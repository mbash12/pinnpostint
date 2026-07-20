import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { LoginModal } from './auth/login-modal';
import { Colors, WebShadows } from '@/constants/theme';
import { GradientButton } from './ui/gradient-button';

interface AuthProtectionProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export function AuthProtection({
  children,
  redirectTo = '/(auth)/login',
  requireAuth = true
}: AuthProtectionProps) {
  const { isAuthenticated, isLoading, user, setLoginModalVisible, isLoggingOut, isJustLoggedIn, isLoginModalVisible } = useAuth();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [hasPromptedLogin, setHasPromptedLogin] = useState(false);
  const [modalHasOpened, setModalHasOpened] = useState(false);

  // Track when the modal genuinely mounts into view after we requested it
  useEffect(() => {
    if (isLoginModalVisible && hasPromptedLogin) {
      setModalHasOpened(true);
    }
  }, [isLoginModalVisible, hasPromptedLogin]);

  useEffect(() => {
    // Only redirect if not loading, auth is required, and user is not authenticated
    // For desktop, we show a modal instead of redirecting
    // We also skip this if a manual logout is in progress to avoid double popups/redirects
    // Also skip if user just logged in (within 2 seconds) to prevent immediate modal popup
    if (!isLoading && requireAuth && !isAuthenticated && !isLoggingOut && !isJustLoggedIn()) {
      if (isDesktop) {
        if (!hasPromptedLogin) {
          setLoginModalVisible(true);
          setHasPromptedLogin(true);
        } else if (modalHasOpened && !isLoginModalVisible) {
          // If the modal was successfully fired, but is now closed and user isn't authenticated yet,
          // they aborted the login prompt. Redirect them to the home page!
          router.replace('/');
        }
      } else {
        router.replace(redirectTo as any);
      }
    }
  }, [isAuthenticated, isLoading, router, redirectTo, requireAuth, user, isDesktop, setLoginModalVisible, isLoggingOut, isJustLoggedIn, hasPromptedLogin, isLoginModalVisible, modalHasOpened]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
        <ThemedText style={styles.loadingText}>Checking authentication...</ThemedText>
      </View>
    );
  }

  // Show login required state on desktop
  // Don't show if user just logged in (prevent immediate popup)
  if (requireAuth && !isAuthenticated && isDesktop && !isLoggingOut && !isJustLoggedIn()) {
    return (
      <View style={styles.desktopContainer}>
        <View style={styles.loginRequiredCard}>
          <ThemedText style={styles.cardTitle}>Login Required</ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            Please sign in to access this page
          </ThemedText>
          <GradientButton
            title="Sign In Now"
            onPress={() => setLoginModalVisible(true)}
          />
        </View>
      </View>
    );
  }

  // Show loading while redirecting on mobile
  // Don't redirect if user just logged in
  if (requireAuth && !isAuthenticated && !isJustLoggedIn()) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
        <ThemedText style={styles.loadingText}>Redirecting to login...</ThemedText>
      </View>
    );
  }

  // If auth is not required or user is authenticated, render children
  if (!requireAuth || isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback loading state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
      <ThemedText style={styles.loadingText}>Loading...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  desktopContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    minHeight: 400,
  },
  loginRequiredCard: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    boxShadow: WebShadows.medium,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
