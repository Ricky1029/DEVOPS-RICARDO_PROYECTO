// services/prestamoService.ts
// Servicio para manejar toda la lógica de préstamos

import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  getDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Prestamo, SolicitudPrestamoData, EstadoPrestamo } from '../types/prestamo';

/**
 * Crea una nueva solicitud de préstamo
 */
export const crearSolicitudPrestamo = async (
  solicitud: SolicitudPrestamoData,
  usuarioNombre: string,
  usuarioEmail: string,
  equipoNombre: string,
  equipoImagen?: string
): Promise<string> => {
  try {
    // Validar disponibilidad del equipo
    const equipoDisponible = await verificarDisponibilidadEquipo(solicitud.equipoId);
    if (!equipoDisponible) {
      throw new Error('El equipo no está disponible en este momento');
    }

    // Validar límite de préstamos activos del usuario
    const prestamosActivos = await obtenerPrestamosActivosUsuario(solicitud.usuarioId);
    if (prestamosActivos.length >= 3) {
      throw new Error('Has alcanzado el límite de 3 préstamos activos');
    }

    const nuevoPrestamo = {
      ...solicitud,
      usuarioNombre,
      usuarioEmail,
      equipoNombre,
      equipoImagen: equipoImagen || null,
      estado: 'pendiente' as EstadoPrestamo,
      fechaSolicitud: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'prestamos'), nuevoPrestamo);
    
    // Actualizar estado del equipo a "reservado" temporalmente
    await updateDoc(doc(db, 'equipos', solicitud.equipoId), {
      estado: false,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    // Evita log ruidoso en producción, pero conserva el detalle en desarrollo
    if (__DEV__) {
      console.warn('Error al crear solicitud de préstamo:', error);
    }
    const message = error instanceof Error ? error.message : 'No pudimos crear tu solicitud';
    throw new Error(message);
  }
};

/**
 * Obtiene todas las solicitudes pendientes (para admin)
 */
export const obtenerSolicitudesPendientes = async (): Promise<Prestamo[]> => {
  try {
    const q = query(
      collection(db, 'prestamos'),
      where('estado', '==', 'pendiente')
    );
    
    const snapshot = await getDocs(q);
    const prestamos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fechaSolicitud: doc.data().fechaSolicitud?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Prestamo[];
    
    // Ordenar por fecha de solicitud (más reciente primero)
    return prestamos.sort((a, b) => {
      const dateA = a.fechaSolicitud?.getTime() || 0;
      const dateB = b.fechaSolicitud?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    throw error;
  }
};

/**
 * Aprobar una solicitud de préstamo y generar código QR
 */
export const aprobarSolicitudPrestamo = async (
  prestamoId: string,
  adminId: string,
  notas?: string
): Promise<string> => {
  try {
    // Generar código QR único
    const codigoQR = generarCodigoQR(prestamoId);
    
    await updateDoc(doc(db, 'prestamos', prestamoId), {
      estado: 'aprobado',
      aprobadoPor: adminId,
      fechaAprobacion: serverTimestamp(),
      codigoQR,
      notas: notas || null,
      updatedAt: serverTimestamp(),
    });

    return codigoQR;
  } catch (error) {
    console.error('Error al aprobar solicitud:', error);
    throw error;
  }
};

/**
 * Rechazar una solicitud de préstamo
 */
export const rechazarSolicitudPrestamo = async (
  prestamoId: string,
  adminId: string,
  motivoRechazo: string
): Promise<void> => {
  try {
    // Obtener el préstamo para liberar el equipo
    const prestamoDoc = await getDoc(doc(db, 'prestamos', prestamoId));
    const prestamoData = prestamoDoc.data();

    await updateDoc(doc(db, 'prestamos', prestamoId), {
      estado: 'rechazado',
      aprobadoPor: adminId,
      motivoRechazo,
      updatedAt: serverTimestamp(),
    });

    // Liberar el equipo
    if (prestamoData?.equipoId) {
      await updateDoc(doc(db, 'equipos', prestamoData.equipoId), {
        estado: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    throw error;
  }
};

/**
 * Registrar entrega de equipo mediante escaneo de QR
 */
export const registrarEntregaEquipo = async (
  codigoQR: string
): Promise<Prestamo> => {
  try {
    // Buscar préstamo por código QR
    const q = query(
      collection(db, 'prestamos'),
      where('codigoQR', '==', codigoQR),
      where('estado', '==', 'aprobado')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Código QR inválido o préstamo ya procesado');
    }

    const prestamoDoc = snapshot.docs[0];
    const prestamoData = prestamoDoc.data();
    
    // Calcular fecha de devolución
    const fechaPrestamo = new Date();
    const fechaDevolucion = new Date();
    fechaDevolucion.setDate(fechaDevolucion.getDate() + prestamoData.duracionDias);

    await updateDoc(doc(db, 'prestamos', prestamoDoc.id), {
      estado: 'activo',
      fechaPrestamo: Timestamp.fromDate(fechaPrestamo),
      fechaDevolucion: Timestamp.fromDate(fechaDevolucion),
      updatedAt: serverTimestamp(),
    });

    return {
      id: prestamoDoc.id,
      ...prestamoData,
      fechaPrestamo,
      fechaDevolucion,
    } as Prestamo;
  } catch (error) {
    console.error('Error al registrar entrega:', error);
    throw error;
  }
};

/**
 * Registrar devolución de equipo mediante escaneo de QR
 */
export const registrarDevolucionEquipo = async (
  codigoQR: string
): Promise<void> => {
  try {
    const q = query(
      collection(db, 'prestamos'),
      where('codigoQR', '==', codigoQR),
      where('estado', '==', 'activo')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error('Código QR inválido o préstamo no activo');
    }

    const prestamoDoc = snapshot.docs[0];
    const prestamoData = prestamoDoc.data();

    await updateDoc(doc(db, 'prestamos', prestamoDoc.id), {
      estado: 'devuelto',
      fechaDevolucionReal: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Liberar el equipo
    await updateDoc(doc(db, 'equipos', prestamoData.equipoId), {
      estado: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error al registrar devolución:', error);
    throw error;
  }
};

/**
 * Registrar devolución de equipo por ID (flujo usuario desde historial)
 */
export const devolverPrestamoUsuario = async (prestamoId: string): Promise<void> => {
  try {
    const prestamoRef = doc(db, 'prestamos', prestamoId);
    const prestamoDoc = await getDoc(prestamoRef);

    if (!prestamoDoc.exists()) {
      throw new Error('Préstamo no encontrado');
    }

    const prestamoData = prestamoDoc.data();
    const estadoActual = prestamoData.estado as EstadoPrestamo;

    if (estadoActual === 'devuelto') {
      return; // Ya procesado
    }

    if (!['activo', 'aprobado'].includes(estadoActual)) {
      throw new Error('El préstamo no está activo');
    }

    await updateDoc(prestamoRef, {
      estado: 'devuelto',
      fechaDevolucionReal: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (prestamoData.equipoId) {
      await updateDoc(doc(db, 'equipos', prestamoData.equipoId), {
        estado: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error al devolver préstamo:', error);
    throw error instanceof Error ? error : new Error('No pudimos registrar la devolución');
  }
};

/**
 * Obtener préstamos de un usuario
 */
export const obtenerPrestamosUsuario = async (
  usuarioId: string
): Promise<Prestamo[]> => {
  try {
    const q = query(
      collection(db, 'prestamos'),
      where('usuarioId', '==', usuarioId)
    );
    
    const snapshot = await getDocs(q);
    // Ordenar en memoria después de obtener los documentos
    const prestamos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fechaSolicitud: doc.data().fechaSolicitud?.toDate(),
      fechaAprobacion: doc.data().fechaAprobacion?.toDate(),
      fechaPrestamo: doc.data().fechaPrestamo?.toDate(),
      fechaDevolucion: doc.data().fechaDevolucion?.toDate(),
      fechaDevolucionReal: doc.data().fechaDevolucionReal?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Prestamo[];
    
    // Ordenar por fecha de creación (más reciente primero)
    return prestamos.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    // En móviles un console.error dispara pantalla roja; registramos solo en desarrollo
    if (__DEV__) {
      console.warn('Error al obtener préstamos del usuario (fallback a lista vacía):', error);
    }
    return [];
  }
};

/**
 * Obtener préstamos activos de un usuario
 */
export const obtenerPrestamosActivosUsuario = async (
  usuarioId: string
): Promise<Prestamo[]> => {
  try {
    const q = query(
      collection(db, 'prestamos'),
      where('usuarioId', '==', usuarioId),
      where('estado', 'in', ['pendiente', 'aprobado', 'activo'])
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Prestamo[];
  } catch (error) {
    console.error('Error al obtener préstamos activos:', error);
    return [];
  }
};

/**
 * Verificar disponibilidad de un equipo
 */
export const verificarDisponibilidadEquipo = async (
  equipoId: string
): Promise<boolean> => {
  try {
    const equipoDoc = await getDoc(doc(db, 'equipos', equipoId));
    if (!equipoDoc.exists()) {
      return false;
    }
    return equipoDoc.data().estado === true;
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    return false;
  }
};

/**
 * Generar código QR único
 */
const generarCodigoQR = (prestamoId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PRESTAMO-${prestamoId.substring(0, 8).toUpperCase()}-${random}-${timestamp}`;
};

/**
 * Actualizar préstamos vencidos (ejecutar periódicamente)
 */
export const actualizarPrestamosVencidos = async (): Promise<number> => {
  try {
    const ahora = Timestamp.now();
    const q = query(
      collection(db, 'prestamos'),
      where('estado', '==', 'activo'),
      where('fechaDevolucion', '<', ahora)
    );
    
    const snapshot = await getDocs(q);
    
    const updates = snapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        estado: 'vencido',
        updatedAt: serverTimestamp(),
      })
    );
    
    await Promise.all(updates);
    return snapshot.size;
  } catch (error) {
    console.error('Error al actualizar préstamos vencidos:', error);
    return 0;
  }
};
