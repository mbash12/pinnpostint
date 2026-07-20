import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AvatarPlaceholder } from '@/components/ui/avatar-placeholder';
import { Colors, WebShadows } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAlert } from '@/components/ui/custom-alert';
import { formatUserName } from '@/utils/user-helpers';

export function ProfileSideMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();

  const handleLogout = async () => {
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
    try {
      await logout();
      router.replace('/(auth)/login' as never);
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to logout. Please try again.',
        type: 'error'
      });
    }
  };

  const menuItems = isAuthenticated ? [
    {
      id: '1',
      title: 'Create Ad',
      onPress: () => router.push('/(pages)/create-ad/select-category'),
    },
    {
      id: '2',
      title: 'My Favorites',
      onPress: () => router.push('/(pages)/my-favorites'),
    },
    {
      id: '3',
      title: 'My Bookings',
      onPress: () => router.push('/(pages)/my-bookings'),
    },
    {
      id: '4',
      title: 'Chat',
      onPress: () => router.push('/(pages)/chat'),
    },
    {
      id: '5',
      title: 'Settings',
      onPress: () => router.push('/(pages)/settings'),
    },
    {
      id: '6',
      title: 'Help & Support',
      onPress: () => router.push('/(pages)/help-support'),
    },
    {
      id: '7',
      title: 'Logout',
      onPress: handleLogout,
      isDanger: true,
    },
  ] : [
    {
      id: '1',
      title: 'Login',
      onPress: () => router.push('/(auth)/login'),
    },
    {
      id: '2',
      title: 'Help & Support',
      onPress: () => router.push('/(pages)/help-support'),
    },
  ];

  const isActive = (path: string) => {
    return pathname.includes(path);
  };

  return (
    <ThemedView style={styles.sidebar}>
      <View style={styles.userSection}>
        {isAuthenticated && user?.avatar ? (
          <NetworkImage
            source={{ uri: user.avatar }}
            style={styles.avatar}
            placeholder={require('@/assets/images/placeholder.png')}
          />
        ) : (
          <AvatarPlaceholder size={80} style={styles.avatar} />
        )}
        <View style={styles.userInfo}>
          <ThemedText style={styles.userName}>
            {isAuthenticated ? formatUserName(user) : 'Guest'}
          </ThemedText>
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => router.push('/(pages)/update-profile')}
            >
              <MaterialIcons name="edit" size={14} color={Colors.light.primary} />
              <ThemedText style={styles.editProfileText}>Edit Profile</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.menuItem,
              isAuthenticated && isActive('/create-ad') && item.id === '1' && styles.menuItemActive,
              isAuthenticated && (isActive('/my-favorites') || isActive('/orders-booking')) && item.id === '2' && styles.menuItemActive,
              isAuthenticated && (isActive('/my-bookings') || isActive('/orders-booking')) && item.id === '3' && styles.menuItemActive,
              isAuthenticated && isActive('/chat') && item.id === '4' && styles.menuItemActive,
              isAuthenticated && isActive('/settings') && item.id === '5' && styles.menuItemActive,
              isActive('/help-support') && item.id === (isAuthenticated ? '6' : '2') && styles.menuItemActive,
            ]}
            onPress={item.onPress}
          >
            <ThemedText style={[
              styles.menuText,
              item.isDanger && styles.menuTextDanger,
              isAuthenticated && isActive('/create-ad') && item.id === '1' && styles.menuTextActive,
              isAuthenticated && (isActive('/my-favorites') || isActive('/orders-booking')) && item.id === '2' && styles.menuTextActive,
              isAuthenticated && (isActive('/my-bookings') || isActive('/orders-booking')) && item.id === '3' && styles.menuTextActive,
              isAuthenticated && isActive('/chat') && item.id === '4' && styles.menuTextActive,
              isAuthenticated && isActive('/settings') && item.id === '5' && styles.menuTextActive,
              isActive('/help-support') && item.id === (isAuthenticated ? '6' : '2') && styles.menuTextActive,
            ]}>
              {item.title}
            </ThemedText>
            <MaterialIcons
              name="arrow-forward-ios"
              size={16}
              color={item.isDanger ? Colors.light.danger : Colors.light.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 320,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: Colors.light.backgroundSecondary,
  },
  userSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  userInfo: {
    alignItems: 'center',
    width: '100%',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    boxShadow: WebShadows.subtle,
  },
  editProfileText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    boxShadow: WebShadows.subtle,
  },
  menuItemActive: {
    backgroundColor: Colors.light.primary + '15',
  },
  menuText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
    flex: 1,
  },
  menuTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  menuTextDanger: {
    color: Colors.light.danger,
  },
});
