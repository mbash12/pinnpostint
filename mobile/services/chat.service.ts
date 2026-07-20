/**
 * Chat Service
 * Handles all chat-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';
import { PaginatedResponse } from './pagination.service';

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface Conversation {
  id: string;
  otherUser: ChatUser;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string | null;
  adId?: string | null;
  ad?: {
    id: string;
    slug?: string;
    title: string;
    price: number;
    images: string[];
    locationCity?: string;
    locationState?: string;
    locationFormatted?: string;
    category?: {
      name: string;
      adPlaceholder?: string;
    };
    subcategory?: {
      name: string;
    };
  } | null;
  isRead: boolean;
  createdAt: string;
}

export interface SendMessageRequest {
  recipientId?: string;
  text?: string;
  adId?: string;
  adSlug?: string;
}

export interface InitiateChatResponse {
  conversation: {
    id: string;
    otherUser: ChatUser;
  } | null;
  recipient?: ChatUser;
  ad?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    locationCity?: string;
    category?: {
      name: string;
      adPlaceholder?: string;
    };
    subcategory?: {
      name: string;
    };
  } | null;
}

export interface MessagesPage {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface GetMessagesParams {
  /** Load messages older than this message id (exclusive). */
  before?: string;
  limit?: number;
}

class ChatService {
  /**
   * Get total unread message count across all conversations
   * Uses lightweight endpoint for better performance
   */
  async getTotalUnreadCount(): Promise<number> {
    try {
      const response = await apiService.get<{ unreadCount: number }>(API_ENDPOINTS.CHAT.UNREAD_COUNT);
      if (response.success && response.data) {
        return response.data.unreadCount || 0;
      }
      return 0;
    } catch (error) {
      console.error('Failed to get total unread count:', error);
      return 0;
    }
  }

  /**
   * List all conversations for the authenticated user
   */
  async getConversations(params?: { page?: number, limit?: number }): Promise<PaginatedResponse<Conversation>> {
    return apiService.get<Conversation[]>(API_ENDPOINTS.CHAT.CONVERSATIONS, params) as Promise<PaginatedResponse<Conversation>>;
  }

  /**
   * Resolve ad/recipient context for initiating a chat
   */
  async initiateChat(params: { adSlug?: string; recipientId?: string }): Promise<ApiResponse<InitiateChatResponse>> {
    return apiService.get<InitiateChatResponse>(API_ENDPOINTS.CHAT.INITIATE, params);
  }

  /**
   * Get messages for a specific conversation.
   * Cursor-based pagination: pass `before` (the oldest message id currently
   * loaded) to fetch the page older than it.
   */
  async getMessages(
    conversationId: string,
    params?: GetMessagesParams
  ): Promise<ApiResponse<MessagesPage>> {
    return apiService.get<MessagesPage>(API_ENDPOINTS.CHAT.MESSAGES(conversationId), params);
  }

  /**
   * Send a message
   */
  async sendMessage(data: SendMessageRequest): Promise<ApiResponse<Message>> {
    return apiService.post<Message>(API_ENDPOINTS.CHAT.SEND_MESSAGE, data);
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markAsRead(conversationId: string): Promise<ApiResponse<void>> {
    return apiService.patch<void>(API_ENDPOINTS.CHAT.MARK_READ(conversationId));
  }

  /**
   * Delete all conversations (for testing purposes)
   */
  async deleteAllConversations(): Promise<ApiResponse<void>> {
    return apiService.delete<void>('/chat/conversations/all');
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
