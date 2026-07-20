"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { generateSlug } from "@/utils/slug";
import { useBlogArticle, useUpdateBlog } from "@/hooks/use-blog";
import { countWordsInHtml } from "@/utils/cx";
import { generateSmartExcerpt } from "@/utils/excerpt";
import { apiClient } from "@/lib/api-client";

interface EditBlogPageProps {
    params: Promise<{ id: string }>;
}

export default function EditBlogPage({ params }: EditBlogPageProps) {
    const [id, setId] = useState("");

    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    const { data: blogResponse, isLoading } = useBlogArticle(id);
    const blog = blogResponse?.data;

    if (isLoading) return <LoadingState message="Loading article..." />;
    if (!blog) return <ErrorState message="Article not found" />;

    return <EditBlogForm blog={blog} />;
}

function EditBlogForm({ blog }: { blog: any }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        isActive: true,
        categoryId: "",
        imageUrl: "",
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateBlog();

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/blog-categories', {
            ...(query && { search: query }),
            limit: 20,
            isActive: true
        }, { skipLoading: true });
        return response.data || [];
    };

    useEffect(() => {
        setFormState({
            title: blog.title || "",
            slug: blog.slug || "",
            excerpt: blog.excerpt || "",
            content: blog.content || "",
            isActive: blog.isActive ?? true,
            categoryId: blog.categoryId || blog.category?.id || "",
            imageUrl: blog.imageUrl || "",
        });
    }, [blog]);

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleTitleBlur = () => {
        if (formState.title && !formState.slug) {
            handleChange("slug", generateSlug(formState.title));
        }
    };

    const handleContentChange = (content: string) => {
        handleChange("content", content);
        if (content && !formState.excerpt) {
            handleChange("excerpt", generateSmartExcerpt(content));
        }
    };

    const calculateReadTime = (content: string) => {
        const wordsPerMinute = 200;
        const textContent = content.replace(/<[^>]*>/g, '');
        const words = textContent.trim().split(/\s+/).filter(Boolean).length;
        return Math.ceil(words / wordsPerMinute);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const updateData = {
                title: formState.title,
                slug: formState.slug,
                content: formState.content,
                excerpt: formState.excerpt || generateSmartExcerpt(formState.content),
                imageUrl: formState.imageUrl || null,
                isActive: formState.isActive,
                categoryId: formState.categoryId || null,
            };

            const result = await updateMutation.mutateAsync({ id: blog.id, blogData: updateData });
            if (result?.success) {
                showAlert("Article Updated", "Blog article has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/content-management/blog"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update article. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Content management" title="Edit News Article">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Article title"
                            placeholder="Enter article title"
                            value={formState.title}
                            onChange={(v) => handleChange("title", v)}
                            onBlur={handleTitleBlur}
                            isRequired
                            isInvalid={!!fieldErrors.title}
                            hint={fieldErrors.title}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. my-article-title"
                            value={formState.slug}
                            onChange={(v) => handleChange("slug", v)}
                            hint={fieldErrors.slug || "Used in URLs. Updating this can affect existing links."}
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                        />
                    </FormGrid>

                    <SearchableSelect
                        label="Category"
                        placeholder="Search for a category..."
                        value={formState.categoryId}
                        onSelectionChange={(value) => handleChange("categoryId", value)}
                        searchFn={searchCategories}
                        displayKey="name"
                        valueKey="id"
                    />

                    <div className="max-w-md">
                        <ImageUpload
                            value={formState.imageUrl}
                            onChange={(url) => handleChange("imageUrl", url)}
                            onRemove={() => handleChange("imageUrl", "")}
                            label="Featured Image"
                            hint="Upload a high-quality image for your article (recommended: 1200x630px, max 5MB)"
                            isInvalid={!!fieldErrors.imageUrl}
                        />
                    </div>

                    <TextArea
                        label="Excerpt"
                        placeholder="Brief summary of the article (optional)"
                        value={formState.excerpt}
                        onChange={(v) => handleChange("excerpt", v)}
                        rows={3}
                        hint="Will be auto-generated from content if left empty"
                        isInvalid={!!fieldErrors.excerpt}
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">Content</label>
                        <RichTextEditor
                            value={formState.content}
                            onChange={handleContentChange}
                            placeholder="Write your article content here..."
                            className="min-h-[300px]"
                            height="h-96"
                            onAlert={showAlert}
                        />
                        <div className="flex justify-between text-xs text-tertiary">
                            <span>Words: {countWordsInHtml(formState.content)}</span>
                            <span>Read time: {calculateReadTime(formState.content)} min</span>
                        </div>
                    </div>
                </FormSection>

                <SettingsSection title="Article settings" description="Configure visibility.">
                    <ToggleField
                        label="Published"
                        description="Toggle to control if the article is visible to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/content-management/blog"
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: blog.createdAt,
                        updatedAt: blog.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
