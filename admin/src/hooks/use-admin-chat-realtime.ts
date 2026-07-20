"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { adminChatSocket } from "@/lib/admin-chat-socket";
import { ADMIN_CHAT_INBOX_UNREAD_KEY } from "@/hooks/use-admin-chat-inbox";
import { ADMIN_CHAT_CONVERSATIONS_KEY } from "@/hooks/use-admin-chat-conversations";

const AUTH_TOKEN_KEY = "auth_token";

/**
 * Keeps a Socket.IO session for the logged-in admin and refreshes chat inbox badges when
 * `conversation_updated` fires (same event as the mobile app).
 */
export function useAdminChatSocketSession(): void {
    const queryClient = useQueryClient();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (typeof window === "undefined" || isLoading) {
            return;
        }
        if (!isAuthenticated) {
            adminChatSocket.disconnect();
            return;
        }
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token) {
            return;
        }
        adminChatSocket.ensureConnected(token);
        const off = adminChatSocket.onConversationUpdated(() => {
            void queryClient.invalidateQueries({ queryKey: ADMIN_CHAT_INBOX_UNREAD_KEY });
            void queryClient.invalidateQueries({ queryKey: ADMIN_CHAT_CONVERSATIONS_KEY });
        });
        return () => {
            off();
            adminChatSocket.disconnect();
        };
    }, [isAuthenticated, isLoading, queryClient]);
}

/**
 * While viewing a thread, refetch messages when the server signals that conversation changed.
 * Does not disconnect the socket (session is owned by {@link useAdminChatSocketSession}).
 */
export function useAdminChatThreadLive(conversationId: string | null, refresh: () => void): void {
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        if (typeof window === "undefined" || isLoading || !isAuthenticated || !conversationId) {
            return;
        }
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
            adminChatSocket.ensureConnected(token);
        }
        const off = adminChatSocket.onConversationUpdated((payload) => {
            if (payload?.id === conversationId) {
                refresh();
            }
        });
        return off;
    }, [conversationId, isAuthenticated, isLoading, refresh]);
}
