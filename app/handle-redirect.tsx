import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

const MOTION_MS = 220;

const HandleRedirectScreen = () => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: MOTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: MOTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, let's get their role from Firestore
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log("User role:", userData.role);
          // Redirect based on role
          if (userData.role === "admin") {
            router.replace("/admin");
          } else {
            router.replace("/(tabs)/dashboard");
          }
        } else {
          // Fallback if user doc doesn't exist
          console.log("User document not found, redirecting to user view.");
          router.replace("/(tabs)/dashboard");
        }
      } else {
        // User is signed out
        router.replace("/login");
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.loaderCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ActivityIndicator size="large" color="#0A66FF" />
        <Text style={styles.loadingText}>Preparando tu panel...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
  },
  loaderCard: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    gap: 12,
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
  },
});

export default HandleRedirectScreen;
