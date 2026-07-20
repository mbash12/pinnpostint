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
import { useSubcategory, useUpdateSubcategory, useUploadSubcategoryImage, useCategory } from "@/hooks/use-categories";

export default function EditSubcategoryPage() {
    const params = useParams<{ id: string; subcategoryId: string }>();
    const categoryId = params?.id ?? "";
    const subcategoryId = params?.subcategoryId ?? "";
    
    const { data: subcategoryResponse, isLoading: subLoading } = useSubcategory(subcategoryId);
    const { data: categoryResponse } = useCategory(categoryId);
    const subcategory = subcategoryResponse?.data;
    const category = categoryResponse?.data;

    if (subLoading) return <LoadingState message="Loading subcategory..." />;
    if (!subcategory) return <ErrorState message="Subcategory not found" />;

    return <EditSubcategoryForm subcategory={subcategory} category={category} categoryId={categoryId} />;
}

function EditSubcategoryForm({ subcategory, category, categoryId }: { subcategory: any; category: any; categoryId: string }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        image: "",
        supportsBooking: false,
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateSubcategory();

    useEffect(() => {
        setFormState({
            name: subcategory.name || "",
            slug: subcategory.slug || "",
            description: subcategory.description || "",
            image: subcategory.image || "",
            supportsBooking: subcategory.supportsBooking ?? false,
            isActive: subcategory.isActive ?? true,
            order: subcategory.order ?? 0,
        });
    }, [subcategory]);

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
                supportsBooking: formState.supportsBooking,
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await updateMutation.mutateAsync({ id: subcategory.id, data: updateData });
            if (result?.success) {
                showAlert("Subcategory Updated", "Subcategory has been successfully updated.", "success");
                setTimeout(() => router.push(`/dashboard/ad-management/categories/${categoryId}/subcategories`), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update subcategory. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Ad management" title={`${category?.data?.name ?? "Category"} · Edit subcategory`}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={3}>
                        <Input
                            label="Subcategory name"
                            placeholder="e.g. Apartments"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            onBlur={handleNameBlur}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. apartments"
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
                            hint="Order in which subcategories appear (0 = first)"
                            isInvalid={!!fieldErrors.order}
                            min={0}
                        />
                    </FormGrid>

                    <TextArea
                        label="Description"
                        placeholder="Describe listings included in this subcategory"
                        value={formState.description}
                        onChange={(v) => handleChange("description", v)}
                        rows={4}
                        isInvalid={!!fieldErrors.description}
                        hint={fieldErrors.description}
                    />

                    <div className="max-w-md">
                        <ImageUpload
                            value={formState.image}
                            onChange={(url) => handleChange("image", url)}
                            onRemove={() => handleChange("image", "")}
                            label="Subcategory image"
                            hint="Upload a high-quality image for the subcategory (recommended: 1200x630px, max 5MB)"
                            isInvalid={!!fieldErrors.image}
                        />
                    </div>
                </FormSection>

                <SettingsSection title="Subcategory settings" description="Configure visibility and booking availability.">
                    <ToggleField
                        label="Active"
                        description="Deactivate to temporarily hide this subcategory from listings."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                    <ToggleField
                        label="Supports Booking"
                        description="Allow ads in this subcategory to enable booking."
                        checked={formState.supportsBooking}
                        onChange={(v) => handleChange("supportsBooking", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref={`/dashboard/ad-management/categories/${categoryId}/subcategories`}
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: subcategory.createdAt,
                        updatedAt: subcategory.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
