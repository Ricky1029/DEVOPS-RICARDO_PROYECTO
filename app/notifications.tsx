import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerNotificacionesUsuario,
} from "@/services/notificacionService";
import { Notificacion, TipoNotificacion } from "@/types/notificacion";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Configuración de estilos por tipo de notificación
 */
const tipoNotificacionStyles: Record<
  TipoNotificacion,
  {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }
> = {
  solicitud_aprobada: {
    icon: "checkmark-circle-outline",
    color: Colors.light.success,
  },
  solicitud_rechazada: {
    icon: "close-circle-outline",
    color: "#EF4444",
  },
  recordatorio_devolucion: {
    icon: "time-outline",
    color: Colors.light.warning,
  },
  recordatorio_devolucion_urgente: {
    icon: "alert-circle-outline",
    color: "#DC2626",
  },
  equipo_disponible: {
    icon: "gift-outline",
    color: Colors.light.primary,
  },
  prestamo_vencido: {
    icon: "warning-outline",
    color: "#DC2626",
  },
  prestamo_proximo_vencer: {
    icon: "hourglass-outline",
    color: Colors.light.warning,
  },
  devolucion_confirmada: {
    icon: "checkmark-done-outline",
    color: Colors.light.success,
  },
};

/**
 * Convierte fecha ISO a texto relativo
 */
const formatearTiempoRelativo = (fecha: string): string => {
  try {
    // Validar que la fecha no esté vacía
    if (!fecha) {
      return "Fecha desconocida";
    }

    const ahora = new Date();
    const fechaNotif = new Date(fecha);

    // Validar que la fecha se haya parseado correctamente
    if (isNaN(fechaNotif.getTime())) {
      // Intentar con otros formatos comunes
      const timestamp = parseInt(fecha);
      if (!isNaN(timestamp)) {
        const fechaAlternativa = new Date(timestamp);
        if (!isNaN(fechaAlternativa.getTime())) {
          return formatearDesdeDate(ahora, fechaAlternativa);
        }
      }
      return "Fecha desconocida";
    }

    return formatearDesdeDate(ahora, fechaNotif);
  } catch (error) {
    console.warn("Error al formatear fecha:", fecha, error);
    return "Fecha desconocida";
  }
};

/**
 * Formatea la diferencia entre dos fechas
 */
const formatearDesdeDate = (ahora: Date, fechaNotif: Date): string => {
  const diffMs = ahora.getTime() - fechaNotif.getTime();
  if (diffMs < 0) return "Ahora mismo";
  const diffMinutos = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMinutos / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMinutos < 1) return "Ahora mismo";
  if (diffMinutos < 60) return `Hace ${diffMinutos} min`;
  if (diffHoras < 24)
    return `Hace ${diffHoras} ${diffHoras === 1 ? "hora" : "horas"}`;
  if (diffDias === 1) return "Ayer";
  if (diffDias < 7) return `Hace ${diffDias} días`;

  return fechaNotif.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
};

const NotificationsScreen = () => {
  const router = useRouter();
  const { vpsUserId } = useVpsUser();

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Cargar notificaciones del backend
   */
  const cargarNotificaciones = useCallback(
    async (refresh = false) => {
      if (!vpsUserId) {
        setIsLoading(false);
        return;
      }

      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const notifs = await obtenerNotificacionesUsuario(parseInt(vpsUserId));
        setNotificaciones(notifs);
      } catch (error) {
        console.error("Error al cargar notificaciones:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [vpsUserId],
  );

  /**
   * Marcar notificación como leída al tocarla
   */
  const handleNotificacionPress = async (notificacion: Notificacion) => {
    if (!notificacion.leida) {
      const exito = await marcarNotificacionLeida(notificacion.id);

      if (exito) {
        // Actualizar estado local
        setNotificaciones((prev) =>
          prev.map((n) =>
            n.id === notificacion.id ? { ...n, leida: true } : n,
          ),
        );
      }
    }

    // Navegar según los datos de la notificación
    if (notificacion.datos?.prestamoId) {
      router.push("/(tabs)/history");
    } else if (notificacion.datos?.equipoId) {
      router.push({
        pathname: "/product-details",
        params: { id: notificacion.datos.equipoId },
      });
    }
  };

  /**
   * Marcar todas como leídas
   */
  const handleMarcarTodasLeidas = async () => {
    if (!vpsUserId) return;

    const exito = await marcarTodasLeidas(parseInt(vpsUserId));

    if (exito) {
      // Actualizar estado local
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
  };

  /**
   * Cargar notificaciones al montar el componente
   */
  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  /**
   * Renderizar cada notificación
   */
  const renderItem = ({ item }: { item: Notificacion }) => {
    const estilo = tipoNotificacionStyles[item.tipo] || {
      icon: "notifications-outline",
      color: Colors.light.primary,
    };

    return (
      <TouchableOpacity
        style={[styles.card, !item.leida && styles.cardNoLeida]}
        onPress={() => handleNotificacionPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${estilo.color}1A` },
            ]}
          >
            <Ionicons name={estilo.icon} size={22} color={estilo.color} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.titulo}</Text>
          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.mensaje}
          </Text>
          <Text style={styles.cardTimestamp}>
            {formatearTiempoRelativo(item.createdAt)}
          </Text>
        </View>
        {!item.leida && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  /**
   * Vista de carga
   */
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header hideLeftButton>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Notificaciones</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={18} color={Colors.light.textDark} />
            </TouchableOpacity>
          </View>
        </Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Cargando notificaciones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Vista vacía
   */
  if (notificaciones.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header hideLeftButton>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Notificaciones</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={18} color={Colors.light.textDark} />
            </TouchableOpacity>
          </View>
        </Header>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="notifications-off-outline"
            size={64}
            color={Colors.light.gray}
          />
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptyText}>
            No tienes notificaciones por el momento
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header hideLeftButton>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Notificaciones</Text>
            {notificacionesNoLeidas > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificacionesNoLeidas}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {notificacionesNoLeidas > 0 && (
              <TouchableOpacity
                style={styles.markAllButton}
                onPress={handleMarcarTodasLeidas}
              >
                <Text style={styles.markAllText}>Marcar todas</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={18} color={Colors.light.textDark} />
            </TouchableOpacity>
          </View>
        </View>
      </Header>
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => cargarNotificaciones(true)}
            colors={[Colors.light.primary]}
            tintColor={Colors.light.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  headerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.textDark,
  },
  badge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.light.primary + "15",
  },
  markAllText: {
    color: Colors.light.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  iconButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    position: "relative",
  },
  cardNoLeida: {
    backgroundColor: Colors.light.primary + "08",
    borderColor: Colors.light.primary + "30",
  },
  cardLeft: {
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.textDark,
  },
  cardMessage: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  cardTimestamp: {
    fontSize: 12,
    color: Colors.light.gray,
    marginTop: 2,
  },
  unreadDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.textDark,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: "center",
  },
});

export default NotificationsScreen;
