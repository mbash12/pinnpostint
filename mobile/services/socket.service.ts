import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/api.config';

export type SocketEventType = 'new_message' | 'messages_read' | 'user_typing' | 'user_stopped_typing' | 'conversation_updated' | 'error';
export type SocketEventCallback = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private eventListeners: Map<SocketEventType, Set<SocketEventCallback>> = new Map();

  /**
   * Connect to Socket.IO server
   */
  connect(token: string): void {
    if (!token) {
      console.error('Cannot connect to socket: No token provided');
      return;
    }

    // Already connected, don't reconnect
    if (this.socket?.connected) {
      console.log('Socket already connected, skipping reconnection');
      this.isConnected = true;
      return;
    }

    // If socket exists but disconnected, replace it (preserve JS-side `on` listeners).
    if (this.socket) {
      this.disconnect(false);
    }

    try {
      // Remove API path for socket connection
      let socketUrl = API_BASE_URL.replace('/api/v1', '');

      // For localhost development, ensure consistent URL format
      if (socketUrl.includes('127.0.0.1')) {
        socketUrl = socketUrl.replace('127.0.0.1', 'localhost');
      }

      this.socket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'], // Prefer websocket for better performance
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,  // Reduced from 10 to prevent excessive reconnection attempts
        timeout: 20000,
        forceNew: false, // ✅ Reuse existing connection instead of creating new one
        autoConnect: true,
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      this.isConnected = false;
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      // If it's a disconnect that should reconnect, socket.io will handle it
      if (reason === 'io server disconnect') {
        // The server forcibly disconnected the client, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.isConnected = true;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      // Silently handle reconnection attempts
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after all attempts');
      this.isConnected = false;
    });

    this.socket.on('upgrade', (transport) => {
      // Connection was upgraded (e.g., from polling to websocket)
    });

    // Chat event handlers
    this.socket.on('new_message', (data) => {
      this.emitToListeners('new_message', data);
    });

    this.socket.on('messages_read', (data) => {
      this.emitToListeners('messages_read', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emitToListeners('user_typing', data);
    });

    this.socket.on('user_stopped_typing', (data) => {
      this.emitToListeners('user_stopped_typing', data);
    });

    this.socket.on('conversation_updated', (data) => {
      this.emitToListeners('conversation_updated', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emitToListeners('error', error);
    });
  }

  /**
   * Emit event to all registered listeners
   */
  private emitToListeners(event: SocketEventType, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in socket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_conversation', conversationId);
    } else {
      // Queue the join operation for when connection is established
      const handleConnect = () => {
        this.socket?.emit('join_conversation', conversationId);
        this.socket?.off('connect', handleConnect);
      };
      this.socket?.on('connect', handleConnect);
    }
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  /**
   * Send typing indicator
   */
  startTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', { conversationId });
    }
  }

  /**
   * Stop typing indicator
   */
  stopTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  /**
   * Register event listener
   */
  on(event: SocketEventType, callback: SocketEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unregister event listener
   */
  off(event: SocketEventType, callback: SocketEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Disconnect socket.
   * @param clearListeners When true (e.g. logout), remove all registered `on` callbacks.
   */
  disconnect(clearListeners: boolean = false): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    if (clearListeners) {
      this.eventListeners.clear();
    }
  }

  /**
   * Check if socket is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket ID
   */
  get socketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
