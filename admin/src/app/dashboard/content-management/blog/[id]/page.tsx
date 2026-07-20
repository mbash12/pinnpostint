"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useBlogArticle, useUpdateBlog } from "@/hooks/use-blog";
import { Blog } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";

interface BlogArticleViewPageProps {
    params: Promise<{
        id: string;
    }>;
}

function ArticleInfo({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
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

export default function BlogArticleViewPage({ params }: BlogArticleViewPageProps) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [articleId, setArticleId] = useState<string>("");
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    // Handle async params
    React.useEffect(() => {
        params.then((resolvedParams) => {
            setArticleId(resolvedParams.id);
        });
    }, [params]);

    const { data: articleResponse, isLoading } = useBlogArticle(articleId);
    const article = articleResponse?.data?.data as Blog;

    const updateArticleMutation = useUpdateBlog();

    const handleToggleStatus = async () => {
        if (!article) return;

        setIsUpdating(true);
        try {
            await updateArticleMutation.mutateAsync({
                id: article.id,
                blogData: {
                    isActive: !article.isActive,
                }
            });
            setAlertDialog({
                isOpen: true,
                title: "Status Updated",
                description: `Article "${article.title}" has been ${!article.isActive ? 'published' : 'drafted'}.`,
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

    const handleToggleFeatured = async () => {
        if (!article) return;

        setIsUpdating(true);
        try {
            await updateArticleMutation.mutateAsync({
                id: article.id,
                blogData: {
                    isFeatured: !article.isFeatured,
                }
            });
            setAlertDialog({
                isOpen: true,
                title: "Featured Status Updated",
                description: `Article "${article.title}" featured status has been updated.`,
                type: "success",
            });
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: error?.message || "Failed to update featured status. Please try again.",
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
        router.push(`/dashboard/content-management/blog/${articleId}/edit`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-primary">Loading article details...</div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <h2 className="text-lg font-semibold text-primary">Article Not Found</h2>
                <p className="text-tertiary">The article you're looking for doesn't exist.</p>
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
                    {article.title}
                </h1>
            </header>

            {article.imageUrl && (
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="aspect-square max-w-md overflow-hidden rounded-lg bg-secondary/30 flex items-center justify-center">
                        <img 
                            src={getProxiedImageUrl(article.imageUrl)} 
                            alt={article.title}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                </section>
            )}

            <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-primary">Article Information</h2>
                    <div className="flex items-center gap-2">
                        <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                article.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                            }`}
                        >
                            {article.isActive ? "Published" : "Draft"}
                        </span>
                        {article.isFeatured && (
                            <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-brand-subtle text-brand-primary">
                                Featured
                            </span>
                        )}
                    </div>
                </header>

                <div className="space-y-4">
                    <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: article.content }} />
                    </div>

                    {article.excerpt && (
                        <div className="border-t border-secondary pt-4">
                            <h4 className="text-sm font-semibold text-primary mb-2">Excerpt</h4>
                            <p className="text-sm text-tertiary">{article.excerpt}</p>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-primary mb-4">Article Details</h3>
                    <div className="space-y-0">
                        <ArticleInfo
                            label="Slug"
                            value={article.slug}
                        />
                        <ArticleInfo
                            label="Category"
                            value={article.category?.name || "No category"}
                        />
                        <ArticleInfo
                            label="Author"
                            value={article.author ? `${article.author.firstName} ${article.author.lastName}` : 'Unknown'}
                        />
                        {article.publishedAt && (
                            <ArticleInfo
                                label="Published"
                                value={new Date(article.publishedAt).toLocaleDateString()}
                            />
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-primary mb-4">Metadata</h3>
                    <div className="space-y-0">
                        <ArticleInfo
                            label="Created"
                            value={new Date(article.createdAt).toLocaleDateString()}
                        />
                        <ArticleInfo
                            label="Last Updated"
                            value={new Date(article.updatedAt).toLocaleDateString()}
                        />
                    </div>
                </section>
            </div>

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
                    color={article.isActive ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleToggleStatus}
                    isLoading={isUpdating}
                >
                    {article.isActive ? "Draft" : "Publish"}
                </Button>
                <Button
                    color={article.isFeatured ? "secondary" : "primary"}
                    size="sm"
                    onClick={handleToggleFeatured}
                    isLoading={isUpdating}
                >
                    {article.isFeatured ? "Remove Featured" : "Feature"}
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