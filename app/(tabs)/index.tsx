import { GridProductCard } from "@/components/shared/grid-product-card";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    arrayRemove,
    arrayUnion,
    doc,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    FlatList,
    Platform,
    SafeAreaView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

import { Header } from "@/components/header";
import { KeyboardDismissWrapper } from "@/components/ui/keyboard-dismiss-wrapper";
import { useResponsive } from "@/hooks/use-responsive";
import { SideMenu } from "../../components/shared/side-menu";
import { auth, db } from "../../firebaseConfig";

// Define the structure of an Equipo
interface Equipo {
  id: string;
  nombre: string;
  tipo?: string;
  categoria?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  estado?: boolean;
  ubicacion?: string;
  cantidad?: number;
  foto?: string;
  imagen?: string;
  especificaciones?: string;
  codigo?: string;
}

const CatalogScreen = () => {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    fetchEquipos();
  }, []);

  const fetchEquipos = async () => {
    try {
      const response = await fetch("https://api.prestaapp.site/articulos");
      const data = await response.json();

      const mapped: Equipo[] = data.map((item: any, index: number) => ({
        id: item.ID,
        nombre: item.Nombre ?? "",
        categoria: item.Categoria ?? "",
        estado: item.Estado ?? false,
        imagen: item.Foto ?? "",
      }));

      // 🔥 eliminar duplicados por id
      const unique = Array.from(
        new Map(mapped.map((item) => [item.id, item])).values(),
      );

      setEquipos(unique);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching equipos:", error);
      setLoading(false);
    }
  };

  const numColumns = 2;

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

  const handleToggleFavorite = async (item: Equipo) => {
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
      await setDoc(userRef, { favoritos: [] }, { merge: true });
      const alreadyFav = favoriteIds.includes(item.id);
      if (alreadyFav) {
        await updateDoc(userRef, { favoritos: arrayRemove(item.id) });
      } else {
        await updateDoc(userRef, { favoritos: arrayUnion(item.id) });
      }
    } catch (error) {
      console.error("Error al actualizar favoritos", error);
      Alert.alert("Error", "No pudimos actualizar tus favoritos.");
    }
  };

  const handleProductPress = (item: Equipo) => {
    router.push({
      pathname: "../product-details" as any,
      params: {
        id: item.id as string,
        nombre: item.Nombre,
        categoria: item.Categoria || "Sin categoría",
        estado: item.Estado?.toString() || "false",
        imagen: item.Foto || "https://via.placeholder.com/300",
      },
    });
  };

  const normalize = (text?: string) =>
    (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const displayedEquipos = equipos.filter((equipo) => {
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
    return (
      normalize(equipo.nombre).includes(q) ||
      normalize(equipo.tipo).includes(q) ||
      normalize((equipo as any).categoria).includes(q) ||
      normalize((equipo as any).codigo)?.includes?.(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardDismissWrapper>
        <Header onMenuPress={toggleMenu}>
          <View style={styles.headerSearchRow}>
            <Animated.View
              style={[
                styles.searchContainer,
                isSearchFocused && styles.searchContainerFocused,
                { flex: 1 },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={
                  isSearchFocused ? Colors.light.primary : Colors.light.gray
                }
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar equipos..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholderTextColor={Colors.light.gray}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                inputMode="search"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setIsSearchFocused(true);
                }}
              />
            </Animated.View>
          </View>
        </Header>

        <SideMenu
          isVisible={isMenuVisible}
          onClose={toggleMenu}
          slideAnim={slideAnim}
          fadeAnim={fadeAnim}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={displayedEquipos}
            renderItem={({ item }) => (
              <GridProductCard
                item={item}
                onPress={() => handleProductPress(item)}
                onToggleFavorite={() => handleToggleFavorite(item)}
                isFavorite={favoriteIds.includes(item.id)}
              />
            )}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={[
              styles.list,
              { paddingHorizontal: 20, paddingVertical: 12 },
            ]}
            columnWrapperStyle={{ gap: isMobile ? 12 : 16 }}
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </KeyboardDismissWrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  headerSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundAlt,
    paddingHorizontal: 14,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 200,
  },
  searchContainerFocused: {
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.textDark,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.light.secondary,
    fontWeight: "600",
  },
  // Menu styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sideMenu: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "70%",
    backgroundColor: Colors.light.background,
    paddingVertical: 20,
    paddingHorizontal: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemText: {
    marginLeft: 15,
    fontSize: 16,
    color: Colors.light.text,
  },
  list: {
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  filterButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default CatalogScreen;
