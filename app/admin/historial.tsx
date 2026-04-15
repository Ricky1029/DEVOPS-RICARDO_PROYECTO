import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface HistorialEvento {
  id: string;
  usuario: string;
  equipo: string;
  fecha: string;
  tipo: string;
  estado: string;
}

const badgeStyles: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  aprobado: {
    bg: "rgba(16,185,129,0.12)",
    text: "#0f5132",
    border: "rgba(16,185,129,0.32)",
  },
  aceptado: {
    bg: "rgba(16,185,129,0.12)",
    text: "#0f5132",
    border: "rgba(16,185,129,0.32)",
  },
  pendiente: {
    bg: "rgba(251,191,36,0.16)",
    text: "#8a6500",
    border: "rgba(251,191,36,0.32)",
  },
  activo: {
    bg: "rgba(59,130,246,0.14)",
    text: "#1e3a8a",
    border: "rgba(59,130,246,0.32)",
  },
  devuelto: {
    bg: "rgba(107,114,128,0.14)",
    text: "#374151",
    border: "rgba(107,114,128,0.3)",
  },
  rechazado: {
    bg: "rgba(239,68,68,0.14)",
    text: "#991b1b",
    border: "rgba(239,68,68,0.3)",
  },
  vencido: {
    bg: "rgba(239,68,68,0.14)",
    text: "#991b1b",
    border: "rgba(239,68,68,0.3)",
  },
};

const tipoIcon: Record<
  string,
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  Préstamo: { name: "arrow-down-circle", color: "#0A66FF" },
  Devolución: { name: "arrow-up-circle", color: "#16a34a" },
  Rechazo: { name: "close-circle", color: "#dc2626" },
};

