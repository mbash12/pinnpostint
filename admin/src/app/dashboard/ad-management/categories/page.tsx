"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { Category } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { getProxiedImageUrl } from "@/utils/image-proxy";

function CategoryActions({ category, onDelete, isDeleting }: { category: Category; onDelete: () => void; isDeleting: boolean }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${category.id}/subcategories`}>
                Subcategories
            </Button>
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${category.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${category.name}?`}
                description={`Are you sure you want to delete "${category.name}"? This action cannot be undone.`}
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

export default function CategoriesPage() {
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

    const deleteMutation = useDeleteCategory();

    const {
        data,
        pagination,
        isLoading,
        isError,
        error,
        currentPage: apiCurrentPage,
        setPage,
        updateParams
    } = useCategories({
        search: debouncedSearchTerm.trim() || undefined,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
    });

    const categories = data || [];

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
        data: categories,
        pagination: pagination || {
            page: apiCurrentPage,
            limit: itemsPerPage,
            total: categories.length,
            totalPages: Math.ceil(categories.length / itemsPerPage)
        },
        currentPage: apiCurrentPage,
        itemsPerPage,
    });

    const handleCategoryDelete = useCallback((category: Category) => {
        deleteMutation.mutateAsync(category.id).catch(error => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete category",
                type: "error",
            });
        });
    }, [deleteMutation]);

    const columns: Column<Category>[] = [
        {
            key: "category",
            label: "Category",
            render: (category) => (
                <div className="flex items-center gap-3">
                    <Avatar size="sm" src={category.image ? getProxiedImageUrl(category.image) : undefined} alt={category.name} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{category.name}</span>
                        <span className="text-xs text-tertiary">{category.id}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "slug",
            label: "Slug",
            render: (category) => <span className="text-tertiary">{category.slug}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (category) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${category.isActive
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
            render: (category) => <CategoryActions category={category} onDelete={() => handleCategoryDelete(category)} isDeleting={deleteMutation.isPending} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Categories</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/categories/create">
                        New category
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                        data={categories}
                        keyExtractor={(category) => category.id}
                        isLoading={isLoading}
                        isError={isError}
                        error={error}
                        emptyTitle="No categories found"
                        emptyDescription="Get started by creating your first category."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/categories/create">
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
