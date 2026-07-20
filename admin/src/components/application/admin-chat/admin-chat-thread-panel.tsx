"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/base/buttons/button";
import { apiClient } from "@/lib/api-client";
import { ADMIN_CHAT_INBOX_UNREAD_KEY } from "@/hooks/use-admin-chat-inbox";
import { ADMIN_CHAT_CONVERSATIONS_KEY } from "@/hooks/use-admin-chat-conversations";
import { useAdminChatThreadLive } from "@/hooks/use-admin-chat-realtime";
import { formatChatDateTime } from "@/utils/format-chat-datetime";

type ChatUser = { id: string; name: string; avatar?: string | null };
type InitiatePayload = {
    conversation: { id: string; otherUser: ChatUser } | null;
    recipient?: ChatUser;
    ad?: unknown;
};
export type MessageRow = {
    id: string;
    conversationId: string;
    senderId: string;
    text?: string | null;
    createdAt: string;
    isRead?: boolean;
};

export type AdminChatThreadPanelProps = {
    peerUserId: string;
    peerDisplayName: string;
    /** When set (inbox), open this thread without calling /chat/initiate. */
    initialConversation?: { id: string; otherUserName: string };
    /** Called when a new conversation is created (first message sent). */
    onConversationCreated?: (conversationId: string, otherUserName: string) => void;
};

function invalidateChatQueries(queryClient: ReturnType<typeof useQueryClient>): void {
    void queryClient.invalidateQueries({ queryKey: ADMIN_CHAT_INBOX_UNREAD_KEY });
    void queryClient.invalidateQueries({ queryKey: ADMIN_CHAT_CONVERSATIONS_KEY });
}

