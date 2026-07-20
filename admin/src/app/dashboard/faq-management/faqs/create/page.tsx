"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreateFAQ } from "@/hooks/use-faq";
import { apiClient } from "@/lib/api-client";
import { faqValidationSchema } from "@/utils/validation";

export default function CreateFAQPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        question: "",
        answer: "",
        isActive: true,
        categoryId: "",
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateFAQ();

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/faq-categories', { 
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
        if (["question", "answer"].includes(field)) {
            validateFieldValue(field, value, faqValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate entire form before submission
        const isValid = validateFormData(formState, faqValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }
        
        try {
            const data = {
                question: formState.question,
                answer: formState.answer,
                isActive: formState.isActive,
                order: formState.order,
                ...(formState.categoryId && { categoryId: formState.categoryId }),
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("FAQ Created", "FAQ has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/faq-management/faqs"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create FAQ. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="FAQ Management" title="Create FAQ">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Question"
                            placeholder="Enter the FAQ question"
                            value={formState.question}
                            onChange={(v) => handleChange("question", v)}
                            isRequired
                            isInvalid={!!fieldErrors.question}
                            hint={fieldErrors.question}
                            maxLength={200}
                        />
                        <FormGrid cols={2}>
                            <SearchableSelect
                                label="Category"
                                placeholder="Search for a category..."
                                value={formState.categoryId}
                                onSelectionChange={(value) => handleChange("categoryId", value)}
                                searchFn={searchCategories}
                                displayKey="name"
                                valueKey="id"
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
                    </FormGrid>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">Answer</label>
                        <RichTextEditor
                            value={formState.answer}
                            onChange={(v) => handleChange("answer", v)}
                            placeholder="Write the detailed answer here..."
                            className="min-h-[300px]"
                            height="h-96"
                            onAlert={showAlert}
                        />
                    </div>
                </FormSection>

                <SettingsSection title="FAQ settings" description="Configure visibility and display order.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the FAQ is visible to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/faq-management/faqs"
                    submitLabel="Create FAQ"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
