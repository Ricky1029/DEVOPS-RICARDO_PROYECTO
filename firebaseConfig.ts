// Import the functions you need from the SDKs you need
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBM3mhRV9mUL-MY8R_W9fHr_f75PE-5SmY",
  authDomain: "prestaequipoapp.firebaseapp.com",
  projectId: "prestaequipoapp",
  storageBucket: "prestaequipoapp.firebasestorage.app",
  messagingSenderId: "807656499630",
  appId: "1:807656499630:web:0571d14c92c3413b7c403f",
};

export const FIREBASE_API_KEY = firebaseConfig.apiKey;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(firebaseApp);

// Initialize Firebase Authentication with persistence for React Native
const getReactNativePersistenceSafely = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  }
).getReactNativePersistence;

export const auth =
  Platform.OS === "web" || typeof getReactNativePersistenceSafely !== "function"
    ? FirebaseAuth.getAuth(firebaseApp)
    : FirebaseAuth.initializeAuth(firebaseApp, {
        persistence: getReactNativePersistenceSafely(
          AsyncStorage,
        ) as FirebaseAuth.Persistence,
      });