export function AdminChatThreadPanel({
    peerUserId,
    peerDisplayName,
    initialConversation,
    onConversationCreated,
}: AdminChatThreadPanelProps) {
    const queryClient = useQueryClient();
    const fromList = Boolean(initialConversation?.id);

    const [recipientLabel, setRecipientLabel] = useState(
        initialConversation?.otherUserName ?? peerDisplayName
    );
    const [conversationId, setConversationId] = useState<string | null>(initialConversation?.id ?? null);
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [input, setInput] = useState("");
    const [loadingInit, setLoadingInit] = useState(!fromList);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const loadMessages = useCallback(
        async (cid: string, markRead: boolean) => {
            setLoadingMessages(true);
            try {
                const res = await apiClient.get<{
                    messages: MessageRow[];
                    hasMore: boolean;
                    nextCursor: string | null;
                }>(`/chat/conversations/${cid}/messages`, { limit: 100 });
                if (res.success && res.data?.messages) {
                    setMessages(res.data.messages);
                    if (markRead) {
                        await apiClient.patch(`/chat/conversations/${cid}/read`, {});
                        invalidateChatQueries(queryClient);
                    }
                }
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to load messages");
            } finally {
                setLoadingMessages(false);
            }
        },
        [queryClient]
    );

    useEffect(() => {
        setRecipientLabel(initialConversation?.otherUserName ?? peerDisplayName);
    }, [peerDisplayName, initialConversation?.otherUserName]);

    // Inbox: open listed thread
    useEffect(() => {
        if (!fromList || !initialConversation?.id || !peerUserId) return;
        setError(null);
        setMessages([]);
        setConversationId(initialConversation.id);
        void loadMessages(initialConversation.id, true);
    }, [fromList, initialConversation?.id, peerUserId, loadMessages]);

    // User route: initiate
    useEffect(() => {
        if (fromList || !peerUserId) return;

        let cancelled = false;
        (async () => {
            setLoadingInit(true);
            setError(null);
            try {
                const res = await apiClient.get<InitiatePayload>(`/chat/initiate`, { recipientId: peerUserId });
                if (cancelled) return;
                if (!res.success || !res.data) {
                    setError("Could not start chat");
                    return;
                }
                const d = res.data;
                if (d.conversation) {
                    setConversationId(d.conversation.id);
                    setRecipientLabel(d.conversation.otherUser.name);
                    await loadMessages(d.conversation.id, true);
                } else if (d.recipient) {
                    setConversationId(null);
                    setRecipientLabel(d.recipient.name);
                }
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to initiate chat");
            } finally {
                if (!cancelled) setLoadingInit(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [fromList, peerUserId, loadMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages.length]);

    const unreadFromUserCount = useMemo(
        () => messages.filter((m) => m.senderId === peerUserId && m.isRead === false).length,
        [messages, peerUserId]
    );

    useEffect(() => {
        if (!conversationId) return;
        const fast = unreadFromUserCount > 0;
        const ms = fast ? 25000 : 50000;
        const t = setInterval(() => {
            void loadMessages(conversationId, false);
        }, ms);
        return () => clearInterval(t);
    }, [conversationId, loadMessages, unreadFromUserCount]);

    const refreshThreadSilently = useCallback(() => {
        if (!conversationId) return;
        void loadMessages(conversationId, false);
    }, [conversationId, loadMessages]);

    useAdminChatThreadLive(conversationId, refreshThreadSilently);

    const displayNameResolved = useMemo(
        () => recipientLabel || peerDisplayName || "User",
        [recipientLabel, peerDisplayName]
    );

    useEffect(() => {
        const base = "Pin N Post Admin";
        if (!displayNameResolved) return;
        if (unreadFromUserCount <= 0) {
            document.title = `${displayNameResolved} · Chat · ${base}`;
        } else {
            document.title = `(${unreadFromUserCount}) ${displayNameResolved} · Chat · ${base}`;
        }
        return () => {
            document.title = base;
        };
    }, [unreadFromUserCount, displayNameResolved]);

    const handleMarkUserMessagesRead = async () => {
        if (!conversationId) return;
        setError(null);
        try {
            await apiClient.patch(`/chat/conversations/${conversationId}/read`, {});
            await loadMessages(conversationId, false);
            invalidateChatQueries(queryClient);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to mark as read");
        }
    };

    const handleSend = async () => {
        const text = input.trim();
        if (!text || !peerUserId || sending) return;
        const wasNew = !conversationId;
        setSending(true);
        setError(null);
        try {
            const res = await apiClient.post<MessageRow>(`/chat/messages`, { recipientId: peerUserId, text });
            if (!res.success || !res.data) throw new Error("Send failed");
            const msg = res.data as MessageRow;
            setConversationId(msg.conversationId);
            setInput("");
            await loadMessages(msg.conversationId, true);
            invalidateChatQueries(queryClient);
            if (wasNew && onConversationCreated) {
                onConversationCreated(msg.conversationId, displayNameResolved);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Send failed");
        } finally {
            setSending(false);
        }
    };

    if (loadingInit) {
        return <p className="text-sm text-tertiary">Loading…</p>;
    }

    return (
        <>
            {error ? (
                <div className="mb-4 rounded-lg border border-error-subtle bg-error-primary/5 px-4 py-3 text-sm text-error-primary">
                    {error}
                </div>
            ) : null}

            {unreadFromUserCount > 0 ? (
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warning-subtle bg-warning-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-primary">
                        {unreadFromUserCount === 1
                            ? "1 unread message from this user."
                            : `${unreadFromUserCount} unread messages from this user.`}
                    </p>
                    <Button
                        color="secondary"
                        size="sm"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() => void handleMarkUserMessagesRead()}
                    >
                        Mark as read
                    </Button>
                </div>
            ) : null}

            <div className="flex h-[min(70vh,640px)] flex-col rounded-2xl border border-secondary bg-primary shadow-sm">
                {/* Recipient header */}
                <div className="flex items-center gap-3 border-b border-secondary px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-solid/10 text-sm font-bold text-brand-solid">
                        {displayNameResolved.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-primary">{displayNameResolved}</p>
                        <p className="text-xs text-tertiary">
                            {conversationId ? "Existing conversation" : "New conversation"}
                        </p>
                    </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {!conversationId && messages.length === 0 ? (
                        <p className="text-sm text-tertiary">
                            No messages yet. Send the first message to open a conversation in the user&apos;s app inbox.
                        </p>
                    ) : null}
                    {loadingMessages && messages.length === 0 ? (
                        <p className="text-sm text-tertiary">Loading messages…</p>
                    ) : null}
                    {messages.map((m) => {
                        const fromAdmin = m.senderId !== peerUserId;
                        const unreadFromPeer = !fromAdmin && m.isRead === false;
                        return (
                            <div key={m.id} className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                                        fromAdmin
                                            ? "bg-brand-solid text-white shadow-sm"
                                            : unreadFromPeer
                                              ? "border-2 border-brand-solid bg-secondary text-primary"
                                              : "border border-secondary bg-secondary text-primary"
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap break-words">{m.text || "—"}</p>
                                    <p
                                        className={`mt-1 text-xs ${fromAdmin ? "text-white/95" : "text-tertiary"}`}
                                    >
                                        {formatChatDateTime(m.createdAt)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <div className="flex gap-2 border-t border-secondary p-4">
                    <textarea
                        className="min-h-[44px] flex-1 resize-none rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        placeholder="Type a message…"
                        value={input}
                        rows={2}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void handleSend();
                            }
                        }}
                    />
                    <Button
                        color="primary"
                        className="self-end"
                        isDisabled={!input.trim() || sending}
                        isLoading={sending}
                        onClick={() => void handleSend()}
                    >
                        Send
                    </Button>
                </div>
            </div>
        </>
    );
}
