"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useBlogCategory, useUpdateBlogCategory } from "@/hooks/use-blog";
import { BlogCategory } from "@/lib/api-types";

interface BlogCategoryViewPageProps {
    params: Promise<{
        id: string;
    }>;
}

function CategoryInfo({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-secondary">
            <div className="flex items-center gap-3">
                {icon && <div className="text-tertiary">{icon}</div>}
                <span className="text-sm font-medium text-tertiary">{label}</span>
            </div>
            <span className="text-sm text-primary font-mono">{value}</span>
        </div>
    );
}

export default function BlogCategoryViewPage({ params }: BlogCategoryViewPageProps) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [categoryId, setCategoryId] = useState<string>("");
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    // Handle async params
    React.useEffect(() => {
        params.then((resolvedParams) => {
            setCategoryId(resolvedParams.id);
        });
    }, [params]);

    const { data: categoryResponse, isLoading } = useBlogCategory(categoryId);
    const category = categoryResponse?.data as BlogCategory;

    const updateCategoryMutation = useUpdateBlogCategory();

    const handleToggleActive = async () => {
        if (!category) return;

        setIsUpdating(true);
        try {
            await updateCategoryMutation.mutateAsync({
                id: category.id,
                categoryData: {
                    isActive: !category.isActive,
                }
            });
            setAlertDialog({
                isOpen: true,
                title: "Status Updated",
                description: `Category "${category.name}" has been ${!category.isActive ? 'activated' : 'deactivated'}.`,
                type: "success",
            });
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: error?.message || "Failed to update status. Please try again.",
                type: "error",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const handleEdit = () => {
        router.push(`/dashboard/content-management/blog-categories/${categoryId}/edit`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-primary">Loading category details...</div>
            </div>
        );
    }

    if (!category) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <h2 className="text-lg font-semibold text-primary">Category Not Found</h2>
                <p className="text-tertiary">The category you're looking for doesn't exist.</p>
                <Button color="primary" onClick={handleBack}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Content management</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">
                    {category.name}
                </h1>
            </header>

            <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-primary">Category Information</h2>
                    <div className="flex items-center gap-2">
                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                category.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                            }`}
                        >
                            {category.isActive ? "Active" : "Inactive"}
                        </span>
                    </div>
                </header>

                <div className="space-y-0">
                    <CategoryInfo
                        label="Category Name"
                        value={category.name}
                    />
                    <CategoryInfo
                        label="Slug"
                        value={category.slug}
                    />
                    <CategoryInfo
                        label="Description"
                        value={category.description || "No description provided"}
                    />
                    <CategoryInfo
                        label="Blog Count"
                        value={category._count?.blogs || 0}
                    />
                    <CategoryInfo
                        label="Order"
                        value={category.order}
                    />
                    <CategoryInfo
                        label="Status"
                        value={category.isActive ? "Active" : "Inactive"}
                    />
                </div>
            </section>

            <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-primary mb-4">Metadata</h3>
                <div className="space-y-0">
                    <CategoryInfo
                        label="Created"
                        value={new Date(category.createdAt).toLocaleDateString()}
                    />
                    <CategoryInfo
                        label="Last Updated"
                        value={new Date(category.updatedAt).toLocaleDateString()}
                    />
                </div>
            </section>

            <footer className="flex items-center justify-end gap-4">
                <Button
                    color="secondary"
                    size="sm"
                    onClick={handleBack}
                >
                    Back
                </Button>
                <Button
                    color="secondary"
                    size="sm"
                    onClick={handleEdit}
                >
                    Edit
                </Button>
                <Button
                    color={category.isActive ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleToggleActive}
                    isLoading={isUpdating}
                >
                    {category.isActive ? "Deactivate" : "Activate"}
                </Button>
            </footer>

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