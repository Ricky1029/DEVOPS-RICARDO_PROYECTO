import { Colors } from "@/constants/theme";
import { useKeyboard } from "@/hooks/use-keyboard";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    Keyboard,
    StyleProp,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface KeyboardDismissWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * Componente wrapper que cierra el teclado preservando gestos de navegación
 * Implementación que NO interfiere con swipes ni navegación
 */
export const KeyboardDismissWrapper: React.FC<KeyboardDismissWrapperProps> = ({
  children,
  style,
  disabled = false,
}) => {
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const insets = useSafeAreaInsets();

  const dismissKeyboard = () => {
    if (!disabled && isKeyboardVisible) {
      Keyboard.dismiss();
    }
  };

  return (
    <View style={[{ flex: 1 }, style]}>
      {children}
      {!disabled && isKeyboardVisible && (
        <TouchableOpacity
          onPress={dismissKeyboard}
          style={{
            position: "absolute",
            right: 16,
            bottom: keyboardHeight + Math.max(insets.bottom, 12),
            backgroundColor: Colors.light.background,
            borderRadius: 20,
            padding: 10,
            borderWidth: 1,
            borderColor: Colors.light.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Ionicons
            name="chevron-down"
            size={18}
            color={Colors.light.textDark}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default KeyboardDismissWrapper;
