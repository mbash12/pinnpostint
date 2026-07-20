"use client";

import React, { useState } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { DataTable, type Column } from "@/components/application/data-table";

type Role = { id: string; name: string; description: string; permissions: string[]; userCount: number; createdAt: string; };

function RoleActions({ role }: { role: Role }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/user-management/roles/edit?id=${role.id}`}>Edit</Button>
            <ConfirmationDialog title={`Delete ${role.name}?`} description="This action cannot be undone." onConfirm={() => {}}>
                <Button color="secondary-destructive" size="sm">Delete</Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function RolesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    
    const roles: Role[] = [
        { id: "1", name: "Super Admin", description: "Full system access", permissions: ["all"], userCount: 2, createdAt: "2025-01-01" },
        { id: "2", name: "Admin", description: "Administrative access", permissions: ["users", "content", "settings"], userCount: 5, createdAt: "2025-01-05" },
        { id: "3", name: "Moderator", description: "Content moderation", permissions: ["content", "ads"], userCount: 10, createdAt: "2025-01-10" },
        { id: "4", name: "User", description: "Standard user", permissions: ["profile"], userCount: 150, createdAt: "2025-01-01" },
    ];

    const filteredRoles = roles.filter(role => 
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns: Column<Role>[] = [
        { key: "name", label: "Role", render: (role) => <div className="flex flex-col"><span className="font-semibold text-primary">{role.name}</span><span className="text-xs text-tertiary">{role.description}</span></div> },
        { key: "permissions", label: "Permissions", render: (role) => <span className="text-tertiary">{role.permissions.length} permissions</span> },
        { key: "users", label: "Users", render: (role) => <span className="font-semibold">{role.userCount}</span> },
        { key: "created", label: "Created", render: (role) => <span className="text-tertiary">{new Date(role.createdAt).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (role) => <RoleActions role={role} /> },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">User Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Roles</h1>
                </div>
                <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/user-management/roles/create">New Role</Button>
            </header>
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <Input
                    placeholder="Search roles"
                    icon={SearchLg}
                    iconClassName="size-5"
                    className="max-w-md"
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
                <DataTable columns={columns} data={filteredRoles} keyExtractor={(role) => role.id} emptyTitle="No roles found" emptyDescription="Create your first role." emptyAction={<Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/user-management/roles/create">New Role</Button>} itemName="roles" />
            </section>
        </div>
    );
}
