"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FormLayout } from "@/components/forms";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Avatar } from "@/components/base/avatar/avatar";
import { AdminChatThreadPanel } from "@/components/application/admin-chat/admin-chat-thread-panel";
import {
    useAdminChatConversations,
    type AdminInboxConversation,
    ADMIN_CHAT_CONVERSATIONS_KEY,
} from "@/hooks/use-admin-chat-conversations";
import { useUser } from "@/hooks/use-users";
import { apiClient } from "@/lib/api-client";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatChatDateTime } from "@/utils/format-chat-datetime";
import { cx } from "@/utils/cx";
import type { User } from "@/lib/api-types";

const PAGE_SIZE = 25;

export default function AdminChatInboxPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const withUserId = searchParams.get("with");
    const lastSyncedWithRef = useRef<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    useEffect(() => {
        lastSyncedWithRef.current = null;
    }, [page]);

    const { data, isLoading, isError } = useAdminChatConversations(page, PAGE_SIZE);

    const conversations = data?.conversations ?? [];
    const pagination = data?.pagination;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter(
            (c) =>
                c.otherUser.name.toLowerCase().includes(q) ||
                c.otherUser.id.toLowerCase().includes(q)
        );
    }, [conversations, search]);

    const [selected, setSelected] = useState<AdminInboxConversation | null>(null);
    const [composePeerId, setComposePeerId] = useState<string | null>(null);
    const [userSearch, setUserSearch] = useState("");
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced user search
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (userSearch.trim().length < 2) {
            setSearchedUsers([]);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            setUserSearchLoading(true);
            try {
                const res = await apiClient.get<User[]>("/admin/users", {
                    search: userSearch.trim(),
                    role: "USER",
                    limit: 10,
                });
                if (res.success && Array.isArray(res.data)) {
                    setSearchedUsers(res.data);
                } else {
                    setSearchedUsers([]);
                }
            } catch {
                setSearchedUsers([]);
            } finally {
                setUserSearchLoading(false);
            }
        }, 300);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, [userSearch]);

    useEffect(() => {
        if (!withUserId) {
            lastSyncedWithRef.current = null;
            return;
        }
        if (isLoading) {
            return;
        }
        if (lastSyncedWithRef.current === withUserId) {
            return;
        }
        lastSyncedWithRef.current = withUserId;

        const match = conversations.find((c) => c.otherUser.id === withUserId);
        if (match) {
            setSelected(match);
            setComposePeerId(null);
        } else {
            setSelected(null);
            setComposePeerId(withUserId);
        }
    }, [withUserId, conversations, isLoading]);

    const {
        data: composeApiRes,
        isLoading: composeUserLoading,
        isError: composeUserError,
    } = useUser(composePeerId ?? "");
    const composeUser = composeApiRes?.data as User | undefined;

    const paginationInfo = usePaginationInfo({
        data: conversations,
        pagination: pagination ?? undefined,
        currentPage: page,
        itemsPerPage: PAGE_SIZE,
    });

    const clearThread = () => {
        setSelected(null);
        setComposePeerId(null);
        lastSyncedWithRef.current = null;
        router.replace("/dashboard/user-management/chat");
    };

    const handleConversationCreated = (conversationId: string, otherUserName: string) => {
        // Refresh the list, then select the new conversation
        queryClient.invalidateQueries({ queryKey: ADMIN_CHAT_CONVERSATIONS_KEY }).then(() => {
            setSelected({
                id: conversationId,
                otherUser: { id: peerUserId, name: otherUserName },
                lastMessage: null,
                lastMessageAt: new Date().toISOString(),
                unreadCount: 0,
            });
            setComposePeerId(null);
        });
    };

    const peerUserId = selected?.otherUser.id ?? composePeerId ?? "";
    const peerDisplayName = selected
        ? selected.otherUser.name
        : composeUser
          ? `${composeUser.firstName ?? ""} ${composeUser.lastName ?? ""}`.trim() || "User"
          : "Loading…";

    const composeBlocked =
        Boolean(composePeerId) &&
        !composeUserLoading &&
        composeApiRes &&
        composeUser &&
        composeUser.role !== "USER";

    const composeReady =
        Boolean(composePeerId) && !composeUserLoading && composeUser?.role === "USER";

    const showThreadPanel = Boolean(selected) || composeReady;

    const [mobileShowList, setMobileShowList] = useState(true);

    useEffect(() => {
        if (selected || composePeerId) {
            setMobileShowList(false);
        }
    }, [selected, composePeerId]);

    return (
        <FormLayout
            breadcrumb="User management"
            title="Messages"
            subtitle={
                <p className="text-sm text-tertiary">
                    All conversations with app users, newest first. Same threads as in the mobile app.
                    You can still open chat from a user&apos;s row in the users table.
                </p>
            }
        >
            {/* User search to start new chat */}
            <div className="mb-4 relative">
                <Input
                    size="sm"
                    placeholder="Search user to chat…"
                    aria-label="Search user to start chat"
                    value={userSearch}
                    onChange={(v) => { setUserSearch(v); setShowUserDropdown(true); }}
                    onFocus={() => setShowUserDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                />
                {showUserDropdown && userSearch.trim().length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-secondary bg-primary shadow-lg max-h-60 overflow-y-auto">
                        {userSearchLoading ? (
                            <p className="p-3 text-sm text-tertiary">Searching…</p>
                        ) : searchedUsers.length === 0 ? (
                            <p className="p-3 text-sm text-tertiary">No users found</p>
                        ) : (
                            searchedUsers.map((u: User) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary transition"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        router.push(`/dashboard/user-management/chat?with=${encodeURIComponent(u.id)}`);
                                        setUserSearch("");
                                        setShowUserDropdown(false);
                                    }}
                                >
                                    <Avatar
                                        size="xs"
                                        src={u.avatar ? getProxiedImageUrl(u.avatar) : undefined}
                                        alt={u.firstName ?? ""}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <span className="truncate text-sm font-medium text-primary">
                                            {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone || u.id}
                                        </span>
                                        {u.phone ? (
                                            <span className="ml-2 text-xs text-tertiary">{u.phone}</span>
                                        ) : null}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {isError ? (
                <p className="text-sm text-error-primary">Could not load conversations.</p>
            ) : null}

            <div
                className={cx(
                    "flex min-h-[min(85vh,720px)] flex-col gap-0 overflow-hidden rounded-2xl border border-secondary bg-primary shadow-sm lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-0"
                )}
            >
                <aside
                    className={cx(
                        "flex flex-col border-secondary lg:border-r",
                        !mobileShowList && showThreadPanel ? "hidden lg:flex" : "flex"
                    )}
                >
                    <div className="border-b border-secondary p-3">
                        <Input
                            size="sm"
                            placeholder="Filter by name or user ID…"
                            aria-label="Filter conversations"
                            value={search}
                            onChange={setSearch}
                        />
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                            {isLoading && conversations.length === 0 ? (
                                <p className="p-4 text-sm text-tertiary">Loading conversations…</p>
                            ) : null}
                            {!isLoading && filtered.length === 0 ? (
                                <p className="p-4 text-sm text-tertiary">
                                    {search.trim()
                                        ? "No conversations match this filter on this page."
                                        : "No conversations yet."}
                                </p>
                            ) : null}
                            <ul className="divide-y divide-secondary">
                                {filtered.map((c) => {
                                    const active = selected?.id === c.id;
                                    return (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                className={cx(
                                                    "flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-secondary",
                                                    active && "bg-active"
                                                )}
                                                onClick={() => {
                                                    setSelected(c);
                                                    setComposePeerId(null);
                                                    setMobileShowList(false);
                                                }}
                                            >
                                                <Avatar
                                                    size="sm"
                                                    src={
                                                        c.otherUser.avatar
                                                            ? getProxiedImageUrl(c.otherUser.avatar)
                                                            : undefined
                                                    }
                                                    alt={c.otherUser.name}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate font-medium text-primary">
                                                            {c.otherUser.name}
                                                        </span>
                                                        <span className="max-w-[140px] shrink-0 text-right text-xs leading-snug text-tertiary">
                                                            {formatChatDateTime(c.lastMessageAt)}
                                                        </span>
                                                    </div>
                                                    <p className="truncate text-sm text-tertiary">
                                                        {c.lastMessage || "—"}
                                                    </p>
                                                    {c.unreadCount > 0 ? (
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1.5 text-[10px] font-bold text-white">
                                                                {c.unreadCount > 99 ? "99+" : c.unreadCount}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        <div className="border-t border-secondary p-3">
                            <PaginationInfoComponent
                                paginationInfo={paginationInfo}
                                itemName="conversations"
                            />
                            <div className="mt-2 flex gap-2">
                                <Button
                                    size="sm"
                                    color="secondary"
                                    isDisabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </Button>
                                <Button
                                    size="sm"
                                    color="secondary"
                                    isDisabled={
                                        !pagination || page >= (pagination.totalPages ?? 1)
                                    }
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </aside>

                <section
                    className={cx(
                        "flex min-h-[320px] flex-1 flex-col p-4 lg:min-h-0",
                        mobileShowList && showThreadPanel ? "hidden lg:flex" : "flex"
                    )}
                >
                    {composePeerId && composeUserLoading ? (
                        <p className="text-sm text-tertiary">Loading user…</p>
                    ) : composePeerId && composeUserError ? (
                        <div className="space-y-4">
                            <p className="text-sm text-error-primary">User not found.</p>
                            <Button color="secondary" size="sm" onClick={clearThread}>
                                Clear selection
                            </Button>
                        </div>
                    ) : composeBlocked ? (
                        <div className="space-y-4">
                            <p className="text-sm text-tertiary">
                                Chat is only available with standard app users.
                            </p>
                            <Button color="secondary" size="sm" onClick={clearThread}>
                                Clear selection
                            </Button>
                        </div>
                    ) : showThreadPanel && peerUserId ? (
                        <>
                            <div className="mb-4 flex items-center gap-2 lg:hidden">
                                <Button color="secondary" size="sm" onClick={() => setMobileShowList(true)}>
                                    All conversations
                                </Button>
                            </div>
                            <AdminChatThreadPanel
                                key={`${peerUserId}-${selected?.id ?? "compose"}`}
                                peerUserId={peerUserId}
                                peerDisplayName={peerDisplayName}
                                initialConversation={
                                    selected
                                        ? { id: selected.id, otherUserName: selected.otherUser.name }
                                        : undefined
                                }
                                onConversationCreated={handleConversationCreated}
                            />
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                            <p className="text-sm text-tertiary">
                                Select a conversation to read and reply, or open a user from the
                                users list with the Messages link.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </FormLayout>
    );
}
