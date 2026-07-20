import React from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useResponsive } from '@/hooks/use-responsive';
import { LoginModal } from './login-modal';

export function GlobalLoginModal() {
  const { isLoginModalVisible, setLoginModalVisible } = useAuth();
  const { isDesktop } = useResponsive();
  const pathname = usePathname();

  // Don't show modal if we are already on an auth page
  const isAuthRoute = pathname?.includes('/login') || 
                      pathname?.includes('/register') || 
                      pathname?.includes('/forgot-password') || 
                      pathname?.includes('/set-new-password');
                      
  if (isAuthRoute) {
    return null;
  }

  return (
    <LoginModal
      visible={isLoginModalVisible}
      onClose={() => setLoginModalVisible(false)}
      onSuccess={() => setLoginModalVisible(false)}
    />
  );
}
