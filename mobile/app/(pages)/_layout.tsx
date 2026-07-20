import React from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/header';
import { DesktopHeader } from '@/components/desktop-header';
import { DesktopSidebar } from '@/components/desktop-sidebar';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { useSidebar } from '@/contexts/sidebar-context';
import { useResponsive } from '@/hooks/use-responsive';

// Pages that require authentication
const PROTECTED_PAGES = [
  'notifications',
  'update-profile',
  'my-favorites',
  'my-bookings',
  'settings',
  'booking',
  'payment',
  'change-password',
  'chat'
];

export default function PagesLayout() {
  const { isDesktop } = useResponsive();
  const { sidebarVisible, setSidebarVisible } = useSidebar();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      {isDesktop ? <DesktopHeader onMenuPress={() => setSidebarVisible(true)} /> : <Header showBack />}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: [styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }],
        }}>
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="update-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="all-categories" options={{ title: 'All Categories' }} />
        <Stack.Screen name="detail/[slug]" options={{ title: 'Ad Details' }} />
        <Stack.Screen name="blog/[slug]" options={{ title: 'Blog Post Details' }} />
        <Stack.Screen name="my-favorites" options={{ title: 'My Favorites' }} />
        <Stack.Screen name="my-bookings" options={{ title: 'My Bookings' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="help-support" options={{ title: 'Help & Support' }} />
        <Stack.Screen name="booking" options={{ title: 'Booking' }} />
        <Stack.Screen name="payment" options={{ title: 'Payment' }} />
        <Stack.Screen name="change-password" options={{ title: 'Change Password' }} />
        <Stack.Screen name="chat" options={{ title: 'Chat' }} />
        <Stack.Screen name="create-ad/index" options={{ title: 'Create Ad' }} />
        <Stack.Screen name="create-ad/select-category" options={{ title: 'Select Category' }} />
        <Stack.Screen name="create-ad/select-subcategory" options={{ title: 'Select Subcategory' }} />
        <Stack.Screen name="create-ad/ad-form" options={{ title: 'Ad Form' }} />
        <Stack.Screen name="create-ad/preview" options={{ title: 'Preview Ad' }} />
        <Stack.Screen name="create-ad/payment-success" options={{ title: 'Payment Success' }} />
      </Stack>
      
      {/* Desktop Sidebar */}
      {isDesktop && (
        <DesktopSidebar 
          isVisible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});