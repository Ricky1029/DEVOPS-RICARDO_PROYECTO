# 📋 Endpoints del Backend para Aprobar/Rechazar Préstamos con Notificaciones

## Descripción General

Este documento describe los endpoints necesarios para aprobar y rechazar préstamos desde la aplicación, incluyendo el envío automático de notificaciones push a los usuarios.

---

## 🔌 Endpoints

### 1. Aprobar Préstamo

**POST** `/prestamos/:id/aprobar`

Aprueba una solicitud de préstamo y envía una notificación push al usuario.

#### Parámetros de URL

- `id` (number): ID del préstamo a aprobar

#### Body

```json
{
  "adminId": "string",
  "notas": "string (opcional)"
}
```

#### Implementación en Node.js/Express

```javascript
const { Expo } = require("expo-server-sdk");
const expo = new Expo();

router.post("/prestamos/:id/aprobar", async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const { adminId, notas } = req.body;

    // 1. Obtener información del préstamo
    const [prestamos] = await db.query("SELECT * FROM prestamos WHERE id = ?", [
      prestamoId,
    ]);

    if (prestamos.length === 0) {
      return res.status(404).json({ error: "Préstamo no encontrado" });
    }

    const prestamo = prestamos[0];

    // 2. Generar código QR único
    const codigoQR = `PRESTAMO-${prestamoId}-${Date.now()}`;

    // 3. Actualizar el préstamo
    await db.query(
      `UPDATE prestamos 
       SET Estado = 'aceptado', 
           Codigo_QR = ?, 
           aprobado_por = ?,
           notas = ?,
           Fecha_Aprobacion = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [codigoQR, adminId, notas || null, prestamoId],
    );

    // 4. Obtener el artículo
    const [articulos] = await db.query(
      "SELECT Nombre FROM articulos WHERE Id = ?",
      [prestamo.Articulo_Id],
    );
    const nombreArticulo = articulos[0]?.Nombre || "Equipo";

    // 5. Crear notificación en la base de datos
    const [notifResult] = await db.query(
      `INSERT INTO notificaciones 
       (usuario_id, tipo, titulo, mensaje, datos) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        prestamo.Usuario_Id,
        "solicitud_aprobada",
        "¡Solicitud Aprobada! ✅",
        `Tu solicitud para "${nombreArticulo}" ha sido aprobada. Código QR: ${codigoQR}`,
        JSON.stringify({
          prestamoId,
          codigoQR,
          articuloNombre: nombreArticulo,
          screen: "history",
        }),
      ],
    );

    // 6. Enviar notificación push
    const [tokens] = await db.query(
      `SELECT push_token FROM push_tokens 
       WHERE usuario_id = ? AND activo = TRUE`,
      [prestamo.Usuario_Id],
    );

    if (tokens.length > 0) {
      const messages = tokens.map((token) => ({
        to: token.push_token,
        sound: "default",
        title: "¡Solicitud Aprobada! ✅",
        body: `Tu solicitud para "${nombreArticulo}" ha sido aprobada. Código QR: ${codigoQR}`,
        data: {
          type: "solicitud_aprobada",
          prestamoId,
          codigoQR,
          notificacionId: notifResult.insertId,
          screen: "history",
        },
        badge: 1,
      }));

      // Enviar en chunks de 100 (límite de Expo)
      let chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Error al enviar chunk de notificaciones:", error);
        }
      }
    }

    res.json({
      success: true,
      codigoQR,
      message: "Préstamo aprobado y notificación enviada",
    });
  } catch (error) {
    console.error("Error al aprobar préstamo:", error);
    res.status(500).json({
      error: "Error al aprobar préstamo",
      message: error.message,
    });
  }
});
```

---

### 2. Rechazar Préstamo

**POST** `/prestamos/:id/rechazar`

Rechaza una solicitud de préstamo y envía una notificación push al usuario.

#### Parámetros de URL

- `id` (number): ID del préstamo a rechazar

#### Body

```json
{
  "adminId": "string",
  "motivoRechazo": "string"
}
```

#### Implementación en Node.js/Express

```javascript
router.post("/prestamos/:id/rechazar", async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const { adminId, motivoRechazo } = req.body;

    if (!motivoRechazo || motivoRechazo.trim() === "") {
      return res
        .status(400)
        .json({ error: "El motivo de rechazo es requerido" });
    }

    // 1. Obtener información del préstamo
    const [prestamos] = await db.query("SELECT * FROM prestamos WHERE id = ?", [
      prestamoId,
    ]);

    if (prestamos.length === 0) {
      return res.status(404).json({ error: "Préstamo no encontrado" });
    }

    const prestamo = prestamos[0];

    // 2. Actualizar el préstamo
    await db.query(
      `UPDATE prestamos 
       SET Estado = 'rechazado', 
           aprobado_por = ?,
           motivo_rechazo = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, motivoRechazo, prestamoId],
    );

    // 3. Liberar el artículo (ponerlo disponible nuevamente)
    await db.query(
      `UPDATE articulos 
       SET disponibilidad = TRUE 
       WHERE Id = ?`,
      [prestamo.Articulo_Id],
    );

    // 4. Obtener el artículo
    const [articulos] = await db.query(
      "SELECT Nombre FROM articulos WHERE Id = ?",
      [prestamo.Articulo_Id],
    );
    const nombreArticulo = articulos[0]?.Nombre || "Equipo";

    // 5. Crear notificación en la base de datos
    const [notifResult] = await db.query(
      `INSERT INTO notificaciones 
       (usuario_id, tipo, titulo, mensaje, datos) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        prestamo.Usuario_Id,
        "solicitud_rechazada",
        "Solicitud Rechazada ❌",
        `Tu solicitud para "${nombreArticulo}" ha sido rechazada. Motivo: ${motivoRechazo}`,
        JSON.stringify({
          prestamoId,
          articuloNombre: nombreArticulo,
          motivoRechazo,
          screen: "history",
        }),
      ],
    );

    // 6. Enviar notificación push
    const [tokens] = await db.query(
      `SELECT push_token FROM push_tokens 
       WHERE usuario_id = ? AND activo = TRUE`,
      [prestamo.Usuario_Id],
    );

    if (tokens.length > 0) {
      const messages = tokens.map((token) => ({
        to: token.push_token,
        sound: "default",
        title: "Solicitud Rechazada ❌",
        body: `Tu solicitud para "${nombreArticulo}" ha sido rechazada. Motivo: ${motivoRechazo}`,
        data: {
          type: "solicitud_rechazada",
          prestamoId,
          motivoRechazo,
          notificacionId: notifResult.insertId,
          screen: "history",
        },
        badge: 1,
      }));

      // Enviar en chunks de 100 (límite de Expo)
      let chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error("Error al enviar chunk de notificaciones:", error);
        }
      }
    }

    res.json({
      success: true,
      message: "Préstamo rechazado y notificación enviada",
    });
  } catch (error) {
    console.error("Error al rechazar préstamo:", error);
    res.status(500).json({
      error: "Error al rechazar préstamo",
      message: error.message,
    });
  }
});
```

---

## 📦 Instalación de Dependencias

Para que funcione el envío de notificaciones push, necesitas instalar el SDK de Expo:

```bash
npm install expo-server-sdk
```

O con yarn:

```bash
yarn add expo-server-sdk
```

---

## 🗃️ Estructura de Base de Datos Requerida

Asegúrate de que las tablas tengan las siguientes columnas:

### Tabla `prestamos`

```sql
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS Codigo_QR VARCHAR(100);
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS aprobado_por VARCHAR(255);
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS Fecha_Aprobacion TIMESTAMP NULL;
```

### Tabla `articulos`

```sql
-- Asegúrate de que exista la columna 'disponibilidad'
ALTER TABLE articulos ADD COLUMN IF NOT EXISTS disponibilidad BOOLEAN DEFAULT TRUE;
```

---

## 🧪 Pruebas

### Aprobar un préstamo:

```bash
curl -X POST http://217.182.64.251:8002/prestamos/1/aprobar \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "admin123",
    "notas": "Aprobado sin observaciones"
  }'
```

### Rechazar un préstamo:

```bash
curl -X POST http://217.182.64.251:8002/prestamos/1/rechazar \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "admin123",
    "motivoRechazo": "Equipo no disponible en este momento"
  }'
```

---

## ✅ Respuestas de Éxito

### Aprobar (200 OK)

```json
{
  "success": true,
  "codigoQR": "PRESTAMO-1-1708980123456",
  "message": "Préstamo aprobado y notificación enviada"
}
```

### Rechazar (200 OK)

```json
{
  "success": true,
  "message": "Préstamo rechazado y notificación enviada"
}
```

---

## ❌ Respuestas de Error

### Préstamo no encontrado (404)

```json
{
  "error": "Préstamo no encontrado"
}
```

### Motivo de rechazo requerido (400)

```json
{
  "error": "El motivo de rechazo es requerido"
}
```

### Error del servidor (500)

```json
{
  "error": "Error al aprobar préstamo",
  "message": "Descripción detallada del error"
}
```

---

## 📝 Notas Importantes

1. **Validación del AdminId**: Considera agregar middleware de autenticación para validar que el usuario que aprueba/rechaza es realmente un administrador.

2. **Transacciones**: Para mayor seguridad, considera envolver las operaciones en transacciones SQL:

   ```javascript
   const connection = await db.getConnection();
   await connection.beginTransaction();
   try {
     // ... operaciones
     await connection.commit();
   } catch (error) {
     await connection.rollback();
     throw error;
   } finally {
     connection.release();
   }
   ```

3. **Límites de Expo**: Expo Push Notifications tiene un límite de 100 notificaciones por llamada, por eso usamos chunks.

4. **Reintentos**: Considera implementar un sistema de reintentos para notificaciones que fallen.

5. **Logs**: Guarda logs de todas las notificaciones enviadas para debugging y auditoría.
