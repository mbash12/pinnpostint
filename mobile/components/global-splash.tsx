import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

interface GlobalSplashProps {
  children: React.ReactNode;
}

export function GlobalSplash({ children }: GlobalSplashProps) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Only show custom splash on web to prevent responsive flash
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => {
        setShowSplash(false);
        SplashScreen.hideAsync().catch(() => {
          /* ignore keep-awake errors on Android */
        });
      }, 800); // 800ms to cover responsive detection

      return () => clearTimeout(timer);
    } else {
      // On native, hide splash immediately
      SplashScreen.hideAsync().catch(() => {
        /* ignore keep-awake errors on Android */
      });
      setShowSplash(false);
    }
  }, []);

  if (showSplash && Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Image 
            source={require('@/assets/images/splash-icon.png')} 
            style={styles.logo}
            contentFit="contain"
          />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
});