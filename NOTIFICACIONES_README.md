# 📱 Sistema de Notificaciones Push - Guía de Instalación

## ✅ ¿Qué se ha implementado?

Se ha implementado un sistema completo de notificaciones push para tu aplicación Presta-App que incluye:

### Frontend (App React Native)
- ✅ Servicio de notificaciones push completo
- ✅ Hook personalizado `use-notifications` para manejar notificaciones
- ✅ Pantalla de notificaciones actualizada con datos del backend
- ✅ Tipos de TypeScript para notificaciones
- ✅ Configuración de API centralizada
- ✅ Integración en el layout principal

### Tipos de Notificaciones Soportadas
- ✅ Aprobación de solicitudes
- ✅ Rechazo de solicitudes  
- ✅ Recordatorios de devolución
- ✅ Recordatorios urgentes (mismo día)
- ✅ Equipos disponibles
- ✅ Préstamos vencidos
- ✅ Préstamos próximos a vencer
- ✅ Confirmación de devolución

---

## 🚀 Pasos de Instalación

### 1. Instalar Dependencias

Ejecuta el siguiente comando en la carpeta `Presta-App`:

```bash
npm install expo-notifications@~0.31.4 expo-device@~7.0.3
```

O si usas yarn:

```bash
yarn add expo-notifications@~0.31.4 expo-device@~7.0.3
```

### 2. Configurar Proyecto en Expo

Si aún no tienes un proyecto configurado en Expo, ejecuta:

```bash
npx expo login
```

Luego crea/vincula tu proyecto:

```bash
npx eas init
```

Esto generará un `projectId` automáticamente. Copia ese ID y actualízalo en:

- **Archivo:** `app.json`
  ```json
  "extra": {
    "eas": {
      "projectId": "TU-PROJECT-ID-AQUI"
    }
  }
  ```

- **Archivo:** `services/notificacionService.ts` (línea ~57)
  ```typescript
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'TU-PROJECT-ID-AQUI',
  });
  ```

### 3. Reconstruir el Proyecto

Después de instalar las dependencias, limpia y reconstruye:

```bash
npm start -- --clear
```

O con Expo Go:

```bash
npx expo start --clear
```

### 4. Probar en Dispositivo Físico

⚠️ **IMPORTANTE:** Las notificaciones push **NO funcionan en simuladores/emuladores**. Debes probar en un dispositivo físico.

- **Android:** Descarga Expo Go desde Google Play Store
- **iOS:** Descarga Expo Go desde App Store
- Escanea el código QR que aparece al ejecutar `npx expo start`

---

## 🔧 Configuración del Backend

Revisa el archivo **`BACKEND_NOTIFICACIONES.md`** que contiene:

### 📋 Checklist Backend
1. **Crear tablas en MariaDB:**
   - `push_tokens` - Almacena tokens de dispositivos
   - `notificaciones` - Historial de notificaciones

2. **Instalar dependencia:**
   ```bash
   npm install expo-server-sdk node-cron
   ```

3. **Implementar endpoints:**
   - `POST /usuarios/push-token` - Registrar token
   - `GET /notificaciones/usuario/:usuarioId` - Lista de notificaciones
   - `PATCH /notificaciones/:id/leer` - Marcar como leída
   - `PATCH /notificaciones/usuario/:usuarioId/leer-todas` - Marcar todas

4. **Integrar envío de notificaciones:**
   - Al aprobar préstamos
   - Al rechazar préstamos
   - Al devolver equipos
   - Cron job para recordatorios automáticos

Consulta el archivo `BACKEND_NOTIFICACIONES.md` para código completo con ejemplos.

---

## 📊 Estructura de Archivos Creados

```
Presta-App/
├── constants/
│   └── api.ts                          # ✅ Configuración centralizada de API
├── types/
│   └── notificacion.ts                 # ✅ Tipos TypeScript
├── services/
│   └── notificacionService.ts          # ✅ Servicio de notificaciones
├── hooks/
│   └── use-notifications.ts            # ✅ Hook personalizado
├── app/
│   ├── _layout.tsx                     # ✅ Actualizado con hook
│   └── notifications.tsx               # ✅ Pantalla actualizada
├── app.json                            # ✅ Configuración de Expo
├── package.json                        # ✅ Dependencias actualizadas
├── BACKEND_NOTIFICACIONES.md           # 📄 Documentación backend
└── NOTIFICACIONES_README.md            # 📄 Este archivo
```

