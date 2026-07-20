"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useFAQ, useUpdateFAQ } from "@/hooks/use-faq";
import { apiClient } from "@/lib/api-client";

interface EditFAQPageProps {
    params: Promise<{ id: string }>;
}

export default function EditFAQPage({ params }: EditFAQPageProps) {
    const [id, setId] = useState("");

    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    const { data: faqResponse, isLoading } = useFAQ(id);
    const faq = faqResponse?.data;

    if (isLoading) return <LoadingState message="Loading FAQ..." />;
    if (!faq) return <ErrorState message="FAQ not found" />;

    return <EditFAQForm faq={faq} />;
}

function EditFAQForm({ faq }: { faq: any }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        question: "",
        answer: "",
        isActive: true,
        categoryId: "",
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateFAQ();

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/faq-categories', { 
            ...(query && { search: query }), 
            limit: 20, 
            isActive: true 
        }, { skipLoading: true });
        return response.data || [];
    };

    useEffect(() => {
        setFormState({
            question: faq.question || "",
            answer: faq.answer || "",
            isActive: faq.isActive ?? true,
            categoryId: faq.categoryId || faq.category?.id || "",
            order: faq.order ?? 0,
        });
    }, [faq]);

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const updateData = {
                question: formState.question,
                answer: formState.answer,
                isActive: formState.isActive,
                order: formState.order,
                categoryId: formState.categoryId || null,
            };

            const result = await updateMutation.mutateAsync({ id: faq.id, faqData: updateData });
            if (result?.success) {
                showAlert("FAQ Updated", "FAQ has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/faq-management/faqs"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update FAQ. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="FAQ Management" title="Edit FAQ">
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: faq.createdAt,
                        updatedAt: faq.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
