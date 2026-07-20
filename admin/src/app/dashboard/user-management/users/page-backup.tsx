"use client";

import React, { useState, useMemo } from "react";
import { FilterLines, Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { Pagination, PaginationInfoComponent, usePagination } from "@/components/base/pagination";

const users = [
    {
        id: "USR-1023",
        name: "Olivia Rhye",
        email: "olivia@example.com",
        phone: "+62 812-3456-7890",
        role: "ADMIN",
        status: "Active",
        joinedAt: "Sep 12, 2025",
    },
    {
        id: "USR-1022",
        name: "Phoenix Baker",
        email: "phoenix@example.com",
        phone: "+62 811-7788-9911",
        role: "USER",
        status: "Invited",
        joinedAt: "Sep 10, 2025",
    },
    {
        id: "USR-1021",
        name: "Demi Wilkinson",
        email: "demi@example.com",
        phone: "+62 813-2233-4455",
        role: "USER",
        status: "Suspended",
        joinedAt: "Aug 28, 2025",
    },
];

const statusStyles: Record<string, string> = {
    Active: "bg-success-subtle text-success-primary",
    Invited: "bg-warning-subtle text-warning-primary",
    Suspended: "bg-error-subtle text-error-primary",
};

export default function UsersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [itemsPerPage] = useState(10);

    const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) {
            return users;
        }
        
        const query = searchTerm.toLowerCase();
        return users.filter(user =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.phone.toLowerCase().includes(query) ||
            user.role.toLowerCase().includes(query) ||
            user.id.toLowerCase().includes(query)
        );
    }, [searchTerm]);

    const {
        currentPage,
        setCurrentPage,
        paginatedItems: paginatedUsers,
        paginationInfo,
    } = usePagination(filteredUsers, itemsPerPage);

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">User management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Users</h1>
                    <p className="text-sm text-tertiary">Manage your marketplace users, their roles, and verification states.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="secondary" size="sm" iconLeading={<FilterLines />}>
                        Filters
                    </Button>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/user-management/users/create">
                        Invite user
                    </Button>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        placeholder="Search users"
                        icon={SearchLg}
                        iconClassName="size-5"
                        aria-label="Search users"
                        className="max-w-md"
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />

                    <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName="users"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left">User</th>
                                <th scope="col" className="px-4 py-3 text-left">Email</th>
                                <th scope="col" className="px-4 py-3 text-left">Phone</th>
                                <th scope="col" className="px-4 py-3 text-left">Role</th>
                                <th scope="col" className="px-4 py-3 text-left">Status</th>
                                <th scope="col" className="px-4 py-3 text-left">Joined</th>
                                <th scope="col" className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-primary">
                            {paginatedUsers.map((user) => (
                                <tr key={user.id} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3 font-semibold text-primary">
                                        <div className="flex flex-col">
                                            <span>{user.name}</span>
                                            <span className="text-xs text-tertiary">{user.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{user.email}</td>
                                    <td className="px-4 py-3">{user.phone}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-tertiary">{user.role}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[user.status] ?? "bg-secondary text-tertiary"}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{user.joinedAt}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button color="secondary" size="sm" href={`/dashboard/user-management/users/${user.id}/edit`}>
                                                Manage
                                            </Button>
                                            <ConfirmationDialog
                                                title={`Delete ${user.name}?`}
                                                description={`Are you sure you want to delete the user "${user.name}"? This action cannot be undone.`}
                                                onConfirm={() => alert(`Delete user ${user.name}?`)}
                                            >
                                                <Button
                                                    color="secondary-destructive"
                                                    size="sm"
                                                    type="button"
                                                >
                                                    Delete
                                                </Button>
                                            </ConfirmationDialog>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-6">
                    <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName="users"
                        className="hidden sm:block"
                    />
                    <Pagination
                        currentPage={currentPage}
                        totalPages={paginationInfo.totalPages}
                        onPageChange={setCurrentPage}
                        className="mx-auto sm:mx-0"
                    />
                </div>
            </section>
        </div>
    );
}
