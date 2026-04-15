# VpsUserContext - Documentación

## Descripción

El `VpsUserContext` proporciona acceso global al ID del usuario del VPS en toda la aplicación. El ID se guarda automáticamente al iniciar sesión y se mantiene persistente hasta que el usuario cierre sesión.

## Uso

### 1. Importar el hook

```typescript
import { useVpsUser } from "@/contexts/VpsUserContext";
```

### 2. Usar en tu componente

```typescript
const MiComponente = () => {
  const { vpsUserId, setVpsUserId, clearVpsUserId, isLoading } = useVpsUser();

  // Verificar si hay un ID disponible
  if (isLoading) {
    return <Text>Cargando...</Text>;
  }

  if (!vpsUserId) {
    return <Text>No hay usuario logueado</Text>;
  }

  // Usar el ID del VPS
  console.log("ID del usuario VPS:", vpsUserId);

  return <Text>Usuario ID: {vpsUserId}</Text>;
};
```

## API

### `vpsUserId: string | null`

El ID del usuario del VPS. Es `null` si no hay usuario logueado.

### `setVpsUserId: (id: string | null) => Promise<void>`

Guarda el ID del usuario en el contexto y en AsyncStorage.

```typescript
await setVpsUserId("123");
```

### `clearVpsUserId: () => Promise<void>`

Limpia el ID del usuario del contexto y de AsyncStorage.

```typescript
await clearVpsUserId();
```

### `isLoading: boolean`

Indica si el contexto está cargando el ID desde AsyncStorage al iniciar la aplicación.

## Ejemplos de uso

### En un formulario de préstamo

```typescript
const CrearPrestamo = () => {
  const { vpsUserId } = useVpsUser();
  const router = useRouter();

  const handleSubmit = async () => {
    if (!vpsUserId) {
      Alert.alert("Error", "Debes iniciar sesión");
      router.replace("/login");
      return;
    }

    // Usar el ID en la petición
    const response = await fetch("http://api.com/prestamos", {
      method: "POST",
      body: JSON.stringify({
        id_usuario: parseInt(vpsUserId),
        // ... otros datos
      }),
    });
  };
};
```

### En una pantalla de perfil

```typescript
const Perfil = () => {
  const { vpsUserId } = useVpsUser();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (vpsUserId) {
      fetch(`http://api.com/usuarios/${vpsUserId}`)
        .then(res => res.json())
        .then(data => setUserData(data));
    }
  }, [vpsUserId]);

  return <Text>{userData?.nombre}</Text>;
};
```

## Notas importantes

- El ID se guarda automáticamente al iniciar sesión
- El ID se limpia automáticamente al cerrar sesión
- El ID persiste entre reinicios de la app (usando AsyncStorage)
- Siempre verifica que `vpsUserId` no sea `null` antes de usarlo
- Usa `isLoading` para mostrar un indicador de carga mientras se obtiene el ID
