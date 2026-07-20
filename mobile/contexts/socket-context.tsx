import React, { createContext, useContext, useEffect } from 'react';
import { socketService } from '@/services/socket.service';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/auth-context';

interface SocketContextType {
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

/**
 * Keeps Socket.IO connected for the authenticated session so inbox events
 * (e.g. `conversation_updated`) reach the app outside the chat screen.
 */
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      socketService.disconnect(true);
      return;
    }

    authService.getToken().then((token) => {
      if (cancelled || !token) return;
      socketService.connect(token);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ isConnected: socketService.connected }}>
      {children}
    </SocketContext.Provider>
  );
};
