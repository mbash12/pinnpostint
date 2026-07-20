"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useFAQs, useDeleteFAQ } from "@/hooks/use-faq";
import { FAQ } from "@/lib/api-types-faq";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function FAQActions({ faq, onDelete, isDeleting }: { faq: FAQ; onDelete: () => void; isDeleting: boolean }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/faq-management/faqs/${faq.id}/edit`}>Edit</Button>
            <ConfirmationDialog title={`Delete FAQ?`} description="This action cannot be undone." onConfirm={onDelete}>
                <Button color="secondary-destructive" size="sm" isLoading={isDeleting}>Delete</Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function FAQsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    // currentPage is handled by the useFAQs hook
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const deleteMutation = useDeleteFAQ();

    const { data, pagination, isLoading, isError, error, refresh, currentPage: apiCurrentPage, setPage, updateParams } = useFAQs({
        limit: itemsPerPage,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        search: debouncedSearchTerm.trim() || undefined,
    });

    const faqs = data || [];

    // Update search term with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page when filters change
    useEffect(() => {
        updateParams({
            search: debouncedSearchTerm.trim() || undefined,
            isActive: selectedActive === "all" ? undefined : selectedActive === "true"
        });
    }, [selectedActive, debouncedSearchTerm, updateParams]);

    const paginationInfo = usePaginationInfo({
        data: faqs,
        pagination: pagination || {
            page: apiCurrentPage,
            limit: itemsPerPage,
            total: faqs.length,
            totalPages: Math.ceil(faqs.length / itemsPerPage)
        },
        currentPage: apiCurrentPage,
        itemsPerPage
    });

    const handleFAQDeleted = (faqId: string) => {
        deleteMutation.mutateAsync(faqId).then(() => {
            refresh(); // Trigger a refresh to update the list after deletion
        }).catch(error => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete FAQ",
                type: "error",
            });
        });
    };

    const columns: Column<FAQ>[] = [
        { key: "question", label: "Question", render: (faq) => <div className="flex flex-col"><span className="font-semibold text-primary">{faq.question}</span><span className="text-xs text-tertiary">{faq.category?.name || 'Uncategorized'}</span></div> },
        { key: "status", label: "Status", render: (faq) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${faq.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"}`}>{faq.isActive ? "Active" : "Inactive"}</span> },
        { key: "created", label: "Created", render: (faq) => <span className="text-tertiary">{new Date(faq.createdAt).toLocaleDateString()}</span> },
        { key: "updated", label: "Updated", render: (faq) => <span className="text-tertiary">{new Date(faq.updatedAt).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (faq) => <FAQActions faq={faq} onDelete={() => handleFAQDeleted(faq.id)} isDeleting={deleteMutation.isPending} /> },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">FAQ Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">FAQs</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/faq-management/faqs/create">New FAQ</Button>
                </header>
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input placeholder="Search FAQs" icon={SearchLg} iconClassName="size-5" className="max-w-md" value={searchTerm} onChange={setSearchTerm} />
                            <Select selectedKey={selectedActive} onSelectionChange={(key) => typeof key === "string" && setSelectedActive(key as any)} items={[{ id: "all", label: "All Status" }, { id: "true", label: "Active" }, { id: "false", label: "Inactive" }]} size="sm" className="min-w-32">
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="FAQs" />
                    </div>
                    <DataTable columns={columns} data={faqs} keyExtractor={(faq) => faq.id} isLoading={isLoading} isError={isError} error={error} emptyTitle="No FAQs found" emptyDescription="Create your first FAQ." emptyAction={<Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/faq-management/faqs/create">New FAQ</Button>} paginationInfo={paginationInfo} onPageChange={setPage} itemName="FAQs" />
                </section>
            </div>
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </>
    );
}
