import React, { useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';

import { Footer } from '@/components/footer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserProfileCard } from '@/components/shared/user-profile-card';
import { AuthProtection } from '@/components/auth-protection';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuth } from '@/contexts/auth-context';
import { userService } from '@/services/user.service';
import type { User } from '@/types/api.types';
import { useAlert } from '@/components/ui/custom-alert';
import { formatUserName } from '@/utils/user-helpers';
import { TabBar } from '@/constants/theme';
import { HEADER_HEIGHT, DESKTOP_MAX_WIDTH } from '@/constants/layout';

export default function ProfileScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { user: authUser, logout } = useAuth();
  const [userProfile, setUserProfile] = useState<User | null>(authUser);
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (authUser) {
      fetchUserProfile();
    }
  }, [authUser]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const response = await userService.getProfile();
      if (response.success && response.data) {
        setUserProfile(response.data);
      }
    } catch (error) {
      setUserProfile(authUser);
    } finally {
      setIsLoading(false);
    }
  };

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

  const menuItems = [
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
  ];

  if (isLoading && !userProfile) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#CC1614" />
          <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const mobileView = (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TabBar.paddingBottom }}
        showsVerticalScrollIndicator={false}
      >
        <UserProfileCard
          name={formatUserName(userProfile)}
          avatar={userProfile?.avatar}
          onEditPress={() => router.push('/(pages)/update-profile')}
        />

        <ThemedView style={styles.menuContainer}>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuContent}>
                <ThemedText style={[
                  styles.menuText,
                  item.isDanger && styles.menuTextDanger
                ]}>
                  {item.title}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))}
        </ThemedView>
        <Footer />
      </ScrollView>
    </ThemedView>
  );
  
  const desktopView = (
    <View style={desktopStyles.container}>
      <View style={desktopStyles.content}>
        <View style={desktopStyles.mainContent}>
          <View style={desktopStyles.profileHeader}>
            <ThemedText style={desktopStyles.pageTitle}>Profile</ThemedText>
          </View>

          <UserProfileCard
            name={formatUserName(userProfile)}
            avatar={userProfile?.avatar}
            onEditPress={() => router.push('/(pages)/update-profile')}
            isDesktop={true}
          />

          <View style={desktopStyles.menuGrid}>
            {menuItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={desktopStyles.menuCard}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={desktopStyles.menuCardContent}>
                  <MaterialIcons
                    name={
                      item.id === '1' ? 'add-circle-outline' :
                      item.id === '2' ? 'favorite' :
                      item.id === '3' ? 'event' :
                      item.id === '4' ? 'chat-bubble-outline' :
                      item.id === '5' ? 'settings' :
                      item.id === '6' ? 'help-outline' :
                      'logout'
                    }
                    size={24}
                    color={item.isDanger ? '#660B0A' : '#CC1614'}
                    style={desktopStyles.menuIcon}
                  />
                  <View style={desktopStyles.menuTextContainer}>
                    <ThemedText style={[
                      desktopStyles.menuText,
                      item.isDanger && desktopStyles.menuTextDanger
                    ]}>
                      {item.title}
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
  
  return (
    <AuthProtection>
      {isDesktop ? desktopView : mobileView}
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: HEADER_HEIGHT,
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    gap: 14,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
    elevation: 1,
    minHeight: 65,
    justifyContent: 'space-between',
  },
  menuContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuText: {
    fontSize: 16,
    color: '#11181C',
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  menuTextDanger: {
    color: '#660B0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#687076',
  },
});

const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: DESKTOP_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    marginHorizontal: 'auto',
  },
  mainContent: {
    flex: 1,
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  profileHeader: {
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#11181C',
  },
  menuGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 32,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 280,
    maxWidth: 'calc(50% - 8px)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    marginRight: 4,
  },
  menuTextContainer: {
    flex: 1,
    position: 'relative',
  },
  menuText: {
    fontSize: 16,
    color: '#11181C',
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  menuTextDanger: {
    color: '#660B0A',
  },
});
