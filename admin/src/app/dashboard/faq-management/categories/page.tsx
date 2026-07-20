"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { Select } from "@/components/base/select/select";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useDeleteFAQCategory, useFAQCategories } from "@/hooks/use-faq";
import { FAQCategory } from "@/lib/api-types-faq";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function CategoryActions({ category, onDelete, isDeleting }: { category: FAQCategory; onDelete: () => void; isDeleting: boolean }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/faq-management/categories/${category.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete "${category.name}"?`}
                description="This will also remove the category from any FAQs that use it. This action cannot be undone."
                onConfirm={() => onDelete()}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={isDeleting}
                >
                    Delete
                </Button>
            </ConfirmationDialog>
        </div>
    );
}

const activeOptions = [
    { id: "all", label: "All Status" },
    { id: "true", label: "Active" },
    { id: "false", label: "Inactive" },
];

export default function FAQCategoriesPage() {
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

    const deleteMutation = useDeleteFAQCategory();

    const {
        data: categories,
        pagination,
        isLoading,
        isError,
        error,
        currentPage: apiCurrentPage,
        setPage,
        updateParams
    } = useFAQCategories({
        limit: itemsPerPage,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        search: debouncedSearchTerm.trim() || undefined,
    });

    const categoriesTyped = (categories || []) as FAQCategory[];

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
        data: categoriesTyped,
        pagination: pagination || {
            page: apiCurrentPage,
            limit: itemsPerPage,
            total: categoriesTyped.length,
            totalPages: Math.ceil(categoriesTyped.length / itemsPerPage)
        },
        currentPage: apiCurrentPage,
        itemsPerPage,
    });

    const handleDeleteCategory = useCallback((category: FAQCategory) => {
        deleteMutation.mutateAsync(category.id).catch(error => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete FAQ category",
                type: "error",
            });
        });
    }, [deleteMutation]);

    const columns: Column<FAQCategory>[] = [
        {
            key: "category",
            label: "Category",
            render: (category) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{category.name}</span>
                    <span className="text-xs text-tertiary">{category.id}</span>
                </div>
            ),
        },
        {
            key: "slug",
            label: "Slug",
            render: (category) => (
                <code className="rounded bg-secondary px-2 py-1 text-xs text-tertiary">{category.slug}</code>
            ),
        },
        {
            key: "count",
            label: "FAQ Count",
            render: (category) => (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-tertiary">
                    {category._count?.faqs || 0}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (category) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        category.isActive
                            ? "bg-success-subtle text-success-primary"
                            : "bg-warning-subtle text-warning-primary"
                    }`}
                >
                    {category.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (category) => (
                <span className="text-tertiary">{new Date(category.createdAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "updated",
            label: "Updated",
            render: (category) => (
                <span className="text-tertiary">{new Date(category.updatedAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (category) => <CategoryActions category={category} onDelete={() => handleDeleteCategory(category)} isDeleting={deleteMutation.isPending} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">FAQ Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">FAQ Categories</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/faq-management/categories/create">
                        New category
                    </Button>
                </header>

                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search categories"
                                icon={SearchLg}
                                iconClassName="size-5"
                                aria-label="Search categories"
                                className="max-w-md"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
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
                        </div>

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="categories" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={categoriesTyped}
                        keyExtractor={(category) => category.id}
                        isLoading={isLoading}
                        isError={isError}
                        error={error}
                        emptyTitle="No FAQ categories found"
                        emptyDescription="Get started by creating your first FAQ category."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/faq-management/categories/create">
                                New category
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setPage}
                        itemName="categories"
                    />
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
