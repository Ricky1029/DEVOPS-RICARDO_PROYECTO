import { Colors } from "@/constants/theme";
import { useResponsive } from "@/hooks/use-responsive";
import { downloadReport } from "@/utils/reportGenerator";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DimensionValue,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

interface Prestamo {
  id: string;
  equipoNombre: string;
  usuarioNombre: string;
  estado: string;
  fechaSolicitud: any;
  fechaAprobacion?: any;
  fechaDevolucionEsperada?: any;
  proposito?: string;
  codigoQR?: string;
  // Campos de la API
  ID?: number;
  "ID Articulo"?: number;
  "ID Usuario"?: number;
  Estado?: string;
  "Fecha Solicitud"?: string;
  "Fecha Inicio"?: string;
  "Fecha Fin"?: string;
  Proposito?: string;
  Nota?: string;
  QR?: any;
}

interface Equipo {
  id: string;
  nombre: string;
  categoria?: string;
  tipo?: string;
  estado?: boolean;
}

const normalizarEstadoPrestamo = (estadoRaw: unknown): string => {
  const estado = String(estadoRaw || "")
    .toLowerCase()
    .trim();

  if (
    ["espera", "pendiente", "en espera", "en_espera", "solicitado"].includes(
      estado,
    )
  ) {
    return "pendiente";
  }

  if (
    [
      "aceptado",
      "aprobado",
      "activo",
      "en curso",
      "en_curso",
      "prestado",
    ].includes(estado)
  ) {
    return "aprobado";
  }

  if (["rechazado", "denegado", "cancelado"].includes(estado)) {
    return "rechazado";
  }

  if (["devuelto", "finalizado", "completado"].includes(estado)) {
    return "devuelto";
  }

  return estado || "pendiente";
};

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  carrera?: string;
  matricula?: string;
  activo: boolean;
  fechaRegistro: any;
}

const StatCard = ({
  title,
  value,
  iconName,
  onPress,
}: {
  title: string;
  value: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) => {
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowDimensions();
  const cardsPerRow =
    width < 576 ? 1 : width < 768 ? 2 : width < 992 ? 2 : width < 1200 ? 3 : 4;
  const isFullWidth = cardsPerRow === 1;
  const cardWidth: DimensionValue = isFullWidth
    ? "100%"
    : `${100 / cardsPerRow - 1}%`;
  const padding = isMobile ? 18 : isTablet ? 20 : 22;

  return (
    <Pressable
      style={({ hovered }) => [
        styles.card,
        {
          width: cardWidth,
          padding,
          minHeight: isMobile ? 132 : 150,
        },
        hovered && Platform.OS === "web" && styles.cardWebHover,
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeaderRow}>
        <View style={[styles.cardIconWrapper, { padding: isMobile ? 12 : 14 }]}>
          <Ionicons name={iconName} size={isMobile ? 26 : 28} color="#0A66FF" />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTitle, { fontSize: isMobile ? 13 : 14 }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.cardValue,
              { fontSize: isMobile ? 30 : isTablet ? 34 : 38 },
            ]}
          >
            {value}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooterRow}>
        <Text style={[styles.cardHint, { fontSize: isMobile ? 12 : 13 }]}>
          Ver detalle
        </Text>
        <View style={styles.cardTapIndicator}>
          <Ionicons name="chevron-forward" size={16} color="#0A66FF" />
        </View>
      </View>
    </Pressable>
  );
};

