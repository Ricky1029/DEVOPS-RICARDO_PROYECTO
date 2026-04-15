// constants/api.ts
// Configuración de la API del backend

export const API_CONFIG = {
  BASE_URL: "https://api.prestaapp.site",
  ENDPOINTS: {
    // Usuarios
    USUARIOS: "/usuarios",
    USUARIO_EMAIL: (correo: string) => `/usuarios/email/${correo}`,
    USUARIO_PUSH_TOKEN: "/usuarios/push-token",

    // Notificaciones
    NOTIFICACIONES: "/notificaciones",
    NOTIFICACIONES_USUARIO: (usuarioId: number) =>
      `/notificaciones/usuario/${usuarioId}`,
    MARCAR_LEIDA: (notificacionId: number) =>
      `/notificaciones/${notificacionId}/leer`,

    // Préstamos
    PRESTAMOS: "/prestamos",
    PRESTAMOS_USUARIO: (usuarioId: number) => `/prestamos/usuario/${usuarioId}`,
    ACTUALIZAR_PRESTAMO: (prestamoId: number) =>
      `/prestamos/uriel/${prestamoId}`,
    APROBAR_PRESTAMO: (prestamoId: number) =>
      `/prestamos/${prestamoId}/aprobar`,
    RECHAZAR_PRESTAMO: (prestamoId: number) =>
      `/prestamos/${prestamoId}/rechazar`,

    // Equipos
    EQUIPOS: "/equipos",
    EQUIPOS_DISPONIBLES: "/equipos/disponibles",
  },
  TIMEOUT: 10000, // 10 segundos
};

/**
 * Helper para construir URLs completas
 */
export const buildUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
