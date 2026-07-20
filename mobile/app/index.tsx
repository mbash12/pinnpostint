import { Redirect, SplashScreen } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { AuthContextType } from '@/contexts/auth-context';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore keep-awake errors on Android */
});

export default function Index() {
  const auth = useAuth() as AuthContextType | undefined;
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (auth && !auth.isLoading) {
      // Once auth state is loaded, hide splash and mark app as ready
      SplashScreen.hideAsync().catch(() => {
        /* ignore keep-awake errors on Android */
      });
      setAppReady(true);
    }
  }, [auth]);

  // Show loading indicator while checking auth status
  if (!auth || auth.isLoading || !appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Always redirect to the home (tabs) - public pages are accessible without auth
  // Protected pages have their own AuthProtection checks
  return <Redirect href="/(tabs)/" />;
}
