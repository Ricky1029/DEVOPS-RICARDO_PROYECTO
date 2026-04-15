import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    DimensionValue,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

interface Equipo {
  id: string;
  nombre: string;
  categoria?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  estado?: string;
  ubicacion?: string;
  cantidad?: number;
  foto?: string;
  especificaciones?: string;
}

const EquiposAdminScreen = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    fetchArticulos();
  }, []);

  const fetchArticulos = () => {
    fetch("https://api.prestaapp.site/articulos")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const articulosMapeados = data.map((a: any) => ({
            id: a.ID?.toString() || "",
            nombre: a.Nombre || `Artículo #${a.ID}`,
            categoria: a.Categoria || "",
            marca: a.Marca || "",
            modelo: a.Modelo || "",
            serie: a.Serie || "",
            estado: a.Estado || "",
            ubicacion: a.Ubicacion || "",
            cantidad: a.Cantidad || 0,
            foto: a.Foto || "",
            especificaciones: a.Especificaciones || "",
          }));

          setEquipos(articulosMapeados);
        } else {
          setEquipos([]);
        }

        setLoading(false);
      })
      .catch((error) => {
        if (Platform.OS === "web") {
          window.alert("Error: No se pudieron cargar los equipos.");
        } else {
          Alert.alert("Error", "No se pudieron cargar los equipos.");
        }
        if (__DEV__) {
          console.error("Error fetching equipos: ", error);
        }
        setLoading(false);
      });
  };

  const handleEdit = (item: Equipo) => {
    router.push({ pathname: "/admin/equipos/modal", params: { id: item.id } });
  };

  const handleDelete = (item: Equipo) => {
    const confirmDelete = async () => {
      try {
        const response = await fetch(
          `https://api.prestaapp.site/articulos/eliminar/${item.id}`,
          { method: "DELETE" },
        );

        if (response.ok) {
          if (Platform.OS === "web") {
            window.alert("Éxito: Equipo eliminado correctamente.");
          } else {
            Alert.alert("Éxito", "Equipo eliminado correctamente.");
          }
          fetchArticulos();
        } else {
          if (Platform.OS === "web") {
            window.alert("Error: No se pudo eliminar el equipo.");
          } else {
            Alert.alert("Error", "No se pudo eliminar el equipo.");
          }
        }
      } catch (error) {
        if (Platform.OS === "web") {
          window.alert("Error: No se pudo eliminar el equipo.");
        } else {
          Alert.alert("Error", "No se pudo eliminar el equipo.");
        }
        if (__DEV__) {
          console.error("Error deleting document: ", error);
        }
      }
    };

    if (Platform.OS === "web") {
      const confirmar = window.confirm(
        `¿Estás seguro de que quieres eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
      );
      if (confirmar) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        "Confirmar Eliminación",
        `¿Estás seguro de que quieres eliminar "${item.nombre}"? Esta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: confirmDelete },
        ],
      );
    }
  };

  const handleAdd = () => {
    router.push("/admin/equipos/modal");
  };

  const columns = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    if (width < 1200) return 3;
    return 4;
  }, [isMobile, isTablet, width]);

  const cardWidth: DimensionValue = useMemo(
    () => `${100 / columns - 2}%` as DimensionValue,
    [columns],
  );

  const itemsPerPage = useMemo(() => {
    if (isMobile) return 6;
    if (isTablet) return 8;
    return 12;
  }, [isMobile, isTablet]);

  useEffect(() => {
    setCurrentPage(1);
  }, [equipos.length, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(equipos.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedEquipos = equipos.slice(indexOfFirstItem, indexOfLastItem);

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

  const StatusDot = ({ active }: { active: boolean }) => (
    <View
      style={[
        styles.statusDot,
        active ? styles.statusDotOn : styles.statusDotOff,
      ]}
    />
  );

  const EquipoCard = ({ item }: { item: Equipo }) => (
    <Pressable
      style={({ hovered }) => [
        styles.card,
        { width: isMobile ? "100%" : cardWidth },
        hovered && Platform.OS === "web" && styles.cardHover,
      ]}
    >
      <View style={styles.cardImageWrapper}>
        {item.foto ? (
          <Image
            source={{ uri: item.foto }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="image" size={28} color="#9aa4b5" />
            <Text style={styles.cardPlaceholderText}>Sin foto</Text>
          </View>
        )}
        <View style={styles.cardStatus}>
          <StatusDot active={!!item.estado} />
          <Text style={styles.statusLabel}>
            {item.estado ? "Disponible" : "No disponible"}
          </Text>
        </View>
        <View style={styles.cardActionsHover}>
          <Pressable
            style={({ hovered }) => [
              styles.iconButton,
              styles.iconButtonPrimary,
              hovered && Platform.OS === "web" && styles.iconButtonHover,
            ]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil" size={18} color="#fff" />
          </Pressable>
          <Pressable
            style={({ hovered }) => [
              styles.iconButton,
              styles.iconButtonDanger,
              hovered && Platform.OS === "web" && styles.iconButtonHover,
            ]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.nombre}</Text>
        <Text style={styles.cardCategory}>
          {item.categoria || "Sin categoría"}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.metaChip}>
          <Ionicons
            name="hardware-chip-outline"
            size={14}
            color="#4b5563"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.metaChipText}>
            {item.categoria || "Tipo no especificado"}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[
          styles.container,
          (isMobile || isTablet) && styles.containerMobile,
        ]}
        contentContainerStyle={{ paddingBottom: 96 }}
      >
        {Platform.OS === "web" && !isMobile && !isTablet && (
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="laptop-outline" size={24} color="#0A2540" />
              <Text style={styles.title}>Gestión de Equipos</Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#0A66FF"
            style={styles.loader}
          />
        ) : (
          <View
            style={[styles.cardsContainer, { justifyContent: "flex-start" }]}
          >
            {paginatedEquipos.map((item) => (
              <EquipoCard key={item.id} item={item} />
            ))}
          </View>
        )}

        {!loading && totalPages > 1 && (
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
                      currentPage === 1 && styles.paginationButtonTextDisabled,
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
                    {Math.min(indexOfLastItem, equipos.length)} de{" "}
                    {equipos.length})
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
      </ScrollView>

      <Pressable
        style={({ hovered }) => [
          styles.fab,
          (isMobile || isTablet) && styles.fabMobile,
          hovered && Platform.OS === "web" && styles.fabHover,
        ]}
        onPress={handleAdd}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 24,
  },
  containerMobile: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A2540",
    letterSpacing: 0,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0A66FF",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 14px 32px rgba(10,102,255,0.25)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        ":hover": {
          transform: "translateY(-2px) scale(1.02)",
          boxShadow: "0 18px 36px rgba(10,102,255,0.35)",
        },
      },
      default: {
        shadowColor: "#0A66FF",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  fabMobile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    bottom: 18,
    right: 18,
  },
  loader: {
    marginTop: 40,
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6edf5",
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 18px 42px rgba(10,37,64,0.12)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        cursor: "pointer",
        ":hover": {
          transform: "translateY(-4px) scale(1.012)",
          boxShadow: "0 24px 50px rgba(10,37,64,0.18)",
        },
      },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
  },
  cardHover: {
    transform: "translateY(-4px) scale(1.012)",
    boxShadow: "0 24px 50px rgba(10,37,64,0.18)",
  },
  cardImageWrapper: {
    width: "100%",
    height: 180,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#f5f7fb",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  cardPlaceholderText: {
    color: "#9aa4b5",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  cardStatus: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e6edf5",
  },
  statusLabel: { color: "#0A2540", fontWeight: "700", fontSize: 12 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 6,
  },
  statusDotOn: { backgroundColor: "#22c55e" },
  statusDotOff: { backgroundColor: "#d1434b", shadowColor: "#d1434b" },
  cardActionsHover: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 10,
    opacity: 1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
        cursor: "pointer",
        transition: "transform 0.16s ease, box-shadow 0.16s ease",
        ":hover": {
          transform: "scale(1.06)",
          boxShadow: "0 14px 22px rgba(0,0,0,0.18)",
        },
      },
    }),
  },
  iconButtonHover: {
    transform: "scale(1.06)",
    boxShadow: "0 14px 22px rgba(0,0,0,0.18)",
  },
  iconButtonPrimary: { backgroundColor: "#0A66FF" },
  iconButtonDanger: { backgroundColor: "#d1434b" },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A2540",
  },
  cardCategory: {
    fontSize: 14,
    color: "#6b7280",
    letterSpacing: 0.2,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f6fb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e6edf5",
  },
  metaChipText: {
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "600",
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
    marginTop: 6,
    ...Platform.select({
      web: { boxShadow: "0 10px 24px rgba(10,37,64,0.08)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
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
    borderRadius: 10,
    backgroundColor: "#f7f9fc",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.16s ease, background-color 0.16s ease",
        ":hover": {
          transform: "translateY(-1px)",
          backgroundColor: "#edf3fb",
        },
      },
    }),
  },
  paginationButtonHover: {
    transform: "translateY(-1px)",
    backgroundColor: "#edf3fb",
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.secondary,
  },
  paginationButtonTextDisabled: {
    color: Colors.light.gray,
  },
  paginationInfo: {
    alignItems: "center",
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  paginationSubtext: {
    fontSize: 12,
    color: Colors.light.gray,
    marginTop: 2,
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
  paginationTextCompact: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.light.primary,
  },
  fabHover: {
    transform: "translateY(-2px) scale(1.02)",
    boxShadow: "0 18px 36px rgba(10,102,255,0.35)",
  },
});

export default EquiposAdminScreen;
