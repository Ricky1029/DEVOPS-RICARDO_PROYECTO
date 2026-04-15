import {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  auth,
  db,
} from "@/firebaseConfig";
import { useResponsive } from "@/hooks/use-responsive";
import { activarUsuario, desactivarUsuario } from "@/services/usuarioService";
import { Usuario } from "@/types/usuario";
import { Ionicons } from "@expo/vector-icons";
import { deleteDoc, doc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const UsuariosAdminScreen = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form fields
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [matricula, setMatricula] = useState("");
  const [carrera, setCarrera] = useState("");
  const [rol, setRol] = useState<"Estudiante" | "Docente" | "Administrador">(
    "Estudiante",
  ); // RF-1
  const [showRolModal, setShowRolModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState(""); // Campo para password (RF-1)

  const { isMobile, isTablet } = useResponsive();

  const toFirebaseRole = (userRole: Usuario["rol"]) => {
    if (userRole === "Administrador") {
      return "admin";
    }
    return "user";
  };

  const createFirebaseAuthAccount = async (
    email: string,
    userPassword: string,
  ): Promise<{ uid: string; idToken: string }> => {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: userPassword,
          returnSecureToken: true,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data?.localId || !data?.idToken) {
      const firebaseCode = data?.error?.message;
      if (firebaseCode === "EMAIL_EXISTS") {
        throw new Error("Ese correo ya existe en Firebase.");
      }
      if (
        firebaseCode ===
        "WEAK_PASSWORD : Password should be at least 6 characters"
      ) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
      }
      throw new Error("No se pudo crear la cuenta en Firebase Auth.");
    }

    return {
      uid: data.localId,
      idToken: data.idToken,
    };
  };

  const emailExistsInFirebase = async (email: string): Promise<boolean> => {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: email,
          continueUri: "https://prestaapp.local",
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      const firebaseMessage = data?.error?.message;
      throw new Error(
        `No se pudo validar el correo en Firebase: ${firebaseMessage || "Error desconocido"}`,
      );
    }

    return data?.registered === true;
  };

  const emailExistsInVps = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `https://api.prestaapp.site/usuarios/email/${encodeURIComponent(email)}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          return false;
        }

        // Fallback por si el endpoint por correo falla o tiene comportamiento inconsistente
        const allUsersResponse = await fetch(
          "https://api.prestaapp.site/usuarios",
        );
        if (!allUsersResponse.ok) {
          throw new Error("No se pudo validar el correo en VPS.");
        }

        const users = await allUsersResponse.json();
        if (!Array.isArray(users)) {
          return false;
        }

        return users.some((user: any) => {
          const userEmail = (user.Email || user.correo || user.email || "")
            .toString()
            .trim()
            .toLowerCase();
          return userEmail === email;
        });
      }

      const data = await response.json();
      return Boolean(data?.id || data?.ID || data?.email || data?.Email);
    } catch (error) {
      if (__DEV__) {
        console.error("Error validating VPS email: ", error);
      }
      throw new Error("No se pudo validar si el correo ya existe en VPS.");
    }
  };

  const validateEmailAvailability = async (email: string): Promise<void> => {
    const [existsInFirebase, existsInVps] = await Promise.all([
      emailExistsInFirebase(email),
      emailExistsInVps(email),
    ]);

    if (existsInFirebase && existsInVps) {
      throw new Error("Ese correo ya existe en Firebase y en el VPS.");
    }

    if (existsInFirebase) {
      throw new Error("Ese correo ya existe en Firebase.");
    }

    if (existsInVps) {
      throw new Error("Ese correo ya existe en el VPS.");
    }
  };

  const deleteFirebaseAuthAccount = async (idToken: string): Promise<void> => {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
        }),
      },
    );
  };

  const upsertFirestoreUserDocument = async (
    uid: string,
    idToken: string,
    payload: {
      correo: string;
      email: string;
      nombre: string;
      apellido: string;
      telefono: string;
      matricula: string;
      rol: Usuario["rol"];
      role: "admin" | "user";
      activo: boolean;
    },
  ): Promise<void> => {
    const now = new Date().toISOString();

    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usuarios/${uid}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fields: {
            correo: { stringValue: payload.correo },
            email: { stringValue: payload.email },
            nombre: { stringValue: payload.nombre },
            apellido: { stringValue: payload.apellido },
            telefono: { stringValue: payload.telefono },
            matricula: { stringValue: payload.matricula },
            rol: { stringValue: payload.rol },
            role: { stringValue: payload.role },
            activo: { booleanValue: payload.activo },
            createdAt: { timestampValue: now },
            updatedAt: { timestampValue: now },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const firestoreMessage =
        errorBody?.error?.message || "Error desconocido de Firestore";
      throw new Error(
        `No se pudo crear el documento en Firestore: ${firestoreMessage}`,
      );
    }
  };

  // Helper para mostrar confirmaciones que funcione en web y móvil
  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: onConfirm },
      ]);
    }
  };

  // Helper para mostrar alertas simples que funcionen en web y móvil
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = () => {
    fetch("https://api.prestaapp.site/usuarios")
      .then((response) => response.json())
      .then((data) => {
        const currentUserEmail = auth.currentUser?.email?.toLowerCase();

        // Mapear los datos del backend al formato de la interfaz Usuario
        const usuariosMapeados = data
          .filter((user: any) => {
            // Filtrar el usuario actual si es admin
            const userEmail = (user.Email || user.correo || "").toLowerCase();
            return userEmail !== currentUserEmail;
          })
          .map((user: any, index: number) => ({
            id: String(user.ID || user.id || `temp-${index}`),
            nombre: user.Nombre || user.nombre || "",
            apellido: user.Apellido || user.apellido || "",
            telefono: user.Telefono || user.telefono || "",
            correo: user.Email || user.correo || "",
            matricula: user.Matricula || user.matricula || "",
            carrera: user.Carrera || user.carrera || "",
            rol: user.Rol || user.rol || "Estudiante",
            activo: user.Activo !== false,
            createdAt: user.created_at || user.createdAt || new Date(),
            updatedAt: user.updated_at || user.updatedAt || new Date(),
            // Mantener también las propiedades originales para compatibilidad
            ID: user.ID,
            Email: user.Email,
            Telefono: user.Telefono,
            Matricula: user.Matricula,
            Carrera: user.Carrera,
            Rol: user.Rol,
            Nombre: user.Nombre,
            Apellido: user.Apellido,
            Activo: user.Activo,
          }));
        setUsuarios(usuariosMapeados);
        setLoading(false);
      })
      .catch((error) => {
        showAlert("Error", "No se pudieron cargar los usuarios.");
        if (__DEV__) {
          console.error("Error fetching users: ", error);
        }
        setLoading(false);
      });
  };

  const handleAdd = () => {
    setEditingUser(null);
    resetForm();
    setModalVisible(true);
  };

  const handleEdit = (user: Usuario) => {
    setEditingUser(user);
    setNombre(user.nombre);
    setApellido(user.apellido);
    setTelefono(user.telefono);
    setCorreo(user.correo);
    setMatricula(user.matricula);
    setCarrera(user.carrera || user.Carrera || "");
    setRol(user.rol || "Estudiante"); // RF-1
    setPassword("");
    setModalVisible(true);
  };

  const handleToggleActive = async (user: Usuario) => {
    try {
      if (user.activo) {
        await desactivarUsuario(user.id);
        showAlert("Éxito", "Usuario desactivado correctamente.");
      } else {
        await activarUsuario(user.id);
        showAlert("Éxito", "Usuario activado correctamente.");
      }
    } catch (error) {
      showAlert("Error", "No se pudo cambiar el estado del usuario.");
      if (__DEV__) {
        console.error("Error toggling user status: ", error);
      }
    }
  };

  const handleDelete = (user: Usuario) => {
    showConfirmDialog(
      "Confirmar Eliminación",
      `¿Estás seguro de que quieres eliminar a "${user.nombre} ${user.apellido}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          const response = await fetch(
            `https://api.prestaapp.site/usuarios/eliminar/${user.id}`,
            { method: "DELETE" },
          );

          if (response.ok) {
            showAlert("Éxito", "Usuario eliminado correctamente.");
            fetchUsuarios(); // Refrescar lista después de eliminar
          } else {
            showAlert("Error", "No se pudo eliminar el usuario.");
          }
        } catch (error) {
          showAlert("Error", "No se pudo eliminar el usuario.");
          if (__DEV__) {
            console.error("Error deleting user: ", error);
          }
        }
      },
    );
  };

  const resetForm = () => {
    setNombre("");
    setApellido("");
    setTelefono("");
    setCorreo("");
    setMatricula("");
    setCarrera("");
    setRol("Estudiante"); // RF-1
    setPassword("");
  };

  const actualizarUsuario = async () => {
    try {
      const response = await fetch(
        `https://api.prestaapp.site/usuarios/modificar/${editingUser?.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            telefono: telefono.trim(),
            correo: correo.trim(),
            matricula: matricula.trim(),
            carrera: carrera.trim(),
            rol, // RF-1
          }),
        },
      );

      if (!response.ok) {
        throw new Error("No se pudo actualizar el usuario en el VPS.");
      }
    } catch (error) {
      if (__DEV__) {
        console.error("Error updating user: ", error);
      }
      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al actualizar el usuario.";
      throw new Error(message);
    }
  };

  const crearUsuario = async () => {
    let firebaseUser:
      | {
          uid: string;
          idToken: string;
        }
      | undefined;

    try {
      const normalizedEmail = correo.trim().toLowerCase();
      const trimmedPassword = password.trim();

      await validateEmailAvailability(normalizedEmail);

      firebaseUser = await createFirebaseAuthAccount(
        normalizedEmail,
        trimmedPassword,
      );

      await upsertFirestoreUserDocument(
        firebaseUser.uid,
        firebaseUser.idToken,
        {
          correo: normalizedEmail,
          email: normalizedEmail,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono.trim(),
          matricula: matricula.trim(),
          rol,
          role: toFirebaseRole(rol),
          activo: true,
        },
      );

      const response = await fetch(
        "https://api.prestaapp.site/usuarios/crear",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            matricula: matricula.trim(),
            telefono: telefono.trim(),
            email: normalizedEmail,
            rol: rol, // RF-1
            carrera: carrera.trim(),
            password: trimmedPassword, // RF-1
            created_at: new Date().toISOString().split("T")[0], // Solo fecha en formato YYYY-MM-DD
          }),
        },
      );

      if (!response.ok) {
        throw new Error("No se pudo registrar el usuario en el VPS.");
      }
    } catch (error) {
      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, "usuarios", firebaseUser.uid));
          await deleteFirebaseAuthAccount(firebaseUser.idToken);
        } catch (rollbackError) {
          if (__DEV__) {
            console.error("Error en rollback de Firebase: ", rollbackError);
          }
        }
      }

      if (__DEV__) {
        console.error("Error creating user: ", error);
      }
      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar el usuario.";
      throw new Error(message);
    }
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!nombre.trim()) {
      showAlert("Error", "El nombre es requerido");
      return;
    }
    if (!apellido.trim()) {
      showAlert("Error", "El apellido es requerido");
      return;
    }
    if (!telefono.trim()) {
      showAlert("Error", "El teléfono es requerido");
      return;
    }
    if (!correo.trim()) {
      showAlert("Error", "El correo es requerido");
      return;
    }
    if (!matricula.trim()) {
      showAlert("Error", "La matrícula es requerida");
      return;
    }
    if (!rol) {
      showAlert("Error", "El rol es requerido");
      return;
    }

    if (!editingUser) {
      if (!password.trim()) {
        showAlert("Error", "La contraseña es requerida");
        return;
      }

      if (password.trim().length < 6) {
        showAlert("Error", "La contraseña debe tener al menos 6 caracteres");
        return;
      }
    }

    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      showAlert("Error", "El correo no tiene un formato válido");
      return;
    }

    setSubmitting(true);

    try {
      if (editingUser) {
        // Actualizar usuario existente
        await actualizarUsuario();
        showAlert("Éxito", "Usuario actualizado correctamente.");
      } else {
        // Crear nuevo usuario
        await crearUsuario();
        showAlert("Éxito", "Usuario registrado correctamente.");
      }
      fetchUsuarios();
      setModalVisible(false);
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar el usuario";
      showAlert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsuarios = useMemo(() => {
    if (!searchTerm.trim()) return usuarios;

    const term = searchTerm.toLowerCase();
    return usuarios.filter(
      (user) =>
        user.nombre.toLowerCase().includes(term) ||
        user.apellido.toLowerCase().includes(term) ||
        user.correo.toLowerCase().includes(term) ||
        user.matricula.toLowerCase().includes(term),
    );
  }, [usuarios, searchTerm]);

  const StatusBadge = ({ active }: { active: boolean }) => (
    <View
      style={[
        styles.statusBadge,
        active ? styles.statusBadgeActive : styles.statusBadgeInactive,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          active
            ? styles.statusBadgeTextActive
            : styles.statusBadgeTextInactive,
        ]}
      >
        {active ? "Activo" : "Inactivo"}
      </Text>
    </View>
  );

  const UserCard = ({ user }: { user: Usuario }) => (
    <Pressable
      style={({ hovered }) => [
        styles.userCard,
        hovered && Platform.OS === "web" && styles.userCardHover,
      ]}
    >
      <View style={styles.userCardHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(user.Email || user.correo || "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userCardInfo}>
          <Text style={styles.userCardName}>
            {user.nombre} {user.apellido}
          </Text>
          <Text style={styles.userCardEmail}>{user.Email || user.correo}</Text>
        </View>
        <StatusBadge active={user.activo} />
      </View>

      <View style={styles.userCardBody}>
        <View style={styles.userCardRow}>
          <Ionicons name="call-outline" size={16} color="#6b7280" />
          <Text style={styles.userCardLabel}>Teléfono:</Text>
          <Text style={styles.userCardValue}>
            {user.Telefono || user.telefono}
          </Text>
        </View>
        <View style={styles.userCardRow}>
          <Ionicons name="school-outline" size={16} color="#6b7280" />
          <Text style={styles.userCardLabel}>Matrícula:</Text>
          <Text style={styles.userCardValue}>
            {user.Matricula || user.matricula}
          </Text>
        </View>
        <View style={styles.userCardRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#6b7280" />
          <Text style={styles.userCardLabel}>Rol:</Text>
          <View style={styles.rolBadge}>
            <Text style={styles.rolBadgeText}>
              {user.Rol || user.rol || "Sin asignar"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.userCardActions}>
        <Pressable
          style={({ hovered }) => [
            styles.actionButton,
            styles.actionButtonEdit,
            hovered && Platform.OS === "web" && styles.actionButtonHover,
          ]}
          onPress={() => handleEdit(user)}
        >
          <Ionicons name="pencil" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Editar</Text>
        </Pressable>
        <Pressable
          style={({ hovered }) => [
            styles.actionButton,
            styles.actionButtonDanger,
            hovered && Platform.OS === "web" && styles.actionButtonHover,
          ]}
          onPress={() => handleDelete(user)}
        >
          <Ionicons name="trash" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Eliminar</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={[
          styles.container,
          (isMobile || isTablet) && styles.containerMobile,
        ]}
        contentContainerStyle={styles.scrollContent}
      >
        {Platform.OS === "web" && !isMobile && !isTablet && (
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="people-outline" size={24} color="#0A2540" />
              <Text style={styles.title}>Gestión de Usuarios</Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            (isMobile || isTablet) && styles.searchContainerMobile,
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, apellido, correo o matrícula..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#9ca3af"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#0A66FF"
            style={styles.loader}
          />
        ) : (
          <View style={styles.usersContainer}>
            {filteredUsuarios.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyStateText}>
                  {searchTerm
                    ? "No se encontraron usuarios"
                    : "No hay usuarios registrados"}
                </Text>
              </View>
            ) : (
              filteredUsuarios.map((user) => (
                <UserCard key={user.id} user={user} />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={({ hovered }) => [
          styles.floatingAddButton,
          (isMobile || isTablet) && styles.floatingAddButtonMobile,
          hovered && Platform.OS === "web" && styles.floatingAddButtonHover,
        ]}
        onPress={handleAdd}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
        <Text style={styles.floatingAddButtonText}>Nuevo</Text>
      </Pressable>

      {/* Modal de Registro/Edición */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              (isMobile || isTablet) && styles.modalContentMobile,
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingUser ? "Editar Usuario" : "Registrar Nuevo Usuario"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Ingrese el nombre"
                  placeholderTextColor="#9ca3af"
                  maxLength={50}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Ingrese el password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  maxLength={50}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Apellido *</Text>
                <TextInput
                  style={styles.input}
                  value={apellido}
                  onChangeText={setApellido}
                  placeholder="Ingrese el apellido"
                  placeholderTextColor="#9ca3af"
                  maxLength={50}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Teléfono *</Text>
                <TextInput
                  style={styles.input}
                  value={telefono}
                  onChangeText={setTelefono}
                  placeholder="Ingrese el teléfono"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Correo Electrónico *</Text>
                <TextInput
                  style={styles.input}
                  value={correo}
                  onChangeText={setCorreo}
                  placeholder="Ingrese el correo"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={100}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Matrícula *</Text>
                <TextInput
                  style={styles.input}
                  value={matricula}
                  onChangeText={setMatricula}
                  placeholder="Ingrese la matrícula"
                  placeholderTextColor="#9ca3af"
                  maxLength={20}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Carrera</Text>
                <TextInput
                  style={styles.input}
                  value={carrera}
                  onChangeText={setCarrera}
                  placeholder="Ingrese la carrera"
                  placeholderTextColor="#9ca3af"
                  maxLength={100}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Rol *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dropdown]}
                  onPress={() => setShowRolModal(true)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !rol && styles.dropdownPlaceholder,
                    ]}
                  >
                    {rol || "Selecciona el rol"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setModalVisible(false)}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSubmit]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>
                      {editingUser ? "Actualizar" : "Registrar"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para selección de rol (RF-1) */}
      <Modal
        visible={showRolModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRolModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rolModalContent}>
            <Text style={styles.rolModalTitle}>Selecciona el Rol</Text>

            <TouchableOpacity
              style={[
                styles.rolOption,
                rol === "Estudiante" && styles.rolOptionSelected,
              ]}
              onPress={() => {
                setRol("Estudiante");
                setShowRolModal(false);
              }}
            >
              <Ionicons
                name="school"
                size={24}
                color={rol === "Estudiante" ? "#0A66FF" : "#6b7280"}
              />
              <Text
                style={[
                  styles.rolOptionText,
                  rol === "Estudiante" && styles.rolOptionTextSelected,
                ]}
              >
                Estudiante
              </Text>
              {rol === "Estudiante" && (
                <Ionicons name="checkmark-circle" size={24} color="#0A66FF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.rolOption,
                rol === "Docente" && styles.rolOptionSelected,
              ]}
              onPress={() => {
                setRol("Docente");
                setShowRolModal(false);
              }}
            >
              <Ionicons
                name="person"
                size={24}
                color={rol === "Docente" ? "#0A66FF" : "#6b7280"}
              />
              <Text
                style={[
                  styles.rolOptionText,
                  rol === "Docente" && styles.rolOptionTextSelected,
                ]}
              >
                Docente
              </Text>
              {rol === "Docente" && (
                <Ionicons name="checkmark-circle" size={24} color="#0A66FF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.rolOption,
                rol === "Administrador" && styles.rolOptionSelected,
              ]}
              onPress={() => {
                setRol("Administrador");
                setShowRolModal(false);
              }}
            >
              <Ionicons
                name="shield-checkmark"
                size={24}
                color={rol === "Administrador" ? "#0A66FF" : "#6b7280"}
              />
              <Text
                style={[
                  styles.rolOptionText,
                  rol === "Administrador" && styles.rolOptionTextSelected,
                ]}
              >
                Administrador
              </Text>
              {rol === "Administrador" && (
                <Ionicons name="checkmark-circle" size={24} color="#0A66FF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rolModalCloseButton}
              onPress={() => setShowRolModal(false)}
            >
              <Text style={styles.rolModalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 24,
  },
  containerMobile: {
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerMobile: {
    marginBottom: 16,
    gap: 12,
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A2540",
    letterSpacing: 0,
  },
  titleMobile: {
    fontSize: 20,
    flex: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A66FF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s",
        ":hover": {
          backgroundColor: "#0856d6",
          transform: "translateY(-1px)",
        },
      },
    }),
  },
  addButtonMobile: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  floatingAddButton: {
    position: "absolute",
    right: 20,
    bottom: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A66FF",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 22px rgba(10, 102, 255, 0.35)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        ":hover": {
          transform: "translateY(-2px) scale(1.02)",
          boxShadow: "0 14px 26px rgba(10, 102, 255, 0.42)",
        },
      },
      default: {
        shadowColor: "#0A66FF",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  floatingAddButtonHover: {
    transform: "translateY(-2px) scale(1.02)",
    boxShadow: "0 14px 26px rgba(10, 102, 255, 0.42)",
  },
  floatingAddButtonMobile: {
    right: 16,
    bottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  floatingAddButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchContainerMobile: {
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
  },
  loader: {
    marginTop: 40,
  },
  usersContainer: {
    gap: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        ":hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 10px 24px rgba(10,37,64,0.12)",
        },
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
  userCardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 10px 24px rgba(10,37,64,0.12)",
  },
  userCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0A66FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  userCardInfo: {
    flex: 1,
  },
  userCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  userCardEmail: {
    fontSize: 14,
    color: "#6b7280",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: "#d1fae5",
  },
  statusBadgeInactive: {
    backgroundColor: "#fee2e2",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadgeTextActive: {
    color: "#065f46",
  },
  statusBadgeTextInactive: {
    color: "#991b1b",
  },
  userCardBody: {
    gap: 12,
    marginBottom: 16,
  },
  userCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userCardLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  userCardValue: {
    fontSize: 14,
    color: "#1f2937",
  },
  rolBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  rolBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e40af",
  },
  userCardActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.14s ease, opacity 0.14s ease",
        ":hover": {
          transform: "translateY(-1px)",
          opacity: 0.95,
        },
      },
    }),
  },
  actionButtonHover: {
    transform: "translateY(-1px)",
    opacity: 0.95,
  },
  actionButtonEdit: {
    backgroundColor: "#0e7490",
  },
  actionButtonWarning: {
    backgroundColor: "#f59e0b",
  },
  actionButtonSuccess: {
    backgroundColor: "#10b981",
  },
  actionButtonDanger: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  modalContentMobile: {
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2937",
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    fontSize: 15,
    color: "#1f2937",
  },
  dropdownPlaceholder: {
    color: "#9ca3af",
  },
  rolModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  rolModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 20,
    textAlign: "center",
  },
  rolOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    marginBottom: 12,
    backgroundColor: "#fff",
    gap: 12,
  },
  rolOptionSelected: {
    borderColor: "#0A66FF",
    backgroundColor: "#eff6ff",
  },
  rolOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#4b5563",
  },
  rolOptionTextSelected: {
    color: "#0A66FF",
  },
  rolModalCloseButton: {
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  rolModalCloseText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6b7280",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.14s ease, opacity 0.14s ease",
        ":hover": {
          transform: "translateY(-1px)",
          opacity: 0.96,
        },
      },
    }),
  },
  modalButtonCancel: {
    backgroundColor: "#f3f4f6",
  },
  modalButtonSubmit: {
    backgroundColor: "#0A66FF",
  },
  modalButtonTextCancel: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "600",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default UsuariosAdminScreen;
