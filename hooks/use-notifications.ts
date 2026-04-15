// hooks/use-notifications.ts
// Hook personalizado para manejar notificaciones push

import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    NotificationListener,
    NotificationResponseListener,
    inicializarNotificaciones,
    limpiarBadgeCount,
    obtenerNotificacionesUsuario,
} from "../services/notificacionService";
import { Notificacion } from "../types/notificacion";

interface UseNotificationsReturn {
  notificaciones: Notificacion[];
  notificacionesNoLeidas: number;
  isLoading: boolean;
  refreshNotificaciones: () => Promise<void>;
  limpiarBadge: () => Promise<void>;
}

/**
 * Hook para manejar notificaciones push en la aplicación
 */
export const useNotifications = (
  usuarioId: number | null,
): UseNotificationsReturn => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Referencias para los listeners
  const notificationListener = useRef<NotificationListener>();
  const responseListener = useRef<NotificationResponseListener>();

  /**
   * Obtiene las notificaciones del usuario desde el backend
   */
  const refreshNotificaciones = async () => {
    if (!usuarioId) return;

    try {
      setIsLoading(true);
      const notifs = await obtenerNotificacionesUsuario(usuarioId);
      setNotificaciones(notifs);

      // Actualizar badge count con notificaciones no leídas
      const noLeidas = notifs.filter((n) => !n.leida).length;
      await Notifications.setBadgeCountAsync(noLeidas);
    } catch (error) {
      console.error("Error al refrescar notificaciones:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Limpia el badge count
   */
  const limpiarBadge = async () => {
    await limpiarBadgeCount();
  };

  /**
   * Inicializar notificaciones cuando el usuario está logueado
   */
  useEffect(() => {
    if (!usuarioId) return;

    const inicializar = async () => {
      try {
        // Inicializar sistema de notificaciones
        const token = await inicializarNotificaciones(usuarioId);

        if (token) {
          console.log(
            "✓ Notificaciones inicializadas. Token:",
            token.substring(0, 20) + "...",
          );
        }

        // Cargar notificaciones iniciales
        await refreshNotificaciones();
      } catch (error) {
        console.error("Error al inicializar notificaciones:", error);
      }
    };

    inicializar();
  }, [usuarioId]);

  /**
   * Configurar listeners de notificaciones
   */
  useEffect(() => {
    // Listener para cuando llega una notificación mientras la app está abierta
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📬 Notificación recibida:", notification);

        // Refrescar lista de notificaciones
        refreshNotificaciones();
      });

    // Listener para cuando el usuario toca una notificación
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("👆 Usuario tocó la notificación:", response);

        const data = response.notification.request.content.data;

        // Navegar según el tipo de notificación
        if (data.prestamoId) {
          // Navegar a los detalles del préstamo o al historial
          router.push("/(tabs)/history");
        } else if (data.equipoId) {
          // Navegar a los detalles del equipo
          router.push({
            pathname: "/product-details",
            params: { id: data.equipoId },
          });
        } else {
          // Por defecto, ir a la pantalla de notificaciones
          router.push("/notifications");
        }
      });

    // Limpiar listeners al desmontar
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  /**
   * Calcular notificaciones no leídas
   */
  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida).length;

  return {
    notificaciones,
    notificacionesNoLeidas,
    isLoading,
    refreshNotificaciones,
    limpiarBadge,
  };
};
