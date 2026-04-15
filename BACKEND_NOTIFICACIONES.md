# 📱 Sistema de Notificaciones Push - Backend MariaDB

## 📋 Índice
1. [Estructura de Base de Datos](#estructura-de-base-de-datos)
2. [Endpoints Requeridos](#endpoints-requeridos)
3. [Envío de Notificaciones Push](#envío-de-notificaciones-push)
4. [Triggers y Automatización](#triggers-y-automatización)
5. [Ejemplos de Implementación](#ejemplos-de-implementación)

---

## 🗃️ Estructura de Base de Datos

### Tabla: `push_tokens`
Almacena los tokens de notificaciones push de los usuarios.

```sql
CREATE TABLE push_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  push_token VARCHAR(255) NOT NULL UNIQUE,
  plataforma VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
  modelo VARCHAR(100),
  version VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_push_token (push_token)
);
```

### Tabla: `notificaciones`
Almacena el historial de notificaciones enviadas.

```sql
CREATE TABLE notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT FALSE,
  datos JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_leida (leida),
  INDEX idx_created_at (created_at)
);
```

**Tipos de notificación:**
- `solicitud_aprobada`: Solicitud de préstamo aprobada
- `solicitud_rechazada`: Solicitud de préstamo rechazada
- `recordatorio_devolucion`: Recordatorio 1 día antes
- `recordatorio_devolucion_urgente`: Recordatorio el mismo día
- `equipo_disponible`: Equipo que le interesa está disponible
- `prestamo_vencido`: Préstamo no devuelto a tiempo
- `prestamo_proximo_vencer`: Préstamo próximo a vencer (3 días antes)
- `devolucion_confirmada`: Confirmación de devolución exitosa

---

## 🔌 Endpoints Requeridos

### 1. Registrar Token Push
**POST** `/usuarios/push-token`

Registra o actualiza el token push de un usuario.

```javascript
// Ejemplo de body
{
  "usuarioId": 123,
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "dispositivo": {
    "plataforma": "android",
    "modelo": "Pixel 6",
    "version": "13"
  }
}
```

**Implementación:**
```javascript
router.post('/usuarios/push-token', async (req, res) => {
  try {
    const { usuarioId, pushToken, dispositivo } = req.body;
    
    // Insertar o actualizar el token
    const query = `
      INSERT INTO push_tokens 
        (usuario_id, push_token, plataforma, modelo, version) 
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        usuario_id = VALUES(usuario_id),
        plataforma = VALUES(plataforma),
        modelo = VALUES(modelo),
        version = VALUES(version),
        activo = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.query(query, [
      usuarioId,
      pushToken,
      dispositivo.plataforma,
      dispositivo.modelo,
      dispositivo.version
    ]);
    
    res.json({ success: true, message: 'Token registrado' });
  } catch (error) {
    console.error('Error al registrar token:', error);
    res.status(500).json({ error: 'Error al registrar token' });
  }
});
```

---

### 2. Obtener Notificaciones de Usuario
**GET** `/notificaciones/usuario/:usuarioId`

Obtiene todas las notificaciones del usuario.

```javascript
router.get('/notificaciones/usuario/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const limit = req.query.limit || 50;
    
    const query = `
      SELECT * FROM notificaciones 
      WHERE usuario_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    const [notificaciones] = await db.query(query, [usuarioId, parseInt(limit)]);
    
    res.json(notificaciones);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});
```

---

### 3. Marcar Notificación como Leída
**PATCH** `/notificaciones/:id/leer`

```javascript
router.patch('/notificaciones/:id/leer', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      'UPDATE notificaciones SET leida = TRUE WHERE id = ?',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al marcar como leída:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});
```

---

### 4. Marcar Todas como Leídas
**PATCH** `/notificaciones/usuario/:usuarioId/leer-todas`

```javascript
router.patch('/notificaciones/usuario/:usuarioId/leer-todas', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    await db.query(
      'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = ? AND leida = FALSE',
      [usuarioId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al marcar todas como leídas:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});
```

---

## 🚀 Envío de Notificaciones Push

### Instalar dependencia
```bash
npm install expo-server-sdk
```

### Función para enviar notificaciones

```javascript
// services/expoPushService.js
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Envía notificaciones push a múltiples usuarios
 */
async function enviarNotificacionesPush(mensajes) {
  // mensajes = [{ to: 'token', title: '', body: '', data: {} }]
  
  // Filtrar solo tokens válidos
  const mensajesValidos = mensajes.filter(msg => 
    Expo.isExpoPushToken(msg.to)
  );
  
  if (mensajesValidos.length === 0) {
    console.log('No hay tokens válidos para enviar');
    return;
  }
  
  // Dividir en chunks (Expo acepta máximo 100 por request)
  const chunks = expo.chunkPushNotifications(mensajesValidos);
  const tickets = [];
  
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error al enviar chunk de notificaciones:', error);
    }
  }
  
  return tickets;
}

/**
 * Obtiene tokens push activos de un usuario
 */
async function obtenerTokensUsuario(db, usuarioId) {
  const [tokens] = await db.query(
    'SELECT push_token FROM push_tokens WHERE usuario_id = ? AND activo = TRUE',
    [usuarioId]
  );
  
  return tokens.map(t => t.push_token);
}

/**
 * Guarda notificación en BD y envía push
 */
async function notificarUsuario(db, usuarioId, tipo, titulo, mensaje, datos = {}) {
  try {
    // 1. Guardar en base de datos
    const [result] = await db.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, datos) 
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, tipo, titulo, mensaje, JSON.stringify(datos)]
    );
    
    // 2. Obtener tokens del usuario
    const tokens = await obtenerTokensUsuario(db, usuarioId);
    
    if (tokens.length === 0) {
      console.log(`Usuario ${usuarioId} no tiene tokens registrados`);
      return;
    }
    
    // 3. Preparar mensajes push
    const mensajes = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: titulo,
      body: mensaje,
      data: { ...datos, notificacionId: result.insertId },
      priority: 'high',
      badge: 1,
    }));
    
    // 4. Enviar notificaciones push
    await enviarNotificacionesPush(mensajes);
    
    console.log(`Notificación enviada a usuario ${usuarioId}: ${tipo}`);
  } catch (error) {
    console.error('Error al notificar usuario:', error);
  }
}

module.exports = {
  enviarNotificacionesPush,
  obtenerTokensUsuario,
  notificarUsuario,
};
```

---

## ⚡ Triggers y Automatización

### Ejemplo 1: Notificar cuando se aprueba un préstamo

```javascript
router.patch('/prestamos/:id/aprobar', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    // Obtener datos del préstamo
    const [prestamo] = await db.query(
      'SELECT * FROM prestamos WHERE id = ?',
      [id]
    );
    
    if (!prestamo || prestamo.length === 0) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    const p = prestamo[0];
    
    // Actualizar estado del préstamo
    await db.query(
      `UPDATE prestamos 
       SET estado = 'aprobado', aprobado_por = ?, fecha_aprobacion = NOW() 
       WHERE id = ?`,
      [adminId, id]
    );
    
    // 🔔 ENVIAR NOTIFICACIÓN
    await notificarUsuario(
      db,
      p.usuario_id,
      'solicitud_aprobada',
      '✅ Solicitud Aprobada',
      `Tu solicitud para "${p.equipo_nombre}" ha sido aprobada. Puedes recogerlo pronto.`,
      {
        prestamoId: id,
        equipoId: p.equipo_id,
        equipoNombre: p.equipo_nombre,
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al aprobar préstamo:', error);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});
```

### Ejemplo 2: Notificar cuando se rechaza

```javascript
router.patch('/prestamos/:id/rechazar', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId, motivo } = req.body;
    
    const [prestamo] = await db.query(
      'SELECT * FROM prestamos WHERE id = ?',
      [id]
    );
    
    if (!prestamo || prestamo.length === 0) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    const p = prestamo[0];
    
    await db.query(
      `UPDATE prestamos 
       SET estado = 'rechazado', motivo_rechazo = ? 
       WHERE id = ?`,
      [motivo, id]
    );
    
    // 🔔 ENVIAR NOTIFICACIÓN
    await notificarUsuario(
      db,
      p.usuario_id,
      'solicitud_rechazada',
      '❌ Solicitud Rechazada',
      `Tu solicitud para "${p.equipo_nombre}" fue rechazada. ${motivo || ''}`,
      {
        prestamoId: id,
        equipoId: p.equipo_id,
        motivo: motivo,
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al rechazar préstamo:', error);
    res.status(500).json({ error: 'Error al rechazar' });
  }
});
```

### Ejemplo 3: Recordatorios automáticos (Cron Job)

Crea un job que se ejecute diariamente:

```javascript
// jobs/recordatoriosPrestamos.js
const cron = require('node-cron');
const { notificarUsuario } = require('../services/expoPushService');

/**
 * Cron job que se ejecuta todos los días a las 9:00 AM
 * Envía recordatorios de devolución
 */
function iniciarRecordatorios(db) {
  // Ejecutar todos los días a las 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('Ejecutando recordatorios de préstamos...');
      
      // 1. Préstamos que vencen mañana (recordatorio 1 día antes)
      const [prestamosManana] = await db.query(`
        SELECT * FROM prestamos 
        WHERE estado = 'activo' 
        AND DATE(fecha_devolucion) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      `);
      
      for (const prestamo of prestamosManana) {
        await notificarUsuario(
          db,
          prestamo.usuario_id,
          'recordatorio_devolucion',
          '⏰ Recordatorio de Devolución',
          `Recuerda devolver "${prestamo.equipo_nombre}" mañana antes de las 12:00 PM.`,
          {
            prestamoId: prestamo.id,
            equipoNombre: prestamo.equipo_nombre,
            fechaDevolucion: prestamo.fecha_devolucion,
          }
        );
      }
      
      // 2. Préstamos que vencen hoy (urgente)
      const [prestamosHoy] = await db.query(`
        SELECT * FROM prestamos 
        WHERE estado = 'activo' 
        AND DATE(fecha_devolucion) = CURDATE()
      `);
      
      for (const prestamo of prestamosHoy) {
        await notificarUsuario(
          db,
          prestamo.usuario_id,
          'recordatorio_devolucion_urgente',
          '🚨 Devolución HOY',
          `¡Debes devolver "${prestamo.equipo_nombre}" HOY! No olvides hacerlo.`,
          {
            prestamoId: prestamo.id,
            equipoNombre: prestamo.equipo_nombre,
            fechaDevolucion: prestamo.fecha_devolucion,
          }
        );
      }
      
      // 3. Préstamos vencidos (no devueltos)
      const [prestamosVencidos] = await db.query(`
        SELECT * FROM prestamos 
        WHERE estado = 'activo' 
        AND DATE(fecha_devolucion) < CURDATE()
      `);
      
      for (const prestamo of prestamosVencidos) {
        // Actualizar estado a vencido
        await db.query(
          'UPDATE prestamos SET estado = "vencido" WHERE id = ?',
          [prestamo.id]
        );
        
        await notificarUsuario(
          db,
          prestamo.usuario_id,
          'prestamo_vencido',
          '⚠️ Préstamo Vencido',
          `El préstamo de "${prestamo.equipo_nombre}" está vencido. Por favor devuélvelo lo antes posible.`,
          {
            prestamoId: prestamo.id,
            equipoNombre: prestamo.equipo_nombre,
          }
        );
      }
      
      console.log(`Recordatorios enviados: ${prestamosManana.length + prestamosHoy.length + prestamosVencidos.length}`);
    } catch (error) {
      console.error('Error en cron de recordatorios:', error);
    }
  });
  
  console.log('✓ Cron de recordatorios iniciado');
}

module.exports = { iniciarRecordatorios };
```

### Iniciar el cron en tu servidor:

```javascript
// server.js o app.js
const { iniciarRecordatorios } = require('./jobs/recordatoriosPrestamos');

// Después de configurar express y conectar a la BD
iniciarRecordatorios(db);
```

---

## 📦 Instalación de dependencias del backend

```bash
npm install expo-server-sdk node-cron
```

---

## ✅ Checklist de Implementación

- [ ] Crear tablas `push_tokens` y `notificaciones`
- [ ] Implementar endpoint POST `/usuarios/push-token`
- [ ] Implementar endpoint GET `/notificaciones/usuario/:usuarioId`
- [ ] Implementar endpoint PATCH `/notificaciones/:id/leer`
- [ ] Implementar endpoint PATCH `/notificaciones/usuario/:usuarioId/leer-todas`
- [ ] Instalar `expo-server-sdk`
- [ ] Crear servicio `expoPushService.js`
- [ ] Integrar notificaciones en aprobación de préstamos
- [ ] Integrar notificaciones en rechazo de préstamos
- [ ] Integrar notificaciones en devolución de equipos
- [ ] Configurar cron job para recordatorios
- [ ] Probar envío de notificaciones

---

## 🧪 Prueba Manual

Puedes probar el envío de notificaciones con este script:

```javascript
const { notificarUsuario } = require('./services/expoPushService');

// Reemplaza con un usuario real de tu BD
notificarUsuario(
  db,
  1, // usuario_id
  'solicitud_aprobada',
  'Prueba de Notificación',
  'Si ves esto, ¡las notificaciones funcionan!',
  { test: true }
);
```

---

¿Necesitas ayuda con alguna parte específica? 🚀
