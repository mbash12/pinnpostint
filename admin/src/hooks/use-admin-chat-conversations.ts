"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { PaginatedResponse } from "@/lib/api-types";

export const ADMIN_CHAT_CONVERSATIONS_KEY = ["admin-chat-conversations"] as const;

export type AdminInboxConversation = {
    id: string;
    otherUser: { id: string; name: string; avatar?: string | null };
    lastMessage: string | null;
    lastMessageAt: string;
    unreadCount: number;
};

async function fetchConversations(page: number, limit: number): Promise<PaginatedResponse<AdminInboxConversation>> {
    const res = await apiClient.get<AdminInboxConversation[]>("/chat/conversations", { page, limit });
    return res as PaginatedResponse<AdminInboxConversation>;
}

export function useAdminChatConversations(page: number, limit: number) {
    const { isAuthenticated } = useAuth();

    return useQuery({
        queryKey: [...ADMIN_CHAT_CONVERSATIONS_KEY, page, limit],
        queryFn: () => fetchConversations(page, limit),
        enabled: isAuthenticated,
        select: (r) => ({
            conversations: (Array.isArray(r.data) ? r.data : []) as AdminInboxConversation[],
            pagination: r.pagination ?? null,
        }),
    });
}
