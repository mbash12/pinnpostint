"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { generateSlug } from "@/utils/slug";
import { useCreateLegalDocument } from "@/hooks/use-legal-documents";
import { legalDocumentValidationSchema } from "@/utils/validation";

export default function CreateLegalDocumentPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        title: "",
        slug: "",
        content: "",
        isActive: true,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateLegalDocument();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["title", "slug", "content"].includes(field)) {
            validateFieldValue(field, value, legalDocumentValidationSchema);
        }
    };

    const handleTitleBlur = () => {
        if (formState.title && !formState.slug) {
            handleChange("slug", generateSlug(formState.title));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, legalDocumentValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        try {
            const data = {
                title: formState.title,
                slug: formState.slug || generateSlug(formState.title),
                content: formState.content,
                isActive: formState.isActive,
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("Document Created", "Legal document has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/content-management/legal"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create document. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Content management" title="Create Legal Document">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Document title"
                            placeholder="e.g. Terms of Service"
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
                            placeholder="e.g. terms-of-service"
                            value={formState.slug}
                            onChange={(v) => handleChange("slug", v)}
                            hint={fieldErrors.slug || "Used in URLs. Keep it unique and lowercase."}
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                            maxLength={200}
                        />
                    </FormGrid>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">Content</label>
                        <RichTextEditor
                            value={formState.content}
                            onChange={(v) => handleChange("content", v)}
                            placeholder="Write the legal document content here..."
                            className="min-h-[400px]"
                            height="h-96"
                            onAlert={showAlert}
                        />
                        {fieldErrors.content && (
                            <p className="text-xs text-error">{fieldErrors.content}</p>
                        )}
                    </div>
                </FormSection>

                <SettingsSection title="Document settings" description="Configure visibility.">
                    <ToggleField
                        label="Published"
                        description="Toggle to control if the document is visible to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/content-management/legal"
                    submitLabel="Create document"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
