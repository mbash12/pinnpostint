"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { generateSlug } from "@/utils/slug";
import { useCreateFAQCategory } from "@/hooks/use-faq";
import { faqCategoryValidationSchema } from "@/utils/validation";

export default function CreateFAQCategoryPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateFAQCategory();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["name", "slug"].includes(field)) {
            validateFieldValue(field, value, faqCategoryValidationSchema);
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
        const isValid = validateFormData(formState, faqCategoryValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        try {
            const data = {
                name: formState.name,
                slug: formState.slug || generateSlug(formState.name),
                ...(formState.description && { description: formState.description }),
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("Category Created", "FAQ category has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/faq-management/categories"), 1500);
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
        <FormLayout breadcrumb="FAQ Management" title="Create FAQ Category">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={3}>
                        <Input
                            label="Category name"
                            placeholder="e.g. General Questions"
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
                            placeholder="e.g. general-questions"
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
                            hint="Display order (0 = first)"
                            isInvalid={!!fieldErrors.order}
                            min={0}
                        />
                    </FormGrid>

                    <TextArea
                        label="Description"
                        placeholder="Describe this FAQ category"
                        value={formState.description}
                        onChange={(v) => handleChange("description", v)}
                        rows={4}
                        isInvalid={!!fieldErrors.description}
                        hint={fieldErrors.description}
                        maxLength={500}
                    />
                </FormSection>

                <SettingsSection title="Category settings" description="Configure visibility and display order.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the category is visible to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/faq-management/categories"
                    submitLabel="Create category"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
