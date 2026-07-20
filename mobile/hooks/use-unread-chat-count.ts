import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { chatService } from '@/services/chat.service';
import socketService from '@/services/socket.service';

/**
 * Hook to manage total unread chat count
 * Refreshes via HTTP and on realtime `conversation_updated` (requires global socket).
 */
export function useUnreadChatCount() {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return 0;
    }

    try {
      setIsLoading(true);
      const count = await chatService.getTotalUnreadCount();
      setUnreadCount(count);
      return count;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      setUnreadCount(0);
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const off = socketService.on('conversation_updated', () => {
      fetchUnreadCount();
    });
    return off;
  }, [isAuthenticated, fetchUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') fetchUnreadCount();
    });
    return () => sub.remove();
  }, [isAuthenticated, fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    fetchUnreadCount,
  };
}
