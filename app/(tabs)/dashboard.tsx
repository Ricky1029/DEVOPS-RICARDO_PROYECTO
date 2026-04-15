import { Header } from "@/components/header";
import { ProductCard } from "@/components/shared/product-card";
import { KeyboardDismissWrapper } from "@/components/ui/keyboard-dismiss-wrapper";
import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import { useNotifications } from "@/hooks/use-notifications";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    FlatList,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SideMenu } from "../../components/shared/side-menu";

// Interfaces
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

// Componente de Carrusel Horizontal
const HorizontalCarousel = ({
  title,
  data,
  onItemPress,
}: {
  title: string;
  data: Equipo[];
  onItemPress: (item: Equipo) => void;
}) => {
  const { isMobile, isTablet } = useResponsive();

  return (
    <View
      style={[
        styles.carouselContainer,
        {
          paddingHorizontal: isMobile ? 12 : isTablet ? 16 : 20,
          marginBottom: isMobile ? 16 : 20,
        },
      ]}
    >
      <Text
        style={[
          styles.sectionTitle,
          {
            fontSize: isMobile ? 18 : isTablet ? 20 : 22,
            marginBottom: isMobile ? 12 : 16,
          },
        ]}
      >
        {title}
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard item={item} onPress={() => onItemPress(item)} />
        )}
        contentContainerStyle={[
          styles.carouselContent,
          { paddingHorizontal: isMobile ? 4 : 8 },
        ]}
      />
    </View>
  );
};

// Componente Principal
const DashboardScreen = () => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const router = useRouter();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { vpsUserId } = useVpsUser();
  const { notificacionesNoLeidas, refreshNotificaciones } = useNotifications(
    vpsUserId ? parseInt(vpsUserId) : null,
  );

  // Animaciones del menú lateral
  const slideAnim = useState(new Animated.Value(-300))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

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

  // Cargar datos del vps
  useEffect(() => {
    fetchEquipos();
  }, []);

  // Refrescar notificaciones cuando la pantalla se enfoca
  useFocusEffect(
    useCallback(() => {
      refreshNotificaciones();
    }, [refreshNotificaciones]),
  );

  const fetchEquipos = () => {
    try {
      fetch("https://api.prestaapp.site/articulos")
        .then((response) => response.json())
        .then((data) => {
          const articulos = data.map((item: any) => ({
            id: String(item.ID),
            nombre: item.Nombre,
            tipo: item.Categoria,
            categoria: item.Categoria,
            marca: item.Marca,
            modelo: item.Modelo,
            serie: item.Serie,
            estado: item.Estado,
            ubicacion: item.Ubicacion,
            cantidad: item.Cantidad,
            imagen: item.Foto,
            foto: item.Foto,
            especificaciones: item.Especificaciones,
          }));
          setEquipos(articulos);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error al cargar equipos:", error);
          setEquipos([]);
          setLoading(false);
        });
    } catch (error) {
      console.error("Error al cargar equipos:", error);
      setEquipos([]);
      setLoading(false);
    }
  };

  const handleProductPress = (item: Equipo) => {
    router.push({
      pathname: "/product-details",
      params: {
        id: item.id,
        nombre: item.Nombre,
        categoria: item.Categoria || "Sin tipo",
        estado: item.Estado?.toString() || "false",
        imagen: item.Foto || "https://via.placeholder.com/300",
      },
    });
  };

  // Filtrar productos por búsqueda (sin acentos)
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.secondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardDismissWrapper>
        {/* Header */}
        <Header onMenuPress={toggleMenu}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.searchContainer,
                isSearchFocused && styles.searchContainerFocused,
              ]}
            >
              <Ionicons
                name="search-outline"
                size={isMobile ? 18 : 20}
                color={
                  isSearchFocused ? Colors.light.primary : Colors.light.gray
                }
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { fontSize: isMobile ? 14 : 16 }]}
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
            </View>
            <TouchableOpacity
              style={[
                styles.iconButton,
                { marginLeft: isMobile ? 10 : 14, position: "relative" },
              ]}
              onPress={() => router.push("/notifications")}
              accessibilityLabel="Abrir notificaciones"
            >
              <Ionicons
                name={
                  notificacionesNoLeidas > 0
                    ? "notifications"
                    : "notifications-outline"
                }
                size={isMobile ? 18 : 20}
                color={
                  notificacionesNoLeidas > 0 ? "#DC2626" : Colors.light.primary
                }
              />
              {notificacionesNoLeidas > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificacionesNoLeidas > 9 ? "9+" : notificacionesNoLeidas}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Header>

        {/* Menú Lateral */}
        <SideMenu
          isVisible={isMenuVisible}
          onClose={toggleMenu}
          slideAnim={slideAnim}
          fadeAnim={fadeAnim}
        />

        {/* Contenido Principal */}
        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: isMobile ? 20 : 30,
          }}
        >
          {/* Los más Reservados */}
          <HorizontalCarousel
            title="Los más Reservados"
            data={displayedEquipos.slice(0, 5)}
            onItemPress={handleProductPress}
          />

          <HorizontalCarousel
            title="Recomendados para Ti"
            data={displayedEquipos.slice(5, 11)}
            onItemPress={handleProductPress}
          />

          {/* Seguir Reservando */}
          <HorizontalCarousel
            title="Seguir Reservando"
            data={displayedEquipos.slice(0, 5).reverse()}
            onItemPress={handleProductPress}
          />
        </ScrollView>
      </KeyboardDismissWrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 6,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundAlt,
  },
  mainContent: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "transparent",
    ...(Platform.OS === "web"
      ? {
          transition: "all 0.2s ease",
        }
      : {}),
  },
  searchContainerFocused: {
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.secondary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.light.textDark,
    paddingRight: 4,
    ...(Platform.OS === "web"
      ? {
          outlineStyle: "none" as any,
        }
      : {}),
  },
  carouselContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: Colors.light.textDark,
  },
  carouselContent: {
    paddingVertical: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default DashboardScreen;
