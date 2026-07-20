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
import { useBlogCategories, useDeleteBlogCategory } from "@/hooks/use-blog";
import { BlogCategory } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function CategoryActions({ category, onDelete, onError }: { category: BlogCategory; onDelete: () => void; onError: (error: string) => void }) {
    const [showDelete, setShowDelete] = useState(false);
    const deleteMutation = useDeleteBlogCategory();

    const confirmDelete = async () => {
        try {
            await deleteMutation.mutateAsync(category.id);
            setShowDelete(false);
            onDelete();
        } catch (error: any) {
            onError(error.message || "Failed to delete category");
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/content-management/blog-categories/${category.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${category.name}?`}
                description="This action cannot be undone."
                onConfirm={confirmDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    isLoading={deleteMutation.isPending}
                    onClick={() => setShowDelete(true)}
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

export default function NewsCategoriesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const { data: response, isLoading, isError, error, refetch } = useBlogCategories({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm.trim() || undefined,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
    });

    const categories = (response?.data || []) as BlogCategory[];
    const pagination = (response as any)?.pagination;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedActive]);

    const paginationInfo = usePaginationInfo({
        data: categories,
        pagination: pagination || {
            page: currentPage,
            limit: itemsPerPage,
            total: categories.length,
            totalPages: Math.ceil(categories.length / itemsPerPage)
        },
        currentPage,
        itemsPerPage
    });

    const handleDelete = useCallback(() => {
        refetch(); // Explicitly refetch after deletion
    }, [refetch]);

    const handleDeleteError = (error: string) => {
        setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            description: error,
            type: "error",
        });
    };

    const columns: Column<BlogCategory>[] = [
        {
            key: "name",
            label: "Category",
            render: (cat) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{cat.name}</span>
                    <span className="text-xs text-tertiary">{cat.id}</span>
                </div>
            ),
        },
        {
            key: "slug",
            label: "Slug",
            render: (cat) => <span className="text-tertiary">{cat.slug}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (cat) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    cat.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                }`}>
                    {cat.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (cat) => <span className="text-tertiary">{new Date(cat.createdAt).toLocaleDateString()}</span>,
        },
        {
            key: "updated",
            label: "Updated",
            render: (cat) => <span className="text-tertiary">{new Date(cat.updatedAt).toLocaleDateString()}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (cat) => <CategoryActions category={cat} onDelete={handleDelete} onError={handleDeleteError} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Content Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Blog Categories</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/content-management/blog-categories/create">
                        New Category
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search categories"
                                icon={SearchLg}
                                iconClassName="size-5"
                                className="max-w-md"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
                            <Select
                                selectedKey={selectedActive}
                                onSelectionChange={(key) => typeof key === "string" && setSelectedActive(key as any)}
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
                        keyExtractor={(cat) => cat.id}
                        isLoading={isLoading}
                        isError={isError}
                        error={error}
                        emptyTitle="No blog categories found"
                        emptyDescription="Create your first blog category."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/content-management/blog-categories/create">
                                New Category
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setCurrentPage}
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
