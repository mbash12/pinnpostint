"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

export const ADMIN_CHAT_INBOX_UNREAD_KEY = ["admin-chat-inbox-unread"] as const;

type UnreadByPeerPayload = {
    unreadByUserId: Record<string, number>;
    totalUnread: number;
};

/**
 * Unread counts for the logged-in admin's chat inbox, keyed by the other participant's user id.
 * Uses GET /chat/unread-by-peer (all conversations) so badges are correct for users not on
 * the first page of the conversation list.
 */
export function useAdminChatInboxUnread() {
    const { isAuthenticated } = useAuth();

    return useQuery({
        queryKey: ADMIN_CHAT_INBOX_UNREAD_KEY,
        enabled: isAuthenticated,
        queryFn: async () => {
            const res = await apiClient.get<UnreadByPeerPayload>("/chat/unread-by-peer");
            if (res.success && res.data?.unreadByUserId) {
                return res.data.unreadByUserId;
            }
            return {};
        },
        staleTime: 0,
        refetchInterval: 120_000,
        refetchOnWindowFocus: true,
    });
}
