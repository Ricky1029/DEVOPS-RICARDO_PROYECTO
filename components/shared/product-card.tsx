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

// Componente de Tarjeta de Producto
export const ProductCard = ({ item, onPress }: { item: Equipo; onPress: () => void }) => (
  <TouchableOpacity style={styles.productCard} onPress={onPress}>
    <View style={styles.cardContent}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.imagen || 'https://via.placeholder.com/150' }}
          style={styles.productImage}
        />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.nombre}</Text>
        <Text style={styles.productType}>{item.tipo || 'Sin tipo'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.estado ? Colors.light.success : Colors.light.error }]}>
          <Text style={styles.statusText}>{item.estado ? 'Disponible' : 'No disponible'}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginRight: 16,
    width: 200,
    height: 280, // Altura fija para todas las tarjetas
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'column',
  },
  imageContainer: {
    height: 160, // Altura fija para el contenedor de la imagen
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  productInfo: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textDark,
    marginBottom: 4,
  },
  productType: {
    fontSize: 14,
    color: Colors.light.gray,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: Colors.light.background,
    fontSize: 12,
    fontWeight: '500',
  },
});
