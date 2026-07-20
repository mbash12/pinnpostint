import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useResponsive } from '@/hooks/use-responsive';

/**
 * Hook version of requireAuth for use in components
 */
export const useAuthGuard = () => {
  const { isAuthenticated, isLoading, isLoggingOut, setLoginModalVisible } = useAuth();
  const { isDesktop } = useResponsive();
  const router = useRouter();

  const checkAuthAndRedirect = (): boolean => {
    if (isLoading || isLoggingOut) {
      return false;
    }

    if (!isAuthenticated) {
      setLoginModalVisible(true);
      return false;
    }

    return true;
  };

  const redirectToLogin = () => {
    if (isLoggingOut) return;
    setLoginModalVisible(true);
  };

  return {
    isAuthenticated: !isLoading && isAuthenticated,
    isLoading,
    checkAuthAndRedirect,
    redirectToLogin
  };
};