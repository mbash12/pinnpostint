"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { SearchableSelect } from "@/components/base/searchable-select";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { generateSlug } from "@/utils/slug";
import { useCreateBlog } from "@/hooks/use-blog";
import { countWordsInHtml } from "@/utils/cx";
import { generateSmartExcerpt } from "@/utils/excerpt";
import { apiClient } from "@/lib/api-client";
import { blogValidationSchema } from "@/utils/validation";

export default function CreateBlogPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        isActive: true,
        categoryId: "",
        imageUrl: "",
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateBlog();

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/blog-categories', {
            ...(query && { search: query }),
            limit: 20,
            isActive: true
        }, { skipLoading: true });
        return response.data || [];
    };

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
        
        // Real-time validation for critical fields
        if (["title", "slug", "content"].includes(field)) {
            validateFieldValue(field, value, blogValidationSchema);
        }
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
        
        // Validate entire form before submission
        const isValid = validateFormData(formState, blogValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct the errors in the form.", "error");
            return;
        }
        
        try {
            const data = {
                title: formState.title,
                slug: formState.slug || generateSlug(formState.title),
                content: formState.content,
                excerpt: formState.excerpt || generateSmartExcerpt(formState.content),
                ...(formState.imageUrl && { imageUrl: formState.imageUrl }),
                isActive: formState.isActive,
                ...(formState.categoryId && { categoryId: formState.categoryId }),
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("Article Created", "Blog article has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/content-management/blog"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create article. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Content management" title="Create Blog Article">
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
                            maxLength={200}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. my-article-title"
                            value={formState.slug}
                            onChange={(v) => handleChange("slug", v)}
                            hint={fieldErrors.slug || "Used in URLs. Auto-generated from title if empty."}
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                            maxLength={200}
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
                        hint={fieldErrors.excerpt || "Will be auto-generated from content if left empty"}
                        isInvalid={!!fieldErrors.excerpt}
                        maxLength={500}
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
                    submitLabel="Create article"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
