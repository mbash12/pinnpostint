"use client";

import React, { useState, useEffect } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useSubcategories, useDeleteSubcategory } from "@/hooks/use-categories";
import { Subcategory } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useParams } from "next/navigation";
import { getProxiedImageUrl } from "@/utils/image-proxy";

function SubcategoryActions({ subcategory, categoryId, onDelete, isDeleting }: { subcategory: Subcategory; categoryId: string; onDelete: () => void; isDeleting: boolean }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategory.id}/attributes`}>Attributes</Button>
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategory.id}/edit`}>Edit</Button>
            <ConfirmationDialog title={`Delete ${subcategory.name}?`} description="This action cannot be undone." onConfirm={onDelete}>
                <Button color="secondary-destructive" size="sm" isLoading={isDeleting}>Delete</Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function SubcategoriesPage() {
    const params = useParams();
    const categoryId = params.id as string;
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const deleteMutation = useDeleteSubcategory();

    const { 
        data, 
        pagination, 
        isLoading, 
        isError, 
        error, 
        refresh,
        currentPage: apiCurrentPage,
        setPage,
        updateParams
    } = useSubcategories(categoryId, {
        search: debouncedSearchTerm.trim() || undefined,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
    });

    const subcategories = data || [];

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
        data: subcategories,
        pagination: pagination || {
            page: apiCurrentPage,
            limit: itemsPerPage,
            total: subcategories.length,
            totalPages: Math.ceil(subcategories.length / itemsPerPage)
        },
        currentPage: apiCurrentPage,
        itemsPerPage
    });

    const handleSubcategoryDeleted = (subcategory: Subcategory) => {
        deleteMutation.mutateAsync(subcategory.id).then(() => {
            refresh(); // Trigger a refresh to update the list after deletion
        }).catch(error => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete subcategory",
                type: "error",
            });
        });
    };

    const columns: Column<Subcategory>[] = [
        {
            key: "name",
            label: "Subcategory",
            render: (sub) => (
                <div className="flex items-center gap-3">
                    <Avatar size="sm" src={sub.image ? getProxiedImageUrl(sub.image) : undefined} alt={sub.name} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{sub.name}</span>
                        <span className="text-xs text-tertiary">{sub.id}</span>
                    </div>
                </div>
            ),
        },
        { key: "slug", label: "Slug", render: (sub) => <span className="text-tertiary">{sub.slug}</span> },
        { key: "status", label: "Status", render: (sub) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sub.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"}`}>{sub.isActive ? "Active" : "Inactive"}</span> },
        { key: "created", label: "Created", render: (sub) => <span className="text-tertiary">{new Date(sub.createdAt).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (sub) => <SubcategoryActions subcategory={sub} categoryId={categoryId} onDelete={() => handleSubcategoryDeleted(sub)} isDeleting={deleteMutation.isPending} /> },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad Management</p>
                        <div className="flex items-center gap-2">
                            <Button color="secondary" size="sm" iconLeading={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/></svg>} href="/dashboard/ad-management/categories">
                                Categories
                            </Button>
                            <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Subcategories</h1>
                        </div>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href={`/dashboard/ad-management/categories/${categoryId}/subcategories/create`}>New Subcategory</Button>
                </header>
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input placeholder="Search subcategories" icon={SearchLg} iconClassName="size-5" className="max-w-md" value={searchTerm} onChange={setSearchTerm} />
                            <Select selectedKey={selectedActive} onSelectionChange={(key) => typeof key === "string" && setSelectedActive(key as any)} items={[{ id: "all", label: "All Status" }, { id: "true", label: "Active" }, { id: "false", label: "Inactive" }]} size="sm" className="min-w-32">
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="subcategories" />
                    </div>
                    <DataTable columns={columns} data={subcategories} keyExtractor={(sub) => sub.id} isLoading={isLoading} isError={isError} error={error} emptyTitle="No subcategories found" emptyDescription="Create your first subcategory." emptyAction={<Button color="primary" size="sm" iconLeading={<Plus />} href={`/dashboard/ad-management/categories/${categoryId}/subcategories/create`}>New Subcategory</Button>} paginationInfo={paginationInfo} onPageChange={setPage} itemName="subcategories" />
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
