
import enum
import threading
import time as time_module
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional

from database import Base, engine, get_db
from exponent_server_sdk import (DeviceNotRegisteredError, PushClient,
                                 PushMessage, PushServerError)
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import (JSON, TIMESTAMP, Boolean, Column, Date, Enum,
                        ForeignKey, Integer, String, Text, func, text)
from sqlalchemy.orm import Session, relationship

# Esto asegura que las tablas se creen si no existen
Base.metadata.create_all(bind=engine)


# Clase de manejo estado de articulos
class EstadoArticulo(enum.Enum):
	agotado = "agotado"
	disponible = "disponible"

# Clase de manejo estado de prestamos
class EstadoPrestamo(enum.Enum):
	aceptado = "aceptado"
	denegado = "denegado"
	espera = "espera"
	activo = "activo"
	devuelto = "devuelto"
	vencido = "vencido"

# Modelo de SQLAlchemy para la DB
class UsuarioDB(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255))
    nombre = Column(String(50))
    apellido = Column(String(50))
    rol = Column(String(50))
    telefono = Column(String(50))
    matricula = Column(String(50))
    carrera = Column(String(50))
    created_at = Column(TIMESTAMP)
    password = Column(String(255))
    ubicacion = Column(String(255))

    prestamos = relationship('PrestamosDB',back_populates='usuario')

# Clase para manejar el put (update) de usuario
class UsuarioUpdate(BaseModel):
    password: Optional[str] = None
    telefono: Optional[str] = None
    ubicacion: Optional[str] = None

# Clase para la tabla de prestamos
class PrestamosDB(Base):
    __tablename__="prestamos"
    id = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey('usuarios.id'))
    id_articulo = Column(Integer, ForeignKey('articulos.id'))
    fecha_inicio = Column(Date)
    fecha_fin = Column(Date)
    fecha_solicitud = Column(Date)
    fecha_aprobacion = Column(Date)
    nota = Column(String(255))
    proposito = Column(String(255))
    estado = Column(Enum(EstadoPrestamo, name="estado_prestamo_enum"), nullable=False)
    qr = Column(String(255))
    usuario = relationship('UsuarioDB', back_populates='prestamos')
    articulo = relationship('ArticulosDB', back_populates='prestamos')

#Clase para la tabla de equipos
class ArticulosDB(Base):
    __tablename__ = "articulos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200))
    categoria = Column(String())
    marca = Column(String(100))
    modelo = Column(String(100))
    serie = Column(String(100))
    estado = Column(Enum(EstadoArticulo))
    ubicacion = Column(String(255))
    cantidad = Column(Integer)
    foto = Column(String(255))
    especificaciones = Column(String(255))
    prestamos = relationship('PrestamosDB', back_populates='articulo')

# Clase para la tabla de push tokens
class PushTokenDB(Base):
    __tablename__ = "push_tokens"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    push_token = Column(String(255), nullable=False, unique=True)
    plataforma = Column(String(20), nullable=False)  # 'ios', 'android', 'web'
    modelo = Column(String(100))
    version = Column(String(50))
    activo = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, default=datetime.now)
    updated_at = Column(TIMESTAMP, default=datetime.now, onupdate=datetime.now)
    usuario = relationship('UsuarioDB')

# Clase para la tabla de notificaciones
class NotificacionesDB(Base):
    __tablename__ = "notificaciones"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False)
    tipo = Column(String(50), nullable=False)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False)
    leida = Column(Boolean, default=False)
    datos = Column(JSON)
    created_at = Column(TIMESTAMP, default=datetime.now)
    usuario = relationship('UsuarioDB')

# Esquema de Pydantic para recibir datos de usuarios
class UsuarioCreate(BaseModel):
    email: str
    rol: str
    created_at: str
    password: str
    nombre: str
    apellido: str
    matricula: str
    telefono: Optional[str] = None
    carrera: Optional[str] = None

# Esquema de Pydantic para recibir datos de articulos
class ArticuloCreate(BaseModel):
	nombre: str
	categoria: str
	marca: str
	modelo: str
	serie: str
	estado: str
	ubicacion: str
	cantidad: int
	foto: str
	especificaciones: str

# Esquema de Pydantic para actualizar articulos
class ArticuloUpdate(BaseModel):
	nombre: Optional[str] = None
	categoria: Optional[str] = None
	marca: Optional[str] = None
	modelo: Optional[str] = None
	serie: Optional[str] = None
	estado: Optional[str] = None
	ubicacion: Optional[str] = None
	cantidad: Optional[int] = None
	foto: Optional[str] = None
	especificaciones: Optional[str] = None

# Esquema de Pydantic para recibir datos para prestamos
class PrestamoCreate(BaseModel):
	id_usuario: int
	id_articulo: int
	fecha_inicio: str
	fecha_fin: str
	fecha_solicitud: str
	fecha_aprobacion: Optional[str] = None
	nota: str
	proposito: str
	estado: str
	qr: str

