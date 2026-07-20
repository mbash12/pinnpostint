"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { generateSlug } from "@/utils/slug";
import { useCreateSubcategory, useUploadSubcategoryImage, useCategory } from "@/hooks/use-categories";
import { subcategoryValidationSchema } from "@/utils/validation";

export default function CreateSubcategoryPage() {
    const params = useParams<{ id: string }>();
    const categoryId = params?.id ?? "";
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        image: "",
        supportsBooking: false,
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateSubcategory();
    const { data: categoryResponse } = useCategory(categoryId);
    const category = categoryResponse?.data;

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["name", "slug"].includes(field)) {
            validateFieldValue(field, value, subcategoryValidationSchema);
        }
    };

    const handleNameBlur = () => {
        if (formState.name && !formState.slug) {
            handleChange("slug", generateSlug(formState.name));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, subcategoryValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        try {
            const data = {
                name: formState.name,
                slug: formState.slug || generateSlug(formState.name),
                ...(formState.description && { description: formState.description }),
                ...(formState.image && { image: formState.image }),
                supportsBooking: formState.supportsBooking,
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await createMutation.mutateAsync({ categoryId, data });
            if (result?.success) {
                showAlert("Subcategory Created", "Subcategory has been successfully created.", "success");
                setTimeout(() => router.push(`/dashboard/ad-management/categories/${categoryId}/subcategories`), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create subcategory. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout
            breadcrumb="Ad management"
            title={`${category?.data?.name ?? "Category"} · Create subcategory`}
        >
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
                            maxLength={100}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. apartments"
                            value={formState.slug}
                            onChange={(v) => handleChange("slug", v)}
                            hint={fieldErrors.slug || "Used in URLs. Keep it unique and lowercase."}
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                            maxLength={200}
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
                        maxLength={500}
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
                    submitLabel="Create subcategory"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
