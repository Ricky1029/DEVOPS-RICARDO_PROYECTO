import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface HamburgerMenuProps {
  isVisible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
  currentPath: string;
}

export function HamburgerMenu({ isVisible, onClose, slideAnim, currentPath }: HamburgerMenuProps) {
  const router = useRouter();

  const menuItems = [
    { title: 'Inicio', icon: 'home-outline', link: '/(tabs)' },
    { title: 'Catálogo', icon: 'grid-outline', link: '/(tabs)/index' },
    { title: 'Mi Perfil', icon: 'person-outline', link: '/(tabs)/profile' },
    { title: 'Favoritos', icon: 'heart-outline', link: '/(tabs)/favorites' }
  ];

  const handleMenuItemPress = (link: string, title: string) => {
    if (title === 'Favoritos') {
      Alert.alert(
        'Mis Favoritos',
        'Aquí podrás ver tus equipos favoritos próximamente.\n\nFuncionalidad en desarrollo.',
        [{ text: 'OK', onPress: () => console.log('Alert closed') }]
      );
    } else if (currentPath !== link) {
      router.push(link as any);
    }
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.sideMenu,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menú</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-outline" size={28} color={Colors.light.primary} />
            </TouchableOpacity>
          </View>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                currentPath === item.link && styles.menuItemActive
              ]}
              onPress={() => handleMenuItemPress(item.link, item.title)}
            >
              <Ionicons name={item.icon as any} size={24} color={Colors.light.primary} />
              <Text style={styles.menuItemText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '70%',
    backgroundColor: Colors.light.background,
    paddingVertical: 20,
    paddingHorizontal: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemActive: {
    backgroundColor: Colors.light.backgroundAlt,
  },
  menuItemText: {
    marginLeft: 15,
    fontSize: 16,
    color: Colors.light.text,
  },
});