// Error Boundary para capturar errores de renderizado
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (__DEV__) {
      console.error("Error capturado por ErrorBoundary:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={42} color="#ef4444" />
          <Text style={styles.errorTitle}>Ocurrió un error</Text>
          <Text style={styles.errorMessage}>
            Intenta recargar la pantalla. Si persiste, verifica tu conexión.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const AdminDashboard = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const chartAnim = React.useRef(new Animated.Value(0)).current;

  const [prestamosActivos, setPrestamosActivos] = useState<Prestamo[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [prestamosHoy, setPrestamosHoy] = useState<Prestamo[]>([]);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalAnimation] = useState(new Animated.Value(0));

  // Modal para escaneo QR (RF-6)
  const [showQrModal, setShowQrModal] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [scannedPrestamo, setScannedPrestamo] = useState<Prestamo | null>(null);
  const router = useRouter();

  // Modal para exportar reportes
  const [showExportModal, setShowExportModal] = useState(false);

  // Verificar permisos cuando se abre el modal
  useEffect(() => {
    if (!showQrModal) return;

    // Asegura solicitar permisos en cuanto se abre el modal, incluso si el hook aún no los ha cargado
    if (!permission) {
      requestPermission();
      return;
    }

    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [showQrModal, permission, requestPermission]);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const showInlineHeader = Platform.OS === "web" && !isMobile && !isTablet;

  // Normaliza el valor leído del escáner para iOS/Android (algunas builds devuelven rawData en vez de data)
  const parseScannedValue = (result: any): string => {
    const candidates = [
      result?.data,
      result?.rawValue,
      result?.rawString,
      result?.rawData,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
      // iOS puede entregar Uint8Array en rawData
      if (candidate && typeof candidate === "object" && "length" in candidate) {
        try {
          const decoded = String.fromCharCode(...(candidate as any));
          if (decoded.trim()) {
            return decoded.trim();
          }
        } catch (err) {
          // Ignorar si no se puede decodificar
        }
      }
    }

    return "";
  };

  // Función para cargar datos - funciona en web y mobile
  const cargarDatos = async () => {
    try {
      setLoading(true);
      // Hacer todas las peticiones en paralelo con timeout
      const fetchWithTimeout = (url: string, timeout = 10000) => {
        return Promise.race([
          fetch(url).then((res) => res.json()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout),
          ),
        ]);
      };

      const [prestamosData, usuariosData, articulosData] = await Promise.all([
        fetchWithTimeout("https://api.prestaapp.site/prestamos").catch(() => ({
          error: true,
        })),
        fetchWithTimeout("https://api.prestaapp.site/usuarios").catch(() => ({
          error: true,
        })),
        fetchWithTimeout("https://api.prestaapp.site/articulos").catch(() => ({
          error: true,
        })),
      ]);

      if (__DEV__) {
        console.log("Préstamos recibidos:", prestamosData);
        console.log("Usuarios recibidos:", usuariosData);
        console.log("Artículos recibidos:", articulosData);
      }

      // Crear mapas para búsqueda rápida
      const usuariosMap = new Map();
      const articulosMap = new Map();

      // Mapear usuarios
      if (Array.isArray(usuariosData) && usuariosData.length > 0) {
        usuariosData.forEach((u: any) => {
          try {
            if (u && u.ID) {
              usuariosMap.set(u.ID, {
                id: u.ID?.toString() || "",
                nombre: u.Nombre || `Usuario #${u.ID}`,
                email: u.Email || "",
                telefono: u.Telefono || "",
                carrera: u.Carrera || "",
                matricula: u.Matricula || "",
                activo: u.Activo !== false,
                fechaRegistro: u["Fecha Registro"] || null,
              });
            }
          } catch (err) {
            // Ignorar usuario inválido
          }
        });

        setUsuarios(Array.from(usuariosMap.values()));
      } else {
        setUsuarios([]);
      }

      // Mapear artículos/equipos
      if (Array.isArray(articulosData) && articulosData.length > 0) {
        articulosData.forEach((a: any) => {
          try {
            if (a && a.ID) {
              articulosMap.set(a.ID, {
                id: a.ID?.toString() || "",
                nombre: a.Nombre || `Artículo #${a.ID}`,
                categoria: a.Categoria || "",
                tipo: a.Tipo || "",
                estado: a.Disponible !== false,
              });
            }
          } catch (err) {
            // Ignorar artículo inválido
          }
        });

        setEquipos(Array.from(articulosMap.values()));
      } else {
        setEquipos([]);
      }

      // Mapear préstamos con nombres reales
      if (Array.isArray(prestamosData) && prestamosData.length > 0) {
        const prestamosMapeados: Prestamo[] = prestamosData
          .map((p: any) => {
            try {
              if (!p || !p.ID) return null;

              const usuario = usuariosMap.get(p["ID Usuario"]);
              const articulo = articulosMap.get(p["ID Articulo"]);
              const prestamo = prestamosData.find((pr: any) => pr.ID === p.ID);

              return {
                id: String(p.ID || ""),
                equipoNombre: articulo?.nombre || `Equipo #${p.ID}`,
                usuarioNombre:
                  prestamo?.Email_Usuario ||
                  usuario?.nombre ||
                  `Usuario #${p["ID Usuario"]}`,
                estado: normalizarEstadoPrestamo(p.Estado || "espera"),
                fechaSolicitud: p.Fecha_Solicitud || null,
                fechaAprobacion: p.Fecha_Aprobacion || null,
                fechaDevolucionEsperada: p["Fecha Fin"] || null,
                proposito: p.Proposito || p.Nota || "",
                codigoQR: p.QR || null,
                QR: p.QR || null,
              } as Prestamo;
            } catch (err) {
              return null;
            }
          })
          .filter((p): p is Prestamo => p !== null);

        if (__DEV__) {
          console.log("Préstamos mapeados:", prestamosMapeados.length);
        }

        // Filtrar préstamos activos (solo los que están en préstamo actualmente)
        const activos = prestamosMapeados.filter(
          (p) => p.estado === "aprobado" || p.estado === "pendiente",
        );

        // Filtrar préstamos de hoy (solicitados hoy)
        const hoy = new Date().toISOString().split("T")[0]; // Solo la fecha sin hora
        console.log("Fecha de hoy para comparación:", hoy);
        const prestamosDehoy = prestamosMapeados.filter((p) => {
          const fechaSolicitud = p.fechaSolicitud
            ? new Date(p.fechaSolicitud).toISOString().split("T")[0]
            : null;
          return fechaSolicitud === hoy;
        });
        console.log("Préstamos de hoy encontrados:", prestamosDehoy);

        setPrestamosActivos(activos);
        setPrestamosHoy(prestamosDehoy);
      } else {
        setPrestamosActivos([]);
        setPrestamosHoy([]);
      }

      setLoading(false);
    } catch (error) {
      if (__DEV__) {
        console.error("Error fetching data:", error);
      }
      // Establecer valores por defecto seguros
      setUsuarios([]);
      setEquipos([]);
      setPrestamosActivos([]);
      setPrestamosHoy([]);
      setLoading(false);

      Alert.alert(
        "Error de conexión",
        "No se pudieron cargar los datos. Por favor, verifica tu conexión a internet.",
      );
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const openModal = (modalKey: string) => {
    setActiveModal(modalKey);
    setFiltroTexto("");
    setFiltroEstado("todos");
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setActiveModal(null));
  };

  const marcarComoDevuelto = async (prestamoId: string) => {
    Alert.alert(
      "Demo",
      "En la versión completa, esto marcaría el préstamo como devuelto",
    );
    setPrestamosActivos((prev) => prev.filter((p) => p.id !== prestamoId));
  };

  const entregarEquipo = async (codigoQR: string) => {
    try {
      Alert.alert(
        "Confirmar entrega",
        "¿Confirmas la entrega del equipo al usuario?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: async () => {
              try {
                const response = await fetch(
                  "https://api.api.prestaapp.site/prestamos/entregar",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      codigoQR: codigoQR,
                    }),
                  },
                );

                const data = await response.json();

                if (response.ok && data.success) {
                  Alert.alert(
                    "Éxito",
                    `Equipo entregado correctamente: ${data.equipoNombre}`,
                  );
                  // Recargar datos
                  setShowQrModal(false);
                  setScannedData(null);
                  setScannedPrestamo(null);
                  // Recargar lista de préstamos (funciona en web y mobile)
                  cargarDatos();
                } else {
                  Alert.alert(
                    "Error",
                    data.error || "Error al registrar entrega",
                  );
                }
              } catch (error) {
                const mensaje =
                  error instanceof Error
                    ? error.message
                    : "Error al registrar entrega";
                Alert.alert("Error", mensaje);
              }
            },
          },
        ],
      );
    } catch (error) {
      if (__DEV__) {
        console.error("Error entregarEquipo:", error);
      }
    }
  };

  const recibirDevolucion = async (codigoQR: string) => {
    try {
      Alert.alert(
        "Confirmar devolución",
        "¿Confirmas la devolución del equipo?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: async () => {
              try {
                const response = await fetch(
                  "https://api.api.prestaapp.site/prestamos/devolver",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      codigoQR: codigoQR,
                    }),
                  },
                );

                const data = await response.json();

                if (response.ok && data.success) {
                  const mensaje = data.devolucionTardia
                    ? `Devolución registrada (tardía): ${data.equipoNombre}`
                    : `Devolución registrada correctamente: ${data.equipoNombre}`;
                  Alert.alert("Éxito", mensaje);
                  // Recargar datos
                  setShowQrModal(false);
                  setScannedData(null);
                  setScannedPrestamo(null);
                  // Recargar lista de préstamos (funciona en web y mobile)
                  cargarDatos();
                } else {
                  Alert.alert(
                    "Error",
                    data.error || "Error al registrar devolución",
                  );
                }
              } catch (error) {
                const mensaje =
                  error instanceof Error
                    ? error.message
                    : "Error al registrar devolución";
                Alert.alert("Error", mensaje);
              }
            },
          },
        ],
      );
    } catch (error) {
      if (__DEV__) {
        console.error("Error recibirDevolucion:", error);
      }
    }
  };

  const toggleUsuarioStatus = async (
    usuarioId: string,
    currentStatus: boolean,
  ) => {
    Alert.alert(
      "Demo",
      `En la versión completa, esto ${!currentStatus ? "activaría" : "desactivaría"} el usuario`,
    );
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === usuarioId ? { ...u, activo: !currentStatus } : u,
      ),
    );
  };

  const formatEstadoLabel = (estado: string) =>
    estado.charAt(0).toUpperCase() + estado.slice(1);

  const getStatusTokens = (estado: string) => {
    const palette: Record<
      string,
      { bg: string; text: string; border: string }
    > = {
      pendiente: {
        bg: "rgba(255, 193, 7, 0.16)",
        text: "#8a6500",
        border: "rgba(255, 193, 7, 0.28)",
      },
      espera: {
        bg: "rgba(255, 193, 7, 0.16)",
        text: "#8a6500",
        border: "rgba(255, 193, 7, 0.28)",
      },
      aprobado: {
        bg: "rgba(40, 167, 69, 0.14)",
        text: "#1f7a39",
        border: "rgba(40, 167, 69, 0.32)",
      },
      aceptado: {
        bg: "rgba(40, 167, 69, 0.14)",
        text: "#1f7a39",
        border: "rgba(40, 167, 69, 0.32)",
      },
      rechazado: {
        bg: "rgba(220, 53, 69, 0.14)",
        text: "#932937",
        border: "rgba(220, 53, 69, 0.28)",
      },
      denegado: {
        bg: "rgba(220, 53, 69, 0.14)",
        text: "#932937",
        border: "rgba(220, 53, 69, 0.28)",
      },
      devuelto: {
        bg: "rgba(108, 117, 125, 0.14)",
        text: "#505960",
        border: "rgba(108, 117, 125, 0.26)",
      },
      disponible: {
        bg: "rgba(40, 167, 69, 0.14)",
        text: "#1f7a39",
        border: "rgba(40, 167, 69, 0.32)",
      },
      "no-disponible": {
        bg: "rgba(220, 53, 69, 0.14)",
        text: "#932937",
        border: "rgba(220, 53, 69, 0.28)",
      },
      activo: {
        bg: "rgba(40, 167, 69, 0.14)",
        text: "#1f7a39",
        border: "rgba(40, 167, 69, 0.32)",
      },
      inactivo: {
        bg: "rgba(220, 53, 69, 0.14)",
        text: "#932937",
        border: "rgba(220, 53, 69, 0.28)",
      },
    };

    return (
      palette[estado.toLowerCase()] || {
        bg: "rgba(0, 123, 255, 0.12)",
        text: "#0A4FA3",
        border: "rgba(0, 123, 255, 0.24)",
      }
    );
  };

  // Función para sumar 1 día a una fecha y formatearla
  const formatDateWithPlusOne = (date: any): string => {
    if (!date) return "Sin fecha";
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "Sin fecha";
    // Sumar 1 día
    dateObj.setDate(dateObj.getDate() + 1);
    return dateObj.toLocaleDateString("es-ES");
  };

  const renderPrestamoItem = ({ item }: { item: Prestamo }) => {
    const badge = getStatusTokens(item.estado);

    return (
      <View style={styles.listCard}>
        <View style={styles.listItemHeader}>
          <View style={styles.listTitleBlock}>
            <Text style={styles.listItemTitle}>{item.equipoNombre}</Text>
            <Text style={styles.listItemSubtitle}>{item.usuarioNombre}</Text>
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.pillText, { color: badge.text }]}>
              {formatEstadoLabel(item.estado)}
            </Text>
          </View>
        </View>

        <View style={styles.listMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color="#4b5563"
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>
              {item.fechaAprobacion
                ? formatDateWithPlusOne(item.fechaAprobacion)
                : item.fechaSolicitud
                  ? formatDateWithPlusOne(item.fechaSolicitud)
                  : "Sin fecha"}
            </Text>
          </View>
          {item.proposito ? (
            <View style={[styles.metaChip, styles.metaChipGhost]}>
              <Ionicons
                name="bookmark-outline"
                size={14}
                color="#4b5563"
                style={styles.metaIcon}
              />
              <Text
                style={styles.metaText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.proposito}
              </Text>
            </View>
          ) : null}
        </View>

        {item.estado === "aprobado" && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => marcarComoDevuelto(item.id)}
            activeOpacity={0.85}
          >
            <Ionicons name="return-up-back" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Marcar como devuelto</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEquipoItem = ({ item }: { item: Equipo }) => {
    const badge = getStatusTokens(item.estado ? "disponible" : "no-disponible");

    return (
      <View style={styles.listCard}>
        <View style={styles.listItemHeader}>
          <View style={styles.listTitleBlock}>
            <Text style={styles.listItemTitle}>{item.nombre}</Text>
            {item.categoria && (
              <Text style={styles.listItemSubtitle}>
                Categoría: {item.categoria}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.pillText, { color: badge.text }]}>
              {item.estado ? "Disponible" : "No disponible"}
            </Text>
          </View>
        </View>

        <View style={styles.listMetaRow}>
          {item.tipo ? (
            <View style={styles.metaChip}>
              <Ionicons
                name="hardware-chip-outline"
                size={14}
                color="#4b5563"
                style={styles.metaIcon}
              />
              <Text style={styles.metaText}>Tipo: {item.tipo}</Text>
            </View>
          ) : null}
          <View style={[styles.metaChip, styles.metaChipGhost]}>
            <Ionicons
              name="pricetag-outline"
              size={14}
              color="#4b5563"
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>ID interno: {item.id}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderUsuarioItem = ({ item }: { item: Usuario }) => {
    const badge = getStatusTokens(item.activo ? "activo" : "inactivo");

    return (
      <View style={styles.listCard}>
        <View style={styles.listItemHeader}>
          <View style={styles.listTitleBlock}>
            <Text style={styles.listItemTitle}>{item.nombre}</Text>
            <Text style={styles.listItemSubtitle}>{item.email}</Text>
            {item.matricula && (
              <Text style={styles.listItemSubtitle}>
                Matrícula: {item.matricula}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.pill,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.pillText, { color: badge.text }]}>
              {item.activo ? "Activo" : "Inactivo"}
            </Text>
          </View>
        </View>

        <View style={styles.listMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons
              name="calendar-number-outline"
              size={14}
              color="#4b5563"
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>
              {item.fechaRegistro instanceof Date
                ? item.fechaRegistro.toLocaleDateString("es-ES")
                : "Registro no disponible"}
            </Text>
          </View>
          {item.telefono ? (
            <View style={[styles.metaChip, styles.metaChipGhost]}>
              <Ionicons
                name="call-outline"
                size={14}
                color="#4b5563"
                style={styles.metaIcon}
              />
              <Text style={styles.metaText}>{item.telefono}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: item.activo ? "#C12C48" : "#1E7A39" },
          ]}
          onPress={() => toggleUsuarioStatus(item.id, item.activo)}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>
            {item.activo ? "Desactivar" : "Activar"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const filtrarDatos = (datos: any[], tipo: string) => {
    // Ensure datos is an array
    if (!datos || !Array.isArray(datos)) {
      return [];
    }

    let datosFiltrados = datos;
    const normalize = (text?: string) =>
      (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    if (filtroTexto) {
      const q = normalize(filtroTexto);
      switch (tipo) {
        case "prestamos":
          datosFiltrados = datos.filter(
            (item) =>
              normalize(item.equipoNombre).includes(q) ||
              normalize(item.usuarioNombre).includes(q),
          );
          break;
        case "equipos":
          datosFiltrados = datos.filter(
            (item) =>
              normalize(item.nombre).includes(q) ||
              normalize(item.categoria).includes(q) ||
              normalize(item.tipo).includes(q),
          );
          break;
        case "usuarios":
          datosFiltrados = datos.filter(
            (item) =>
              normalize(item.nombre).includes(q) ||
              normalize(item.email).includes(q) ||
              normalize(item.matricula).includes(q),
          );
          break;
      }
    }

    if (filtroEstado !== "todos") {
      switch (tipo) {
        case "prestamos":
          datosFiltrados = datosFiltrados.filter(
            (item) => item.estado === filtroEstado,
          );
          break;
        case "equipos":
          datosFiltrados = datosFiltrados.filter((item) =>
            filtroEstado === "disponible" ? item.estado : !item.estado,
          );
          break;
        case "usuarios":
          datosFiltrados = datosFiltrados.filter((item) =>
            filtroEstado === "activo" ? item.activo : !item.activo,
          );
          break;
      }
    }

    return datosFiltrados;
  };

  const renderModalContent = () => {
    if (!activeModal) return null;

    const modalProps = {
      transform: [
        {
          scale: modalAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          }),
        },
      ],
      opacity: modalAnimation,
    };

    let datos: any[] = [];
    let titulo = "";
    let filtrosEstado: { label: string; value: string }[] = [];
    let renderItem: any;

    switch (activeModal) {
      case "prestamos-activos":
        datos = filtrarDatos(prestamosActivos, "prestamos");
        titulo = "Préstamos Activos";
        filtrosEstado = [
          { label: "Todos", value: "todos" },
          { label: "Aprobados", value: "aprobado" },
          { label: "Pendientes", value: "pendiente" },
        ];
        renderItem = renderPrestamoItem;
        break;
      case "equipos":
        datos = filtrarDatos(equipos, "equipos");
        titulo = "Equipos";
        filtrosEstado = [
          { label: "Todos", value: "todos" },
          { label: "Disponibles", value: "disponible" },
          { label: "No Disponibles", value: "no-disponible" },
        ];
        renderItem = renderEquipoItem;
        break;
      case "usuarios":
        datos = filtrarDatos(usuarios, "usuarios");
        titulo = "Usuarios";
        filtrosEstado = [
          { label: "Todos", value: "todos" },
          { label: "Activos", value: "activo" },
          { label: "Inactivos", value: "inactivo" },
        ];
        renderItem = renderUsuarioItem;
        break;
      case "prestamos-hoy":
        datos = filtrarDatos(prestamosHoy, "prestamos");
        titulo = "Préstamos de Hoy";
        filtrosEstado = [
          { label: "Todos", value: "todos" },
          { label: "Aprobados", value: "aprobado" },
          { label: "Pendientes", value: "pendiente" },
          { label: "Rechazados", value: "rechazado" },
        ];
        renderItem = renderPrestamoItem;
        break;
    }

    return (
      <Animated.View
        style={[
          styles.modalContent,
          (isMobile || isTablet) && styles.modalContentMobile,
          modalProps,
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{titulo}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.filtersContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar..."
              value={filtroTexto}
              onChangeText={setFiltroTexto}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="search"
              inputMode="search"
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusFilters}
          >
            {filtrosEstado.map((filtro) => (
              <TouchableOpacity
                key={filtro.value}
                style={[
                  styles.statusFilterButton,
                  filtroEstado === filtro.value &&
                    styles.statusFilterButtonActive,
                ]}
                onPress={() => setFiltroEstado(filtro.value)}
              >
                <Text
                  style={[
                    styles.statusFilterText,
                    filtroEstado === filtro.value &&
                      styles.statusFilterTextActive,
                  ]}
                >
                  {filtro.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.resultsInfo}>
          <Text style={styles.resultsText}>
            {(datos?.length || 0).toString()} resultado
            {(datos?.length || 0) !== 1 ? "s" : ""}
          </Text>
        </View>

        <FlatList
          data={datos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.modalList}
          contentContainerStyle={styles.modalListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No se encontraron resultados</Text>
            </View>
          }
        />
      </Animated.View>
    );
  };

  // CALCULAR DATOS DINÁMICOS Y CONSTANTES - ANTES DEL RETURN CONDICIONAL
  // (Los hooks deben ejecutarse en cada render, no pueden estar después de un return)
  const containerPadding = isMobile ? 16 : isTablet ? 20 : 24;

  // Préstamos por mes (últimos 6 meses)
  const lineChartData = React.useMemo(() => {
    try {
      if (!Array.isArray(prestamosHoy) || prestamosHoy.length === 0)
        return [0, 0, 0, 0, 0, 0];

      const now = new Date();
      const monthCounts = [0, 0, 0, 0, 0, 0];

      prestamosHoy.forEach((prestamo) => {
        try {
          const fechaSolicitud = prestamo.fechaSolicitud
            ? new Date(prestamo.fechaSolicitud)
            : null;
          if (fechaSolicitud && !isNaN(fechaSolicitud.getTime())) {
            const monthsAgo =
              (now.getFullYear() - fechaSolicitud.getFullYear()) * 12 +
              (now.getMonth() - fechaSolicitud.getMonth());
            if (monthsAgo >= 0 && monthsAgo < 6) {
              monthCounts[5 - monthsAgo]++;
            }
          }
        } catch (err) {
          // Ignorar errores individuales
        }
      });

      return monthCounts;
    } catch (error) {
      return [0, 0, 0, 0, 0, 0];
    }
  }, [prestamosHoy]);

  const lineChartLabels = React.useMemo(() => {
    const now = new Date();
    const labels = [];
    const meses = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(meses[date.getMonth()]);
    }

    return labels;
  }, []);

  // Equipos por categoría
  const barChartData = React.useMemo(() => {
    try {
      if (!Array.isArray(equipos) || equipos.length === 0) return [];

      const categorias: { [key: string]: number } = {};
      equipos.forEach((equipo) => {
        try {
          if (!equipo) return;
          const categoria = equipo.categoria || equipo.tipo || "Otros";
          categorias[categoria] = (categorias[categoria] || 0) + 1;
        } catch (err) {
          // Ignorar errores individuales
        }
      });

      const colores = [
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
        "#10b981",
        "#f59e0b",
        "#06b6d4",
        "#f43f5e",
      ];

      return Object.entries(categorias)
        .map(([label, value], index) => ({
          label,
          value,
          color: colores[index % colores.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7);
    } catch (error) {
      return [];
    }
  }, [equipos]);

  // Estados de préstamos
  const pieChartData = React.useMemo(() => {
    try {
      if (!Array.isArray(prestamosHoy) || prestamosHoy.length === 0) {
        return [{ name: "Sin datos", value: 1, color: "#e5e7eb" }];
      }

      const estados: { [key: string]: number } = {};
      prestamosHoy.forEach((prestamo) => {
        try {
          const estado = prestamo?.estado || "desconocido";
          estados[estado] = (estados[estado] || 0) + 1;
        } catch (err) {
          // Ignorar préstamo inválido
        }
      });

      const estadoMap: { [key: string]: { name: string; color: string } } = {
        aceptado: { name: "Activos", color: "#10b981" },
        aprobado: { name: "Activos", color: "#10b981" },
        pendiente: { name: "Pendientes", color: "#fbbf24" },
        devuelto: { name: "Devueltos", color: "#6b7280" },
        rechazado: { name: "Rechazados", color: "#ef4444" },
        vencido: { name: "Vencidos", color: "#dc2626" },
      };

      const consolidado: { [key: string]: { value: number; color: string } } =
        {};
      Object.entries(estados).forEach(([estado, count]) => {
        try {
          const mapped = estadoMap[estado] || {
            name: estado.charAt(0).toUpperCase() + estado.slice(1),
            color: "#9ca3af",
          };
          if (consolidado[mapped.name]) {
            consolidado[mapped.name].value += count;
          } else {
            consolidado[mapped.name] = { value: count, color: mapped.color };
          }
        } catch (err) {
          // Ignorar estado inválido
        }
      });

      return Object.entries(consolidado).map(([name, data]) => ({
        name,
        value: data.value,
        color: data.color,
      }));
    } catch (error) {
      return [{ name: "Sin datos", value: 1, color: "#e5e7eb" }];
    }
  }, [prestamosHoy]);

  // Métricas de progreso
  const progressData = React.useMemo(() => {
    try {
      const totalEquipos = Math.max(equipos?.length || 0, 1);
      const equiposDisponibles = Array.isArray(equipos)
        ? equipos.filter((e) => e?.estado).length
        : 0;
      const disponibilidad = equiposDisponibles / totalEquipos;

      const utilizacion = (prestamosActivos?.length || 0) / totalEquipos;

      // Calcular satisfacción basado en préstamos completados vs rechazados
      const completados = Array.isArray(prestamosHoy)
        ? prestamosHoy.filter(
            (p) => p?.estado === "devuelto" || p?.estado === "aprobado",
          ).length || 1
        : 1;
      const rechazados = Array.isArray(prestamosHoy)
        ? prestamosHoy.filter((p) => p?.estado === "rechazado").length
        : 0;
      const satisfaccion = completados / (completados + rechazados);

      return [
        {
          label: "Disponibilidad",
          value: Math.min(Math.max(disponibilidad, 0), 1) || 0,
          color: "#3b82f6",
        },
        {
          label: "Utilización",
          value: Math.min(Math.max(utilizacion, 0), 1) || 0,
          color: "#8b5cf6",
        },
        {
          label: "Satisfacción",
          value: Math.min(Math.max(satisfaccion, 0), 1) || 0,
          color: "#10b981",
        },
      ];
    } catch (error) {
      return [
        { label: "Disponibilidad", value: 0, color: "#3b82f6" },
        { label: "Utilización", value: 0, color: "#8b5cf6" },
        { label: "Satisfacción", value: 0, color: "#10b981" },
      ];
    }
  }, [equipos, prestamosActivos, prestamosHoy]);

  useEffect(() => {
    chartAnim.setValue(0);
    Animated.timing(chartAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [chartAnim, lineChartData, barChartData, pieChartData, progressData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Cargando datos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          padding: containerPadding,
          paddingTop: isMobile || isTablet ? 12 : containerPadding,
        }}
        scrollIndicatorInsets={{ top: insets.top }}
      >
        <View style={{ width: "100%", maxWidth: isDesktop ? 1400 : "100%" }}>
          {/* Header con título y botón de reporte (RF-8) */}
          <View
            style={[
              styles.dashboardHeader,
              { marginBottom: isMobile ? 16 : 24 },
            ]}
          >
            {showInlineHeader && (
              <View style={styles.dashboardTitleRow}>
                <Ionicons
                  name="stats-chart-outline"
                  size={24}
                  color={Colors.light.primary}
                />
                <Text
                  style={[
                    styles.title,
                    {
                      fontSize: 24,
                      marginBottom: 0,
                    },
                  ]}
                >
                  Dashboard de Administrador
                </Text>
              </View>
            )}
            <Pressable
              style={({ hovered }) => [
                styles.downloadButton,
                hovered && Platform.OS === "web" && styles.downloadButtonHover,
              ]}
              onPress={() => {
                console.log("Botón de reporte presionado");
                setShowExportModal(true);
              }}
            >
              <Ionicons
                name="download-outline"
                size={isMobile ? 18 : 20}
                color="#fff"
              />
              <Text
                style={[
                  styles.downloadButtonText,
                  { fontSize: isMobile ? 12 : 14 },
                ]}
              >
                {isMobile ? "Reporte" : "Descargar Reporte (PDF/CSV)"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.cardsContainer}>
            <StatCard
              title="Préstamos Activos"
              value={
                Array.isArray(prestamosActivos)
                  ? prestamosActivos.length.toString()
                  : "0"
              }
              iconName="stats-chart"
              onPress={() => openModal("prestamos-activos")}
            />
            <StatCard
              title="Equipos Disponibles"
              value={
                Array.isArray(equipos)
                  ? equipos.filter((e) => e.estado).length.toString()
                  : "0"
              }
              iconName="checkbox-outline"
              onPress={() => openModal("equipos")}
            />
            <StatCard
              title="Total de Usuarios"
              value={Array.isArray(usuarios) ? usuarios.length.toString() : "0"}
              iconName="people"
              onPress={() => openModal("usuarios")}
            />
            <StatCard
              title="Préstamos Hoy"
              value={
                Array.isArray(prestamosHoy)
                  ? prestamosHoy.length.toString()
                  : "0"
              }
              iconName="calendar-outline"
              onPress={() => openModal("prestamos-hoy")}
            />
          </View>

          {/* Sección de Gráficas */}
          <View style={styles.chartsSection}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name="bar-chart"
                size={isMobile ? 20 : 24}
                color={Colors.light.primary}
              />
              <Text
                style={[styles.sectionTitle, { fontSize: isMobile ? 18 : 22 }]}
              >
                Análisis y Reportes
              </Text>
            </View>

            {/* Gráfica de Línea - Préstamos por Mes */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Ionicons name="trending-up" size={24} color="#0A66FF" />
                <Text style={styles.chartTitle}>Préstamos Mensuales</Text>
              </View>
              <Text style={styles.chartDescription}>
                Evolución de préstamos durante los últimos 6 meses
              </Text>
              <View style={styles.lineChartContainer}>
                <View style={styles.lineChartGrid}>
                  {lineChartData.map((value, index) => {
                    const maxValue = Math.max(...lineChartData, 1);
                    const baseHeight = (value / maxValue) * 180;
                    const animatedHeight = chartAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, baseHeight],
                    });
                    const zeroHeight = 22;
                    const isZero = value <= 0;
                    const label = lineChartLabels[index];
                    return (
                      <View key={index} style={styles.lineChartColumn}>
                        <View style={styles.lineChartBarWrapper}>
                          <Animated.View
                            style={[
                              styles.lineChartBar,
                              {
                                height: isZero ? zeroHeight : animatedHeight,
                                opacity: isZero ? 0.5 : 1,
                                transform: [{ scaleY: isZero ? 1 : chartAnim }],
                              },
                            ]}
                          />
                          <Animated.Text
                            style={[
                              styles.lineChartValue,
                              { opacity: chartAnim },
                            ]}
                          >
                            {value}
                          </Animated.Text>
                        </View>
                        <Text style={styles.lineChartLabel}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Gráfica de Barras - Equipos por Categoría */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Ionicons name="bar-chart" size={24} color="#0A66FF" />
                <Text style={styles.chartTitle}>Equipos por Categoría</Text>
              </View>
              <Text style={styles.chartDescription}>
                Distribución del inventario por tipo de equipo
              </Text>
              <View style={styles.barChartContainer}>
                {barChartData.map((item, index) => {
                  const maxValue = Math.max(
                    ...barChartData.map((d) => d.value),
                    1,
                  );
                  const widthPercent = (item.value / maxValue) * 100;
                  const animatedWidth = chartAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", `${widthPercent}%`],
                  });
                  const zeroWidth = "18%";
                  const isZero = item.value <= 0;
                  return (
                    <View key={index} style={styles.barChartRow}>
                      <Text style={styles.barChartLabel}>{item.label}</Text>
                      <View style={styles.barChartBarContainer}>
                        <Animated.View
                          style={[
                            styles.barChartBar,
                            {
                              width: isZero ? zeroWidth : animatedWidth,
                              backgroundColor: isZero ? "#d1d5db" : item.color,
                              opacity: isZero ? 0.7 : 1,
                              transform: [{ scaleX: isZero ? 1 : chartAnim }],
                            },
                          ]}
                        />
                        <Animated.Text
                          style={[
                            styles.barChartValue,
                            { opacity: isZero ? 0.45 : chartAnim },
                          ]}
                        >
                          {item.value}
                        </Animated.Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Grid de 2 columnas para gráficas más pequeñas */}
            <View
              style={[
                styles.chartsGrid,
                isMobile && { flexDirection: "column" },
              ]}
            >
              {/* Gráfica de Pie - Estados de Préstamos */}
              <View
                style={[styles.chartCard, !isMobile && styles.chartCardSmall]}
              >
                <View style={styles.chartHeader}>
                  <Ionicons name="pie-chart" size={20} color="#0A66FF" />
                  <Text
                    style={[
                      styles.chartTitle,
                      { fontSize: isMobile ? 15 : 16 },
                    ]}
                  >
                    Estados de Préstamos
                  </Text>
                </View>
                <View style={styles.pieChartContainer}>
                  {pieChartData.map((item, index) => {
                    const total = pieChartData.reduce(
                      (sum, d) => sum + d.value,
                      0,
                    );
                    const percentage = ((item.value / total) * 100).toFixed(0);
                    return (
                      <View key={index} style={styles.pieChartRow}>
                        <View
                          style={[
                            styles.pieChartColor,
                            { backgroundColor: item.color },
                          ]}
                        />
                        <Text style={styles.pieChartLabel}>{item.name}</Text>
                        <Text style={styles.pieChartValue}>
                          {item.value} ({percentage}%)
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Gráfica de Progreso - Métricas Clave */}
              <View
                style={[styles.chartCard, !isMobile && styles.chartCardSmall]}
              >
                <View style={styles.chartHeader}>
                  <Ionicons name="stats-chart" size={20} color="#0A66FF" />
                  <Text
                    style={[
                      styles.chartTitle,
                      { fontSize: isMobile ? 15 : 16 },
                    ]}
                  >
                    Métricas Clave
                  </Text>
                </View>
                <View style={styles.progressChartContainer}>
                  {progressData.map((item, index) => {
                    const percentage = item.value * 100;
                    const zeroWidth = "14%";
                    const isZero = percentage <= 0;
                    return (
                      <View key={index} style={styles.progressChartRow}>
                        <Text style={styles.progressChartLabel}>
                          {item.label}
                        </Text>
                        <View style={styles.progressBarContainer}>
                          <View style={styles.progressBarBackground}>
                            <Animated.View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: isZero
                                    ? zeroWidth
                                    : chartAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ["0%", `${percentage}%`],
                                      }),
                                  backgroundColor: isZero
                                    ? "#d1d5db"
                                    : item.color,
                                  opacity: isZero ? 0.65 : 1,
                                  transform: [
                                    { scaleX: isZero ? 1 : chartAnim },
                                  ],
                                },
                              ]}
                            />
                          </View>
                          <Animated.Text
                            style={[
                              styles.progressBarValue,
                              { opacity: isZero ? 0.4 : chartAnim },
                            ]}
                          >
                            {percentage.toFixed(0)}%
                          </Animated.Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Tarjetas de Insights */}
            <View style={styles.insightsContainer}>
              <Text
                style={[
                  styles.sectionTitle,
                  { fontSize: isMobile ? 16 : 18, marginBottom: 12 },
                ]}
              >
                Insights Rápidos
              </Text>
              <View style={[styles.insightsGrid, isMobile && { gap: 10 }]}>
                <View style={styles.insightCard}>
                  <View
                    style={[styles.insightIcon, { backgroundColor: "#dcfce7" }]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={isMobile ? 20 : 24}
                      color="#16a34a"
                    />
                  </View>
                  <Text
                    style={[styles.insightValue, isMobile && { fontSize: 24 }]}
                  >
                    {((progressData[0]?.value || 0) * 100).toFixed(0)}%
                  </Text>
                  <Text
                    style={[styles.insightLabel, isMobile && { fontSize: 11 }]}
                  >
                    Tasa de Disponibilidad
                  </Text>
                </View>
                <View style={styles.insightCard}>
                  <View
                    style={[styles.insightIcon, { backgroundColor: "#dbeafe" }]}
                  >
                    <Ionicons
                      name="people"
                      size={isMobile ? 20 : 24}
                      color="#2563eb"
                    />
                  </View>
                  <Text
                    style={[styles.insightValue, isMobile && { fontSize: 24 }]}
                  >
                    {usuarios.filter((u) => u.activo).length}
                  </Text>
                  <Text
                    style={[styles.insightLabel, isMobile && { fontSize: 11 }]}
                  >
                    Usuarios Activos
                  </Text>
                </View>
                <View style={styles.insightCard}>
                  <View
                    style={[styles.insightIcon, { backgroundColor: "#fef3c7" }]}
                  >
                    <Ionicons
                      name="time"
                      size={isMobile ? 20 : 24}
                      color="#d97706"
                    />
                  </View>
                  <Text
                    style={[styles.insightValue, isMobile && { fontSize: 24 }]}
                  >
                    {(() => {
                      const prestamosConFechas = prestamosHoy.filter(
                        (p) => p.fechaSolicitud && p.fechaDevolucionEsperada,
                      );
                      if (prestamosConFechas.length === 0) return "0";
                      const promedio =
                        prestamosConFechas.reduce((sum, p) => {
                          const inicio = new Date(p.fechaSolicitud);
                          const fin = new Date(p.fechaDevolucionEsperada!);
                          const dias = Math.max(
                            0,
                            Math.ceil(
                              (fin.getTime() - inicio.getTime()) /
                                (1000 * 60 * 60 * 24),
                            ),
                          );
                          return sum + dias;
                        }, 0) / prestamosConFechas.length;
                      return promedio.toFixed(1);
                    })()}
                  </Text>
                  <Text
                    style={[styles.insightLabel, isMobile && { fontSize: 11 }]}
                  >
                    Días Promedio
                  </Text>
                </View>
                <View style={styles.insightCard}>
                  <View
                    style={[styles.insightIcon, { backgroundColor: "#e0e7ff" }]}
                  >
                    <Ionicons
                      name="trending-up"
                      size={isMobile ? 20 : 24}
                      color="#6366f1"
                    />
                  </View>
                  <Text
                    style={[styles.insightValue, isMobile && { fontSize: 24 }]}
                  >
                    {(() => {
                      if (lineChartData.length < 2) return "+0%";
                      const mesAnterior =
                        lineChartData[lineChartData.length - 2] || 1;
                      const mesActual =
                        lineChartData[lineChartData.length - 1] || 0;
                      const crecimiento =
                        mesAnterior === 0
                          ? 0
                          : ((mesActual - mesAnterior) / mesAnterior) * 100;
                      return `${crecimiento >= 0 ? "+" : ""}${crecimiento.toFixed(0)}%`;
                    })()}
                  </Text>
                  <Text
                    style={[styles.insightLabel, isMobile && { fontSize: 11 }]}
                  >
                    Crecimiento Mensual
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={activeModal !== null}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <View
          style={[
            styles.modalOverlay,
            (isMobile || isTablet) && styles.modalOverlayMobile,
          ]}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={closeModal}
            activeOpacity={1}
          />
          {renderModalContent()}
        </View>
      </Modal>

      {/* Botón flotante para Escanear QR (RF-6) */}
      <Pressable
        style={({ hovered }) => [
          styles.fab,
          hovered && Platform.OS === "web" && styles.fabHover,
        ]}
        onPress={() => setShowQrModal(true)}
      >
        <Ionicons name="qr-code-outline" size={24} color="#fff" />
        <Text style={styles.fabText}>Escanear QR</Text>
      </Pressable>

      {/* Modal de cámara QR */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowQrModal(false);
          setScannedData(null);
          setScannedPrestamo(null);
        }}
      >
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Ionicons name="qr-code" size={26} color="#0A2540" />
              <Text style={styles.qrModalTitle}>Escanear Código QR</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowQrModal(false);
                  setScannedData(null);
                  setScannedPrestamo(null);
                }}
              >
                <Ionicons name="close" size={26} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {!permission ? (
              <View style={styles.qrMockCamera}>
                <ActivityIndicator size="large" color="#0A66FF" />
                <Text style={styles.qrMockText}>Verificando permisos...</Text>
              </View>
            ) : !permission.granted ? (
              <View style={styles.qrMockCamera}>
                <Ionicons name="camera-outline" size={64} color="#0A66FF" />
                <Text style={styles.qrMockText}>
                  Se necesita permiso para acceder a la cámara
                </Text>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionButtonSuccess,
                    { marginTop: 16 },
                  ]}
                  onPress={requestPermission}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Permitir Cámara</Text>
                </TouchableOpacity>
              </View>
            ) : scannedPrestamo ? (
              <View style={styles.qrResultContainer}>
                <View style={styles.qrResultHeader}>
                  <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                  <Text style={styles.qrResultTitle}>QR Escaneado</Text>
                </View>

                <View style={styles.qrResultCard}>
                  <View style={styles.qrResultRow}>
                    <Text style={styles.qrResultLabel}>Equipo:</Text>
                    <Text style={styles.qrResultValue}>
                      {scannedPrestamo.equipoNombre}
                    </Text>
                  </View>
                  <View style={styles.qrResultRow}>
                    <Text style={styles.qrResultLabel}>Usuario:</Text>
                    <Text style={styles.qrResultValue}>
                      {scannedPrestamo.usuarioNombre}
                    </Text>
                  </View>
                  <View style={styles.qrResultRow}>
                    <Text style={styles.qrResultLabel}>Estado:</Text>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: getStatusTokens(
                            scannedPrestamo.estado,
                          ).bg,
                          borderColor: getStatusTokens(scannedPrestamo.estado)
                            .border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          {
                            color: getStatusTokens(scannedPrestamo.estado).text,
                          },
                        ]}
                      >
                        {formatEstadoLabel(scannedPrestamo.estado)}
                      </Text>
                    </View>
                  </View>
                  {scannedPrestamo.proposito && (
                    <View style={styles.qrResultRow}>
                      <Text style={styles.qrResultLabel}>Propósito:</Text>
                      <Text style={styles.qrResultValue}>
                        {scannedPrestamo.proposito}
                      </Text>
                    </View>
                  )}
                  {scannedPrestamo.codigoQR && (
                    <View style={styles.qrResultRow}>
                      <Text style={styles.qrResultLabel}>Código QR:</Text>
                      <Text
                        style={[
                          styles.qrResultValue,
                          { fontFamily: "monospace", fontSize: 11 },
                        ]}
                      >
                        {scannedPrestamo.codigoQR}
                      </Text>
                    </View>
                  )}
                </View>

                {(scannedPrestamo.estado === "aprobado" ||
                  scannedPrestamo.estado === "aceptado") &&
                  scannedPrestamo.codigoQR && (
                    <View style={styles.qrActionsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.actionButtonSuccess,
                          { width: "100%" },
                        ]}
                        onPress={() => {
                          entregarEquipo(scannedPrestamo.codigoQR!);
                        }}
                      >
                        <Ionicons name="cube-outline" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>
                          Entregar Equipo
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                {scannedPrestamo.estado === "activo" &&
                  scannedPrestamo.codigoQR && (
                    <View style={styles.qrActionsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: "#0A66FF", width: "100%" },
                        ]}
                        onPress={() => {
                          recibirDevolucion(scannedPrestamo.codigoQR!);
                        }}
                      >
                        <Ionicons
                          name="return-up-back-outline"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.actionButtonText}>
                          Recibir Devolución
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: "#6b7280", marginTop: 12 },
                  ]}
                  onPress={() => {
                    setScannedData(null);
                    setScannedPrestamo(null);
                  }}
                >
                  <Ionicons name="scan" size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Escanear Otro</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                  }}
                  onBarcodeScanned={(result) => {
                    if (scannedData) return; // Evitar múltiples escaneos

                    const scannedValue = parseScannedValue(result);
                    if (!scannedValue) {
                      Alert.alert(
                        "QR no legible",
                        "No se encontraron datos utilizables en el código. Intenta acercar más o verifica el contraste.",
                      );
                      return;
                    }

                    setScannedData(scannedValue);

                    // Buscar el préstamo por ID, QR code, o contenido del QR
                    const normalized = scannedValue.trim();
                    const prestamo = [
                      ...prestamosActivos,
                      ...prestamosHoy,
                    ].find(
                      (p) =>
                        p.id === normalized ||
                        p.id.toString() === normalized ||
                        p.QR === normalized ||
                        (p as any).codigoQR === normalized,
                    );

                    if (prestamo) {
                      // Si existe QR, agregarlo al objeto para las funciones de entrega/devolución
                      const prestamoConQR = {
                        ...prestamo,
                        codigoQR:
                          prestamo.QR ||
                          (prestamo as any).codigoQR ||
                          normalized,
                      };
                      setScannedPrestamo(prestamoConQR);
                    } else {
                      Alert.alert(
                        "Préstamo no encontrado",
                        `No se encontró el préstamo con el código escaneado`,
                        [
                          {
                            text: "OK",
                            onPress: () => {
                              setScannedData(null);
                            },
                          },
                        ],
                      );
                    }
                  }}
                />
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerText}>
                    Apunta al código QR del préstamo
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para exportar reportes */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                maxWidth: isMobile ? "90%" : isTablet ? 400 : 450,
                padding: isMobile ? 20 : 32,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { fontSize: isMobile ? 20 : 24 }]}
              >
                Descargar Reporte
              </Text>
              <TouchableOpacity
                onPress={() => setShowExportModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                styles.modalSubtitle,
                { fontSize: isMobile ? 14 : 16, marginBottom: 24 },
              ]}
            >
              Seleccione el formato de exportación:
            </Text>

            <TouchableOpacity
              style={[
                styles.exportOptionButton,
                { marginBottom: 12, padding: isMobile ? 16 : 18 },
              ]}
              onPress={async () => {
                console.log("Generando reporte PDF...");
                setShowExportModal(false);
                try {
                  const success = await downloadReport("pdf", {
                    prestamosActivos,
                    equipos,
                    usuarios,
                    prestamosHoy,
                  });

                  console.log("Resultado PDF:", success);
                  if (success && Platform.OS !== "web") {
                    Alert.alert("Éxito", "Reporte generado correctamente");
                  } else if (!success) {
                    Alert.alert("Error", "No se pudo generar el reporte PDF");
                  }
                } catch (error) {
                  console.error("Error en reporte PDF:", error);
                  Alert.alert(
                    "Error",
                    "Ocurrió un error al generar el reporte",
                  );
                }
              }}
            >
              <View style={styles.exportOptionContent}>
                <View style={styles.exportIconWrapper}>
                  <Ionicons name="document-text" size={28} color="#0A66FF" />
                </View>
                <View style={styles.exportTextContainer}>
                  <Text
                    style={[
                      styles.exportOptionTitle,
                      { fontSize: isMobile ? 16 : 18 },
                    ]}
                  >
                    Formato PDF
                  </Text>
                  <Text
                    style={[
                      styles.exportOptionDescription,
                      { fontSize: isMobile ? 12 : 13 },
                    ]}
                  >
                    Documento listo para imprimir
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportOptionButton,
                { marginBottom: 16, padding: isMobile ? 16 : 18 },
              ]}
              onPress={async () => {
                console.log("Generando reporte CSV...");
                setShowExportModal(false);
                try {
                  const success = await downloadReport("csv", {
                    prestamosActivos,
                    equipos,
                    usuarios,
                    prestamosHoy,
                  });

                  console.log("Resultado CSV:", success);
                  if (success) {
                    if (Platform.OS !== "web") {
                      Alert.alert(
                        "Éxito",
                        "Reporte CSV descargado correctamente",
                      );
                    }
                  } else {
                    Alert.alert("Error", "No se pudo descargar el reporte CSV");
                  }
                } catch (error) {
                  console.error("Error en reporte CSV:", error);
                  Alert.alert(
                    "Error",
                    "Ocurrió un error al generar el reporte",
                  );
                }
              }}
            >
              <View style={styles.exportOptionContent}>
                <View style={styles.exportIconWrapper}>
                  <Ionicons name="grid" size={28} color="#10b981" />
                </View>
                <View style={styles.exportTextContainer}>
                  <Text
                    style={[
                      styles.exportOptionTitle,
                      { fontSize: isMobile ? 16 : 18 },
                    ]}
                  >
                    Formato CSV
                  </Text>
                  <Text
                    style={[
                      styles.exportOptionDescription,
                      { fontSize: isMobile ? 12 : 13 },
                    ]}
                  >
                    Datos para Excel o análisis
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { padding: isMobile ? 14 : 16 }]}
              onPress={() => setShowExportModal(false)}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { fontSize: isMobile ? 14 : 16 },
                ]}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f4f8" },
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
  },
  loadingText: { marginTop: 16, fontSize: 16, color: "#666" },
  title: {
    fontWeight: "800",
    color: "#0A2540",
    marginBottom: 24,
  },
  dashboardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a3a6b",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.2s ease, transform 0.1s ease",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  downloadButtonHover: {
    backgroundColor: "#2a4a7b",
    transform: [{ translateY: -1 }],
  },
  downloadButtonText: {
    color: "#fff",
    fontWeight: "600",
    ...Platform.select({
      web: {
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      },
    }),
  },
  cardsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
    width: "100%",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e6edf5",
    marginBottom: 16,
    alignItems: "stretch",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 14px 40px rgba(10,37,64,0.08)",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
    position: "relative",
  },
  cardWebHover: {
    transform: [{ translateY: -6 }],
    ...Platform.select({
      web: {
        boxShadow: "0 18px 48px rgba(10,37,64,0.12)",
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIconWrapper: {
    backgroundColor: "#e8f1ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7e6ff",
  },
  cardIcon: { marginBottom: 0 },
  cardMeta: { flex: 1, marginLeft: 14 },
  cardTitle: {
    color: "#667788",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardValue: { color: "#0A2540", fontWeight: "800" },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  cardHint: { color: "#6b7280", letterSpacing: 0.2, fontWeight: "500" },
  cardTapIndicator: {
    backgroundColor: "#f0f5ff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d7e6ff",
  },
  placeholder: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e6edf5",
    ...Platform.select({
      web: { boxShadow: "0 16px 38px rgba(10,37,64,0.08)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 6,
      },
    }),
  },
  placeholderText: {
    color: "#6b7280",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  chartsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0A2540",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e6edf5",
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(10,37,64,0.08)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 5,
      },
    }),
  },
  chartCardSmall: {
    flex: 1,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2540",
  },
  chartDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  lineChartContainer: {
    marginTop: 10,
  },
  lineChartGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 200,
    paddingHorizontal: 10,
  },
  lineChartColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  lineChartBarWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
  },
  lineChartBar: {
    width: "60%",
    backgroundColor: "#0A66FF",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    minHeight: 20,
    ...Platform.select({
      web: {
        transition: "height 0.3s ease",
      },
    }),
  },
  lineChartValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2540",
    marginTop: 4,
  },
  lineChartLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 8,
    fontWeight: "600",
  },
  barChartContainer: {
    paddingVertical: 10,
  },
  barChartRow: {
    marginBottom: 16,
  },
  barChartLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 6,
  },
  barChartBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barChartBar: {
    height: 28,
    borderRadius: 6,
    minWidth: 30,
    ...Platform.select({
      web: {
        transition: "width 0.3s ease",
      },
    }),
  },
  barChartValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2540",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2540",
  },
  errorMessage: {
    fontSize: 14,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: "#0A66FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  pieChartContainer: {
    paddingVertical: 10,
  },
  pieChartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  pieChartColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 10,
  },
  pieChartLabel: {
    fontSize: 14,
    color: "#4b5563",
    flex: 1,
    fontWeight: "600",
  },
  pieChartValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2540",
  },
  progressChartContainer: {
    paddingVertical: 10,
  },
  progressChartRow: {
    marginBottom: 16,
  },
  progressChartLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 6,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 24,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 12,
    ...Platform.select({
      web: {
        transition: "width 0.3s ease",
      },
    }),
  },
  progressBarValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A2540",
    minWidth: 45,
    textAlign: "right",
  },
  chartsGrid: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  insightsContainer: {
    marginTop: 8,
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  insightCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    flex: 1,
    minWidth: 140,
    maxWidth: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e6edf5",
    ...Platform.select({
      web: { boxShadow: "0 8px 20px rgba(10,37,64,0.06)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  insightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  insightValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0A2540",
    marginBottom: 4,
  },
  insightLabel: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalOverlayMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: {
    backgroundColor: "#fdfefe",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e6edf5",
    width: "100%",
    maxWidth: 720,
    maxHeight: "85%",
    shadowColor: "#0A2540",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 30,
  },
  modalContentMobile: {
    height: "70%",
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e6edf5",
    backgroundColor: "#f7f9fc",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A2540",
    letterSpacing: 0.3,
  },
  closeButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#eef2f7",
    borderWidth: 1,
    borderColor: "#e0e6ef",
  },
  modalSubtitle: {
    color: "#64748b",
    lineHeight: 22,
  },
  exportOptionButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s ease",
        ":hover": {
          borderColor: "#0A66FF",
          backgroundColor: "#f8fafc",
          transform: "translateX(4px)",
        },
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  exportOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exportIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  exportTextContainer: {
    flex: 1,
  },
  exportOptionTitle: {
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  exportOptionDescription: {
    color: "#64748b",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    alignItems: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        ":hover": {
          backgroundColor: "#e2e8f0",
        },
      },
    }),
  },
  cancelButtonText: {
    color: "#475569",
    fontWeight: "600",
  },
  filtersContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e6edf5",
    backgroundColor: "#fff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f9fc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e4e9f2",
    ...Platform.select({
      web: { boxShadow: "0 10px 24px rgba(10,37,64,0.05)" },
    }),
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: "#1f2933" },
  statusFilters: { flexDirection: "row" },
  statusFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e9f2",
    ...Platform.select({
      web: { transition: "all 0.15s ease", cursor: "pointer" },
    }),
  },
  statusFilterButtonActive: {
    backgroundColor: "#0A66FF",
    borderColor: "#0A66FF",
  },
  statusFilterText: { fontSize: 14, color: "#4b5563", fontWeight: "600" },
  statusFilterTextActive: { color: "#fff" },
  resultsInfo: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f7f9fc",
    borderBottomWidth: 1,
    borderBottomColor: "#e6edf5",
  },
  resultsText: { fontSize: 14, color: "#4b5563", fontWeight: "600" },
  modalList: { flex: 1 },
  modalListContent: { paddingHorizontal: 14, paddingBottom: 24 },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e6edf5",
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: { boxShadow: "0 10px 24px rgba(10,37,64,0.06)" },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  listItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listTitleBlock: { flex: 1, paddingRight: 10 },
  listItemTitle: { fontSize: 16, fontWeight: "800", color: "#0A2540", flex: 1 },
  listItemSubtitle: { fontSize: 14, color: "#556273", marginTop: 2 },
  listMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f4f6fb",
    borderWidth: 1,
    borderColor: "#e4e9f2",
    marginRight: 8,
    marginTop: 6,
  },
  metaChipGhost: { backgroundColor: "#fff" },
  metaIcon: { marginRight: 6 },
  metaText: { fontSize: 13, color: "#4b5563", fontWeight: "500" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  fab: {
    position: "absolute",
    right: 22,
    bottom: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A66FF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: "0 16px 32px rgba(10,102,255,0.28)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      },
      default: {
        shadowColor: "#0A2540",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 8,
      },
    }),
  },
  fabHover: {
    transform: [{ translateY: -2 }],
    ...Platform.select({
      web: {
        boxShadow: "0 20px 38px rgba(10,102,255,0.34)",
      },
    }),
  },
  fabText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A66FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 12,
    ...Platform.select({
      web: { boxShadow: "0 10px 20px rgba(10,102,255,0.25)" },
    }),
  },
  actionButtonSuccess: { backgroundColor: "#1E7A39" },
  actionButtonDanger: { backgroundColor: "#C12C48" },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 420,
    gap: 16,
    ...Platform.select({
      web: { boxShadow: "0 20px 45px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  qrModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  qrModalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0A2540",
  },
  qrMockCamera: {
    height: 200,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#d7e6ff",
    backgroundColor: "#f3f6ff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  qrMockText: {
    textAlign: "center",
    color: "#4b5563",
    lineHeight: 20,
  },
  qrPrimaryButton: {
    alignSelf: "stretch",
    justifyContent: "center",
    marginTop: 8,
  },
  cameraContainer: {
    height: 400,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  scannerText: {
    marginTop: 20,
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  qrResultContainer: {
    padding: 16,
  },
  qrResultHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  qrResultTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2540",
    marginTop: 8,
  },
  qrResultCard: {
    backgroundColor: "#f7f9fc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  qrResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qrResultLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  qrResultValue: {
    fontSize: 14,
    color: "#0A2540",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  qrActionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, color: "#888", marginTop: 10 },
});

// Wrapper con ErrorBoundary
const AdminDashboardWithErrorBoundary = () => {
  return (
    <ErrorBoundary>
      <AdminDashboard />
    </ErrorBoundary>
  );
};

export default AdminDashboardWithErrorBoundary;
