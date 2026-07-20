"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { UserRole, User } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { useAdminChatInboxUnread } from "@/hooks/use-admin-chat-inbox";

const roleOptions = [
    { id: "all", label: "All Role" },
    { id: "ADMIN", label: "Admin" },
    { id: "USER", label: "User" },
];

const activeOptions = [
    { id: "all", label: "All Status" },
    { id: "true", label: "Active" },
    { id: "false", label: "Inactive" },
];

export default function UsersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    const [selectedRole, setSelectedRole] = useState<"all" | UserRole>("all");
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const { data: users, pagination, isLoading, currentPage, setPage } = useUsers({
        search: debouncedSearchTerm.trim() || undefined,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        role: selectedRole === "all" ? undefined : selectedRole,
    });

    const usersTyped = users as User[];

    const deleteUserMutation = useDeleteUser();
    const { data: unreadByUserId = {} } = useAdminChatInboxUnread();

    const handleDeleteUser = async (user: User) => {
        try {
            await deleteUserMutation.mutateAsync(user.id);
            setAlertDialog({
                isOpen: true,
                title: "User Deleted",
                description: `${user.firstName} ${user.lastName} has been successfully deleted.`,
                type: "success",
            });
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: `Failed to delete user: ${error.message || 'Unknown error'}`,
                type: "error",
            });
        }
    };

    const columns: Column<User>[] = [
        {
            key: "user",
            label: "User",
            render: (user) => (
                <div className="flex items-center gap-3">
                    {user.avatar ? (
                        <Avatar size="sm" src={getProxiedImageUrl(user.avatar)} alt={`${user.firstName} ${user.lastName}`} />
                    ) : (
                        <ImagePlaceholder size="sm" />
                    )}
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{user.firstName} {user.lastName}</span>
                        <span className="text-xs text-tertiary">{user.id}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "phone",
            label: "Phone",
            render: (user) => <span>{user.phone || '-'}</span>,
        },
        {
            key: "role",
            label: "Role",
            render: (user) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    user.role === 'ADMIN' ? "bg-brand-subtle text-brand-primary" : "bg-secondary text-tertiary"
                }`}>
                    {user.role}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (user) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    user.isActive ? "bg-success-subtle text-success-primary" : "bg-error-subtle text-error-primary"
                }`}>
                    {user.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "verification",
            label: "Verified",
            render: (user) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    user.isVerified ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                }`}>
                    {user.isVerified ? "Yes" : "No"}
                </span>
            ),
        },
        {
            key: "joined",
            label: "Joined",
            render: (user) => <span className="text-tertiary">{new Date(user.createdAt).toLocaleDateString()}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (user) => {
                const unread = unreadByUserId[user.id] ?? 0;
                return (
                    <div className="flex justify-end gap-2">
                        <Button color="secondary" size="sm" href={`/dashboard/user-management/users/${user.id}/edit`}>
                            Edit
                        </Button>
                        {user.role === "USER" ? (
                            <Button
                                color="secondary"
                                size="sm"
                                href={`/dashboard/user-management/chat?with=${encodeURIComponent(user.id)}`}
                                className="gap-1"
                            >
                                Chat
                                {unread > 0 ? (
                                    <span
                                        aria-label={`${unread} unread messages`}
                                        className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-solid px-1 text-[10px] font-bold text-white tabular-nums"
                                    >
                                        {unread > 99 ? "99+" : unread}
                                    </span>
                                ) : null}
                            </Button>
                        ) : null}
                        <ConfirmationDialog
                            title={`Delete ${user.firstName} ${user.lastName}?`}
                            description={`Are you sure you want to delete the user "${user.firstName} ${user.lastName}"? This action cannot be undone.`}
                            onConfirm={() => handleDeleteUser(user)}
                        >
                            <Button
                                color="secondary-destructive"
                                size="sm"
                                type="button"
                                isLoading={deleteUserMutation.isPending}
                            >
                                Delete
                            </Button>
                        </ConfirmationDialog>
                    </div>
                );
            },
        },
    ];



    // Use server-side pagination info
    const paginationInfo = useMemo(() => {
        const total = pagination?.total || 0;
        const page = pagination?.page || currentPage;
        const limit = pagination?.limit || itemsPerPage;
        const totalPages = pagination?.totalPages || Math.ceil(total / limit);

        const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
        const endItem = Math.min(page * limit, total);

        return {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            startItem,
            endItem,
        };
    }, [pagination, currentPage, itemsPerPage]);



    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, setPage]);

    // Reset to page 1 when filters change (except search)
    useEffect(() => {
        setPage(1);
    }, [selectedActive, selectedRole, setPage]);



    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">User management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Users</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">

                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/user-management/users/create">
                        Create user
                    </Button>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search users"
                            icon={SearchLg}
                            iconClassName="size-5"
                            aria-label="Search users"
                            className="max-w-md"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />

                        <div className="flex gap-2">
                            <Select
                                aria-label="Filter by status"
                                selectedKey={selectedActive}
                                onSelectionChange={(key) => {
                                    if (typeof key === "string") {
                                        setSelectedActive(key as "all" | "true" | "false");
                                    }
                                }}
                                items={activeOptions}
                                size="sm"
                                className="min-w-32"
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>

                            <Select
                                aria-label="Filter by role"
                                selectedKey={selectedRole}
                                onSelectionChange={(key) => {
                                    if (typeof key === "string") {
                                        setSelectedRole(key as "all" | UserRole);
                                    }
                                }}
                                items={roleOptions}
                                size="sm"
                                className="min-w-32"
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                    </div>

                    <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName="users"
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={usersTyped}
                    keyExtractor={(user) => user.id}
                    isLoading={isLoading}
                    emptyTitle="No users found"
                    emptyDescription="Try adjusting your search or filter criteria."
                    emptyAction={
                        <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/user-management/users/create">
                            New user
                        </Button>
                    }
                    paginationInfo={paginationInfo}
                    onPageChange={setPage}
                    itemName="users"
                />
            </section>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}
