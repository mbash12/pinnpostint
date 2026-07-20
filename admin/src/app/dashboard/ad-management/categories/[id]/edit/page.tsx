"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { generateSlug } from "@/utils/slug";
import { useCategory, useUpdateCategory, useUploadCategoryImage } from "@/hooks/use-categories";

export default function EditAdCategoryPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const { data: categoryResponse, isLoading } = useCategory(id || '');
    const category = (categoryResponse?.data || categoryResponse) as any;

    if (isLoading) return <LoadingState message="Loading category..." />;
    if (!category || !category.id) return <ErrorState message="Category not found" />;

    return <EditAdCategoryForm category={category} />;
}

function EditAdCategoryForm({ category }: { category: any }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        image: "",
        adPlaceholder: "",
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateCategory();

    useEffect(() => {
        setFormState({
            name: category.name || "",
            slug: category.slug || "",
            description: category.description || "",
            image: category.image || "",
            adPlaceholder: category.adPlaceholder || "",
            isActive: category.isActive ?? true,
            order: category.order ?? 0,
        });
    }, [category]);

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleNameBlur = () => {
        if (formState.name && !formState.slug) {
            handleChange("slug", generateSlug(formState.name));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const updateData = {
                name: formState.name,
                slug: formState.slug,
                description: formState.description || null,
                image: formState.image || undefined,
                adPlaceholder: formState.adPlaceholder || undefined,
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await updateMutation.mutateAsync({ id: category.id, data: updateData });
            if (result?.success) {
                showAlert("Category Updated", "Category has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/ad-management/categories"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update category. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout 
            breadcrumb="Ad management" 
            title="Edit category"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={3}>
                        <Input
                            label="Category name"
                            placeholder="e.g. Real Estate"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            onBlur={handleNameBlur}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. real-estate"
                            value={formState.slug}
                            onChange={(v) => handleChange("slug", v)}
                            hint={fieldErrors.slug || "Used in URLs. Updating this can affect existing links."}
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                        />
                        <NumberInput
                            label="Order"
                            placeholder="0"
                            value={formState.order}
                            onChange={(v) => handleChange("order", v)}
                            hint="Order in which categories appear (0 = first)"
                            isInvalid={!!fieldErrors.order}
                        />
                    </FormGrid>

                    <TextArea
                        label="Description"
                        placeholder="Describe what listings belong in this category"
                        value={formState.description}
                        onChange={(v) => handleChange("description", v)}
                        rows={4}
                        isInvalid={!!fieldErrors.description}
                        hint={fieldErrors.description}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="max-w-md">
                            <ImageUpload
                                value={formState.image}
                                onChange={(url) => handleChange("image", url)}
                                onRemove={() => handleChange("image", "")}
                                label="Category image"
                                hint="Upload a high-quality icon/image for the category"
                                isInvalid={!!fieldErrors.image}
                            />
                        </div>
                        <div className="max-w-md">
                            <ImageUpload
                                value={formState.adPlaceholder}
                                onChange={(url) => handleChange("adPlaceholder", url)}
                                onRemove={() => handleChange("adPlaceholder", "")}
                                label="Ad placeholder image"
                                hint="Fallback image for ads in this category that don't have images"
                                isInvalid={!!fieldErrors.adPlaceholder}
                            />
                        </div>
                    </div>
                </FormSection>

                <SettingsSection title="Category settings" description="Configure visibility.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the category is available to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/ad-management/categories"
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: category.createdAt,
                        updatedAt: category.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
