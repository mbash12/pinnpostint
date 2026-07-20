import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-context';
import { useAlert } from '@/components/ui/custom-alert';
import { Colors, Shadows } from '@/constants/theme';

interface DesktopSidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export function DesktopSidebar({ isVisible, onClose }: DesktopSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, logout } = useAuth();
  const { showAlert } = useAlert();

  const allMenuItems = [
    { name: 'Home', path: '/', icon: 'home' },
    { name: 'Blog', path: '/(tabs)/blog', icon: 'public' },
  ];

  const browseMenuItem = { name: 'Browse', path: '/(tabs)/browse', icon: 'search' };

  const authMenuItems = [
    { name: 'Post Ad', path: '/(pages)/create-ad', icon: 'add-circle' },
    { name: 'My Ads', path: '/(tabs)/my-ads', icon: 'dashboard' },
  ];

  const loginMenuItem = { name: 'Login', path: '/(auth)/login', icon: 'login' };

  const menuItems = isAuthenticated
    ? [...allMenuItems, browseMenuItem, ...authMenuItems]
    : [...allMenuItems, browseMenuItem, loginMenuItem];

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/' || pathname === '/(tabs)/' || pathname === '/(tabs)';
    }
    return pathname.includes(path);
  };

  const handleNavigation = (path: string) => {
    router.push(path as never);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <>
      <TouchableOpacity 
        style={styles.overlay} 
        onPress={onClose}
        activeOpacity={1}
      />
      
      <ThemedView style={styles.sidebar}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>Menu</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.path}
              style={[
                styles.menuItem,
                isActive(item.path) && styles.menuItemActive
              ]}
              onPress={() => handleNavigation(item.path)}
            >
              <MaterialIcons 
                name={item.icon as never} 
                size={22} 
                color={isActive(item.path) ? Colors.light.primary : Colors.light.textSecondary} 
              />
              <ThemedText style={[
                styles.menuText,
                isActive(item.path) && styles.menuTextActive
              ]}>
                {item.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {isAuthenticated && (
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={async () => {
                const confirmed = await new Promise<boolean>((resolve) => {
                  showAlert({
                    title: 'Logout',
                    message: 'Are you sure you want to logout?',
                    type: 'warning',
                    buttons: [
                      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                      { text: 'Logout', style: 'destructive', onPress: () => resolve(true) }
                    ]
                  });
                });
                if (!confirmed) return;
                logout();
                router.replace('/(auth)/login' as never);
              }}
            >
              <MaterialIcons name="logout" size={22} color={Colors.light.danger} />
              <ThemedText style={styles.logoutText}>Logout</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    ...Shadows.medium,
    zIndex: 1001,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: Colors.light.primary + '15',
  },
  menuText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  menuTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 15,
    color: Colors.light.danger,
    fontWeight: '500',
  },
});
