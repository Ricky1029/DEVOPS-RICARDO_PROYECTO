import { useVpsUser } from "@/contexts/VpsUserContext";
import { useResponsive } from "@/hooks/use-responsive";
import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { auth } from "../../firebaseConfig";

const MOTION_MS = 220;

const AdminLayout = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const { clearVpsUserId } = useVpsUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingLoansCount, setPendingLoansCount] = useState<number | null>(
    null,
  );
  const mobileHeaderBarHeight = 56;
  const mobileHeaderTotalHeight = insets.top + mobileHeaderBarHeight;

  // En móvil/tablet, el menú se oculta por defecto
  const showSidebar = !isMobile && !isTablet;

  const currentTitle = useMemo(() => {
    if (!pathname) return "Dashboard";
    if (pathname.includes("/admin/equipos")) return "Gestión de Equipos";
    if (pathname.includes("/admin/prestamos")) return "Gestión de Préstamos";
    if (pathname.includes("/admin/usuarios")) return "Gestión de Usuarios";
    if (pathname.includes("/admin/historial")) return "Historial";
    return "Dashboard";
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearVpsUserId();
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Logout Error: ", error);
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!pathname?.includes("/admin/prestamos")) {
      setPendingLoansCount(null);
      return;
    }

    let isActive = true;

    const loadPendingCount = async () => {
      try {
        const response = await fetch("https://api.prestaapp.site/prestamos");
        const data = await response.json();

        const prestamosArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.prestamos)
            ? data.prestamos
            : [];

        const count = prestamosArray.filter(
          (s: any) =>
            s?.Estado === "espera" ||
            s?.Estado === "pendiente" ||
            s?.Estado === "En espera",
        ).length;

        if (isActive) {
          setPendingLoansCount(count);
        }
      } catch (error) {
        if (isActive) {
          setPendingLoansCount(null);
        }
      }
    };

    loadPendingCount();
    const intervalId = setInterval(loadPendingCount, 15000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [pathname]);

  const navigateTo = (
    path:
      | "/admin"
      | "/admin/equipos"
      | "/admin/prestamos"
      | "/admin/usuarios"
      | "/admin/historial",
  ) => {
    router.replace(path);
    if (isMobile || isTablet) {
      setIsMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Panel Admin</Text>
        {(isMobile || isTablet) && (
          <TouchableOpacity
            onPress={() => setIsMenuOpen(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView style={styles.sidebarScroll}>
        <Pressable
          style={({ hovered }) => [
            styles.sidebarLink,
            hovered && styles.sidebarLinkHover,
          ]}
          onPress={() => navigateTo("/admin")}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color="#fff"
            style={styles.icon}
          />
          <Text style={styles.sidebarLinkText}>Dashboard</Text>
        </Pressable>
        <Pressable
          style={({ hovered }) => [
            styles.sidebarLink,
            hovered && styles.sidebarLinkHover,
          ]}
          onPress={() => navigateTo("/admin/equipos")}
        >
          <Ionicons name="laptop" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.sidebarLinkText}>Gestión de Equipos</Text>
        </Pressable>
        <Pressable
          style={({ hovered }) => [
            styles.sidebarLink,
            hovered && styles.sidebarLinkHover,
          ]}
          onPress={() => navigateTo("/admin/prestamos")}
        >
          <Ionicons name="cube" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.sidebarLinkText}>Gestión de Préstamos</Text>
        </Pressable>
        <Pressable
          style={({ hovered }) => [
            styles.sidebarLink,
            hovered && styles.sidebarLinkHover,
          ]}
          onPress={() => navigateTo("/admin/usuarios")}
        >
          <Ionicons name="people" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.sidebarLinkText}>Gestión de Usuarios</Text>
        </Pressable>
        <Pressable
          style={({ hovered }) => [
            styles.sidebarLink,
            hovered && styles.sidebarLinkHover,
          ]}
          onPress={() => navigateTo("/admin/historial")}
        >
          <Ionicons name="time" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.sidebarLinkText}>Historial</Text>
        </Pressable>
      </ScrollView>
      <Pressable
        style={({ hovered }) => [
          styles.sidebarLink,
          styles.logoutButton,
          hovered && styles.logoutButtonHover,
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out" size={20} color="#fff" style={styles.icon} />
        <Text style={styles.sidebarLinkText}>Cerrar Sesión</Text>
      </Pressable>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Hamburger button for mobile/tablet */}
      {(isMobile || isTablet) && (
        <SafeAreaView
          edges={["top", "left", "right"]}
          style={styles.mobileHeaderSafeArea}
        >
          <View
            style={[
              styles.mobileHeader,
              {
                height: mobileHeaderBarHeight,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setIsMenuOpen(true)}
              style={styles.hamburger}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={28} color="#0A2540" />
            </TouchableOpacity>
            <Text style={styles.mobileHeaderTitle}>{currentTitle}</Text>
            {pathname?.includes("/admin/prestamos") &&
              pendingLoansCount !== null && (
                <View style={styles.mobileHeaderCountBadge}>
                  <Text style={styles.mobileHeaderCountText}>
                    {pendingLoansCount} en espera
                  </Text>
                </View>
              )}
          </View>
        </SafeAreaView>
      )}

      {/* Sidebar - Fixed for desktop, Modal for mobile/tablet */}
      {showSidebar ? (
        <View style={styles.sidebar}>
          <SidebarContent />
        </View>
      ) : (
        <Modal
          visible={isMenuOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalSidebar,
                {
                  paddingTop: insets.top + 24,
                  paddingBottom: Math.max(insets.bottom, 10) + 10,
                },
              ]}
            >
              <SidebarContent />
            </View>
            <TouchableOpacity
              style={styles.modalBackdrop}
              onPress={() => setIsMenuOpen(false)}
              activeOpacity={1}
            />
          </View>
        </Modal>
      )}

      {/* Content Area */}
      <View
        style={[
          styles.mainContent,
          (isMobile || isTablet) && {
            paddingTop: mobileHeaderTotalHeight + 8,
          },
        ]}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === "web" ? "none" : "fade",
            animationDuration: Platform.OS === "web" ? 0 : MOTION_MS,
            gestureEnabled: true,
          }}
        />
      </View>

      {isLoggingOut && (
        <View style={styles.loggingOutOverlay}>
          <View style={styles.loggingOutCard}>
            <ActivityIndicator size="small" color="#0A66FF" />
            <Text style={styles.loggingOutText}>Cerrando sesión...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f0f4f8",
  },
  mobileHeaderSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    zIndex: 100,
    paddingTop: 0,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  mobileHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  hamburger: {
    padding: 12,
    marginRight: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        ":hover": {
          backgroundColor: "rgba(0,0,0,0.05)",
        },
      },
    }),
  },
  mobileHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0A2540",
    flex: 1,
  },
  mobileHeaderCountBadge: {
    marginLeft: 8,
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#e9f1ff",
    borderWidth: 1,
    borderColor: "#d6e3fb",
  },
  mobileHeaderCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2540",
  },
  sidebar: {
    width: 260,
    backgroundColor: "#0A2540",
    paddingVertical: 22,
    justifyContent: "space-between",
    borderRightWidth: Platform.OS === "web" ? 1 : 0,
    borderRightColor: "rgba(255,255,255,0.06)",
    ...Platform.select({
      web: {
        boxShadow: "2px 0 20px rgba(0,0,0,0.15)",
      },
    }),
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sidebarTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  closeButton: {
    padding: 8,
  },
  sidebarScroll: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  sidebarLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.22s ease, transform 0.22s ease",
      },
    }),
  },
  sidebarLinkHover: {
    backgroundColor: "rgba(255,255,255,0.08)",
    transform: [{ translateX: 4 }],
  },
  icon: {
    width: 22,
    marginRight: 14,
  },
  sidebarLinkText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  logoutButton: {
    marginTop: 16,
    marginHorizontal: 20,
    marginBottom: 26,
    backgroundColor: "rgba(220, 53, 69, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(220, 53, 69, 0.35)",
  },
  logoutButtonHover: {
    backgroundColor: "rgba(220, 53, 69, 0.22)",
    transform: [{ translateY: -1 }],
  },
  mainContent: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#f0f4f8",
  },
  mainContentMobile: {
    paddingTop: Platform.OS === "web" ? 60 : 100,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  modalSidebar: {
    width: "72%",
    maxWidth: 320,
    backgroundColor: "#0A2540",
    paddingTop: 18,
    paddingBottom: 10,
    justifyContent: "space-between",
    ...Platform.select({
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    backgroundColor: "#fff",
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
    color: "#334155",
  },
});

export default AdminLayout;
