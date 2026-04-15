import { Header } from "@/components/header";
import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { SideMenu } from "../../components/shared/side-menu";
import { auth } from "../../firebaseConfig";

import { SafeAreaView } from "react-native-safe-area-context";

const MOTION_MS = 220;

interface UserProfile {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  ubicacion: string;
  matricula: string;
  avatar?: string;
}

const ProfileScreen = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftProfile, setDraftProfile] = useState<UserProfile | null>(null);
  const [locating, setLocating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const slideAnim = useState(new Animated.Value(-300))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const router = useRouter();
  const pathname = usePathname();
  const { vpsUserId, clearVpsUserId } = useVpsUser();
  const { width } = useWindowDimensions();
  const { isMobile, isTablet, isDesktop, isWeb } = useResponsive();

  // Responsive values
  const avatarSize = isMobile ? 80 : isTablet ? 100 : 120;
  const headerPadding = isMobile ? 16 : isTablet ? 24 : 32;
  const sectionPadding = isMobile ? 16 : isTablet ? 24 : 32;
  const contentMaxWidth = isDesktop ? 800 : width;

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
        duration: MOTION_MS,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();
    setIsMenuVisible(!isMenuVisible);
  };

  const fetchUserProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    // Si no hay ID del VPS, solo usar datos de Firebase
    if (!vpsUserId) {
      const profile = {
        nombre: user.displayName?.split(" ")[0] || "Usuario",
        apellidos: user.displayName?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        telefono: "",
        ubicacion: "",
        matricula: "",
        avatar:
          user.photoURL ||
          `https://ui-avatars.com/api/?name=${user.displayName || "Usuario"}&background=1a3a6b&color=fff`,
      };
      setUserProfile(profile);
      setDraftProfile(profile);
      return;
    }

    // Obtener datos del usuario desde el VPS
    try {
      console.log("Obteniendo perfil de usuario VPS con ID:", vpsUserId);
      const response = await fetch(
        `https://api.prestaapp.site/usuarios/id/${vpsUserId}`,
      );

      if (!response.ok) {
        console.log("Error al obtener perfil del VPS:", response.status);
        throw new Error("No se pudo obtener el perfil del usuario");
      }

      const userData = await response.json();
      console.log("Datos del usuario obtenidos del VPS:", userData);

      const profile: UserProfile = {
        nombre: userData.nombre || user.displayName?.split(" ")[0] || "Usuario",
        apellidos:
          userData.apellido ||
          userData.apellidos ||
          user.displayName?.split(" ").slice(1).join(" ") ||
          "",
        email: userData.correo || user.email || "",
        telefono: userData.telefono || "",
        ubicacion: userData.ubicacion || "",
        matricula: userData.matricula || "",
        avatar:
          userData.foto ||
          user.photoURL ||
          `https://ui-avatars.com/api/?name=${userData.nombre || "Usuario"}&background=1a3a6b&color=fff`,
      };

      setUserProfile(profile);
      setDraftProfile(profile);
    } catch (error) {
      console.error("Error al obtener perfil del VPS:", error);
      // Fallback a datos de Firebase si falla
      const profile = {
        nombre: user.displayName?.split(" ")[0] || "Usuario",
        apellidos: user.displayName?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        telefono: "",
        ubicacion: "",
        matricula: "",
        avatar:
          user.photoURL ||
          `https://ui-avatars.com/api/?name=${user.displayName || "Usuario"}&background=1a3a6b&color=fff`,
      };
      setUserProfile(profile);
      setDraftProfile(profile);
    }
  }, [vpsUserId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserProfile()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await clearVpsUserId();
      auth.signOut();
      router.replace("/login");
    } catch (error) {
      console.error("Logout Error: ", error);
      auth.signOut();
      router.replace("/login");
    } finally {
      setTimeout(() => setLoggingOut(false), 1200);
    }
  };

  const handleSaveProfile = async () => {
    if (!draftProfile) return;

    try {
      console.log("Datos enviados al VPS:", {
        id: vpsUserId,
        ubicacion: draftProfile.ubicacion,
      });

      // Opción 1: Endpoint específico para ubicación
      const response = await fetch(
        `https://api.prestaapp.site/usuarios/modificar/ubicacion/${vpsUserId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ubicacion: draftProfile.ubicacion,
          }),
        },
      );

      console.log("Respuesta del servidor:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(
          "Error al guardar perfil en el VPS:",
          response.status,
          errorData,
        );
        throw new Error(
          `No se pudo guardar el perfil del usuario: ${errorData}`,
        );
      }

      setUserProfile(draftProfile);
      setIsEditing(false);
      Alert.alert("Perfil actualizado", "Tus datos se han guardado.");
    } catch (error) {
      console.error("Error al guardar perfil:", error);
      Alert.alert("Error", "No pudimos guardar tu perfil. Intenta de nuevo.");
    }
  };

  const handleUpdateLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "Necesitamos permiso de ubicación para guardar tu posición.",
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const geo = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const first = geo[0];
      const humanReadable = first
        ? `${first.street || ""} ${first.streetNumber || ""}, ${first.city || first.subregion || ""}, ${first.region || ""}`.trim()
        : `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;

      setDraftProfile((prev) =>
        prev ? { ...prev, ubicacion: humanReadable } : prev,
      );
      Alert.alert("Ubicación actualizada", "Se registró tu ubicación actual.");
    } catch (error) {
      console.error("Location error", error);
      Alert.alert(
        "Error",
        "No pudimos obtener tu ubicación. Intenta de nuevo.",
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header onMenuPress={toggleMenu}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Mi Perfil</Text>
          <TouchableOpacity
            style={[
              styles.iconButton,
              isEditing && { backgroundColor: Colors.light.primary },
            ]}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Ionicons
              name={isEditing ? "close" : "pencil"}
              size={20}
              color={isEditing ? "#fff" : Colors.light.primary}
            />
          </TouchableOpacity>
        </View>
      </Header>
      <SideMenu
        isVisible={isMenuVisible}
        onClose={toggleMenu}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={isMobile ? 80 : 40}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="always"
          contentContainerStyle={{
            alignItems: "center",
            paddingBottom: 120,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={{ width: "100%", maxWidth: contentMaxWidth }}>
            {/* Header con información del usuario */}
            <View style={[styles.header, { padding: headerPadding }]}>
              <Image
                source={{ uri: userProfile?.avatar }}
                style={[
                  styles.avatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                  },
                ]}
              />
              <View style={styles.userInfo}>
                <Text
                  style={[
                    styles.userName,
                    { fontSize: isMobile ? 22 : isTablet ? 26 : 30 },
                  ]}
                >
                  {userProfile
                    ? `${userProfile.nombre} ${userProfile.apellidos}`
                    : ""}
                </Text>
                <Text
                  style={[styles.userEmail, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.email}
                </Text>
              </View>
            </View>

            {/* Información Personal */}
            <View
              style={[styles.section, { paddingHorizontal: sectionPadding }]}
            >
              <Text
                style={[styles.sectionTitle, { fontSize: isMobile ? 18 : 20 }]}
              >
                Información Personal
              </Text>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Nombre
                </Text>
                <Text
                  style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.nombre}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Apellidos
                </Text>
                <Text
                  style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.apellidos}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Correo
                </Text>
                <Text
                  style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.email}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Teléfono
                </Text>
                <Text
                  style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.telefono}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Ubicación
                </Text>
                {isEditing ? (
                  <TextInput
                    style={[
                      styles.infoValueInput,
                      { fontSize: isMobile ? 14 : 16 },
                    ]}
                    value={draftProfile?.ubicacion}
                    onChangeText={(text) =>
                      setDraftProfile((prev) =>
                        prev ? { ...prev, ubicacion: text } : prev,
                      )
                    }
                  />
                ) : (
                  <Text
                    style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                  >
                    {userProfile?.ubicacion}
                  </Text>
                )}
              </View>
              {isEditing && (
                <TouchableOpacity
                  style={[
                    styles.locationButton,
                    locating && styles.locationButtonDisabled,
                  ]}
                  onPress={handleUpdateLocation}
                  disabled={locating}
                >
                  <Ionicons
                    name="location"
                    size={18}
                    color={Colors.light.secondary}
                  />
                  <Text style={styles.locationButtonText}>
                    {locating
                      ? "Obteniendo ubicación..."
                      : "Usar mi ubicación actual"}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { fontSize: isMobile ? 14 : 16 }]}
                >
                  Matrícula escolar
                </Text>
                <Text
                  style={[styles.infoValue, { fontSize: isMobile ? 14 : 16 }]}
                >
                  {userProfile?.matricula}
                </Text>
              </View>
            </View>

            {/* Botones de Acción */}
            <View
              style={[
                styles.actionButtons,
                {
                  padding: sectionPadding,
                  flexDirection: isDesktop ? "row" : "column",
                },
              ]}
            >
              {isEditing && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: Colors.light.primary },
                    isWeb && styles.actionButtonWeb,
                  ]}
                  onPress={handleSaveProfile}
                >
                  <Ionicons
                    name="save-outline"
                    size={isMobile ? 20 : 24}
                    color="#fff"
                  />
                  <Text
                    style={[
                      styles.actionButtonText,
                      { fontSize: isMobile ? 14 : 16 },
                    ]}
                  >
                    Guardar Perfil
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.logoutButton, isWeb && styles.actionButtonWeb]}
                onPress={handleLogout}
              >
                <Ionicons
                  name="log-out-outline"
                  size={isMobile ? 18 : 20}
                  color={Colors.light.error}
                />
                <Text
                  style={[
                    styles.logoutButtonText,
                    { fontSize: isMobile ? 14 : 15 },
                  ]}
                >
                  Cerrar Sesión
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loggingOut && (
        <View style={styles.loggingOutOverlay}>
          <View style={styles.loggingOutCard}>
            <ActivityIndicator size="small" color={Colors.light.secondary} />
            <Text style={styles.loggingOutText}>Cerrando sesión...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  avatar: {
    marginRight: 16,
    ...Platform.select({
      web: {
        transition: "transform 0.22s ease",
      },
    }),
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: "bold",
    color: Colors.light.textDark,
    marginBottom: 4,
  },
  userEmail: {
    color: Colors.light.gray,
  },
  inputInline: {
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 4,
  },
  section: {
    marginTop: 20,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontWeight: "bold",
    color: Colors.light.textDark,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    alignItems: "center",
    gap: 12,
  },
  infoLabel: {
    color: Colors.light.gray,
    flex: 1,
  },
  infoValue: {
    color: Colors.light.textDark,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  infoValueInput: {
    flex: 1,
    color: Colors.light.textDark,
    fontWeight: "600",
    textAlign: "right",
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 4,
  },
  actionButtons: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  actionButtonWeb: {
    ...Platform.select({
      web: {
        transition: "transform 0.22s ease, opacity 0.22s ease",
        ":hover": {
          opacity: 0.9,
          transform: "translateY(-2px)",
        },
      },
    }),
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.error,
    backgroundColor: "transparent",
    ...Platform.select({
      web: { cursor: "pointer" },
    }),
  },
  logoutButtonText: {
    color: Colors.light.error,
    fontWeight: "600",
  },
  headerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  iconButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundAlt,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: -4,
    borderRadius: 10,
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  locationButtonText: {
    color: Colors.light.secondary,
    fontWeight: "700",
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  loggingOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 37, 64, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1200,
  },
  loggingOutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: "0 10px 28px rgba(10,37,64,0.14)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  loggingOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
});

export default ProfileScreen;