const HistorialScreen = () => {
  const [data, setData] = useState<HistorialEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { isMobile, isTablet } = useResponsive();

  const itemsPerPage = useMemo(
    () => (isMobile || isTablet ? 8 : 12),
    [isMobile, isTablet],
  );

  useEffect(() => {
    fetchHistorial();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, itemsPerPage]);

  const fetchHistorial = async () => {
    try {
      const response = await fetch("https://api.prestaapp.site/prestamos");
      const result = await response.json();

      // Asegura que siempre sea array
      let prestamos = [];
      if (Array.isArray(result)) {
        prestamos = result;
      } else if (Array.isArray(result.prestamos)) {
        prestamos = result.prestamos;
      }

      // Transforma los datos de la API al formato del historial
      const eventos: HistorialEvento[] = prestamos.map((prestamo: any) => {
        const estado = (
          prestamo.Estado ||
          prestamo.estado ||
          "pendiente"
        ).toLowerCase();
        let tipo = "Préstamo";

        if (estado === "devuelto") {
          tipo = "Devolución";
        } else if (estado === "rechazado") {
          tipo = "Rechazo";
        }

        // Formatea la fecha
        let fechaFormateada = "N/A";
        const fechaSolicitud =
          prestamo.Fecha_Solicitud ||
          prestamo.fechaSolicitud ||
          prestamo.FechaSolicitud;
        if (fechaSolicitud) {
          try {
            const fecha = new Date(fechaSolicitud);
            fechaFormateada = fecha
              .toLocaleDateString("es-MX", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
              .replace(",", "");
          } catch (e) {
            fechaFormateada = fechaSolicitud;
          }
        }

        return {
          id: (prestamo.Id || prestamo.id || "").toString(),
          usuario:
            prestamo.Email_Usuario ||
            prestamo.usuarioEmail ||
            "Usuario desconocido",
          equipo:
            prestamo.Articulo_Nombre ||
            prestamo.equipoNombre ||
            "Equipo desconocido",
          fecha: fechaFormateada,
          tipo,
          estado,
        };
      });

      // Ordena por fecha más reciente primero
      eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));

      setData(eventos);
    } catch (error) {
      console.error("Error al cargar historial:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        (isMobile || isTablet) && styles.contentMobile,
      ]}
    >
      <View style={Platform.OS === "web" ? styles.webInner : undefined}>
        {Platform.OS === "web" && !isMobile && !isTablet && (
          <View style={styles.headerRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <Ionicons name="time" size={24} color={Colors.light.primary} />
              <Text style={styles.title}>Historial de Movimientos</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.secondary} />
            <Text style={styles.loadingText}>Cargando historial...</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={64}
              color={Colors.light.gray}
            />
            <Text style={styles.emptyText}>No hay movimientos registrados</Text>
          </View>
        ) : (
          <>
            {isMobile || isTablet ? (
              <View style={styles.cardList}>
                {currentItems.map((item, index) => {
                  const badge =
                    badgeStyles[item.estado] || badgeStyles.pendiente;
                  const iconMeta = tipoIcon[item.tipo] || tipoIcon["Préstamo"];
                  return (
                    <View key={`${item.id}-${index}`} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                          <Ionicons
                            name={iconMeta.name}
                            size={18}
                            color={iconMeta.color}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.cardTitle}>{item.tipo}</Text>
                        </View>
                        <Text style={styles.cardId}>#{item.id}</Text>
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.cardRow}>
                          <Text style={styles.cardLabel}>Usuario</Text>
                          <Text style={styles.cardValue} numberOfLines={1}>
                            {item.usuario}
                          </Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Text style={styles.cardLabel}>Equipo</Text>
                          <Text style={styles.cardValue} numberOfLines={1}>
                            {item.equipo}
                          </Text>
                        </View>
                        <View style={styles.cardRow}>
                          <Text style={styles.cardLabel}>Fecha</Text>
                          <Text style={styles.cardValue}>{item.fecha}</Text>
                        </View>
                      </View>

                      <View style={styles.cardFooter}>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: badge.bg,
                              borderColor: badge.border,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: badge.text }]}
                          >
                            {item.estado.charAt(0).toUpperCase() +
                              item.estado.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <ScrollView
                horizontal={Platform.OS !== "web"}
                showsHorizontalScrollIndicator={Platform.OS !== "web"}
                contentContainerStyle={
                  Platform.OS === "web" ? styles.tableScrollWeb : undefined
                }
              >
                <View
                  style={[
                    styles.tableCard,
                    Platform.OS === "web" && styles.tableCardWeb,
                  ]}
                >
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 1.1 }]}>
                      ID Transacción
                    </Text>
                    <Text style={[styles.th, { flex: 1.1 }]}>Usuario</Text>
                    <Text style={[styles.th, { flex: 1.3 }]}>Equipo</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Fecha</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Tipo de Evento</Text>
                    <Text
                      style={[styles.th, { flex: 0.9, textAlign: "right" }]}
                    >
                      Estado
                    </Text>
                  </View>

                  {currentItems.map((item, index) => {
                    const badge =
                      badgeStyles[item.estado] || badgeStyles.pendiente;
                    const iconMeta =
                      tipoIcon[item.tipo] || tipoIcon["Préstamo"];
                    return (
                      <Pressable
                        key={`${item.id}-${index}`}
                        style={({ hovered }) => [
                          styles.tr,
                          hovered && Platform.OS === "web" && styles.trHover,
                        ]}
                      >
                        <Text
                          style={[
                            styles.td,
                            { flex: 1.1, fontWeight: "700", color: "#0A2540" },
                          ]}
                        >
                          {item.id}
                        </Text>
                        <Text
                          style={[styles.td, { flex: 1.1 }]}
                          numberOfLines={1}
                        >
                          {item.usuario}
                        </Text>
                        <Text
                          style={[styles.td, { flex: 1.3 }]}
                          numberOfLines={1}
                        >
                          {item.equipo}
                        </Text>
                        <Text style={[styles.td, { flex: 1 }]}>
                          {item.fecha}
                        </Text>
                        <View style={[styles.tdInline, { flex: 1 }]}>
                          <Ionicons
                            name={iconMeta.name}
                            size={16}
                            color={iconMeta.color}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.td}>{item.tipo}</Text>
                        </View>
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: badge.bg,
                              borderColor: badge.border,
                              flex: 0.9,
                              justifyContent: "flex-end",
                            },
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: badge.text }]}
                          >
                            {item.estado.charAt(0).toUpperCase() +
                              item.estado.slice(1)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {totalPages > 1 && (
              <View
                style={[
                  styles.paginationContainer,
                  (isMobile || isTablet) && styles.paginationContainerMobile,
                ]}
              >
                {isMobile || isTablet ? (
                  <>
                    <Pressable
                      style={({ hovered }) => [
                        styles.paginationIconButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                        hovered &&
                          currentPage !== 1 &&
                          Platform.OS === "web" &&
                          styles.paginationIconButtonHover,
                      ]}
                      onPress={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={
                          currentPage === 1
                            ? Colors.light.gray
                            : Colors.light.secondary
                        }
                      />
                    </Pressable>

                    <View style={styles.paginationInfoPill}>
                      <Text style={styles.paginationTextCompact}>
                        {currentPage} / {totalPages}
                      </Text>
                    </View>

                    <Pressable
                      style={({ hovered }) => [
                        styles.paginationIconButton,
                        currentPage === totalPages &&
                          styles.paginationButtonDisabled,
                        hovered &&
                          currentPage !== totalPages &&
                          Platform.OS === "web" &&
                          styles.paginationIconButtonHover,
                      ]}
                      onPress={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={
                          currentPage === totalPages
                            ? Colors.light.gray
                            : Colors.light.secondary
                        }
                      />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={({ hovered }) => [
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                        hovered &&
                          currentPage !== 1 &&
                          Platform.OS === "web" &&
                          styles.paginationButtonHover,
                      ]}
                      onPress={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={18}
                        color={
                          currentPage === 1
                            ? Colors.light.gray
                            : Colors.light.secondary
                        }
                      />
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage === 1 &&
                            styles.paginationButtonTextDisabled,
                        ]}
                      >
                        Anterior
                      </Text>
                    </Pressable>

                    <View style={styles.paginationInfo}>
                      <Text style={styles.paginationText}>
                        Página {currentPage} de {totalPages}
                      </Text>
                      <Text style={styles.paginationSubtext}>
                        ({indexOfFirstItem + 1}-
                        {Math.min(indexOfLastItem, data.length)} de{" "}
                        {data.length})
                      </Text>
                    </View>

                    <Pressable
                      style={({ hovered }) => [
                        styles.paginationButton,
                        currentPage === totalPages &&
                          styles.paginationButtonDisabled,
                        hovered &&
                          currentPage !== totalPages &&
                          Platform.OS === "web" &&
                          styles.paginationButtonHover,
                      ]}
                      onPress={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage === totalPages &&
                            styles.paginationButtonTextDisabled,
                        ]}
                      >
                        Siguiente
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={
                          currentPage === totalPages
                            ? Colors.light.gray
                            : Colors.light.secondary
                        }
                      />
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fb" },
  content: { padding: 20, gap: 16 },
  contentMobile: { padding: 14 },
  webInner: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
  },
  headerRow: { gap: 6 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A2540",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    marginLeft: 34,
  },
  cardList: { gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e6edf5",
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A2540",
  },
  cardId: {
    fontSize: 12,
    color: Colors.light.gray,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cardBody: {
    marginTop: 12,
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardLabel: {
    fontSize: 12,
    color: Colors.light.gray,
    flex: 0.7,
  },
  cardValue: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1.1,
    fontWeight: "600",
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6edf5",
    ...Platform.select({
      web: { boxShadow: "0 16px 36px rgba(10,37,64,0.08)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  tableCardWeb: {
    width: "100%",
    minWidth: 0,
  },
  tableScrollWeb: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e6edf5",
    backgroundColor: "#f7f9fc",
  },
  th: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f6",
    gap: 6,
  },
  trHover: {
    backgroundColor: "#f8fbff",
  },
  td: {
    fontSize: 14,
    color: "#1f2937",
  },
  tdInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.gray,
    marginTop: 12,
  },
  emptyContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.gray,
    marginTop: 16,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6edf5",
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  paginationContainerMobile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f7f9fc",
    borderRadius: 10,
  },
  paginationButtonHover: {
    transform: "translateY(-1px)",
    backgroundColor: "#edf3fb",
  },
  paginationButtonDisabled: { opacity: 0.5 },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.secondary,
  },
  paginationButtonTextDisabled: { color: Colors.light.gray },
  paginationInfo: { alignItems: "center" },
  paginationInfoPill: {
    minWidth: 94,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8e3f0",
    backgroundColor: "#f7f9fc",
  },
  paginationIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d8e3f0",
    backgroundColor: "#f7f9fc",
  },
  paginationIconButtonHover: {
    transform: "translateY(-1px) scale(1.03)",
    backgroundColor: "#edf3fb",
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  paginationTextCompact: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.light.primary,
  },
  paginationSubtext: {
    fontSize: 12,
    color: Colors.light.gray,
    marginTop: 2,
  },
});

export default HistorialScreen;
