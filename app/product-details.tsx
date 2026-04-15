import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
    Alert,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

interface ProductData {
  id: string;
  nombre: string;
  categoria: string;
  imagen: string;
  estado: boolean;
  marca?: string;
  modelo?: string;
  serie?: string;
  ubicacion?: string;
  cantidad?: number;
  foto?: string;
  especificaciones?: string;
}

const ProductDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [productData, setProductData] = useState<ProductData | null>(null);

  // Responsive values
  const imageHeight = isMobile ? 250 : isTablet ? 350 : 450;
  const contentPadding = isMobile ? 16 : isTablet ? 24 : 32;
  const modalMaxWidth = isDesktop ? 600 : width * 0.9;

  // Datos del producto que vendrían de los parámetros
  const product = {
    id: params.id as string,
  };

  const handleRequestLoan = () => {
    if (!productData) return;

    router.push({
      pathname: "/loan-request-modal" as any,
      params: {
        id_usuario: auth.currentUser?.uid,
        id: product.id,
        nombre: productData.nombre,
        categoria: productData.categoria,
      },
    });
  };

  const syncFavoriteState = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, "usuarios", user.uid);
    const snapshot = await getDoc(userRef);
    const favs = (snapshot.data()?.favoritos as string[] | undefined) || [];
    setIsFavorite(favs.includes(product.id));
  }, [product.id]);

  const fetchArticulo = useCallback(() => {
    fetch(`https://api.prestaapp.site/articulos/id/${product.id}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Datos del equipozzzzzzzzzzz:", data);
        setProductData({
          id: data.id || product.id,
          nombre: data.nombre || data.Nombre || "",
          categoria: data.categoria || data.Categoria || "",
          imagen: data.foto || data.Foto || "",
          estado: data.estado === "disponible" || data.Estado === "disponible",
          marca: data.marca || data.Marca || "",
          modelo: data.modelo || data.Modelo || "",
          serie: data.serie || data.Serie || "",
          ubicacion: data.ubicacion || data.Ubicacion || "",
          cantidad: data.cantidad || data.Cantidad || 0,
          foto: data.foto || data.Foto || "",
          especificaciones:
            data.especificaciones || data.Especificaciones || "",
        });
      })
      .catch((error) => {
        console.error("Error al obtener datos del equipo:", error);
        Alert.alert("Error", "No pudimos cargar los detalles del equipo.");
      });
  }, [product.id]);

  React.useEffect(() => {
    syncFavoriteState();
    fetchArticulo();
  }, [syncFavoriteState, fetchArticulo]);

  const handleAddToFavorites = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(
        "Inicia sesión",
        "Debes iniciar sesión para guardar favoritos.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Ir a login", onPress: () => router.replace("/login") },
        ],
      );
      return;
    }

    const userRef = doc(db, "usuarios", user.uid);
    try {
      // Asegurar que exista el documento
      await setDoc(userRef, { favoritos: [] }, { merge: true });

      if (isFavorite) {
        await updateDoc(userRef, { favoritos: arrayRemove(product.id) });
        setIsFavorite(false);
      } else {
        await updateDoc(userRef, { favoritos: arrayUnion(product.id) });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error("Error al actualizar favoritos", error);
      Alert.alert("Error", "No pudimos actualizar tus favoritos.");
    }
  };

  const handleViewHistory = () => {
    setIsHistoryModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          alignItems: "center",
          paddingHorizontal: contentPadding,
        }}
      >
        <View style={{ width: "100%", maxWidth: isDesktop ? 1000 : width }}>
          {/* Header */}
          <Header showBackButton onBackPress={() => router.back()}>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.headerTitle,
                  { fontSize: isMobile ? 20 : isTablet ? 24 : 28 },
                ]}
              >
                Detalles del Producto
              </Text>
            </View>
          </Header>

          {/* Product Card: Image + Info unified */}
          <View style={styles.productCard}>
            <View
              style={[
                styles.imageContainer,
                { paddingHorizontal: contentPadding },
              ]}
            >
              <Image
                source={{
                  uri: productData?.foto || "https://via.placeholder.com/300",
                }}
                style={[styles.productImage, { height: imageHeight }]}
              />
              <View
                style={[
                  styles.availabilityBadge,
                  {
                    backgroundColor: productData?.estado
                      ? "#28a745"
                      : "#dc3545",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.availabilityText,
                    { fontSize: isMobile ? 12 : 14 },
                  ]}
                >
                  {productData?.estado ? "Disponible" : "No Disponible"}
                </Text>
              </View>
            </View>
            <View style={[styles.productInfo, { padding: contentPadding }]}>
              <Text
                style={[
                  styles.productName,
                  { fontSize: isMobile ? 22 : isTablet ? 26 : 30 },
                ]}
              >
                {productData?.nombre}
              </Text>
              <Text
                style={[
                  styles.productCategory,
                  { fontSize: isMobile ? 14 : 16 },
                ]}
              >
                {productData?.categoria}
              </Text>
            </View>
          </View>

          {/* Product Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Información del Equipo</Text>
            <View style={styles.detailRow}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#525f7f"
              />
              <Text style={styles.detailText}>Código: {productData?.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="pricetag-outline" size={20} color="#525f7f" />
              <Text style={styles.detailText}>
                Categoría: {productData?.categoria}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#525f7f" />
              <Text style={styles.detailText}>
                Tiempo máximo de préstamo: 7 días
              </Text>
            </View>
          </View>

          {/* Specifications Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Especificaciones</Text>
            <View style={styles.specsContainer}>
              {productData?.marca && (
                <View style={styles.specRowAlt}>
                  <View style={styles.specLabelGroup}>
                    <Ionicons
                      name="pricetag-outline"
                      size={16}
                      color={Colors.light.gray}
                      style={styles.specIcon}
                    />
                    <Text style={styles.specLabel}>Marca</Text>
                  </View>
                  <Text style={styles.specValue}>{productData.marca}</Text>
                </View>
              )}
              {productData?.modelo && (
                <View style={styles.specRowAlt}>
                  <View style={styles.specLabelGroup}>
                    <Ionicons
                      name="cube-outline"
                      size={16}
                      color={Colors.light.gray}
                      style={styles.specIcon}
                    />
                    <Text style={styles.specLabel}>Modelo</Text>
                  </View>
                  <Text style={styles.specValue}>{productData.modelo}</Text>
                </View>
              )}
              {productData?.serie && (
                <View style={styles.specRowAlt}>
                  <View style={styles.specLabelGroup}>
                    <Ionicons
                      name="barcode-outline"
                      size={16}
                      color={Colors.light.gray}
                      style={styles.specIcon}
                    />
                    <Text style={styles.specLabel}>Serie</Text>
                  </View>
                  <Text style={styles.specValue}>{productData.serie}</Text>
                </View>
              )}
              {productData?.ubicacion && (
                <View style={styles.specRowAlt}>
                  <View style={styles.specLabelGroup}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={Colors.light.gray}
                      style={styles.specIcon}
                    />
                    <Text style={styles.specLabel}>Ubicación</Text>
                  </View>
                  <Text style={styles.specValue}>{productData.ubicacion}</Text>
                </View>
              )}
              {productData?.cantidad !== undefined && (
                <View style={styles.specRowAlt}>
                  <View style={styles.specLabelGroup}>
                    <Ionicons
                      name="layers-outline"
                      size={16}
                      color={Colors.light.gray}
                      style={styles.specIcon}
                    />
                    <Text style={styles.specLabel}>Disponibles</Text>
                  </View>
                  <Text style={styles.specValue}>{productData.cantidad}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Características</Text>
            <View style={styles.featuresContainer}>
              {productData?.especificaciones ? (
                <View style={styles.featureItem}>
                  <Ionicons name="list-outline" size={16} color="#28a745" />
                  <Text style={styles.featureText}>
                    {productData.especificaciones}
                  </Text>
                </View>
              ) : null}
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.featureText}>
                  Estado: {productData?.estado ? "Disponible" : "No disponible"}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: productData?.estado ? "#007bff" : "#6c757d",
                },
              ]}
              onPress={handleRequestLoan}
              disabled={!productData?.estado}
            >
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {productData?.estado ? "Solicitar Préstamo" : "No Disponible"}
              </Text>
            </TouchableOpacity>

            
          </View>

          {/* Additional Info */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Información Adicional</Text>
            <Text style={styles.infoText}>
              Para solicitar el préstamo de este equipo, presiona el botón
              &quot;Solicitar Préstamo&quot;. Tu solicitud será revisada por el
              administrador y recibirás una notificación con la respuesta.
            </Text>
            <Text style={styles.infoText}>
              Recuerda que debes devolver el equipo en las mismas condiciones en
              que lo recibiste y dentro del plazo establecido.
            </Text>
          </View>
          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isHistoryModalVisible}
        onRequestClose={() => {
          setIsHistoryModalVisible(!isHistoryModalVisible);
        }}
      >
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.modalContent,
              {
                maxWidth: modalMaxWidth,
                padding: isMobile ? 20 : 24,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { fontSize: isMobile ? 18 : 20 }]}
              >
                Historial del Equipo
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsHistoryModalVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={isMobile ? 22 : 24}
                  color={Colors.light.gray}
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.historyScrollContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.historyItem}>
                <View style={styles.historyItemIcon}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={Colors.light.secondary}
                  />
                </View>
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemTitle}>
                    Préstamo académico
                  </Text>
                  <Text style={styles.historyItemDate}>
                    15/10/2024 - 22/10/2024
                  </Text>
                </View>
                <View style={styles.historyItemStatus}>
                  <View
                    style={[styles.statusBadge, { backgroundColor: "#28a745" }]}
                  >
                    <Text style={styles.statusText}>Devuelto</Text>
                  </View>
                </View>
              </View>

              <View style={styles.historyItem}>
                <View style={styles.historyItemIcon}>
                  <Ionicons
                    name="construct-outline"
                    size={20}
                    color={Colors.light.warning}
                  />
                </View>
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemTitle}>
                    Mantenimiento Preventivo
                  </Text>
                  <Text style={styles.historyItemSubtitle}>
                    Revisión general y limpieza
                  </Text>
                  <Text style={styles.historyItemDate}>10/10/2024</Text>
                </View>
                <View style={styles.historyItemStatus}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: Colors.light.secondary },
                    ]}
                  >
                    <Text style={styles.statusText}>Completado</Text>
                  </View>
                </View>
              </View>

              <View style={styles.historyItem}>
                <View style={styles.historyItemIcon}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={Colors.light.secondary}
                  />
                </View>
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemTitle}>
                    Proyecto de investigación
                  </Text>
                  <Text style={styles.historyItemDate}>
                    01/10/2024 - 05/10/2024
                  </Text>
                </View>
                <View style={styles.historyItemStatus}>
                  <View
                    style={[styles.statusBadge, { backgroundColor: "#28a745" }]}
                  >
                    <Text style={styles.statusText}>Devuelto</Text>
                  </View>
                </View>
              </View>

              <View style={styles.historyItem}>
                <View style={styles.historyItemIcon}>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={Colors.light.success}
                  />
                </View>
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemTitle}>Equipo Registrado</Text>
                  <Text style={styles.historyItemSubtitle}>
                    Ingreso al inventario
                  </Text>
                  <Text style={styles.historyItemDate}>15/09/2024</Text>
                </View>
                <View style={styles.historyItemStatus}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: Colors.light.success },
                    ]}
                  >
                    <Text style={styles.statusText}>Inicial</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setIsHistoryModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontWeight: "600",
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  favoriteButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundAlt,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.2s ease",
        ":hover": {
          transform: "scale(1.1)",
        },
      },
    }),
  },
  productCard: {
    backgroundColor: Colors.light.background,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  imageContainer: {
    backgroundColor: Colors.light.background,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  productImage: {
    width: "90%",
    maxWidth: 400,
    resizeMode: "contain",
    borderRadius: 16,
  },
  availabilityBadge: {
    position: "absolute",
    top: 30,
    right: 30,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  availabilityText: {
    color: Colors.light.background,
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  productInfo: {
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    padding: 20,
  },
  productName: {
    fontSize: 26,
    fontWeight: "bold",
    color: Colors.light.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  productCategory: {
    fontSize: 16,
    color: Colors.light.gray,
    marginBottom: 24,
    fontWeight: "500",
  },
  detailsSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primary,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: Colors.light.gray,
    marginLeft: 12,
    lineHeight: 22,
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundAlt,
    padding: 12,
    borderRadius: 10,
  },
  featureText: {
    fontSize: 14,
    color: Colors.light.textDark,
    marginLeft: 12,
    fontWeight: "500",
  },
  actionsSection: {
    marginBottom: 28,
    paddingBottom: 32,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: Colors.light.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundAlt,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Colors.light.textDark,
    fontWeight: "600",
  },
  infoSection: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.light.border,
    paddingTop: 24,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.gray,
    lineHeight: 22,
    marginBottom: 16,
  },
  specsContainer: {
    gap: 12,
    backgroundColor: "transparent",
  },
  specRowAlt: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 10,
  },
  specLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  specIcon: {
    marginRight: 2,
  },
  specLabel: {
    fontSize: 13,
    color: Colors.light.gray,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  specValue: {
    fontSize: 14,
    color: Colors.light.textDark,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 0,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundAlt,
  },
  historyScrollContainer: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  historyItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyItemContent: {
    flex: 1,
    paddingRight: 8,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    marginBottom: 4,
    lineHeight: 20,
  },
  historyItemSubtitle: {
    fontSize: 14,
    color: Colors.light.gray,
    marginBottom: 6,
    lineHeight: 18,
  },
  historyItemDate: {
    fontSize: 12,
    color: Colors.light.gray,
    fontWeight: "500",
  },
  historyItemStatus: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 70,
    alignItems: "center",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.background,
    letterSpacing: 0.5,
  },
  modalButton: {
    margin: 20,
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonText: {
    color: Colors.light.background,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default ProductDetailsScreen;
