import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

interface HeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  hideLeftButton?: boolean;
  children?: React.ReactNode;
}

export const Header = ({
  onMenuPress,
  showBackButton,
  onBackPress,
  hideLeftButton,
  children,
}: HeaderProps) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isDesktop = width >= 1024;

  return (
    <View
      style={[
        styles.header,
        {
          padding: isMobile ? 12 : 16,
          paddingHorizontal: isDesktop ? 24 : isMobile ? 12 : 16,
        },
      ]}
    >
      {!hideLeftButton && (
        <TouchableOpacity
          onPress={showBackButton ? onBackPress : onMenuPress}
          style={[styles.menuButton, { padding: isMobile ? 6 : 8 }]}
        >
          <Ionicons
            name={showBackButton ? "arrow-back-outline" : "menu-outline"}
            size={isMobile ? 24 : 28}
            color={Colors.light.primary}
          />
        </TouchableOpacity>
      )}
      <View
        style={[
          styles.content,
          { marginLeft: hideLeftButton ? 0 : isMobile ? 12 : 16 },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    ...(Platform.OS === "web"
      ? {
          position: "sticky" as any,
          top: 0,
          zIndex: 100,
        }
      : {}),
  },
  menuButton: {
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundAlt,
    ...(Platform.OS === "web"
      ? {
          transition: "background-color 0.2s ease",
          cursor: "pointer",
        }
      : {}),
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
