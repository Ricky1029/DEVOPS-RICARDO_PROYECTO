import { Colors } from '@/constants/theme';
import { collection, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, Animated, Easing, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/header';
import { SideMenu } from '../../components/shared/side-menu';
import React, { useEffect, useState } from 'react';
import { FavoriteProductCard } from '@/components/shared/favorite-product-card';
import { useResponsive } from '@/hooks/use-responsive';
import { auth, db } from '../../firebaseConfig';

const FavoritesScreen = () => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-300))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];
  const router = useRouter();
  const { width, isMobile, isTablet, isDesktop } = useResponsive();
  const [equipos, setEquipos] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [equiposLoaded, setEquiposLoaded] = useState(false);
  const loading = !(favoritesLoaded && equiposLoaded);
  const [noSession, setNoSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Responsive values
  const contentMaxWidth = isDesktop ? 1200 : width;

  const sampleEquipos = [
    {
      id: 'demo-1',
      nombre: 'Laptop Dell XPS',
      tipo: 'Laptop',
      estado: true,
      imagen: 'https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/media-gallery/notebook-xps-15-9530-campaign-hero-504x350.png',
    },
    {
      id: 'demo-2',
      nombre: 'Monitor LG 27"',
      tipo: 'Monitor',
      estado: true,
      imagen: 'https://www.lg.com/content/dam/channel/wcms/mx/images/monitores/27gp750-b_awp_espr_mx_c/27GP750-B-450.jpg',
    },
    {
      id: 'demo-3',
      nombre: 'Teclado mecánico',
      tipo: 'Accesorio',
      estado: true,
      imagen: 'https://spacegamer.com.ar/img/Public/1058-producto-1019-producto-teclado-kumara-k552-rainbow-switch-red-1-683-491.jpg',
    },
  ];

  const toggleMenu = () => {
    const springConfig = {
      damping: 20,
      mass: 0.8,
      stiffness: 100,
      useNativeDriver: true,
    };

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: isMenuVisible ? -300 : 0,
        ...springConfig,
      }),
      Animated.timing(fadeAnim, {
        toValue: isMenuVisible ? 0 : 1,
        duration: 500,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      })
    ]).start();
    setIsMenuVisible(!isMenuVisible);
  };

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Suscribir equipos
    const equiposRef = collection(db, 'equipos');
    const unsubscribeEquipos = onSnapshot(
      equiposRef,
      snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        setEquipos(data);
        setEquiposLoaded(true);
      },
      () => setEquiposLoaded(true)
    );
    cleanups.push(unsubscribeEquipos);

    // Fallback: carga inicial por getDocs en caso de que el listener tarde o falle en móviles
    getDocs(equiposRef)
      .then(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        setEquipos(data);
        setEquiposLoaded(true);
      })
      .catch(() => setEquiposLoaded(true));

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // Fallback de tiempo: si nada responde en 1.5s, mostramos ejemplos para evitar loader infinito
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!equiposLoaded) {
        setEquipos(sampleEquipos);
        setEquiposLoaded(true);
      }
      if (!favoritesLoaded) {
        setFavoriteIds([]);
        setFavoritesLoaded(true);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [equiposLoaded, favoritesLoaded]);

  // Listener de autenticación para saber cuándo hay usuario
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setNoSession(false);
        setFavoritesLoaded(false);
      } else {
        setUserId(null);
        setNoSession(true);
        setFavoriteIds([]);
        setFavoritesLoaded(true);
      }
    });
    return () => unsubAuth();
  }, []);

  // Listener de favoritos del usuario cuando hay userId
  useEffect(() => {
    if (!userId) return;
    setFavoritesLoaded(false);
    const userRef = doc(db, 'usuarios', userId);
    const unsubUser = onSnapshot(
      userRef,
      snapshot => {
        const favs = (snapshot.data()?.favoritos as string[] | undefined) || [];
        setFavoriteIds(favs);
        setFavoritesLoaded(true);
      },
      () => setFavoritesLoaded(true)
    );
    return () => unsubUser();
  }, [userId]);

  const handleRequestPress = (item: any) => {
    router.push({
      pathname: '../product-details' as any,
      params: {
        id: item.id,
        nombre: item.nombre,
        categoria: item.categoria || item.tipo || 'Sin categoría',
        estado: (item.estado ?? true).toString(),
        imagen: item.imagen || 'https://via.placeholder.com/300',
      },
    });
  };

  const numColumns = width < 640 ? 1 : width < 1024 ? 2 : 3;

  const renderItem = ({ item }: { item: any }) => (
    <FavoriteProductCard item={item} onPress={() => handleRequestPress(item)} />
  );

  const sourceEquipos = equipos.length > 0 ? equipos : sampleEquipos;
  const filteredFavorites = favoriteIds.length > 0
    ? sourceEquipos.filter(e => favoriteIds.includes(e.id))
    : [];

  // Si no hay favoritos coincidentes (por ejemplo, sin permisos para leer equipos), caemos a ejemplos
  const displayed = favoriteIds.length > 0
    ? (filteredFavorites.length > 0 ? filteredFavorites : sampleEquipos)
    : sourceEquipos.slice(0, 6); // ejemplos si no hay favoritos/sesión

  return (
    <SafeAreaView style={styles.container}>
      <Header onMenuPress={toggleMenu}>
        <Text style={[styles.title, { fontSize: isMobile ? 20 : isTablet ? 24 : 28 }]}>Mis Favoritos</Text>
      </Header>
      <SideMenu
        isVisible={isMenuVisible}
        onClose={toggleMenu}
        slideAnim={slideAnim}
        fadeAnim={fadeAnim}
      />
      <View style={{ flex: 1, width: '100%' }}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
        ) : displayed.length === 0 ? (
          <Text style={styles.emptyText}>No hay productos para mostrar.</Text>
        ) : (
          <FlatList
            data={displayed}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            key={numColumns}
            numColumns={numColumns}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.list,
              { 
                paddingHorizontal: isMobile ? 8 : isTablet ? 12 : 16,
                maxWidth: contentMaxWidth,
                alignSelf: 'stretch',
              }
            ]}
            columnWrapperStyle={numColumns > 1 ? { gap: 12, justifyContent: 'space-between' } : undefined}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundAlt,
  },
  title: {
    fontWeight: 'bold',
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  list: {
    paddingVertical: 16,
  },
  emptyText: {
    marginTop: 40,
    color: Colors.light.gray,
    fontSize: 16,
  },
});

export default FavoritesScreen;
