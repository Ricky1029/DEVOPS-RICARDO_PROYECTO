import { KeyboardDismissWrapper } from "@/components/ui/keyboard-dismiss-wrapper";
import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { auth } from "../firebaseConfig";
import { crearSolicitudPrestamo } from "../services/prestamoService";

const LoanRequestModal = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedDuration, setSelectedDuration] = useState("7");
  const [customDays, setCustomDays] = useState("14");
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [customPurposeDescription, setCustomPurposeDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(1);
  const { vpsUserId, isLoading: vpsLoading } = useVpsUser();
  const { width } = useWindowDimensions();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [qrData, setQrData] = useState<string | null>(null);

  // Responsive values
  const contentPadding = isMobile ? 16 : isTablet ? 20 : 24;
  const modalMaxWidth = isDesktop ? 700 : width * 0.95;
  const buttonsPerRow = width < 576 ? 1 : width < 768 ? 2 : 3;

  const product = {
    id: params.id as string,
    nombre: params.nombre as string,
    categoria: params.categoria as string,
    imagen: params.imagen as string,
  };

  const durationOptions = [
    { value: "1", label: "1 día", description: "Uso puntual" },
    { value: "3", label: "3 días", description: "Proyecto corto" },
    { value: "7", label: "7 días", description: "Proyecto semanal" },
    {
      value: "custom",
      label: "Personalizado",
      description: "Elige los días específicos",
    },
  ];

  const handlePurposeSelection = (value: string) => {
    setSelectedPurpose(value);
    // Limpiar la descripción personalizada si se cambia a otra opción
    if (value !== "other") {
      setCustomPurposeDescription("");
    }
  };

  const generateQRData = () => {
    const data = vpsUserId?.toString() || "";
    setQrData(data);
  };

  const purposeOptions = [
    { value: "academic", label: "Académico", icon: "school-outline" },
    { value: "research", label: "Investigación", icon: "search-outline" },
    { value: "project", label: "Proyecto", icon: "construct-outline" },
    { value: "presentation", label: "Presentación", icon: "easel-outline" },
    { value: "other", label: "Otro", icon: "ellipsis-horizontal-outline" },
  ];

  const formatLocalDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const crearPrestamo = async () => {
    console.log("Intentando crear préstamo con vpsUserId:", vpsUserId);

    if (!vpsUserId) {
      Alert.alert(
        "Error",
        "No se pudo obtener el ID del usuario. Por favor, inicia sesión nuevamente.",
        [{ text: "OK", onPress: () => router.replace("/login") }],
      );
      return;
    }

    const idUsuarioNumerico = parseInt(vpsUserId);
    if (isNaN(idUsuarioNumerico)) {
      Alert.alert(
        "Error",
        "ID de usuario inválido. Por favor, inicia sesión nuevamente.",
      );
      return;
    }

    console.log("ID usuario numérico:", idUsuarioNumerico);

    // Generar QR data (usar directamente el vpsUserId)
    const qrCode = vpsUserId.toString();
    console.log("Código QR generado:", qrCode);

    // Determinar la duración en días (usar customDays si es "custom")
    const duracionDias =
      selectedDuration === "custom"
        ? parseInt(customDays)
        : parseInt(selectedDuration);

    if (isNaN(duracionDias) || duracionDias < 1) {
      Alert.alert("Error", "Duración de préstamo inválida");
      return;
    }

    // crear prestamo en vps
    const now = new Date();
    const fechaFin = new Date(now);
    fechaFin.setDate(fechaFin.getDate() + duracionDias);

    fetch("https://api.prestaapp.site/prestamos/crear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_usuario: idUsuarioNumerico,
        id_articulo: product.id as string,
        fecha_inicio: formatLocalDateForApi(now),
        fecha_fin: formatLocalDateForApi(fechaFin),
        // Enviar timestamp completo para evitar corrimientos de día/hora.
        fecha_solicitud: now.toISOString().split("T")[0],
        fecha_aprobacion: null,
        nota: "xd",
        proposito:
          selectedPurpose === "other"
            ? customPurposeDescription.trim()
            : selectedPurpose,
        estado: "espera",
        qr: qrCode,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Respuesta del servidor:", data);
        router.back();
        Alert.alert(
          "Solicitud Enviada",
          `Tu solicitud para ${product.nombre} por ${duracionDias} día(s) ha sido enviada correctamente.\n\nPropósito: ${selectedPurpose === "other" ? customPurposeDescription.trim() : selectedPurpose}\n\nRecibirás una notificación cuando sea revisada por un administrador.`,
        );
      })
      .catch((error) => {
        console.error("Error al crear el préstamo:", error);
        Alert.alert("Error", "No se pudo crear la solicitud de préstamo.");
      });
  };

  const handleSliderChange = (positionX: number) => {
    const clamped = Math.min(Math.max(positionX, 0), sliderWidth);
    const ratio = clamped / (sliderWidth || 1);
    const days = Math.round(ratio * 29) + 1; // 1 a 30
    setCustomDays(days.toString());
  };

  const handleSubmitRequest = async () => {
    if (!selectedPurpose) {
      Alert.alert("Error", "Por favor selecciona el propósito del préstamo");
      return;
    }

    if (selectedPurpose === "other") {
      if (!customPurposeDescription.trim()) {
        Alert.alert("Error", "Por favor describe el propósito del préstamo");
        return;
      }
      if (customPurposeDescription.trim().length < 10) {
        Alert.alert(
          "Error",
          "La descripción debe tener al menos 10 caracteres",
        );
        return;
      }
      if (customPurposeDescription.trim().length > 100) {
        Alert.alert("Error", "La descripción no puede exceder 100 caracteres");
        return;
      }
    }

    if (selectedDuration === "custom") {
      const days = parseInt(customDays);
      if (isNaN(days) || days < 1 || days > 30) {
        Alert.alert(
          "Error",
          "Por favor ingresa un número válido de días (1-30)",
        );
        return;
      }
    }

    // Verificar que el usuario esté autenticado
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "Debes iniciar sesión para solicitar un préstamo");
      router.replace("/login");
      return;
    }

    try {
      setIsSubmitting(true);

      const finalDuration =
        selectedDuration === "custom"
          ? parseInt(customDays)
          : parseInt(selectedDuration);
      const finalPurpose =
        selectedPurpose === "other"
          ? customPurposeDescription.trim()
          : selectedPurpose;

      // Obtener el nombre del propósito para mostrar
      const purposeLabels: Record<string, string> = {
        academic: "Académico",
        research: "Investigación",
        project: "Proyecto",
        presentation: "Presentación",
      };
      const purposeDisplay =
        selectedPurpose === "other"
          ? finalPurpose
          : purposeLabels[selectedPurpose];

      // Crear solicitud en Firebase
      const prestamoId = await crearSolicitudPrestamo(
        {
          usuarioId: user.uid,
          equipoId: product.id,
          duracionDias: finalDuration,
          proposito: finalPurpose,
        },
        user.displayName || user.email?.split("@")[0] || "Usuario",
        user.email || "",
        product.nombre,
        product.imagen,
      );

      setIsSubmitting(false);

      Alert.alert(
        "Solicitud Enviada",
        `Tu solicitud para ${product.nombre} por ${finalDuration} día(s) ha sido enviada correctamente.\n\nPropósito: ${purposeDisplay}\n\nRecibirás una notificación cuando sea revisada por un administrador.`,
        [
          {
            text: "Ver Mis Préstamos",
            onPress: () => {
              router.back();
              router.push("/(tabs)/history");
            },
          },
          {
            text: "Entendido",
            onPress: () => router.back(),
            style: "cancel",
          },
        ],
      );
    } catch (error: any) {
      setIsSubmitting(false);

      const message = typeof error?.message === "string" ? error.message : "";
      // Manejo de errores específicos
      if (message.includes("disponible")) {
        Alert.alert(
          "Equipo No Disponible",
          "Este equipo ya ha sido reservado por otro usuario. Por favor, selecciona otro equipo.",
          [{ text: "Entendido", onPress: () => router.back() }],
        );
      } else if (message.includes("límite")) {
        Alert.alert(
          "Límite alcanzado",
          "Has alcanzado el límite de 3 préstamos activos. Devuelve un equipo antes de solicitar más.",
          [
            {
              text: "Ver Mis Préstamos",
              onPress: () => router.push("/(tabs)/history"),
            },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          "Ocurrió un error al enviar la solicitud. Por favor, intenta de nuevo.",
          [{ text: "Entendido" }],
        );
      }
    }
  };

  return (
    <KeyboardDismissWrapper>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color="#0A2540" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Solicitar Préstamo</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Product Info */}
          <View style={styles.productSection}>
            <View style={styles.productInfo}>
              <Ionicons name="cube-outline" size={24} color="#007bff" />
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.nombre}</Text>
                <Text style={styles.productCategory}>{product.categoria}</Text>
              </View>
            </View>
          </View>

          {/* Duration Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duración del Préstamo</Text>
            <Text style={styles.sectionSubtitle}>
              ¿Por cuánto tiempo necesitas el equipo?
            </Text>

            <View style={styles.optionsContainer}>
              {durationOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionCard,
                    selectedDuration === option.value && styles.selectedOption,
                  ]}
                  onPress={() => setSelectedDuration(option.value)}
                >
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionLabel,
                        selectedDuration === option.value &&
                          styles.selectedOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        selectedDuration === option.value &&
                          styles.selectedOptionDescription,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioButton,
                      selectedDuration === option.value &&
                        styles.radioButtonSelected,
                    ]}
                  >
                    {selectedDuration === option.value && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Days Selector */}
            {selectedDuration === "custom" && (
              <View style={styles.customDaysContainer}>
                <Text style={styles.customDaysLabel}>
                  ¿Cuántos días necesitas?
                </Text>
                <View style={styles.daysSelector}>
                  <TouchableOpacity
                    style={styles.dayButton}
                    onPress={() => {
                      const current = parseInt(customDays) || 1;
                      if (current > 1) setCustomDays((current - 1).toString());
                    }}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={Colors.light.secondary}
                    />
                  </TouchableOpacity>

                  <View style={styles.daysInputContainer}>
                    <Text style={styles.daysNumber}>{customDays}</Text>
                    <Text style={styles.daysText}>
                      día{parseInt(customDays) !== 1 ? "s" : ""}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.dayButton}
                    onPress={() => {
                      const current = parseInt(customDays) || 1;
                      if (current < 30) setCustomDays((current + 1).toString());
                    }}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={Colors.light.secondary}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.daysSliderContainer}>
                  <View
                    style={styles.sliderTrack}
                    onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                    onStartShouldSetResponder={() => true}
                    onResponderMove={(e) =>
                      handleSliderChange(e.nativeEvent.locationX)
                    }
                    onResponderRelease={(e) =>
                      handleSliderChange(e.nativeEvent.locationX)
                    }
                  >
                    <View
                      style={[
                        styles.sliderProgress,
                        {
                          width: `${((parseInt(customDays) - 1) / 29) * 100}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.sliderThumb,
                        { left: `${((parseInt(customDays) - 1) / 29) * 100}%` },
                      ]}
                      pointerEvents="none"
                    />
                  </View>
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>1 día</Text>
                    <Text style={styles.sliderLabel}>30 días</Text>
                  </View>
                </View>

                <Text style={styles.customDaysHint}>
                  Mínimo: 1 día • Máximo: 30 días
                </Text>
              </View>
            )}
          </View>

          {/* Purpose Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Propósito del Préstamo</Text>
            <Text style={styles.sectionSubtitle}>
              ¿Para qué vas a usar el equipo?
            </Text>

            <View style={styles.purposeGrid}>
              {purposeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.purposeCard,
                    selectedPurpose === option.value && styles.selectedPurpose,
                  ]}
                  onPress={() => handlePurposeSelection(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={
                      selectedPurpose === option.value ? "#007bff" : "#525f7f"
                    }
                  />
                  <Text
                    style={[
                      styles.purposeLabel,
                      selectedPurpose === option.value &&
                        styles.selectedPurposeText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Purpose Description */}
            {selectedPurpose === "other" && (
              <View style={styles.customPurposeContainer}>
                <Text style={styles.customPurposeLabel}>
                  Describe el propósito específico
                </Text>
                <TextInput
                  style={[
                    styles.customPurposeInput,
                    {
                      borderColor:
                        customPurposeDescription.length < 10
                          ? Colors.light.error
                          : customPurposeDescription.length > 90
                            ? Colors.light.warning
                            : Colors.light.success,
                    },
                  ]}
                  placeholder="Ej: Análisis de muestras para proyecto de química orgánica..."
                  placeholderTextColor={Colors.light.gray}
                  value={customPurposeDescription}
                  onChangeText={setCustomPurposeDescription}
                  maxLength={100}
                  multiline={true}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.characterCount}>
                  <Text
                    style={[
                      styles.characterCountText,
                      {
                        color:
                          customPurposeDescription.length < 10
                            ? Colors.light.error
                            : customPurposeDescription.length > 90
                              ? Colors.light.warning
                              : Colors.light.success,
                      },
                    ]}
                  >
                    {customPurposeDescription.length}/100 caracteres
                  </Text>
                  <Text style={styles.characterCountHint}>
                    {customPurposeDescription.length < 10
                      ? `Necesitas ${10 - customPurposeDescription.length} caracteres más`
                      : "Descripción válida"}
                  </Text>
                </View>
                <Text style={styles.customPurposeHint}>
                  Sé específico: menciona el uso exacto, proyecto o actividad
                  para la que necesitas el equipo
                </Text>
              </View>
            )}
          </View>

          {/* Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Términos y Condiciones</Text>
            <View style={styles.termsList}>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.termText}>
                  Devolver el equipo en las mismas condiciones
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.termText}>
                  Respetar el tiempo máximo de préstamo
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.termText}>
                  Reportar cualquier daño inmediatamente
                </Text>
              </View>
              <View style={styles.termItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.termText}>
                  Usar el equipo solo para fines académicos
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting ||
                !selectedPurpose ||
                !selectedDuration ||
                (selectedDuration === "custom" &&
                  (isNaN(parseInt(customDays)) ||
                    parseInt(customDays) < 1 ||
                    parseInt(customDays) > 30)) ||
                (selectedPurpose === "other" &&
                  (customPurposeDescription.trim().length < 10 ||
                    customPurposeDescription.trim().length > 100))) &&
                styles.disabledButton,
            ]}
            onPress={crearPrestamo}
            disabled={
              isSubmitting ||
              !selectedPurpose ||
              !selectedDuration ||
              (selectedDuration === "custom" &&
                (isNaN(parseInt(customDays)) ||
                  parseInt(customDays) < 1 ||
                  parseInt(customDays) > 30)) ||
              (selectedPurpose === "other" &&
                (customPurposeDescription.trim().length < 10 ||
                  customPurposeDescription.trim().length > 100))
            }
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitButtonText}>Enviando...</Text>
              </>
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Enviar Solicitud</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardDismissWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 40,
  },
  productSection: {
    backgroundColor: Colors.light.background,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  productDetails: {
    marginLeft: 16,
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.primary,
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 15,
    color: Colors.light.gray,
    fontWeight: "500",
  },
  section: {
    backgroundColor: Colors.light.background,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: Colors.light.gray,
    marginBottom: 20,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundAlt,
  },
  selectedOption: {
    borderColor: Colors.light.secondary,
    backgroundColor: Colors.light.accent,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textDark,
  },
  selectedOptionText: {
    color: Colors.light.secondary,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.light.gray,
    marginTop: 4,
    lineHeight: 18,
  },
  selectedOptionDescription: {
    color: Colors.light.secondary,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: Colors.light.secondary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.secondary,
  },
  purposeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  purposeCard: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundAlt,
  },
  selectedPurpose: {
    borderColor: Colors.light.secondary,
    backgroundColor: Colors.light.accent,
  },
  purposeLabel: {
    fontSize: 14,
    color: Colors.light.textDark,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  selectedPurposeText: {
    color: Colors.light.secondary,
    fontWeight: "600",
  },
  termsList: {
    gap: 16,
  },
  termItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  termText: {
    fontSize: 14,
    color: Colors.light.gray,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.light.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: Colors.light.gray,
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  customDaysContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.secondary,
  },
  customDaysLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  daysSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 20,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.light.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  daysInputContainer: {
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: Colors.light.secondary,
    minWidth: 80,
  },
  daysNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.secondary,
    lineHeight: 28,
  },
  daysText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.light.gray,
    marginTop: 2,
  },
  daysSliderContainer: {
    marginBottom: 16,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    position: "relative",
    marginHorizontal: 12,
  },
  sliderProgress: {
    height: 6,
    backgroundColor: Colors.light.secondary,
    borderRadius: 3,
    position: "absolute",
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: Colors.light.secondary,
    borderRadius: 10,
    position: "absolute",
    top: -7,
    marginLeft: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  sliderLabel: {
    fontSize: 12,
    color: Colors.light.gray,
    fontWeight: "500",
  },
  customDaysHint: {
    fontSize: 12,
    color: Colors.light.gray,
    textAlign: "center",
    fontStyle: "italic",
  },
  customPurposeContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.secondary,
  },
  customPurposeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    marginBottom: 12,
  },
  customPurposeInput: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    padding: 12,
    fontSize: 14,
    color: Colors.light.textDark,
    minHeight: 80,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  characterCount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  characterCountText: {
    fontSize: 12,
    fontWeight: "600",
  },
  characterCountHint: {
    fontSize: 11,
    color: Colors.light.gray,
    fontStyle: "italic",
  },
  customPurposeHint: {
    fontSize: 12,
    color: Colors.light.gray,
    lineHeight: 16,
    fontStyle: "italic",
  },
});

export default LoanRequestModal;
