// services/usuarioService.ts
// Servicio para manejar toda la lógica de usuarios

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { RegistroUsuarioData, Usuario } from "../types/usuario";

/**
 * Registrar un nuevo usuario
 */
export const registrarUsuario = async (
  datosUsuario: RegistroUsuarioData,
): Promise<string> => {
  try {
    // Validar que el correo no esté ya registrado
    const correoExiste = await verificarCorreoExistente(datosUsuario.correo);
    if (correoExiste) {
      throw new Error("El correo electrónico ya está registrado");
    }

    // Validar que la matrícula no esté ya registrada
    const matriculaExiste = await verificarMatriculaExistente(
      datosUsuario.matricula,
    );
    if (matriculaExiste) {
      throw new Error("La matrícula ya está registrada");
    }

    const nuevoUsuario = {
      ...datosUsuario,
      activo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "usuarios"), nuevoUsuario);
    return docRef.id;
  } catch (error) {
    if (__DEV__) {
      console.warn("Error al registrar usuario:", error);
    }
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos registrar el usuario";
    throw new Error(message);
  }
};

/**
 * Obtener todos los usuarios
 */
export const obtenerUsuarios = async (): Promise<Usuario[]> => {
  try {
    const snapshot = await getDocs(collection(db, "usuarios"));
    const usuarios = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Usuario[];

    // Ordenar por fecha de creación (más reciente primero)
    return usuarios.sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw error;
  }
};

/**
 * Obtener un usuario por ID
 */
export const obtenerUsuarioPorId = async (
  usuarioId: string,
): Promise<Usuario | null> => {
  try {
    const usuarioDoc = await getDoc(doc(db, "usuarios", usuarioId));
    if (!usuarioDoc.exists()) {
      return null;
    }

    return {
      id: usuarioDoc.id,
      ...usuarioDoc.data(),
      createdAt: usuarioDoc.data().createdAt?.toDate(),
      updatedAt: usuarioDoc.data().updatedAt?.toDate(),
    } as Usuario;
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return null;
  }
};

/**
 * Actualizar información de un usuario
 */
export const actualizarUsuario = async (
  usuarioId: string,
  datos: Partial<RegistroUsuarioData>,
): Promise<void> => {
  try {
    // Si se está actualizando el correo, verificar que no exista
    if (datos.correo) {
      const correoExiste = await verificarCorreoExistente(
        datos.correo,
        usuarioId,
      );
      if (correoExiste) {
        throw new Error(
          "El correo electrónico ya está registrado por otro usuario",
        );
      }
    }

    // Si se está actualizando la matrícula, verificar que no exista
    if (datos.matricula) {
      const matriculaExiste = await verificarMatriculaExistente(
        datos.matricula,
        usuarioId,
      );
      if (matriculaExiste) {
        throw new Error("La matrícula ya está registrada por otro usuario");
      }
    }

    await updateDoc(doc(db, "usuarios", usuarioId), {
      ...datos,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos actualizar el usuario";
    throw new Error(message);
  }
};

/**
 * Desactivar un usuario (soft delete)
 */
export const desactivarUsuario = async (usuarioId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "usuarios", usuarioId), {
      activo: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    throw error;
  }
};

/**
 * Activar un usuario
 */
export const activarUsuario = async (usuarioId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, "usuarios", usuarioId), {
      activo: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error al activar usuario:", error);
    throw error;
  }
};

/**
 * Eliminar un usuario permanentemente
 */
export const eliminarUsuario = async (usuarioId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "usuarios", usuarioId));
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    throw error;
  }
};

/**
 * Verificar si un correo ya existe
 */
const verificarCorreoExistente = async (
  correo: string,
  excluirUsuarioId?: string,
): Promise<boolean> => {
  try {
    const q = query(collection(db, "usuarios"), where("correo", "==", correo));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return false;
    }

    // Si estamos excluyendo un usuario (para actualización), verificar que no sea el mismo
    if (excluirUsuarioId) {
      return snapshot.docs.some((doc) => doc.id !== excluirUsuarioId);
    }

    return true;
  } catch (error) {
    console.error("Error al verificar correo:", error);
    return false;
  }
};

/**
 * Verificar si una matrícula ya existe
 */
const verificarMatriculaExistente = async (
  matricula: string,
  excluirUsuarioId?: string,
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, "usuarios"),
      where("matricula", "==", matricula),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return false;
    }

    // Si estamos excluyendo un usuario (para actualización), verificar que no sea el mismo
    if (excluirUsuarioId) {
      return snapshot.docs.some((doc) => doc.id !== excluirUsuarioId);
    }

    return true;
  } catch (error) {
    console.error("Error al verificar matrícula:", error);
    return false;
  }
};

/**
 * Buscar usuarios por término de búsqueda
 */
export const buscarUsuarios = async (termino: string): Promise<Usuario[]> => {
  try {
    const usuarios = await obtenerUsuarios();
    const terminoLower = termino.toLowerCase();

    return usuarios.filter(
      (usuario) =>
        usuario.nombre.toLowerCase().includes(terminoLower) ||
        usuario.apellido.toLowerCase().includes(terminoLower) ||
        usuario.correo.toLowerCase().includes(terminoLower) ||
        usuario.matricula.toLowerCase().includes(terminoLower),
    );
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    return [];
  }
};

/**
 * Obtener usuario del VPS por correo electrónico
 */
export const obtenerUsuarioPorCorreo = async (
  correo: string,
): Promise<{ id: number } | null> => {
  try {
    console.log("Buscando usuario con correo:", correo);
    const response = await fetch(
      `https://api.prestaapp.site/usuarios/email/${correo}`,
    );

    if (!response.ok) {
      console.log("Respuesta no exitosa del VPS:", response.status);
      return null;
    }

    const data = await response.json();
    console.log("Respuesta del VPS:", data);

    const usuario = data;

    if (usuario) {
      console.log("Usuario encontrado! ID:", usuario.id);
      return { id: usuario.id };
    } else {
      console.log("Usuario NO encontrado en VPS con correo:", correo);
      return null;
    }
  } catch (error) {
    console.error("Error al obtener usuario del VPS:", error);
    return null;
  }
};