# Esquema de Pydantic para actualizar prestamos (solicitudes)
class PrestamoUpdate(BaseModel):
	id: int
	estado: str
	fecha_aprobacion: str

# Esquema de Pydantic para registrar push token
class PushTokenCreate(BaseModel):
	usuarioId: int
	pushToken: str
	dispositivo: dict  # {"plataforma": "android", "modelo": "Pixel 6", "version": "13"}

# Esquema de Pydantic para crear notificacion
class NotificacionCreate(BaseModel):
	usuario_id: int
	tipo: str
	titulo: str
	mensaje: str
	datos: Optional[Dict[str, Any]] = None

# Esquema de Pydantic para aprobar prestamo
class PrestamoAprobar(BaseModel):
	adminId: str
	notas: Optional[str] = None

# Esquema de Pydantic para rechazar prestamo
class PrestamoRechazar(BaseModel):
	adminId: str
	motivoRechazo: str

# Esquema de Pydantic para entregar equipo
class PrestamoEntregar(BaseModel):
	codigoQR: str

# Esquema de Pydantic para devolver equipo
class PrestamoDevolver(BaseModel):
	codigoQR: str

app = FastAPI()

# Sepa que del CORS
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# SECCION DE USUARIOS

@app.post("/usuarios/crear")
def crear_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    nuevo_usuario = UsuarioDB(
        nombre=usuario.nombre, 
        apellido=usuario.apellido, 
        matricula=usuario.matricula, 
        email=usuario.email, 
        rol=usuario.rol, 
        telefono=usuario.telefono,
        carrera=usuario.carrera,
        password=usuario.password, 
        created_at=usuario.created_at
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return {"id": nuevo_usuario.id}

@app.get("/usuarios")
def obtener_usuarios(db: Session = Depends(get_db)):
	usuarios = db.query(UsuarioDB).all()

	if not usuarios:
		return {"error":"No hay usuarios"}

	return [{"ID":u.id, "Email":u.email, "Nombre":u.nombre, "Apellido":u.apellido, "Telefono":u.telefono, "Rol":u.rol, "Matricula":u.matricula, "Carrera":u.carrera, "Activo":True} for u in usuarios]

@app.get("/usuarios/email/{email}")
def obtener_usuario_por_correo(email, db: Session = Depends(get_db)):
	usuario = db.query(UsuarioDB).filter(UsuarioDB.email == email).first()

	if not usuario:
		return {"error":"No hay usuario con ese correo"}

	return usuario

@app.get("/usuarios/id/{id}")
def obtener_usuario(id: int, db: Session = Depends(get_db)):
	usuario = db.query(UsuarioDB).filter(UsuarioDB.id == id).first()

	if not usuario:
		return {"error":"Usuario no existe"}

	return usuario

@app.put("/usuarios/modificar/{id}") # Modificar contraseña (solo admin)
def modificar_password(id: int, data: UsuarioUpdate, db: Session = Depends(get_db)):
	usuario = db.query(UsuarioDB).filter(UsuarioDB.id == id).first()

	if not usuario:
		return {"Error":"Usuario no encontrado"}

	for key, value in data.dict(exclude_unset=True).items():
		setattr(usuario, key, value)

	db.commit()
	db.refresh(usuario)
	return usuario


@app.put("/usuarios/modificar/ubicacion/{id}") # Modificar ubicacion
def modificar_ubicacion(id: int, ubicacion: UsuarioUpdate, db: Session = Depends(get_db)):
	usuario = db.query(UsuarioDB).filter(UsuarioDB.id == id).first()

	if not usuario:
		return {"Error":"Usuario no encontrado"}

	for key, value in ubicacion.dict(exclude_unset=True).items():
		setattr(usuario, key, value)

	db.commit()
	db.refresh(usuario)
	return usuario

@app.delete("/usuarios/eliminar/{id}") # Eliminar usuario
def eliminar_usuario(id: int, db: Session = Depends(get_db)):
	usuario = db.query(UsuarioDB).filter(UsuarioDB.id == id).first()

	if not usuario:
		return {"error": "Usuario no encontrado"}

	db.delete(usuario)
	db.commit()
	return {"message": "Usuario eliminado correctamente"}

# SECCION DE ARTICULOS

@app.get("/articulos") # Todos
def obtener_articulos(db: Session = Depends(get_db)):
	articulos = db.query(ArticulosDB).all()

	if not articulos:
		return {"error":"No hay articulos"}

	return [{"ID":a.id, "Nombre":a.nombre, "Categoria":a.categoria, "Marca":a.marca,
		"Modelo":a.modelo, "Serie":a.serie, "Estado":a.estado, "Ubicacion":a.ubicacion,
		"Cantidad":a.cantidad, "Foto":a.foto, "Especificaciones": a.especificaciones
		} for a in articulos]

@app.get("/articulos/id/{id}") # Por ID
def obtener_articulo(id: int, db: Session = Depends(get_db)):
	articulo = db.query(ArticulosDB).filter(ArticulosDB.id == id).first()

	if not articulo:
		return {"error":"Articulo inexistente"}

	return articulo

@app.get("/articulos/estado/{estado}") # Por Estado
def obtener_articulos_por_estado(estado: EstadoArticulo,db: Session = Depends(get_db)):
	articulos = db.query(ArticulosDB).filter(ArticulosDB.estado == estado).all()

	if not articulos:
		return {"error": "No hay articulos con ese estado"}

	return [{"ID":a.id, "Nombre":a.nombre, "Categoria":a.categoria, "Marca":a.marca,
		"Modelo":a.modelo, "Serie":a.serie, "Estado":a.estado, "Ubicacion":a.ubicacion,
		"Cantidad":a.cantidad, "Foto":a.foto, "Especificaciones": a.especificaciones
		} for a in articulos]

@app.post("/articulos/crear") # crear articulo
def crear_articulo(articulo: ArticuloCreate, db: Session = Depends(get_db)):
	nuevo_articulo = ArticulosDB(
		nombre=articulo.nombre, categoria=articulo.categoria, marca=articulo.marca, modelo=articulo.modelo, serie=articulo.serie, estado=articulo.estado, ubicacion=articulo.ubicacion, cantidad=articulo.cantidad, foto=articulo.foto, especificaciones=articulo.especificaciones
	)
	db.add(nuevo_articulo)
	db.commit()
	db.refresh(nuevo_articulo)
	return nuevo_articulo

@app.put("/articulos/modificar/{id}") # Modificar articulo
def modificar_articulo(id: int, data: ArticuloUpdate, db: Session = Depends(get_db)):
	articulo = db.query(ArticulosDB).filter(ArticulosDB.id == id).first()

	if not articulo:
		return JSONResponse(
			status_code=404,
			content={"error": "Artículo no encontrado"}
		)

	for key, value in data.dict(exclude_unset=True).items():
		setattr(articulo, key, value)

	db.commit()
	db.refresh(articulo)
	return articulo

@app.delete("/articulos/eliminar/{id}") # Eliminar articulo
def eliminar_articulo(id: int, db: Session = Depends(get_db)):
	articulo = db.query(ArticulosDB).filter(ArticulosDB.id == id).first()

	if not articulo:
		return {"error": "Articulo no encontrado"}

	db.delete(articulo)
	db.commit()
	return {"message": "Articulo eliminado correctamente"}

# SECCION DE PRESTAMOS
@app.get("/prestamos") # Todos
def obtener_prestamos(db: Session = Depends(get_db)):
	prestamos = db.query(PrestamosDB).all()

	if not prestamos:
		return {"error":"No hay prestamos"}

	return [{"ID":p.id, "ID_Usuario":p.id_usuario, 
		"Email_Usuario":p.usuario.email if p.usuario else "Usuario eliminado", 
		"ID_Articulo":p.id_articulo, "Fecha_Inicio":p.fecha_inicio,
		"Fecha_Fin":p.fecha_fin, "Fecha_Solicitud":p.fecha_solicitud, "Nota":p.nota, "Proposito":p.proposito,
		"Estado":p.estado, "QR":p.qr, 
		"Articulo_Nombre":p.articulo.nombre if p.articulo else "Artículo eliminado"
		} for p in prestamos]

@app.get("/prestamos/id/{id}") # Por ID
def obtener_prestamo(id: int, db: Session = Depends(get_db)):
	prestamo = db.query(PrestamosDB).filter(PrestamosDB.id == id).first()

	if not prestamo:
		return {"error":"No hay prestamo con ese ID"}

	return prestamo

@app.get("/prestamos/usuario/{id_usuario}") # Por ID de usuario
def obtener_prestamos_por_usuario(id_usuario: int, db: Session = Depends(get_db)):
	prestamos = db.query(PrestamosDB).filter(PrestamosDB.id_usuario == id_usuario).all()

	if not prestamos:
		return []

	return [{"ID":p.id, "ID_Usuario":p.id_usuario, 
		"Email_Usuario":p.usuario.email if p.usuario else "Usuario eliminado",
		"ID_Articulo":p.id_articulo, 
		"Articulo_Nombre":p.articulo.nombre if p.articulo else "Artículo eliminado",
		"Fecha_Inicio":p.fecha_inicio,
		"Fecha_Fin":p.fecha_fin, "Fecha_Solicitud":p.fecha_solicitud, 
		"Fecha_Aprobacion":p.fecha_aprobacion,
		"Nota":p.nota, "Proposito":p.proposito,
		"Estado":p.estado.value if hasattr(p.estado, 'value') else p.estado, 
		"QR":p.qr
		} for p in prestamos]


@app.get("/prestamos/estado/{estado}") # Por Estado
def obtener_prestamos_por_estado(estado: EstadoPrestamo, db: Session = Depends(get_db)):
	prestamos = db.query(PrestamosDB).filter(PrestamosDB.estado == estado).all()

	if not prestamos:
		return {"error":"No hay prestamos con ese estado"}

	return [{"ID":p.id, "ID_Usuario":p.id_usuario, "ID_Articulo":p.id_articulo, "Fecha_Inicio":p.fecha_inicio,
		"Fecha_Fin":p.fecha_fin, "Fecha_Solicitud":p.fecha_solicitud, "Nota":p.nota, "Proposito":p.proposito,
		"Estado":p.estado, "QR":p.qr
		} for p in prestamos]

@app.get("/prestamos/dia/{dia}") # Por Dia
def obtener_prestamos_dia_solicitud(dia: date, db: Session = Depends(get_db)):
	prestamos = db.query(PrestamosDB).filter(PrestamosDB.fecha_solicitud == dia).all()

	if not prestamos:
		return {"error":"No hay prestamos ese dia o fecha invalida"}

	return [{"ID":p.id, "ID_Usuario":p.id_usuario, "ID_Articulo":p.id_articulo, "Fecha_Inicio":p.fecha_inicio,
		"Fecha_Fin":p.fecha_fin, "Fecha_Solicitud":p.fecha_solicitud, "Nota":p.nota, "Proposito":p.proposito,
		"Estado":p.estado, "QR":p.qr
		} for p in prestamos]

@app.post("/prestamos/crear")
def crear_prestamo(prestamo: PrestamoCreate, db: Session = Depends(get_db)):
	new_prestamo = PrestamosDB(
	id_usuario = prestamo.id_usuario,
	id_articulo = prestamo.id_articulo,
	fecha_inicio = prestamo.fecha_inicio,
	fecha_fin = prestamo.fecha_fin,
	fecha_solicitud = prestamo.fecha_solicitud,
	fecha_aprobacion = prestamo.fecha_aprobacion,
	nota = prestamo.nota,
	proposito = prestamo.proposito,
	estado = prestamo.estado,
	qr = prestamo.qr
	)

	db.add(new_prestamo)
	db.commit()
	db.refresh(new_prestamo)
	return JSONResponse(
		status_code=201,
		content={"Message":"Prestamo creado correctamente"}
	)

@app.put("/prestamos/uriel/{id}")
def juzgar_prestamo(id: int, data: PrestamoUpdate, db: Session = Depends(get_db)):
	prestamo = db.query(PrestamosDB).filter(PrestamosDB.id == id).first()


	for key, value in data.dict(exclude_unset=True).items():
		setattr(prestamo, key, value)

	db.commit()
	db.refresh(prestamo)
	return prestamo

# =========================
# SERVICIO DE NOTIFICACIONES PUSH
# =========================

def enviar_notificaciones_push(mensajes: List[dict]):
	"""
	Envía notificaciones push usando Expo
	mensajes = [{"to": "token", "title": "", "body": "", "data": {}}]
	"""
	try:
		mensajes_validos = []
		for msg in mensajes:
			token = msg.get("to")
			if token and (token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")):
				mensajes_validos.append(PushMessage(
					to=token,
					title=msg.get("title", ""),
					body=msg.get("body", ""),
					data=msg.get("data", {}),
					sound="default",
					priority="high",
					badge=1
				))
		
		if not mensajes_validos:
			print("No hay tokens válidos para enviar")
			return
		
		# Enviar en chunks de 100
		for i in range(0, len(mensajes_validos), 100):
			chunk = mensajes_validos[i:i+100]
			try:
				PushClient().publish_multiple(chunk)
			except PushServerError as e:
				print(f"Error al enviar chunk de notificaciones: {e}")
			except DeviceNotRegisteredError as e:
				print(f"Token no registrado: {e}")
		
	except Exception as e:
		print(f"Error general en enviar notificaciones: {e}")

def obtener_tokens_usuario(db: Session, usuario_id: int) -> List[str]:
	"""Obtiene tokens push activos de un usuario"""
	tokens = db.query(PushTokenDB.push_token).filter(
		PushTokenDB.usuario_id == usuario_id,
		PushTokenDB.activo == True
	).all()
	return [t[0] for t in tokens]

def notificar_usuario(db: Session, usuario_id: int, tipo: str, titulo: str, mensaje: str, datos: dict = None):
	"""Guarda notificación en BD y envía push"""
	try:
		# 1. Guardar en base de datos
		nueva_notif = NotificacionesDB(
			usuario_id=usuario_id,
			tipo=tipo,
			titulo=titulo,
			mensaje=mensaje,
			datos=datos or {}
		)
		db.add(nueva_notif)
		db.commit()
		db.refresh(nueva_notif)
		
		# 2. Obtener tokens del usuario
		tokens = obtener_tokens_usuario(db, usuario_id)
		
		if not tokens:
			print(f"Usuario {usuario_id} no tiene tokens registrados")
			return
		
		# 3. Preparar y enviar notificaciones push
		mensajes = []
		for token in tokens:
			mensajes.append({
				"to": token,
				"title": titulo,
				"body": mensaje,
				"data": {**(datos or {}), "notificacionId": nueva_notif.id}
			})
		
		enviar_notificaciones_push(mensajes)
		print(f"Notificación enviada a usuario {usuario_id}: {tipo}")
		
	except Exception as e:
		print(f"Error al notificar usuario: {e}")

# =========================
# ENDPOINTS DE PUSH TOKENS
# =========================

@app.post("/usuarios/push-token")
def registrar_push_token(data: PushTokenCreate, db: Session = Depends(get_db)):
	"""Registra o actualiza el token push de un usuario"""
	try:
		# Buscar si ya existe el token
		token_existente = db.query(PushTokenDB).filter(
			PushTokenDB.push_token == data.pushToken
		).first()
		
		if token_existente:
			# Actualizar
			token_existente.usuario_id = data.usuarioId
			token_existente.plataforma = data.dispositivo.get("plataforma", "")
			token_existente.modelo = data.dispositivo.get("modelo", "")
			token_existente.version = data.dispositivo.get("version", "")
			token_existente.activo = True
			token_existente.updated_at = datetime.now()
		else:
			# Crear nuevo
			nuevo_token = PushTokenDB(
				usuario_id=data.usuarioId,
				push_token=data.pushToken,
				plataforma=data.dispositivo.get("plataforma", ""),
				modelo=data.dispositivo.get("modelo", ""),
				version=data.dispositivo.get("version", "")
			)
			db.add(nuevo_token)
		
		db.commit()
		return {"success": True, "message": "Token registrado"}
	
	except Exception as e:
		print(f"Error al registrar token: {e}")
		return JSONResponse(
			status_code=500,
			content={"error": "Error al registrar token"}
		)

# =========================
# ENDPOINTS DE NOTIFICACIONES
# =========================

@app.get("/notificaciones/usuario/{usuario_id}")
def obtener_notificaciones_usuario(usuario_id: int, limit: int = 50, db: Session = Depends(get_db)):
	"""Obtiene todas las notificaciones del usuario"""
	try:
		notificaciones = db.query(NotificacionesDB).filter(
			NotificacionesDB.usuario_id == usuario_id
		).order_by(NotificacionesDB.created_at.desc()).limit(limit).all()
		
		return [{
			"id": n.id,
			"tipo": n.tipo,
			"titulo": n.titulo,
			"mensaje": n.mensaje,
			"leida": n.leida,
			"datos": n.datos,
			"created_at": n.created_at.isoformat() if n.created_at else None
		} for n in notificaciones]
	
	except Exception as e:
		print(f"Error al obtener notificaciones: {e}")
		return JSONResponse(
			status_code=500,
			content={"error": "Error al obtener notificaciones"}
		)

@app.patch("/notificaciones/{id}/leer")
def marcar_notificacion_leida(id: int, db: Session = Depends(get_db)):
	"""Marca una notificación como leída"""
	try:
		notificacion = db.query(NotificacionesDB).filter(NotificacionesDB.id == id).first()
		
		if not notificacion:
			return JSONResponse(
				status_code=404,
				content={"error": "Notificación no encontrada"}
			)
		
		notificacion.leida = True
		db.commit()
		
		return {"success": True}
	
	except Exception as e:
		print(f"Error al marcar como leída: {e}")
		return JSONResponse(
			status_code=500,
			content={"error": "Error al actualizar"}
		)

@app.patch("/notificaciones/usuario/{usuario_id}/leer-todas")
def marcar_todas_leidas(usuario_id: int, db: Session = Depends(get_db)):
	"""Marca todas las notificaciones de un usuario como leídas"""
	try:
		db.query(NotificacionesDB).filter(
			NotificacionesDB.usuario_id == usuario_id,
			NotificacionesDB.leida == False
		).update({"leida": True})
		db.commit()
		
		return {"success": True}
	
	except Exception as e:
		print(f"Error al marcar todas como leídas: {e}")
		return JSONResponse(
			status_code=500,
			content={"error": "Error al actualizar"}
		)

# =========================
# ENDPOINTS DE PRÉSTAMOS CON NOTIFICACIONES
# =========================

@app.post("/prestamos/{id}/aprobar")
def aprobar_prestamo(id: int, data: PrestamoAprobar, db: Session = Depends(get_db)):
	"""Aprueba un préstamo y envía notificación al usuario"""
	try:
		print(f"Aprobando préstamo {id} por admin {data.adminId}")
		
		# Obtener préstamo
		prestamo = db.query(PrestamosDB).filter(PrestamosDB.id == id).first()
		
		if not prestamo:
			print(f"Préstamo {id} no encontrado")
			return JSONResponse(
				status_code=404,
				content={"error": "Préstamo no encontrado"}
			)
		
		# Obtener artículo
		articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
		nombre_articulo = articulo.nombre if articulo else "Equipo"
		
		# Generar código QR
		codigo_qr = f"PRESTAMO-{id}-{int(datetime.now().timestamp())}"
		print(f"Código QR generado: {codigo_qr}")
		
		# Actualizar préstamo
		prestamo.estado = EstadoPrestamo.aceptado
		prestamo.qr = codigo_qr
		prestamo.fecha_aprobacion = date.today()
		if data.notas:
			prestamo.nota = data.notas
		db.commit()
		db.refresh(prestamo)
		print(f"Préstamo {id} actualizado a estado aceptado")
		
		# Enviar notificación
		print(f"Enviando notificación al usuario {prestamo.id_usuario}")
		notificar_usuario(
			db,
			prestamo.id_usuario,
			"solicitud_aprobada",
			"✅ Solicitud Aprobada",
			f'Tu solicitud para "{nombre_articulo}" ha sido aprobada. Puedes recogerlo pronto.',
			{
				"prestamoId": id,
				"equipoId": prestamo.id_articulo,
				"equipoNombre": nombre_articulo,
				"codigoQR": codigo_qr,
				"screen": "history"
			}
		)
		print(f"Notificación enviada exitosamente")
		
		return {"success": True, "codigoQR": codigo_qr}
	
	except Exception as e:
		print(f"Error al aprobar préstamo: {e}")
		import traceback
		traceback.print_exc()
		return JSONResponse(
			status_code=500,
			content={"error": "Error al aprobar préstamo", "message": str(e)}
		)

@app.post("/prestamos/{id}/rechazar")
def rechazar_prestamo(id: int, data: PrestamoRechazar, db: Session = Depends(get_db)):
	"""Rechaza un préstamo y envía notificación al usuario"""
	try:
		print(f"Rechazando préstamo {id} por admin {data.adminId}")
		print(f"Motivo: {data.motivoRechazo}")
		
		if not data.motivoRechazo or not data.motivoRechazo.strip():
			return JSONResponse(
				status_code=400,
				content={"error": "El motivo de rechazo es requerido"}
			)
		
		# Obtener préstamo
		prestamo = db.query(PrestamosDB).filter(PrestamosDB.id == id).first()
		
		if not prestamo:
			print(f"Préstamo {id} no encontrado")
			return JSONResponse(
				status_code=404,
				content={"error": "Préstamo no encontrado"}
			)
		
		# Obtener artículo
		articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
		nombre_articulo = articulo.nombre if articulo else "Equipo"
		
		# Actualizar préstamo
		prestamo.estado = EstadoPrestamo.denegado
		prestamo.nota = data.motivoRechazo
		prestamo.fecha_aprobacion = date.today()
		db.commit()
		db.refresh(prestamo)
		print(f"Préstamo {id} actualizado a estado denegado")
		
		# Enviar notificación
		print(f"Enviando notificación al usuario {prestamo.id_usuario}")
		notificar_usuario(
			db,
			prestamo.id_usuario,
			"solicitud_rechazada",
			"❌ Solicitud Rechazada",
			f'Tu solicitud para "{nombre_articulo}" fue rechazada. {data.motivoRechazo}',
			{
				"prestamoId": id,
				"equipoId": prestamo.id_articulo,
				"motivo": data.motivoRechazo,
				"screen": "history"
			}
		)
		print(f"Notificación enviada exitosamente")
		
		return {"success": True}
	
	except Exception as e:
		print(f"Error al rechazar préstamo: {e}")
		import traceback
		traceback.print_exc()
		return JSONResponse(
			status_code=500,
			content={"error": "Error al rechazar préstamo", "message": str(e)}
		)

# =========================
# CRON JOB PARA RECORDATORIOS
# =========================

def cron_recordatorios_prestamos():
	"""Cron job que envía recordatorios de devolución"""
	while True:
		try:
			# Esperar 24 horas (86400 segundos)
			time_module.sleep(86400)
			
			# Obtener sesión de BD
			db = next(get_db())
			
			print("Ejecutando recordatorios de préstamos...")
			
			# Calcular fechas
			from datetime import timedelta
			hoy = date.today()
			manana = hoy + timedelta(days=1)
			
			# 1. Préstamos que vencen mañana
			prestamos_manana = db.query(PrestamosDB).filter(
				PrestamosDB.estado == EstadoPrestamo.aceptado,
				PrestamosDB.fecha_fin == manana
			).all()
			
			for prestamo in prestamos_manana:
				articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
				nombre_articulo = articulo.nombre if articulo else "Equipo"
				
				notificar_usuario(
					db,
					prestamo.id_usuario,
					"recordatorio_devolucion",
					"⏰ Recordatorio de Devolución",
					f'Recuerda devolver "{nombre_articulo}" mañana antes de las 12:00 PM.',
					{
						"prestamoId": prestamo.id,
						"equipoNombre": nombre_articulo,
						"fechaDevolucion": prestamo.fecha_fin.isoformat() if prestamo.fecha_fin else None
					}
				)
			
			# 2. Préstamos que vencen hoy
			prestamos_hoy = db.query(PrestamosDB).filter(
				PrestamosDB.estado == EstadoPrestamo.aceptado,
				PrestamosDB.fecha_fin == hoy
			).all()
			
			for prestamo in prestamos_hoy:
				articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
				nombre_articulo = articulo.nombre if articulo else "Equipo"
				
				notificar_usuario(
					db,
					prestamo.id_usuario,
					"recordatorio_devolucion_urgente",
					"🚨 Devolución HOY",
					f'¡Debes devolver "{nombre_articulo}" HOY! No olvides hacerlo.',
					{
						"prestamoId": prestamo.id,
						"equipoNombre": nombre_articulo,
						"fechaDevolucion": prestamo.fecha_fin.isoformat() if prestamo.fecha_fin else None
					}
				)
			
			# 3. Préstamos vencidos
			prestamos_vencidos = db.query(PrestamosDB).filter(
				PrestamosDB.estado == EstadoPrestamo.aceptado,
				PrestamosDB.fecha_fin < hoy
			).all()
			
			for prestamo in prestamos_vencidos:
				articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
				nombre_articulo = articulo.nombre if articulo else "Equipo"
				
				notificar_usuario(
					db,
					prestamo.id_usuario,
					"prestamo_vencido",
					"⚠️ Préstamo Vencido",
					f'El préstamo de "{nombre_articulo}" está vencido. Por favor devuélvelo lo antes posible.',
					{
						"prestamoId": prestamo.id,
						"equipoNombre": nombre_articulo
					}
				)
			
			print(f"Recordatorios enviados: {len(prestamos_manana) + len(prestamos_hoy) + len(prestamos_vencidos)}")
			
		except Exception as e:
			print(f"Error en cron de recordatorios: {e}")

# =========================
# ENDPOINTS DE ENTREGA Y DEVOLUCIÓN CON QR
# =========================

@app.post("/prestamos/entregar")
def entregar_equipo(data: PrestamoEntregar, db: Session = Depends(get_db)):
	"""Registra la entrega de equipo mediante escaneo de QR"""
	try:
		print(f"Registrando entrega con QR: {data.codigoQR}")
		
		# Buscar préstamo por código QR en estado 'aceptado'
		prestamo = db.query(PrestamosDB).filter(
			PrestamosDB.qr == data.codigoQR,
			PrestamosDB.estado == EstadoPrestamo.aceptado
		).first()
		
		if not prestamo:
			print(f"Préstamo no encontrado o ya procesado")
			return JSONResponse(
				status_code=404,
				content={"error": "Código QR inválido o préstamo ya procesado"}
			)
		
		# Obtener artículo
		articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
		nombre_articulo = articulo.nombre if articulo else "Equipo"
		
		# Actualizar estado a 'activo'
		prestamo.estado = EstadoPrestamo.activo
		prestamo.fecha_inicio = date.today()
		db.commit()
		db.refresh(prestamo)
		print(f"Préstamo {prestamo.id} actualizado a estado activo")
		
		# Enviar notificación al usuario
		print(f"Enviando notificación al usuario {prestamo.id_usuario}")
		notificar_usuario(
			db,
			prestamo.id_usuario,
			"equipo_entregado",
			"📦 Equipo Entregado",
			f'Has recibido "{nombre_articulo}". Recuerda devolverlo antes del {prestamo.fecha_fin.strftime("%d/%m/%Y")}.',
			{
				"prestamoId": prestamo.id,
				"equipoId": prestamo.id_articulo,
				"equipoNombre": nombre_articulo,
				"fechaDevolucion": prestamo.fecha_fin.isoformat() if prestamo.fecha_fin else None,
				"screen": "history"
			}
		)
		print(f"Entrega registrada exitosamente")
		
		return {
			"success": True,
			"prestamoId": prestamo.id,
			"equipoNombre": nombre_articulo,
			"fechaDevolucion": prestamo.fecha_fin.isoformat() if prestamo.fecha_fin else None
		}
	
	except Exception as e:
		print(f"Error al registrar entrega: {e}")
		import traceback
		traceback.print_exc()
		return JSONResponse(
			status_code=500,
			content={"error": "Error al registrar entrega", "message": str(e)}
		)

@app.post("/prestamos/devolver")
def devolver_equipo(data: PrestamoDevolver, db: Session = Depends(get_db)):
	"""Registra la devolución de equipo mediante escaneo de QR"""
	try:
		print(f"Registrando devolución con QR: {data.codigoQR}")
		
		# Buscar préstamo por código QR en estado 'activo'
		prestamo = db.query(PrestamosDB).filter(
			PrestamosDB.qr == data.codigoQR,
			PrestamosDB.estado == EstadoPrestamo.activo
		).first()
		
		if not prestamo:
			print(f"Préstamo no encontrado o no está activo")
			return JSONResponse(
				status_code=404,
				content={"error": "Código QR inválido o préstamo no activo"}
			)
		
		# Obtener artículo
		articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
		nombre_articulo = articulo.nombre if articulo else "Equipo"
		
		# Calcular si fue devuelto a tiempo
		hoy = date.today()
		devolucion_tardia = hoy > prestamo.fecha_fin if prestamo.fecha_fin else False
		
		# Actualizar estado a 'devuelto'
		prestamo.estado = EstadoPrestamo.devuelto
		db.commit()
		db.refresh(prestamo)
		print(f"Préstamo {prestamo.id} actualizado a estado devuelto")
		
		# Marcar artículo como disponible nuevamente
		if articulo:
			articulo.estado = EstadoArticulo.disponible
			db.commit()
			print(f"Artículo {articulo.id} marcado como disponible")
		
		# Enviar notificación al usuario
		print(f"Enviando notificación al usuario {prestamo.id_usuario}")
		mensaje_titulo = "✅ Devolución Confirmada" if not devolucion_tardia else "⚠️ Devolución Tardía Registrada"
		mensaje_body = f'Has devuelto "{nombre_articulo}" correctamente.' if not devolucion_tardia else f'Se registró la devolución de "{nombre_articulo}". La devolución fue tardía.'
		
		notificar_usuario(
			db,
			prestamo.id_usuario,
			"equipo_devuelto",
			mensaje_titulo,
			mensaje_body,
			{
				"prestamoId": prestamo.id,
				"equipoId": prestamo.id_articulo,
				"equipoNombre": nombre_articulo,
				"devolucionTardia": devolucion_tardia,
				"screen": "history"
			}
		)
		print(f"Devolución registrada exitosamente")
		
		return {
			"success": True,
			"prestamoId": prestamo.id,
			"equipoNombre": nombre_articulo,
			"devolucionTardia": devolucion_tardia
		}
	
	except Exception as e:
		print(f"Error al registrar devolución: {e}")
		import traceback
		traceback.print_exc()
		return JSONResponse(
			status_code=500,
			content={"error": "Error al registrar devolución", "message": str(e)}
		)

@app.get("/prestamos/qr/{codigo_qr}")
def obtener_prestamo_por_qr(codigo_qr: str, db: Session = Depends(get_db)):
	"""Obtiene información de un préstamo por código QR"""
	try:
		prestamo = db.query(PrestamosDB).filter(PrestamosDB.qr == codigo_qr).first()
		
		if not prestamo:
			return JSONResponse(
				status_code=404,
				content={"error": "Préstamo no encontrado"}
			)
		
		# Obtener información del artículo y usuario
		articulo = db.query(ArticulosDB).filter(ArticulosDB.id == prestamo.id_articulo).first()
		usuario = db.query(UsuarioDB).filter(UsuarioDB.id == prestamo.id_usuario).first()
		
		return {
			"ID": prestamo.id,
			"ID_Usuario": prestamo.id_usuario,
			"Email_Usuario": usuario.email if usuario else None,
			"Nombre_Usuario": f"{usuario.nombre} {usuario.apellido}" if usuario else None,
			"ID_Articulo": prestamo.id_articulo,
			"Articulo_Nombre": articulo.nombre if articulo else None,
			"Fecha_Inicio": prestamo.fecha_inicio,
			"Fecha_Fin": prestamo.fecha_fin,
			"Fecha_Solicitud": prestamo.fecha_solicitud,
			"Fecha_Aprobacion": prestamo.fecha_aprobacion,
			"Nota": prestamo.nota,
			"Proposito": prestamo.proposito,
			"Estado": prestamo.estado.value,
			"QR": prestamo.qr
		}
	
	except Exception as e:
		print(f"Error al obtener préstamo por QR: {e}")
		return JSONResponse(
			status_code=500,
			content={"error": "Error al obtener préstamo"}
		)

# Iniciar cron en un hilo separado
def iniciar_cron():
	thread = threading.Thread(target=cron_recordatorios_prestamos, daemon=True)
	thread.start()
	print("✓ Cron de recordatorios iniciado")

# Iniciar el cron al arrancar la app
iniciar_cron()
