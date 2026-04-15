import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SideMenu } from "../../components/shared/side-menu";
import { auth } from "../../firebaseConfig";
import { devolverPrestamoUsuario } from "../../services/prestamoService";
import { EstadoPrestamo, Prestamo } from "../../types/prestamo";

// Datos de muestra
const samplePrestamos: Prestamo[] = [
  {
    id: "demo-1",
    equipoId: "demo-1",
    equipoNombre: "Teclado Redragon Kumara K552",
    estado: "espera",
    duracionDias: 7,
    proposito: "Prueba de interfaz",
    fechaSolicitud: new Date(),
    codigoQR: "demo-qr-demo-1",
    usuarioId: "demo",
    usuarioNombre: "Demo",
    usuarioEmail: "demo@demo.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "demo-2",
    equipoId: "demo-2",
    equipoNombre: "Laptop Dell XPS",
    estado: "aprobado",
    duracionDias: 5,
    proposito: "Proyecto escolar",
    fechaSolicitud: new Date(),
    fechaPrestamo: new Date(),
    fechaDevolucion: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    codigoQR: "demo-qr-demo-2",
    usuarioId: "demo",
    usuarioNombre: "Demo",
    usuarioEmail: "demo@demo.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "demo-3",
    equipoId: "demo-3",
    equipoNombre: 'Monitor LG 27"',
    estado: "devuelto",
    duracionDias: 10,
    proposito: "Proyecto final",
    fechaSolicitud: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    fechaPrestamo: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
    fechaDevolucion: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    fechaDevolucionReal: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    usuarioId: "demo",
    usuarioNombre: "Demo",
    usuarioEmail: "demo@demo.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "demo-4",
    equipoId: "demo-4",
    equipoNombre: "Cámara Canon EOS",
    estado: "rechazado",
    duracionDias: 3,
    proposito: "Evento escolar",
    fechaSolicitud: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    usuarioId: "demo",
    usuarioNombre: "Demo",
    usuarioEmail: "demo@demo.com",
    motivoRechazo: "Equipo no disponible en la fecha",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const HistoryScreen = () => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"activos" | "historial">(
    "activos",
  );
  const [selectedPrestamo, setSelectedPrestamo] = useState<Prestamo | null>(
    null,
  );
  const [qrPrestamo, setQrPrestamo] = useState<Prestamo | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [devolviendoId, setDevolviendoId] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { vpsUserId, isLoading: vpsLoading } = useVpsUser();
  const { width } = useWindowDimensions();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const numColumns = width < 640 ? 1 : 2;
  const cardPadding = isMobile ? 14 : 18;
  const contentMaxWidth = isDesktop ? 1200 : width;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const loadPrestamos = useCallback(async () => {
    if (!authReady || vpsLoading) {
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setPrestamos([]);
        setLoading(false);
        return;
      }

      // Si no hay ID del VPS, no consultar para evitar mezclar datos
      if (!vpsUserId) {
        console.log("No hay ID de usuario VPS; esperando sincronización");
        setPrestamos([]);
        setLoading(false);
        return;
      }

      // Obtener préstamos del VPS
      console.log("Obteniendo préstamos del usuario VPS:", vpsUserId);
      const response = await fetch(
        `https://api.prestaapp.site/prestamos/usuario/${vpsUserId}`,
      );

      if (!response.ok) {
        console.log("Error al obtener préstamos del VPS:", response.status);
        throw new Error("No se pudieron obtener los préstamos");
      }

      const data = await response.json();
      console.log("Préstamos obtenidos del VPS:", data);

      // Mapear los datos del VPS a la estructura de Prestamo
      const prestamosData: Prestamo[] = Array.isArray(data)
        ? data
            .filter((p: any) => {
              // Filtro adicional de seguridad: asegurar que el préstamo pertenece al usuario
              const prestamoUserId = (
                p.ID_Usuario ??
                p.id_usuario ??
                p["ID Usuario"] ??
                p.usuarioId ??
                p.usuario_id
              )?.toString();
              return (
                !!prestamoUserId && prestamoUserId === vpsUserId.toString()
              );
            })
            .map((p: any, index: number) => {
              // Calcular duración en días
              let duracionDias = 7; // valor por defecto
              if (p.Fecha_Inicio && p.Fecha_Fin) {
                const fechaInicio = new Date(p.Fecha_Inicio);
                const fechaFin = new Date(p.Fecha_Fin);
                const diffTime = Math.abs(
                  fechaFin.getTime() - fechaInicio.getTime(),
                );
                duracionDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              return {
                id:
                  p.ID?.toString() ||
                  `prestamo-${vpsUserId}-${index}-${Date.now()}`,
                usuarioId: p.ID_Usuario?.toString() || vpsUserId,
                usuarioNombre: "",
                usuarioEmail: "",
                equipoId: p.ID_Articulo?.toString() || "",
                equipoNombre: p.Articulo_Nombre || "Artículo",
                equipoImagen: "",
                fechaSolicitud: p.Fecha_Solicitud
                  ? new Date(p.Fecha_Solicitud)
                  : new Date(),
                fechaAprobacion: p.Fecha_Aprobacion
                  ? new Date(p.Fecha_Aprobacion)
                  : undefined,
                fechaPrestamo: p.Fecha_Inicio
                  ? new Date(p.Fecha_Inicio)
                  : undefined,
                fechaDevolucion: p.Fecha_Fin
                  ? new Date(p.Fecha_Fin)
                  : undefined,
                duracionDias: duracionDias,
                proposito: p.Proposito || "",
                estado: (p.Estado?.toLowerCase() || "espera") as EstadoPrestamo,
                codigoQR: p.QR || "",
                // Log para debug
                _rawEstado: p.Estado,
                notas: p.Nota || "",
                createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
                updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
              };
            })
        : [];

      console.log("Préstamos mapeados:", prestamosData);
      console.log(
        "Estados de préstamos:",
        prestamosData.map((p) => ({ id: p.id, estado: p.estado })),
      );

      setPrestamos(prestamosData);
    } catch (error) {
      console.error("Error al cargar préstamos:", error);
      setPrestamos(__DEV__ ? samplePrestamos : []);
    } finally {
      setLoading(false);
    }
  }, [authReady, vpsLoading, vpsUserId]);

  useEffect(() => {
    loadPrestamos();
  }, [loadPrestamos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrestamos();
    setRefreshing(false);
  };

  const toggleMenu = () => {
    const springConfig = {
      damping: 20,
      mass: 0.8,
      stiffness: 100,
      useNativeDriver: true,
    };

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: isMenuVisible ? -300 : 0,
        ...springConfig,
      }),
      Animated.timing(fadeAnim, {
        toValue: isMenuVisible ? 0 : 1,
        duration: 500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
    setIsMenuVisible(!isMenuVisible);
  };

  const formatDate = (date?: Date) => {
    if (!date) return "-";
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getEstadoStyles = (estado: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      activo: { bg: "#e6f4ef", text: Colors.light.success },
      devuelto: { bg: "#edf0f7", text: Colors.light.gray },
      vencido: { bg: "#fbe9eb", text: Colors.light.error },
      espera: { bg: "#fff6e6", text: Colors.light.warning },
      pendiente: { bg: "#fff6e6", text: Colors.light.warning },
      aprobado: { bg: "#e6f4ff", text: "#1b74d4" },
      aceptado: { bg: "#e6f4ff", text: "#1b74d4" },
      rechazado: { bg: "#f1f2f4", text: "#6c757d" },
      denegado: { bg: "#f1f2f4", text: "#6c757d" },
    };
    return map[estado] || { bg: "#edf0f7", text: Colors.light.gray };
  };

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      espera: "Pendiente",
      pendiente: "Pendiente",
      aprobado: "Aprobado",
      aceptado: "Aprobado",
      activo: "Activo",
      devuelto: "Devuelto",
      vencido: "Vencido",
      rechazado: "Rechazado",
      denegado: "Rechazado",
    };
    return labels[estado] || estado;
  };

  const handlePrestamoPress = (prestamo: Prestamo) => {
    setSelectedPrestamo(prestamo);
    setIsModalVisible(true);
  };

  const handleVerQr = (prestamo: Prestamo) => {
    setQrPrestamo(prestamo);
    setIsQrModalVisible(true);
  };

  const handleCancelar = (prestamo: Prestamo) => {
    Alert.alert(
      "Cancelar solicitud",
      `¿Deseas cancelar la solicitud de ${prestamo.equipoNombre}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `https://api.prestaapp.site/prestamos/cancelar/${prestamo.id}`,
                { method: "DELETE" },
              );

              if (!response.ok) {
                throw new Error("No se pudo cancelar la solicitud");
              }

              Alert.alert("Éxito", "Solicitud cancelada correctamente");
              // Recargar la lista de préstamos
              await loadPrestamos();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "No pudimos cancelar la solicitud";
              Alert.alert("Error", message);
            }
          },
        },
      ],
    );
  };

  const handleDevolver = (prestamo: Prestamo) => {
    Alert.alert(
      "Registrar devolución",
      `Confirma la devolución de ${prestamo.equipoNombre}.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Devolver",
          onPress: async () => {
            try {
              setDevolviendoId(prestamo.id);
              await devolverPrestamoUsuario(prestamo.id);
              setPrestamos((prev) =>
                prev.map((p) =>
                  p.id === prestamo.id
                    ? {
                        ...p,
                        estado: "devuelto",
                        fechaDevolucionReal: new Date(),
                      }
                    : p,
                ),
              );
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "No pudimos registrar la devolución";
              Alert.alert("Error", message);
            } finally {
              setDevolviendoId(null);
            }
          },
        },
      ],
    );
  };

  const prestamosActivos = prestamos.filter((p) =>
    [
      "espera",
      "pendiente",
      "aprobado",
      "aceptado",
      "activo",
      "vencido",
    ].includes(p.estado),
  );
  const prestamosHistoricos = prestamos.filter((p) =>
    ["devuelto", "denegado", "rechazado"].includes(p.estado),
  );

  // Debug logs
  console.log("Total préstamos:", prestamos.length);
  console.log("Préstamos activos:", prestamosActivos.length);
  console.log("Préstamos históricos:", prestamosHistoricos.length);
  console.log(
    "Estados:",
    prestamos.map((p) => p.estado),
  );

  const renderItem = ({ item }: { item: Prestamo }) => {
    const estadoTokens = getEstadoStyles(item.estado);

    return (
      <TouchableOpacity
        onPress={() => handlePrestamoPress(item)}
        activeOpacity={0.9}
        style={{
          width: "100%",
          minWidth: 280,
          maxWidth: numColumns > 1 ? "48%" : "100%",
        }}
      >
        <View style={[styles.prestamoCard, { padding: cardPadding }]}>
          <View style={styles.prestamoHeader}>
            <Text
              style={[styles.prestamoEquipo, { fontSize: isMobile ? 16 : 18 }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {item.equipoNombre}
            </Text>
            <View
              style={[styles.estadoBadge, { backgroundColor: estadoTokens.bg }]}
            >
              <Text
                style={[
                  styles.estadoText,
                  { fontSize: isMobile ? 11 : 12, color: estadoTokens.text },
                ]}
              >
                {getEstadoLabel(item.estado)}
              </Text>
            </View>
          </View>
          <View style={styles.prestamoDetails}>
            {item.estado === "espera" && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="hourglass-outline"
                  size={isMobile ? 14 : 16}
                  color={Colors.light.gray}
                />
                <Text
                  style={[styles.dateText, { fontSize: isMobile ? 12 : 14 }]}
                >
                  Esperando aprobación
                </Text>
              </View>
            )}
            {item.fechaPrestamo && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="calendar-outline"
                  size={isMobile ? 14 : 16}
                  color={Colors.light.gray}
                />
                <Text
                  style={[styles.dateText, { fontSize: isMobile ? 12 : 14 }]}
                >
                  Prestado: {formatDate(item.fechaPrestamo)}
                </Text>
              </View>
            )}
            {item.fechaDevolucion && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="time-outline"
                  size={isMobile ? 14 : 16}
                  color={Colors.light.gray}
                />
                <Text
                  style={[styles.dateText, { fontSize: isMobile ? 12 : 14 }]}
                >
                  Devolución: {formatDate(item.fechaDevolucion)}
                </Text>
              </View>
            )}
            {item.duracionDias && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="timer-outline"
                  size={isMobile ? 14 : 16}
                  color={Colors.light.gray}
                />
                <Text
                  style={[styles.dateText, { fontSize: isMobile ? 12 : 14 }]}
                >
                  Duración: {item.duracionDias} día
                  {item.duracionDias !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {item.motivoRechazo && item.estado === "rechazado" && (
              <View style={styles.dateInfo}>
                <Ionicons
                  name="alert-circle-outline"
                  size={isMobile ? 14 : 16}
                  color={Colors.light.error}
                />
                <Text
                  style={[
                    styles.dateText,
                    { fontSize: isMobile ? 12 : 14, color: Colors.light.error },
                  ]}
                  numberOfLines={2}
                >
                  {item.motivoRechazo}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.cardActionsRow}>
            {/* PENDIENTE: solo Cancelar discreto */}
            {item.estado === "espera" && (
              <TouchableOpacity
                style={styles.cancelChip}
                onPress={() => handleCancelar(item)}
              >
                <Text style={styles.cancelChipText}>Cancelar solicitud</Text>
              </TouchableOpacity>
            )}

            {/* APROBADO: Ver QR primario + Devolver secundario */}
            {item.estado === "aprobado" && (
              <>
                <TouchableOpacity
                  style={styles.primaryChip}
                  onPress={() => handleVerQr(item)}
                >
                  <Ionicons name="qr-code-outline" size={15} color="#fff" />
                  <Text style={styles.primaryChipText}>Ver QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.ghostChip,
                    devolviendoId === item.id && { opacity: 0.6 },
                  ]}
                  onPress={() => handleDevolver(item)}
                  disabled={devolviendoId === item.id}
                >
                  {devolviendoId === item.id ? (
                    <ActivityIndicator
                      size="small"
                      color={Colors.light.primary}
                    />
                  ) : (
                    <Ionicons
                      name="return-down-back"
                      size={15}
                      color={Colors.light.primary}
                    />
                  )}
                  <Text style={styles.ghostChipText}>Devolver</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ACTIVO: solo Devolver */}
            {item.estado === "activo" && (
              <TouchableOpacity
                style={[
                  styles.primaryChip,
                  devolviendoId === item.id && { opacity: 0.6 },
                ]}
                onPress={() => handleDevolver(item)}
                disabled={devolviendoId === item.id}
              >
                {devolviendoId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="return-down-back" size={15} color="#fff" />
                )}
                <Text style={styles.primaryChipText}>Devolver</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header onMenuPress={toggleMenu}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Mis Préstamos</Text>
          </View>
        </Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.secondary} />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header onMenuPress={toggleMenu}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Mis Préstamos</Text>
            <Text style={styles.subtitle}>
              {prestamosActivos.length} préstamos activos
            </Text>
          </View>
        </View>
      </Header>
      <SideMenu
        isVisible={isMenuVisible}
        onClose={toggleMenu}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
      />
      <View style={{ height: 12 }} />
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[
            styles.segment,
            selectedTab === "activos" && styles.segmentActive,
          ]}
          onPress={() => setSelectedTab("activos")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentText,
              selectedTab === "activos" && styles.segmentTextActive,
            ]}
          >
            Activos ({prestamosActivos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            selectedTab === "historial" && styles.segmentActive,
          ]}
          onPress={() => setSelectedTab("historial")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.segmentText,
              selectedTab === "historial" && styles.segmentTextActive,
            ]}
          >
            Historial ({prestamosHistoricos.length})
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 6 }} />
      {(() => {
        const listData =
          selectedTab === "activos" ? prestamosActivos : prestamosHistoricos;
        const isEmpty = listData.length === 0;

        return isEmpty ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="file-tray-outline"
              size={isMobile ? 48 : 64}
              color={Colors.light.gray}
            />
            <Text style={[styles.emptyText, { fontSize: isMobile ? 16 : 18 }]}>
              {selectedTab === "activos"
                ? "No tienes préstamos activos"
                : "Sin historial aún"}
            </Text>
            <Text
              style={[styles.emptySubtext, { fontSize: isMobile ? 13 : 14 }]}
            >
              {selectedTab === "activos"
                ? "Solicita un equipo desde el Dashboard"
                : "Cuando devuelvas o rechacen, aparecerán aquí"}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, width: "100%" }}>
            <FlatList
              data={listData}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              key={numColumns + selectedTab}
              numColumns={numColumns}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              contentContainerStyle={[
                styles.list,
                {
                  paddingHorizontal: isMobile ? 12 : isTablet ? 14 : 18,
                  maxWidth: contentMaxWidth,
                  alignSelf: "center",
                },
              ]}
              columnWrapperStyle={
                numColumns > 1
                  ? { gap: 12, justifyContent: "space-between" }
                  : undefined
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          </View>
        );
      })()}

      {selectedPrestamo && (
        <Modal
          animationType="slide"
          transparent
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Detalles del Préstamo</Text>

              {selectedPrestamo.codigoQR && (
                <>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedPrestamo.codigoQR}`,
                    }}
                    style={styles.qrCode}
                  />
                  <Text style={styles.qrLabel}>Código QR</Text>
                </>
              )}

              <View style={styles.modalDetails}>
                <View style={styles.modalDetailRow}>
                  <Ionicons
                    name="cube-outline"
                    size={16}
                    color={Colors.light.gray}
                  />
                  <Text style={styles.modalText}>
                    {selectedPrestamo.equipoNombre}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={Colors.light.gray}
                  />
                  <Text style={styles.modalText}>
                    Devolución: {formatDate(selectedPrestamo.fechaDevolucion)}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons
                    name="timer-outline"
                    size={16}
                    color={Colors.light.gray}
                  />
                  <Text style={styles.modalText}>
                    Duración: {selectedPrestamo.duracionDias} días
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={Colors.light.gray}
                  />
                  <Text style={styles.modalText}>
                    Propósito: {selectedPrestamo.proposito}
                  </Text>
                </View>
                {(() => {
                  const estadoSafe = (selectedPrestamo.estado ||
                    (selectedPrestamo as any).Estado ||
                    "espera") as string;
                  const tokens = getEstadoStyles(estadoSafe);
                  return (
                    <View
                      style={[
                        styles.estadoBadge,
                        {
                          backgroundColor: tokens.bg,
                          alignSelf: "center",
                          marginTop: 12,
                        },
                      ]}
                    >
                      <Text style={[styles.estadoText, { color: tokens.text }]}>
                        {getEstadoLabel(estadoSafe)}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {qrPrestamo && (
        <Modal
          animationType="fade"
          transparent
          visible={isQrModalVisible}
          onRequestClose={() => setIsQrModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.qrModalContent}>
              <Text style={styles.modalTitle}>Código de entrega</Text>
              <View style={styles.qrWrapper}>
                {qrPrestamo.codigoQR ? (
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrPrestamo.codigoQR}`,
                    }}
                    style={styles.qrCode}
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Ionicons
                      name="qr-code-outline"
                      size={54}
                      color={Colors.light.primary}
                    />
                    <Text style={styles.qrPlaceholderText}>
                      QR espera de generar
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.qrIdLabel}>ID de la solicitud</Text>
              <Text style={styles.qrIdValue}>{qrPrestamo.id}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsQrModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.light.gray,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  title: {
    fontWeight: "bold",
    color: Colors.light.textDark,
    letterSpacing: -0.5,
    fontSize: 24,
    marginBottom: 2,
  },
  subtitle: {
    color: Colors.light.gray,
    marginTop: 2,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: 16,
  },
  emptySubtext: {
    color: Colors.light.gray,
    marginTop: 8,
  },
  list: {
    paddingVertical: 8,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#e8e8ed",
    borderRadius: 12,
    padding: 3,
    marginHorizontal: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.light.background,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  segmentText: {
    fontWeight: "600",
    fontSize: 13,
    color: Colors.light.gray,
  },
  segmentTextActive: {
    color: Colors.light.textDark,
    fontWeight: "700",
  },
  // keep old names as aliases so no other ref breaks
  tabsContainer: { display: "none" } as any,
  tabButton: {} as any,
  tabButtonActive: {} as any,
  tabText: {} as any,
  tabTextActive: {} as any,
  prestamoCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    marginBottom: 0,
    gap: 10,
    ...Platform.select({
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  prestamoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "nowrap",
    gap: 6,
  },
  prestamoEquipo: {
    fontWeight: "600",
    color: Colors.light.textDark,
    flex: 1,
    minWidth: 0,
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  estadoText: {
    fontWeight: "700",
  },
  prestamoDetails: {
    gap: 6,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  // action chips (old names kept as no-op)
  actionChip: {} as any,
  actionChipOutline: {} as any,
  actionChipGhost: {} as any,
  actionChipText: {} as any,
  // new chip styles
  primaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryChipText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  ghostChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  ghostChipText: {
    color: Colors.light.primary,
    fontWeight: "600",
    fontSize: 13,
  },
  cancelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelChipText: {
    color: Colors.light.gray,
    fontWeight: "500",
    fontSize: 12,
  },
  iconButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    color: Colors.light.primary,
  },
  qrCode: {
    width: 200,
    height: 200,
    marginBottom: 12,
    borderRadius: 8,
  },
  qrLabel: {
    fontSize: 12,
    color: Colors.light.gray,
    marginBottom: 16,
  },
  modalDetails: {
    width: "100%",
    gap: 8,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalText: {
    fontSize: 15,
    marginBottom: 4,
    color: Colors.light.text,
  },
  modalButton: {
    marginTop: 20,
    backgroundColor: Colors.light.secondary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  qrModalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "90%",
    maxWidth: 420,
  },
  qrWrapper: {
    width: 240,
    height: 240,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  qrPlaceholderText: {
    color: Colors.light.gray,
    fontSize: 13,
  },
  qrIdLabel: {
    color: Colors.light.gray,
    fontSize: 12,
  },
  qrIdValue: {
    color: Colors.light.textDark,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
});

export default HistoryScreen;
