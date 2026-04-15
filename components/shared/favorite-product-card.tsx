import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Interfaces
interface Equipo {
  id: string;
  nombre: string;
  tipo?: string;
  estado?: boolean;
  imagen?: string;
}

// Componente de Tarjeta de Producto para Favoritos
export const FavoriteProductCard = ({ item, onPress }: { item: Equipo; onPress: () => void }) => (
  <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.92}>
    <View style={styles.cardContent}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.imagen || 'https://via.placeholder.com/200x140?text=Equipo' }}
          style={styles.productImage}
        />
        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name="heart" size={18} color={Colors.light.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.92}>
          {item.nombre}
        </Text>
        <Text style={styles.productType} numberOfLines={1} ellipsizeMode="tail">{item.tipo || 'Sin tipo'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.estado ? '#e6f4ef' : '#fbe9eb' }]}>
          <Text style={[styles.statusText, { color: item.estado ? Colors.light.success : Colors.light.error }]}>
            {item.estado ? 'Disponible' : 'No disponible'}
          </Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    margin: 8,
    flex: 1,
    minHeight: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  productInfo: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
  },
  productName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.light.textDark,
    marginBottom: 2,
    lineHeight: 19,
  },
  productType: {
    fontSize: 12.5,
    color: Colors.light.gray,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
