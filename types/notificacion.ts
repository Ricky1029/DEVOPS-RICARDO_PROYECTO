// types/notificacion.ts
// Tipos para el sistema de notificaciones push

export type TipoNotificacion =
  | 'solicitud_aprobada'
  | 'solicitud_rechazada'
  | 'recordatorio_devolucion'
  | 'recordatorio_devolucion_urgente'
  | 'equipo_disponible'
  | 'prestamo_vencido'
  | 'prestamo_proximo_vencer'
  | 'devolucion_confirmada';

export interface Notificacion {
  id: number;
  usuarioId: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  datos?: {
    prestamoId?: number;
    equipoId?: number;
    equipoNombre?: string;
    fechaDevolucion?: string;
    [key: string]: any;
  };
  createdAt: string; // ISO 8601 date string
}

export interface RegistrarTokenData {
  usuarioId: number;
  pushToken: string;
  dispositivo?: {
    plataforma: string; // 'ios' | 'android' | 'web'
    modelo?: string;
    version?: string;
  };
}

export interface NotificacionLocal {
  titulo: string;
  mensaje: string;
  datos?: Record<string, any>;
  sound?: boolean;
  vibrate?: boolean;
  priority?: 'default' | 'high' | 'max';
}
