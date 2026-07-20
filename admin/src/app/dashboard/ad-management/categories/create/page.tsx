"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { generateSlug } from "@/utils/slug";
import { useCreateCategory, useUploadCategoryImage } from "@/hooks/use-categories";
import { categoryValidationSchema } from "@/utils/validation";

export default function CreateAdCategoryPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        image: "",
        adPlaceholder: "",
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateCategory();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
        
        // Real-time validation for critical fields
        if (["name", "description"].includes(field)) {
            validateFieldValue(field, value, categoryValidationSchema);
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
        const isValid = validateFormData(formState, categoryValidationSchema);
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
                ...(formState.adPlaceholder && { adPlaceholder: formState.adPlaceholder }),
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("Category Created", "Category has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/ad-management/categories"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create category. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout 
            breadcrumb="Ad management" 
            title="Create category"
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
                            maxLength={50}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. real-estate"
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
                            hint="Order in which categories appear (0 = first)"
                            isInvalid={!!fieldErrors.order}
                            min={0}
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
                        maxLength={500}
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
                    submitLabel="Create category"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
