import { Colors } from "@/constants/theme";
import { useVpsUser } from "@/contexts/VpsUserContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../firebaseConfig";
import { inicializarNotificaciones } from "../services/notificacionService";
import { obtenerUsuarioPorCorreo } from "../services/usuarioService";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";
const isMobile = width < 768;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);
const MOTION_MS = 220;

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveAnimSecondary = useRef(new Animated.Value(0)).current;
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formTranslateAnim = useRef(new Animated.Value(16)).current;
  const circles = useRef([
    {
      size: 260,
      top: -40,
      left: -50,
      opacity: 0.42,
      xAmp: 28,
      yAmp: 16,
      rotate: "-12deg",
    },
    {
      size: 220,
      top: 120,
      left: 80,
      opacity: 0.36,
      xAmp: 22,
      yAmp: 12,
      rotate: "8deg",
    },
    {
      size: 300,
      top: -60,
      right: -80,
      opacity: 0.32,
      xAmp: 26,
      yAmp: 15,
      rotate: "15deg",
    },
    {
      size: 240,
      bottom: -30,
      left: 60,
      opacity: 0.34,
      xAmp: 20,
      yAmp: 14,
      rotate: "-18deg",
    },
    {
      size: 200,
      bottom: 60,
      right: -30,
      opacity: 0.4,
      xAmp: 24,
      yAmp: 18,
      rotate: "10deg",
    },
    {
      size: 180,
      top: 220,
      left: 260,
      opacity: 0.3,
      xAmp: 20,
      yAmp: 12,
      rotate: "5deg",
    },
    {
      size: 210,
      top: 260,
      right: 220,
      opacity: 0.28,
      xAmp: 18,
      yAmp: 14,
      rotate: "-8deg",
    },
  ] as const).current;
  const router = useRouter();
  const { setVpsUserId } = useVpsUser();

  useEffect(() => {
    waveAnim.setValue(0);
    waveAnimSecondary.setValue(0);

    const primary = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
      { iterations: -1 },
    );

    const secondary = Animated.loop(
      Animated.timing(waveAnimSecondary, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
        delay: 2500,
      }),
      { iterations: -1 },
    );

    primary.start();
    secondary.start();

    return () => {
      primary.stop();
      secondary.stop();
    };
  }, [waveAnim, waveAnimSecondary]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formFadeAnim, {
        toValue: 1,
        duration: MOTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateAnim, {
        toValue: 0,
        duration: MOTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [formFadeAnim, formTranslateAnim]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor, ingresa tu email y contraseña.");
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);

      // Obtener el ID del usuario del VPS
      const usuarioVPS = await obtenerUsuarioPorCorreo(email);
      console.log("Usuario VPS obtenido:", usuarioVPS);

      if (usuarioVPS) {
        await setVpsUserId(usuarioVPS.id.toString());
        console.log("ID guardado en contexto:", usuarioVPS.id);

        // Inicializar notificaciones push después de login exitoso
        try {
          const token = await inicializarNotificaciones(usuarioVPS.id);
          if (token) {
            console.log("✓ Push token generado y registrado al iniciar sesión");
          } else {
            console.warn(
              "No se pudo generar push token (puede ser simulador o faltan permisos)",
            );
          }
        } catch (notifError) {
          console.error("Error al inicializar notificaciones:", notifError);
          // No bloqueamos el login si falla la inicialización de notificaciones
        }
      } else {
        console.warn("No se encontró el usuario en VPS, continuando sin ID");
        Alert.alert(
          "Advertencia",
          "No se encontró tu cuenta en el sistema. Por favor contacta al administrador.",
        );
      }

      router.replace("/handle-redirect");
    } catch (error: any) {
      console.error("Login Error: ", error);
      Alert.alert(
        "Error de Inicio de Sesión",
        "Credenciales incorrectas. Verifica tu email y contraseña.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderBrandPanel = () => (
    <View style={styles.brandPanel}>
      <View style={styles.animatedBackdrop} pointerEvents="none">
        {circles.map((circle, idx) => {
          const animX = (
            idx % 2 === 0 ? waveAnim : waveAnimSecondary
          ).interpolate({
            inputRange: [0, 1],
            outputRange: [-circle.xAmp, circle.xAmp],
          });
          const animY = (
            idx % 2 === 0 ? waveAnimSecondary : waveAnim
          ).interpolate({
            inputRange: [0, 1],
            outputRange: [-circle.yAmp, circle.yAmp],
          });

          return (
            <AnimatedGradient
              key={`wave-circle-${idx}`}
              colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0.10)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.waveCircle,
                {
                  width: circle.size,
                  height: circle.size,
                  borderRadius: circle.size / 2,
                  opacity: circle.opacity,
                  top: circle.top,
                  left: circle.left,
                  right: circle.right,
                  bottom: circle.bottom,
                  transform: [
                    { translateX: animX },
                    { translateY: animY },
                    { rotate: circle.rotate },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.brandContent}>
        <View style={styles.logoContainer}>
          <Ionicons name="cube" size={60} color="#fff" />
        </View>
        <Text style={styles.brandTitle}>SG-PRESTAMOS</Text>
        <Text style={styles.brandSubtitle}>
          Gestión inteligente de equipos{"\n"}tecnológicos para tu institución
        </Text>
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.featureText}>Solicitudes en línea</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.featureText}>Seguimiento en tiempo real</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.featureText}>Panel administrativo</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderForm = () => (
    <Animated.View
      style={[
        styles.formPanel,
        {
          opacity: formFadeAnim,
          transform: [{ translateY: formTranslateAnim }],
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isMobile && (
            <View style={styles.mobileHeader}>
              <Ionicons name="cube" size={50} color={Colors.light.primary} />
              <Text style={styles.mobileTitle}>SG-PRESTAMOS</Text>
            </View>
          )}

          <View style={styles.formHeader}>
            <Text style={styles.welcomeTitle}>¡Bienvenido de nuevo!</Text>
            <Text style={styles.welcomeSubtitle}>
              Inicia sesión en tu cuenta
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electronico</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedInput === "email" && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={
                  focusedInput === "email" ? Colors.light.secondary : "#888"
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedInput("email")}
                onBlur={() => setFocusedInput(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedInput === "password" && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={
                  focusedInput === "password" ? Colors.light.secondary : "#888"
                }
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedInput("password")}
                onBlur={() => setFocusedInput(null)}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.forgotContainer}>
            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.forgotText,
                  loading && styles.forgotTextDisabled,
                ]}
              >
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Iniciar Sesion</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  if (isWeb && !isMobile) {
    return (
      <View style={styles.container}>
        {renderBrandPanel()}
        {renderForm()}
      </View>
    );
  }

  return <View style={styles.mobileContainer}>{renderForm()}</View>;
};

const styles = StyleSheet.create({
  // Layout principal
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Panel de marca (izquierda en web)
  brandPanel: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  animatedBackdrop: {
    position: "absolute",
    top: -120,
    bottom: -120,
    left: -120,
    right: -120,
    opacity: 0.9,
  },
  waveCircle: {
    position: "absolute",
  },
  brandContent: {
    maxWidth: 500,
    zIndex: 1,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 28,
    marginBottom: 40,
  },
  featuresContainer: {
    marginTop: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  featureText: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 12,
  },

  // Panel de formulario (derecha en web, todo en móvil)
  formPanel: {
    flex: 1,
    backgroundColor: "#fff",
    ...(isWeb && !isMobile
      ? {
          maxWidth: 600,
          minWidth: 500,
        }
      : {}),
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: isWeb && !isMobile ? 60 : 24,
    paddingTop: isMobile ? 40 : 60,
  },

  // Header móvil
  mobileHeader: {
    alignItems: "center",
    marginBottom: 40,
  },
  mobileTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.primary,
    marginTop: 12,
  },

  // Encabezado del formulario
  formHeader: {
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.light.textDark,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.gray,
  },

  // Grupos de inputs
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textDark,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 16,
    height: 56,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputWrapperFocused: {
    backgroundColor: "#fff",
    borderColor: Colors.light.secondary,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.secondary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.textDark,
    height: "100%",
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    padding: 8,
    position: "absolute",
    right: 8,
  },

  // Recuperar contraseña
  forgotContainer: {
    alignItems: "flex-end",
    marginTop: -8,
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 14,
    color: Colors.light.secondary,
    fontWeight: "600",
    ...Platform.select({
      web: {
        transition: "opacity 0.22s ease",
      },
    }),
  },
  forgotTextDisabled: {
    opacity: 0.7,
  },

  // Botón principal
  loginButton: {
    flexDirection: "row",
    backgroundColor: Colors.light.secondary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.22s ease, opacity 0.22s ease",
      },
      ios: {
        shadowColor: Colors.light.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
});

export default LoginScreen;
