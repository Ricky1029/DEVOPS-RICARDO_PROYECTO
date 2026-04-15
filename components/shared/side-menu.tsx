import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";

interface MenuItem {
  title: string;
  icon: string;
  link?: string;
  subItems?: MenuItem[];
}

interface SideMenuProps {
  isVisible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
  fadeAnim: Animated.Value;
}

export function SideMenu({
  isVisible,
  onClose,
  slideAnim,
  fadeAnim,
}: SideMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const menuItems: MenuItem[] = [
    { title: "Inicio", icon: "home-outline", link: "/(tabs)/dashboard" },
    { title: "Catálogo", icon: "grid-outline", link: "/(tabs)" },
    {
      title: "Perfil",
      icon: "person-outline",
      subItems: [
        {
          title: "Mi Perfil",
          icon: "person-circle-outline",
          link: "/(tabs)/profile",
        },
        {
          title: "Mis Préstamos",
          icon: "time-outline",
          link: "/(tabs)/history",
        },
      ],
    },
  ];

  const handleMenuItemPress = (item: MenuItem) => {
    if (item.subItems) {
      setIsProfileDropdownOpen(!isProfileDropdownOpen);
      return;
    }

    if (item.link) {
      if (
        item.title === "Inicio" &&
        (pathname === "/(tabs)/dashboard" || pathname === "/(tabs)")
      ) {
        onClose();
        return;
      }
      router.push(item.link as any);
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.modalOverlay,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          styles.sideMenu,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <Text style={styles.menuSectionTitle}>Menú</Text>
        {menuItems.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuItemPress(item)}
            >
              <Ionicons
                name={item.icon as any}
                size={24}
                color={Colors.light.primary}
              />
              <Text style={styles.menuItemText}>{item.title}</Text>
              {item.subItems && (
                <Ionicons
                  name={
                    isProfileDropdownOpen
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={20}
                  color={Colors.light.gray}
                  style={styles.dropdownIcon}
                />
              )}
            </TouchableOpacity>
            {item.subItems && isProfileDropdownOpen && (
              <View style={styles.dropdownContainer}>
                {item.subItems.map((subItem, subIndex) => (
                  <TouchableOpacity
                    key={subIndex}
                    style={styles.dropdownItem}
                    onPress={() => handleMenuItemPress(subItem)}
                  >
                    <Ionicons
                      name={subItem.icon as any}
                      size={20}
                      color={Colors.light.textDark}
                    />
                    <Text style={styles.dropdownItemText}>{subItem.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    zIndex: 1000, // Asegura que el overlay esté por encima de todo
  },
  sideMenu: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 300,
    height: "100%",
    backgroundColor: Colors.light.background,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textDark,
    marginBottom: 12,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: Colors.light.textDark,
  },
  dropdownIcon: {
    marginLeft: "auto",
  },
  dropdownContainer: {
    paddingLeft: 40,
    backgroundColor: Colors.light.backgroundAlt,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 20,
  },
  dropdownItemText: {
    marginLeft: 12,
    fontSize: 15,
    color: Colors.light.textDark,
  },
});
