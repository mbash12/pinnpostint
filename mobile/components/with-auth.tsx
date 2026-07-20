import React from 'react';
import { AuthProtection } from './auth-protection';

interface WithAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

/**
 * Higher-order component that wraps a component with authentication protection
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { redirectTo = '/(auth)/login', requireAuth = true } = options;

  return function AuthenticatedComponent(props: P) {
    return (
      <AuthProtection redirectTo={redirectTo} requireAuth={requireAuth}>
        <Component {...props} />
      </AuthProtection>
    );
  };
}

/**
 * Hook to check if current page requires authentication
 */
export function useRequireAuth(redirectTo: string = '/(auth)/login') {
  return { redirectTo, requireAuth: true };
}
