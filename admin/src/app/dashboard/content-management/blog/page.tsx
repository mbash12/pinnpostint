"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { FilterLines, Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { Pagination, PaginationInfoComponent } from "@/components/base/pagination";
import { useBlog, useDeleteBlog } from "@/hooks/use-blog";
import { Blog, BlogArticle } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { createExcerptFromHtml, createExcerpt, calculateReadTime } from "@/utils/cx";

// Separate component for news table
function BlogTable({
    articles,
    paginationInfo,
    isLoading,
    isError,
    error,
    currentPage,
    onPageChange,
    onDeleteArticle,
    itemName = "blog"
}: {
    articles: Blog[];
    paginationInfo: any;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    currentPage: number;
    onPageChange: (page: number) => void;
    onDeleteArticle: (article: Blog) => void;
    itemName?: string;
}) {
    const [articleToDelete, setArticleToDelete] = useState<Blog | null>(null);

    const confirmDeleteArticle = async () => {
        if (!articleToDelete) return;
        try {
            await onDeleteArticle(articleToDelete);
            setArticleToDelete(null);
        } catch (error: any) {
            // Error is handled by parent via AlertDialog
            setArticleToDelete(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-primary">Loading articles...</div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <p className="text-error">Error loading articles</p>
                    <p className="text-sm text-tertiary mt-1">{error?.message || 'Failed to load blog articles'}</p>
                    <Button
                        color="primary"
                        size="sm"
                        className="mt-4"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary text-sm">
                    <thead className="text-xs uppercase tracking-wide text-quaternary">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left">Article</th>
                            <th scope="col" className="px-4 py-3 text-left">Category</th>
                            <th scope="col" className="px-4 py-3 text-left">Author</th>
                            <th scope="col" className="px-4 py-3 text-left">Status</th>
                            <th scope="col" className="px-4 py-3 text-left">Created</th>
                            <th scope="col" className="px-4 py-3 text-left">Published</th>
                            <th scope="col" className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary text-primary">
                        {articles.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-tertiary">
                                    No articles found
                                </td>
                            </tr>
                        ) : (
                            articles.map((article) => (
                                <tr key={article.id} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3">
                                                {article.imageUrl && (
                                                    <img
                                                        src={getProxiedImageUrl(article.imageUrl)}
                                                        alt={article.title}
                                                        className="w-12 h-12 rounded-lg object-cover"
                                                    />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-primary">{article.title}</span>
                                                    <div className="flex gap-2 mt-1 text-xs text-tertiary">
                                                        <span>/blog/{createSlug(article.title)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {article.category ? (
                                            <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-secondary">
                                                {article.category.name}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-tertiary">No category</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-tertiary">
                                            {article.author ? `${article.author.firstName} ${article.author.lastName}` : 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                                article.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                                            }`}
                                        >
                                            {article.isActive ? "Published" : "Draft"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">
                                        {new Date(article.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">
                                        {article.publishedAt
                                            ? new Date(article.publishedAt).toLocaleDateString()
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                href={`/dashboard/content-management/blog/${article.id}/edit`}
                                            >
                                                Edit
                                            </Button>
                                            <ConfirmationDialog
                                                title={`Delete "${article.title}"?`}
                                                description={`Are you sure you want to delete this article? This action cannot be undone.`}
                                                onConfirm={confirmDeleteArticle}
                                            >
                                                <Button
                                                    color="secondary-destructive"
                                                    size="sm"
                                                    onClick={() => setArticleToDelete(article)}
                                                >
                                                    Delete
                                                </Button>
                                            </ConfirmationDialog>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-6">
                <PaginationInfoComponent
                    paginationInfo={paginationInfo}
                    itemName={itemName}
                    className="hidden sm:block"
                />
                <Pagination
                    currentPage={currentPage}
                    totalPages={paginationInfo.totalPages}
                    onPageChange={onPageChange}
                    className="mx-auto sm:mx-0"
                />
            </div>
        </>
    );
}

export default function NewsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const { data: blogResponse, isLoading, isError, error } = useBlog({
        page: currentPage,
        limit: itemsPerPage,
        isActive: selectedStatus === "all" ? undefined : selectedStatus === "active",
        search: debouncedSearchTerm.trim() || undefined,
    });

    const articles = (blogResponse?.data || []) as Blog[];
    const pagination = (blogResponse as any)?.pagination;

    const deleteBlogMutation = useDeleteBlog();

    const handleDeleteArticle = useCallback(async (article: Blog) => {
        try {
            await deleteBlogMutation.mutateAsync(article.id);
            setAlertDialog({
                isOpen: true,
                title: "Article Deleted",
                description: `"${article.title}" has been successfully deleted.`,
                type: "success",
            });
        } catch (error) {
            // Delete failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: "Failed to delete article. Please try again.",
                type: "error",
            });
        }
    }, [deleteBlogMutation]);

    // Pagination info from server response, but ensure consistency with actual data
    const paginationInfo = useMemo(() => {
        const total = pagination?.total || 0;
        // Fallback to actual data length if server pagination total is 0 but we have data
        const effectiveTotal = total === 0 && articles && articles.length > 0 ? articles.length : total;
        const page = pagination?.page || currentPage;
        const limit = pagination?.limit || itemsPerPage;
        const totalPages = effectiveTotal === 0 ? 0 : Math.ceil(effectiveTotal / limit);

        const startItem = effectiveTotal > 0 ? (page - 1) * limit + 1 : 0;
        const endItem = effectiveTotal > 0 ? Math.min(page * limit, effectiveTotal) : 0;

        return {
            currentPage: page,
            totalPages,
            totalItems: effectiveTotal,
            itemsPerPage: limit,
            startItem,
            endItem,
        };
    }, [pagination, currentPage, itemsPerPage, articles]);

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedStatus]);

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Content management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Blog</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/content-management/blog/create">
                        New article
                    </Button>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search articles"
                            icon={SearchLg}
                            iconClassName="size-5"
                            aria-label="Search articles"
                            className="max-w-md"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />

                        <div className="flex gap-2">
                            <Select
                                aria-label="Filter by status"
                                selectedKey={selectedStatus}
                                onSelectionChange={(key) => {
                                    if (typeof key === "string") {
                                        setSelectedStatus(key);
                                    }
                                }}
                                items={statusOptions}
                                size="sm"
                                className="min-w-32"
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                    </div>

                    {!isError && <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName="articles"
                    />}
                </div>

                <BlogTable
                    articles={articles}
                    paginationInfo={paginationInfo}
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    onDeleteArticle={handleDeleteArticle}
                    itemName="articles"
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

// Helper function to create slug from title
const createSlug = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
};

const statusOptions = [
    { id: "all", label: "All Status" },
    { id: "active", label: "Published" },
    { id: "inactive", label: "Draft" },
];