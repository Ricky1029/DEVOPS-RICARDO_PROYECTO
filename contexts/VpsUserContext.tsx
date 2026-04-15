import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface VpsUserContextType {
  vpsUserId: string | null;
  setVpsUserId: (id: string | null) => Promise<void>;
  clearVpsUserId: () => Promise<void>;
  isLoading: boolean;
}

const VpsUserContext = createContext<VpsUserContextType | undefined>(undefined);

export const VpsUserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [vpsUserId, setVpsUserIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar el ID del usuario al iniciar la app
  useEffect(() => {
    const loadVpsUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem("vps_user_id");
        if (userId) {
          console.log("VPS User ID cargado del storage:", userId);
          setVpsUserIdState(userId);
        }
      } catch (error) {
        console.error("Error al cargar VPS User ID:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVpsUserId();
  }, []);

  // Guardar el ID del usuario
  const setVpsUserId = async (id: string | null) => {
    try {
      if (id) {
        await AsyncStorage.setItem("vps_user_id", id);
        console.log("VPS User ID guardado:", id);
      } else {
        await AsyncStorage.removeItem("vps_user_id");
        console.log("VPS User ID eliminado");
      }
      setVpsUserIdState(id);
    } catch (error) {
      console.error("Error al guardar VPS User ID:", error);
      throw error;
    }
  };

  // Limpiar el ID del usuario
  const clearVpsUserId = async () => {
    try {
      await AsyncStorage.removeItem("vps_user_id");
      setVpsUserIdState(null);
      console.log("VPS User ID limpiado");
    } catch (error) {
      console.error("Error al limpiar VPS User ID:", error);
      throw error;
    }
  };

  return (
    <VpsUserContext.Provider
      value={{ vpsUserId, setVpsUserId, clearVpsUserId, isLoading }}
    >
      {children}
    </VpsUserContext.Provider>
  );
};

// Hook personalizado para usar el contexto fácilmente
export const useVpsUser = () => {
  const context = useContext(VpsUserContext);
  if (context === undefined) {
    throw new Error("useVpsUser debe ser usado dentro de VpsUserProvider");
  }
  return context;
};
