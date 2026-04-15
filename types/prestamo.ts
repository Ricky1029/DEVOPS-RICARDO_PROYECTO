// types/prestamo.ts
// Tipos para el sistema de préstamos

export interface Prestamo {
  id: string;
  usuarioId: string;
  usuarioNombre?: string;
  usuarioEmail?: string;
  equipoId: string;
  equipoNombre: string;
  equipoImagen?: string;

  // Fechas
  fechaSolicitud: Date;
  fechaAprobacion?: Date;
  fechaPrestamo?: Date;
  fechaDevolucion?: Date;
  fechaDevolucionReal?: Date;

  // Duración y detalles
  duracionDias: number;
  proposito: string;

  // Estados
  estado: EstadoPrestamo;
  // Alias para compatibilidad hacia atrás (si backend manda "Estado")
  Estado?: EstadoPrestamo;

  // QR
  codigoQR?: string;

  // Campos administrativos
  aprobadoPor?: string; // UID del admin
  notas?: string;
  motivoRechazo?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export type EstadoPrestamo =
  | "espera" // Usuario solicitó, esperando aprobación admin (backend usa "espera")
  | "pendiente" // Alias para "espera"
  | "aceptado" // Admin aprobó, esperando entrega (backend usa "aceptado")
  | "aprobado" // Alias para "aceptado"
  | "activo" // Equipo prestado (QR escaneado en entrega)
  | "devuelto" // Equipo devuelto (QR escaneado en devolución)
  | "vencido" // Fecha de devolución pasada y no devuelto
  | "denegado" // Admin rechazó la solicitud (backend usa "denegado")
  | "rechazado"; // Alias para "denegado"

export interface SolicitudPrestamoData {
  usuarioId: string;
  equipoId: string;
  duracionDias: number;
  proposito: string;
}

export interface PrestamoStats {
  total: number;
  activos: number;
  pendientes: number;
  vencidos: number;
  completados: number;
}
