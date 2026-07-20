/**
 * Auth Data Refresh Component
 * Automatically refreshes user data when the app becomes active
 */

import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/auth-context';

interface AuthDataRefreshProps {
  children: React.ReactNode;
}

export function AuthDataRefresh({ children }: AuthDataRefreshProps) {
  const { isAuthenticated, refreshUser } = useAuth();

  useEffect(() => {
    let lastRefreshTime = Date.now();
    const REFRESH_COOLDOWN = 30 * 1000; // 30 seconds cooldown between refreshes

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        const now = Date.now();

        // Only refresh if enough time has passed since the last refresh
        if (now - lastRefreshTime > REFRESH_COOLDOWN) {
          try {
            await refreshUser();
            lastRefreshTime = Date.now();
          } catch (error) {
          }
        } else {
        }
      }
    };

    // Set up the app state listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Clean up the listener when component unmounts
    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, refreshUser]);

  return <>{children}</>;
}