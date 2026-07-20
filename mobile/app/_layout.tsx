import { LogBox } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack , useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/config/firebase';
import { Platform, View, StyleSheet } from 'react-native';
import { useWebFcm } from '@/hooks/use-web-fcm';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { useEffect, useRef } from 'react';
import './global.css';

// Suppress non-critical Android keep-awake error in dev
LogBox.ignoreLogs(['Unable to activate keep awake']);

import { FilterProvider, useFilter } from '@/hooks/use-filter';
import { CategoryProvider } from '@/hooks/use-category';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { AuthProvider } from '@/contexts/auth-context';
import { LocationProvider } from '@/contexts/location-context';
import { SocketProvider } from '@/contexts/socket-context';
import { AlertProvider } from '@/components/ui/custom-alert';
import { GlobalSplash } from '@/components/global-splash';
import { AuthDataRefresh } from '@/components/auth-data-refresh';
import { AutoLocationSetup } from '@/components/auto-location-setup';
import { FilterBottomSheet, FilterOptions } from '@/components/ui/filter-bottom-sheet';
import { GlobalLoginModal } from '@/components/auth/global-login-modal';
import { WebZoomHandler } from '@/components/web-zoom-handler';
import { PendingPaymentRetry } from '@/components/pending-payment-retry';

// Component to handle native push notifications
function NativePushNotifications() {
  usePushNotifications();
  return null;
}

// Component to handle web notification clicks via service worker messages
function WebNotificationHandler() {
  const router = useRouter();
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { url, data } = event.data;

        // Prevent duplicate handling
        if (url && !handled.current.has(url)) {
          handled.current.add(url);
          router.push(url as any);

          // Clean up old URLs from the set
          if (handled.current.size > 10) {
            const first = handled.current.values().next().value;
            handled.current.delete(first);
          }
        }
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [router]);

  return null;
}

// Global Filter Modal Component
function GlobalFilterModal() {
  const { filters, showFilter, setShowFilter, handleApplyFilters, handleResetFilters } = useFilter();
  const router = useRouter();

  const handleApply = (newFilters: FilterOptions) => {
    if (!showFilter) return;

    handleApplyFilters(newFilters);
    setShowFilter(false);

    // Build a complete params object — every key is explicitly set or undefined
    // so router.replace fully replaces the URL with no stale params lingering
    const newParams: any = {
      minPrice: newFilters.priceRange.min || undefined,
      maxPrice: newFilters.priceRange.max || undefined,
      locationLatitude: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationLatitude
        : undefined,
      locationLongitude: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationLongitude
        : undefined,
      locationName: (newFilters.locationLatitude !== undefined && newFilters.locationLongitude !== undefined)
        ? newFilters.locationName
        : undefined,
      sortBy: (newFilters.sortBy && newFilters.sortBy !== 'Most Recent') ? newFilters.sortBy : undefined,
      categoryId: newFilters.categoryId || undefined,
      category: newFilters.categoryId ? newFilters.category : undefined,
      subcategoryId: newFilters.subcategoryId || undefined,
      subcategoryName: newFilters.subcategoryId ? newFilters.subcategoryName : undefined,
    };

    // Filter out undefined params
    const cleanParams = Object.fromEntries(
      Object.entries(newParams).filter(([_, value]) => value !== undefined)
    );

    // Always navigate to browse page when filters are applied
    // This ensures users see the filtered results on the correct page
    router.push({ pathname: '/(tabs)/browse', params: cleanParams as any });
  };

  const handleClose = () => {
    if (showFilter) {
      setShowFilter(false);
    }
  };

  const handleReset = () => {
    if (!showFilter) return;

    handleResetFilters();
    setShowFilter(false);

    // Clear all filter params by navigating to browse without params
    router.replace({
      pathname: '/(tabs)/browse',
      params: {}
    });
  };

  return (
    <FilterBottomSheet
      visible={showFilter}
      onClose={handleClose}
      onApply={handleApply}
      onReset={handleReset}
      filters={filters}
    />
  );
}


// Custom theme with white background
const CustomTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
  },
};

function RootLayoutContent() {
  useWebFcm(); // Initialize FCM for web

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Pin N Post - Buy, Sell & Discover</title>
          <meta name="description" content="Pin N Post - Your marketplace for buying and selling" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
      )}
      <GlobalSplash>
          <AuthProvider>
            <SocketProvider>
            <AlertProvider>
              <LocationProvider>
                <AutoLocationSetup />
                <PendingPaymentRetry />
                <SidebarProvider>
                  <CategoryProvider>
                    <FilterProvider>
                      <AuthDataRefresh>
                        <WebZoomHandler />
                        {Platform.OS !== 'web' && <NativePushNotifications />}
                        <ThemeProvider value={CustomTheme}>
                          {Platform.OS === 'web' ? (
                            <>
                              <WebNotificationHandler />
                              <Stack screenOptions={{ headerShown: false }}>
                                <Stack.Screen name="index" />
                                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                <Stack.Screen name="(pages)" options={{ headerShown: false }} />
                              </Stack>
                              <StatusBar style="dark" />
                            </>
                          ) : (
                            <>
                            <Stack screenOptions={{ headerShown: false }}>
                              <Stack.Screen name="index" />
                              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                              <Stack.Screen name="(pages)" options={{ headerShown: false }} />
                            </Stack>
                            <StatusBar style="dark" />
                            </>
                          )}
                        </ThemeProvider>
                        {/* Global Filter Modal - renders once in the entire app */}
                        <GlobalFilterModal />
                        {/* Global Login Modal - triggered via AuthContext on desktop */}
                        <GlobalLoginModal />
                      </AuthDataRefresh>
                    </FilterProvider>
                  </CategoryProvider>
                </SidebarProvider>
              </LocationProvider>
            </AlertProvider>
          </SocketProvider>
          </AuthProvider>
      </GlobalSplash>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}