---

## 🧪 Cómo Probar

### Paso 1: Iniciar la App
```bash
npx expo start --clear
```

### Paso 2: Abrir en Dispositivo Físico
- Escanea el QR con Expo Go
- Permite los permisos de notificaciones cuando la app los solicite

### Paso 3: Verificar Registro de Token
Cuando inicies sesión, deberías ver en la consola:
```
✓ Notificaciones inicializadas. Token: ExponentPushToken[xxxx]...
```

### Paso 4: Probar Envío desde Backend
Desde tu backend Node.js/Express, ejecuta:

```javascript
const { notificarUsuario } = require('./services/expoPushService');

// Reemplaza con un usuario real
await notificarUsuario(
  db,
  1, // usuario_id
  'solicitud_aprobada',
  '✅ Prueba de Notificación',
  'Si ves esto, ¡las notificaciones funcionan correctamente!',
  { test: true }
);
```

---

## 📱 Cómo Funciona

### Flujo Completo

1. **Usuario Inicia Sesión:**
   - La app solicita permisos de notificaciones
   - Genera un Expo Push Token
   - Envía el token al backend mediante `POST /usuarios/push-token`

2. **Backend Almacena Token:**
   - Guarda el token en la tabla `push_tokens` de MariaDB
   - Asocia el token con el usuario

3. **Evento en Backend (ej. aprobar préstamo):**
   - Backend detecta el evento
   - Crea registro en tabla `notificaciones`
   - Obtiene tokens del usuario
   - Envía notificación push usando Expo Push API

4. **Usuario Recibe Notificación:**
   - Notificación aparece en dispositivo
   - Usuario toca la notificación
   - App navega a la pantalla correspondiente
   - Notificación se marca como leída

---

## 🔔 Características Implementadas

### En la App
- ✅ Registro automático de tokens al login
- ✅ Badge count (número de notificaciones no leídas)
- ✅ Pantalla de notificaciones con datos reales
- ✅ Pull-to-refresh para actualizar
- ✅ Marcar notificaciones como leídas al tocarlas
- ✅ Botón "Marcar todas como leídas"
- ✅ Navegación automática según tipo de notificación
- ✅ Indicadores visuales de notificaciones no leídas
- ✅ Formato de tiempo relativo ("Hace 2 horas", "Ayer", etc.)

### Para Implementar en Backend
- ⏳ Envío de notificaciones en aprobación/rechazo
- ⏳ Cron job para recordatorios diarios
- ⏳ Notificaciones de equipos disponibles
- ⏳ Notificaciones de préstamos vencidos

---

## 🐛 Solución de Problemas

### "No puedo obtener el token"
- Verifica que estés en un dispositivo físico (no simulador)
- Asegúrate de haber aceptado los permisos de notificaciones
- Revisa que el `projectId` en `app.json` sea correcto

### "Las notificaciones no llegan"
- Verifica que el backend esté enviando correctamente a la API de Expo
- Revisa los logs del backend
- Asegúrate de que el token esté guardado en la base de datos
- Prueba con la herramienta de Expo: https://expo.dev/notifications

### "Error al conectar con el backend"
- Verifica que la URL en `constants/api.ts` sea correcta
- Asegúrate de que el backend esté corriendo en `http://217.182.64.251:8002`
- Revisa los logs de la consola de la app

### "Las notificaciones no se marcan como leídas"
- Verifica que el endpoint PATCH `/notificaciones/:id/leer` esté implementado
- Revisa la respuesta del servidor en las DevTools

---

## 📚 Recursos Adicionales

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Token API](https://docs.expo.dev/push-notifications/overview/)
- [Expo Server SDK](https://github.com/expo/expo-server-sdk-node)
- [Node Cron Docs](https://www.npmjs.com/package/node-cron)

---

## ✅ Próximos Pasos

1. **Instalar dependencias:** `npm install expo-notifications expo-device`
2. **Configurar projectId** en `app.json` y `notificacionService.ts`
3. **Reconstruir app:** `npm start -- --clear`
4. **Probar en dispositivo físico**
5. **Implementar endpoints en backend** (ver `BACKEND_NOTIFICACIONES.md`)
6. **Crear tablas en MariaDB**
7. **Configurar cron job** para recordatorios
8. **Probar envío de notificaciones** desde backend

---

¿Necesitas ayuda? Revisa la documentación en `BACKEND_NOTIFICACIONES.md` 🚀
