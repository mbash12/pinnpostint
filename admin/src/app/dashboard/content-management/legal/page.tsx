"use client";

import React, { useState, useCallback } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { DataTable, type Column } from "@/components/application/data-table";
import { useLegalDocuments, useDeleteLegalDocument } from "@/hooks/use-legal-documents";
import { LegalDocument } from "@/lib/api-types";

function DocumentActions({ doc }: { doc: LegalDocument }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/content-management/legal/${doc.id}/edit`}>
                Edit
            </Button>
        </div>
    );
}

export default function LegalDocumentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const { data, isLoading, isError, error } = useLegalDocuments();
    const docs = (Array.isArray(data) ? data : []) as LegalDocument[];

    const filteredDocs = docs.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = useCallback(() => {}, []);

    const columns: Column<LegalDocument>[] = [
        {
            key: "title",
            label: "Title",
            render: (doc) => <span className="font-semibold text-primary">{doc.title}</span>,
        },
        {
            key: "slug",
            label: "Slug",
            render: (doc) => <span className="text-tertiary">{doc.slug}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (doc) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    doc.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                }`}>
                    {doc.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "updated",
            label: "Last Updated",
            render: (doc) => <span className="text-tertiary">{new Date(doc.updatedAt).toLocaleDateString()}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (doc) => <DocumentActions doc={doc} />,
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Content Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Legal Documents</h1>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <Input
                    placeholder="Search documents"
                    icon={SearchLg}
                    iconClassName="size-5"
                    className="max-w-md"
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
                <DataTable
                    columns={columns}
                    data={filteredDocs}
                    keyExtractor={(doc) => doc.id}
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    emptyTitle="No legal documents found"
                    emptyDescription="No legal documents available."
                    itemName="documents"
                />
            </section>
        </div>
    );
}
