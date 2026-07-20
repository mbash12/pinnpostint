"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { FormLayout } from "@/components/forms";
import { Button } from "@/components/base/buttons/button";
import { AdminChatThreadPanel } from "@/components/application/admin-chat/admin-chat-thread-panel";
import { useUser } from "@/hooks/use-users";

export default function AdminUserChatPage() {
    const params = useParams<{ userId: string }>();
    const userId = params?.userId ?? "";
    const { data: userRes, isLoading: userLoading, isError: userFetchError } = useUser(userId);
    const targetUser = userRes?.data as
        | { role?: string; firstName?: string; lastName?: string }
        | undefined;

    const peerDisplayName = useMemo(() => {
        if (!targetUser || targetUser.role !== "USER") return "";
        return `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim() || "User";
    }, [targetUser]);

    if (userFetchError || (!userLoading && !targetUser)) {
        return (
            <FormLayout breadcrumb="User management" title="Chat with user">
                <p className="text-sm text-tertiary">User not found.</p>
                <Button href="/dashboard/user-management/users" color="secondary" className="mt-4">
                    Back to users
                </Button>
            </FormLayout>
        );
    }

    if (userLoading) {
        return (
            <FormLayout breadcrumb="User management" title="Chat with user">
                <p className="text-sm text-tertiary">Loading…</p>
            </FormLayout>
        );
    }

    if (targetUser?.role !== "USER") {
        return (
            <FormLayout breadcrumb="User management" title="Chat with user">
                <p className="text-sm text-tertiary">
                    In-app chat is only available for standard app users. Open support tools for admin
                    accounts.
                </p>
                <Button href="/dashboard/user-management/users" color="secondary" className="mt-4">
                    Back to users
                </Button>
            </FormLayout>
        );
    }

    return (
        <FormLayout breadcrumb="User management" title={`Chat · ${peerDisplayName}`}>
            <div className="mb-4 flex flex-col gap-4 border-b border-secondary pb-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="order-2 max-w-2xl text-sm text-tertiary sm:order-1">
                    Same conversation as in the mobile app. Prefer the{" "}
                    <a
                        href="/dashboard/user-management/chat"
                        className="font-medium text-brand-secondary hover:underline"
                    >
                        Messages
                    </a>{" "}
                    inbox for all threads. Unread badges update live when a user sends a message.
                </p>
                <div className="order-1 flex flex-wrap gap-2 sm:order-2 sm:justify-end">
                    <Button href="/dashboard/user-management/chat" color="secondary" size="sm">
                        All messages
                    </Button>
                    <Button href="/dashboard/user-management/users" color="secondary" size="sm">
                        Back to users
                    </Button>
                </div>
            </div>

            <AdminChatThreadPanel
                key={userId}
                peerUserId={userId}
                peerDisplayName={peerDisplayName}
            />
        </FormLayout>
    );
}
