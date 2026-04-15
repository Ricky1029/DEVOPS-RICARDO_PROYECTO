// app/admin/prestamos.tsx
// Panel de administración para gestionar solicitudes de préstamos

import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import {
  aprobarPrestamoConNotificacion,
  rechazarPrestamoConNotificacion,
} from "../../services/notificacionService";
import { EstadoPrestamo, Prestamo } from "../../types/prestamo";

const PrestamosAdminScreen = () => {
  const [solicitudes, setSolicitudes] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { isMobile, isTablet } = useResponsive();

  // Estados para modales de confirmación
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approvalResultModalVisible, setApprovalResultModalVisible] =
    useState(false);
  const [approvalResultTitle, setApprovalResultTitle] = useState("");
  const [approvalResultMessage, setApprovalResultMessage] = useState("");
  const [selectedSolicitud, setSelectedSolicitud] = useState<Prestamo | null>(
    null,
  );
  const [motivoRechazo, setMotivoRechazo] = useState("");

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchPrestamos();
  }, []);

  const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

  const isDateOnlyString = (value: unknown): value is string => {
    return typeof value === "string" && DATE_ONLY_REGEX.test(value.trim());
  };

  const parseApiDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    if (typeof value !== "string") return null;

    const raw = value.trim();
    const onlyDate = raw.match(DATE_ONLY_REGEX);

    if (onlyDate) {
      const year = Number(onlyDate[1]);
      const monthIndex = Number(onlyDate[2]) - 1;
      const day = Number(onlyDate[3]);
      // Para cadenas solo fecha, crear Date local y evitar corrimientos por UTC.
      return new Date(year, monthIndex, day);
    }

    const normalized =
      raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getSolicitudTimestamp = (solicitud: any): number => {
    const rawDate =
      solicitud?.Fecha_Solicitud ||
      solicitud?.fechaSolicitud ||
      solicitud?.Fecha_Creacion ||
      solicitud?.createdAt;

    if (!rawDate) return 0;

    const parsedDate = parseApiDate(rawDate);
    return parsedDate ? parsedDate.getTime() : 0;
  };

  const getPrestamoId = (solicitud: Prestamo | null) => {
    if (!solicitud) return null;
    return (
      (solicitud as any).ID || (solicitud as any).Id || (solicitud as any).id
    );
  };

  const isPendingSolicitud = (solicitud: any) => {
    const estado = solicitud?.Estado || solicitud?.estado;
    return (
      estado === "espera" || estado === "pendiente" || estado === "En espera"
    );
  };

  const fetchPrestamos = () => {
    fetch("https://api.prestaapp.site/prestamos")
      .then((response) => response.json())
      .then((data) => {
        console.log("API RESPONSE:", data);

        // Asegura que siempre sea array
        let prestamosArray = [];
        if (Array.isArray(data)) {
          prestamosArray = data;
        } else if (Array.isArray(data.prestamos)) {
          prestamosArray = data.prestamos;
        } else {
          prestamosArray = [];
        }

        // Log del primer préstamo para ver su estructura
        if (prestamosArray.length > 0) {
          console.log("ESTRUCTURA DEL PRIMER PRÉSTAMO:", prestamosArray[0]);
        }

        const sortedPrestamos = [...prestamosArray].sort((a: any, b: any) => {
          const pendingA = isPendingSolicitud(a);
          const pendingB = isPendingSolicitud(b);

          if (pendingA !== pendingB) {
            return pendingA ? -1 : 1;
          }

          return getSolicitudTimestamp(b) - getSolicitudTimestamp(a);
        });

        setSolicitudes(sortedPrestamos);
        setCurrentPage(1);
      })
      .catch((error) => {
        if (__DEV__) {
          console.error("Error al obtener préstamos:", error);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const confirmarAprobacion = async () => {
    if (!selectedSolicitud) return;

    const adminId = auth.currentUser?.uid;
    if (!adminId) {
      setApprovalResultTitle("Error");
      setApprovalResultMessage("No se pudo identificar al administrador");
      setApprovalResultModalVisible(true);
      setConfirmModalVisible(false);
      return;
    }

    try {
      setProcessing(true);
      setConfirmModalVisible(false);

      // Extraer el ID correctamente
      const prestamoId = getPrestamoId(selectedSolicitud);

      if (!prestamoId) {
        setApprovalResultTitle("Error");
        setApprovalResultMessage("No se pudo obtener el ID del préstamo");
        setApprovalResultModalVisible(true);
        return;
      }

      const result = await aprobarPrestamoConNotificacion(prestamoId, adminId);

      if (result.success) {
        setApprovalResultTitle("Solicitud Aprobada");
        setApprovalResultMessage(
          `Se ha aprobado la solicitud y se generó el código QR:\n\n${result.codigoQR}\n\nEl usuario ha recibido una notificación.`,
        );
        setApprovalResultModalVisible(true);
        fetchPrestamos();
      } else {
        setApprovalResultTitle("Error");
        setApprovalResultMessage(
          result.message || "No se pudo aprobar la solicitud",
        );
        setApprovalResultModalVisible(true);
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error("Error al aprobar solicitud:", error);
      }
      setApprovalResultTitle("Error");
      setApprovalResultMessage("No se pudo procesar la solicitud.");
      setApprovalResultModalVisible(true);
    } finally {
      setProcessing(false);
      setSelectedSolicitud(null);
    }
  };

  const handleAprobar = (solicitud: Prestamo) => {
    setSelectedSolicitud(solicitud);
    setConfirmModalVisible(true);
  };

  const handleRechazar = (solicitud: Prestamo) => {
    setSelectedSolicitud(solicitud);
    setMotivoRechazo("");
    setRejectModalVisible(true);
  };

  const confirmarRechazo = async () => {
    if (!selectedSolicitud) return;

    const adminId = auth.currentUser?.uid;
    if (!adminId) {
      Alert.alert("Error", "No se pudo identificar al administrador");
      setRejectModalVisible(false);
      return;
    }

    if (!motivoRechazo || !motivoRechazo.trim()) {
      Alert.alert("Error", "Debes especificar el motivo del rechazo");
      return;
    }

    try {
      setProcessing(true);
      setRejectModalVisible(false);

      // Extraer el ID correctamente
      const prestamoId = getPrestamoId(selectedSolicitud);

      if (!prestamoId) {
        Alert.alert("Error", "No se pudo obtener el ID del préstamo");
        return;
      }

      const result = await rechazarPrestamoConNotificacion(
        prestamoId,
        adminId,
        motivoRechazo,
      );

      if (result.success) {
        Alert.alert(
          "Solicitud Rechazada",
          "La solicitud ha sido rechazada y el usuario ha recibido una notificación.",
        );
        fetchPrestamos();
      } else {
        Alert.alert(
          "Error",
          result.message || "No se pudo rechazar la solicitud",
        );
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error("Error al rechazar solicitud:", error);
      }
      Alert.alert("Error", "No se pudo procesar la solicitud.");
    } finally {
      setProcessing(false);
      setSelectedSolicitud(null);
      setMotivoRechazo("");
    }
  };

  const getEstadoBadge = (Estado: EstadoPrestamo) => {
    const config = {
      espera: { label: "En espera", color: "#ffc107", icon: "time-outline" },
      pendiente: { label: "Pendiente", color: "#ffc107", icon: "time-outline" },
      "En espera": {
        label: "En espera",
        color: "#ffc107",
        icon: "time-outline",
      },
      aceptado: {
        label: "Aceptado",
        color: "#17a2b8",
        icon: "checkmark-circle-outline",
      },
      denegado: {
        label: "Denegado",
        color: "#dc3545",
        icon: "close-circle-outline",
      },
      activo: {
        label: "Activo",
        color: "#28a745",
        icon: "play-circle-outline",
      },
    };
    const { label, color, icon } =
      config[Estado as keyof typeof config] || config.espera;
    return { label, color, icon };
  };

  // Calcular datos de paginación
  const totalPages = Math.ceil(solicitudes.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = solicitudes.slice(indexOfFirstItem, indexOfLastItem);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return "-";

    const dateObj = parseApiDate(date);
    if (!dateObj) return "-";

    if (isDateOnlyString(date)) {
      return dateObj.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return dateObj.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calcularDuracionDias = (solicitud: any): number => {
    try {
      const fechaInicio = solicitud.Fecha_Inicio || solicitud.fechaPrestamo;
      const fechaFin = solicitud.Fecha_Fin || solicitud.fechaDevolucion;

      if (!fechaInicio || !fechaFin) return 0;

      const inicio = parseApiDate(fechaInicio);
      const fin = parseApiDate(fechaFin);

      if (!inicio || !fin) return 0;

      const diferenciaMilisegundos = fin.getTime() - inicio.getTime();
      const dias = Math.ceil(diferenciaMilisegundos / (1000 * 60 * 60 * 24));

      return dias > 0 ? dias : 0;
    } catch (error) {
      if (__DEV__) {
        console.error("Error al calcular duración:", error);
      }
      return 0;
    }
  };

  const pendingCount = Array.isArray(solicitudes)
    ? solicitudes.filter(
        (s) =>
          s.Estado === "espera" ||
          s.Estado === "pendiente" ||
          s.Estado === "En espera",
      ).length
    : 0;
  const showInlineHeader = Platform.OS === "web" && !isMobile && !isTablet;

  // PrestamoCard component for mobile view
  const PrestamoCard = ({ solicitud }: { solicitud: Prestamo }) => {
    const { label, color, icon } = getEstadoBadge(solicitud.Estado);

    return (
      <Pressable
        style={({ hovered }) => [
          styles.card,
          hovered && Platform.OS === "web" && styles.cardHover,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={16} color="#fff" />
            <Text style={styles.badgeText}>{label}</Text>
          </View>
          <Text style={styles.cardId}>
            #{(solicitud as any).Id || solicitud.id}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={Colors.light.gray}
            />
            <Text style={styles.infoText}>{solicitud.Email_Usuario}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="cube-outline"
              size={18}
              color={Colors.light.secondary}
            />
            <Text style={[styles.infoText, styles.equipoText]}>
              {solicitud.Articulo_Nombre}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={Colors.light.gray}
            />
            <Text style={styles.infoText}>
              {calcularDuracionDias(solicitud)} días
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={Colors.light.gray}
            />
            <Text style={styles.infoText}>{solicitud.Proposito}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.light.gray} />
            <Text style={styles.infoTextSmall}>
              Solicitado:{" "}
              {formatDate(
                (solicitud as any).Fecha_Solicitud ||
                  (solicitud as any).fechaSolicitud ||
                  (solicitud as any).FechaSolicitud,
              )}
            </Text>
          </View>
        </View>

        {(solicitud.Estado === "espera" ||
          solicitud.Estado === "pendiente" ||
          solicitud.Estado === "En espera") && (
          <View style={styles.cardActions}>
            <Pressable
              style={({ hovered }) => [
                styles.actionButton,
                styles.approveButton,
                hovered && Platform.OS === "web" && styles.actionButtonHover,
              ]}
              onPress={() => handleAprobar(solicitud)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Aprobar</Text>
            </Pressable>
            <Pressable
              style={({ hovered }) => [
                styles.actionButton,
                styles.rejectButton,
                hovered && Platform.OS === "web" && styles.actionButtonHover,
              ]}
              onPress={() => handleRechazar(solicitud)}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Rechazar</Text>
            </Pressable>
          </View>
        )}

        {solicitud.Estado === "aceptado" && solicitud.codigoQR && (
          <View style={styles.qrInfo}>
            <Ionicons
              name="qr-code-outline"
              size={24}
              color={Colors.light.secondary}
            />
            <Text style={styles.qrText}>Código QR: {solicitud.codigoQR}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {showInlineHeader && (
          <View
            style={[
              styles.header,
              (isMobile || isTablet) && styles.headerMobile,
            ]}
          >
            <View
              style={[
                styles.headerRow,
                (isMobile || isTablet) && styles.headerRowMobile,
              ]}
            >
              <View style={styles.headerTitleRow}>
                <Ionicons
                  name="cube-outline"
                  size={24}
                  color={Colors.light.primary}
                />
                <Text style={styles.title}>Gestión de Préstamos</Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  (isMobile || isTablet) && styles.countBadgeMobile,
                ]}
              >
                <Text style={styles.countText}>{pendingCount} en espera</Text>
              </View>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.light.secondary}
            style={styles.loader}
          />
        ) : solicitudes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="folder-open-outline"
              size={64}
              color={Colors.light.gray}
            />
            <Text style={styles.emptyText}>
              No hay solicitudes en este momento
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.cardsContainer,
                (isMobile || isTablet) && styles.cardsContainerMobile,
              ]}
            >
              {currentItems.map((solicitud, index) => (
                <PrestamoCard
                  key={(solicitud as any).ID || index}
                  solicitud={solicitud}
                />
              ))}
            </View>

            {/* Controles de paginación */}
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
                        size={20}
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
                        {Math.min(indexOfLastItem, solicitudes.length)} de{" "}
                        {solicitudes.length})
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
                        size={20}
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
      </ScrollView>

      {/* Modal de confirmación para aprobar */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color="#28a745"
              />
              <Text style={styles.modalTitle}>Aprobar Solicitud</Text>
            </View>
            <Text style={styles.modalMessage}>
              ¿Confirmas que deseas aprobar esta solicitud?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setSelectedSolicitud(null);
                }}
                disabled={processing}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmarAprobacion}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Aprobar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de resultado de aprobación */}
      <Modal
        visible={approvalResultModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setApprovalResultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={
                  approvalResultTitle === "Error"
                    ? "alert-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={48}
                color={approvalResultTitle === "Error" ? "#dc3545" : "#28a745"}
              />
              <Text style={styles.modalTitle}>{approvalResultTitle}</Text>
            </View>
            <Text style={styles.modalMessage}>{approvalResultMessage}</Text>
            <View style={styles.singleModalAction}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  approvalResultTitle === "Error"
                    ? styles.modalButtonReject
                    : styles.modalButtonConfirm,
                ]}
                onPress={() => setApprovalResultModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de rechazo con input */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="close-circle-outline" size={48} color="#dc3545" />
              <Text style={styles.modalTitle}>Rechazar Solicitud</Text>
            </View>
            <Text style={styles.modalMessage}>
              Ingresa el motivo del rechazo:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Equipo no disponible, documentación incompleta..."
              value={motivoRechazo}
              onChangeText={setMotivoRechazo}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setSelectedSolicitud(null);
                  setMotivoRechazo("");
                }}
                disabled={processing}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonReject]}
                onPress={confirmarRechazo}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Rechazar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
  },
  header: {
    padding: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRowMobile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerMobile: {
    padding: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.primary,
    marginBottom: 0,
  },
  titleMobile: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  subtitleMobile: {
    fontSize: 13,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e9f1ff",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  countBadgeMobile: {
    alignSelf: "flex-end",
  },
  countText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.gray,
    marginTop: 16,
  },
  cardsContainer: {
    padding: 16,
  },
  cardsContainerMobile: {
    padding: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 24px rgba(10,37,64,0.12)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardId: {
    fontSize: 12,
    color: Colors.light.gray,
    fontFamily: "monospace",
  },
  cardBody: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  infoTextSmall: {
    fontSize: 12,
    color: Colors.light.gray,
    flex: 1,
  },
  equipoText: {
    fontWeight: "600",
    color: Colors.light.secondary,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.14s ease, opacity 0.14s ease",
        ":hover": {
          transform: "translateY(-1px)",
          opacity: 0.95,
        },
      },
    }),
  },
  actionButtonHover: {
    transform: "translateY(-1px)",
    opacity: 0.95,
  },
  approveButton: {
    backgroundColor: "#28a745",
  },
  rejectButton: {
    backgroundColor: "#dc3545",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  qrInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  qrText: {
    fontSize: 12,
    color: Colors.light.text,
    fontFamily: "monospace",
    flex: 1,
  },
  // Estilos para modales
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.text,
    marginTop: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.light.gray,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 20,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  singleModalAction: {
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.14s ease, opacity 0.14s ease",
        ":hover": {
          transform: "translateY(-1px)",
          opacity: 0.96,
        },
      },
    }),
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalButtonConfirm: {
    backgroundColor: "#28a745",
  },
  modalButtonReject: {
    backgroundColor: "#dc3545",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextCancel: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: "600",
  },
  // Estilos de paginación
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationContainerMobile: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f4f8",
    gap: 6,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.16s ease, background-color 0.16s ease",
        ":hover": {
          transform: "translateY(-1px)",
          backgroundColor: "#eaf2fb",
        },
      },
    }),
  },
  paginationButtonHover: {
    transform: "translateY(-1px)",
    backgroundColor: "#eaf2fb",
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.secondary,
  },
  paginationButtonTextDisabled: {
    color: Colors.light.gray,
  },
  paginationInfo: {
    alignItems: "center",
    gap: 4,
  },
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
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.16s ease, background-color 0.16s ease",
        ":hover": {
          transform: "translateY(-1px) scale(1.03)",
          backgroundColor: "#edf3fb",
        },
      },
    }),
  },
  paginationIconButtonHover: {
    transform: "translateY(-1px) scale(1.03)",
    backgroundColor: "#edf3fb",
  },
  paginationText: {
    fontSize: 15,
    fontWeight: "600",
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
  },
});

export default PrestamosAdminScreen;
