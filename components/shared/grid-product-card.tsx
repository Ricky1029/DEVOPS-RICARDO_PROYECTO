import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

// Interfaces
interface Equipo {
  id: string;
  nombre: string;
  tipo?: string;
  estado?: boolean;
  imagen?: string;
}

// Componente de Tarjeta de Producto para Grilla
export const GridProductCard = ({
  item,
  onPress,
  onToggleFavorite,
  isFavorite,
}: {
  item: Equipo;
  onPress: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  return (
    <TouchableOpacity
      style={[styles.productCard, { marginBottom: 16 }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View
          style={[
            styles.imageContainer,
            { borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Image
            source={{ uri: item.imagen || "https://via.placeholder.com/150" }}
            style={styles.productImage}
            resizeMode="contain"
          />
          {item.estado === false && (
            <View style={styles.unavailableBadge}>
              <Text style={styles.unavailableText}>No disponible</Text>
            </View>
          )}
          
        </View>
        <View style={[styles.productInfo, { padding: isMobile ? 12 : 14 }]}>
          <Text
            style={[
              styles.productName,
              {
                fontSize: isMobile ? 14 : 16,
                lineHeight: isMobile ? 18 : 20,
              },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {item.nombre}
          </Text>
          <Text
            style={[styles.productType, { fontSize: isMobile ? 12 : 13 }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.tipo || "Sin tipo"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? {
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "pointer",
        }
      : {}),
  },
  cardContent: {
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  imageContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 12,
    position: "relative",
    width: "100%",
    aspectRatio: 1,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productInfo: {
    flex: 1,
    justifyContent: "space-between",
    gap: 6,
  },
  productName: {
    fontWeight: "600",
    color: Colors.light.textDark,
    marginBottom: 2,
  },
  productType: {
    fontSize: 14,
    color: Colors.light.gray,
    marginBottom: 0,
  },
  unavailableBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#fff1f1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unavailableText: {
    color: Colors.light.error,
    fontSize: 11,
    fontWeight: "600",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
});
