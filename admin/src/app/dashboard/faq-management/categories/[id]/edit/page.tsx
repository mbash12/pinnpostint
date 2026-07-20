"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { generateSlug } from "@/utils/slug";
import { useFAQCategory, useUpdateFAQCategory } from "@/hooks/use-faq";

interface EditFAQCategoryPageProps {
    params: Promise<{ id: string }>;
}

export default function EditFAQCategoryPage({ params }: EditFAQCategoryPageProps) {
    const [id, setId] = useState("");

    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    const { data, isLoading } = useFAQCategory(id);

    if (isLoading) return <LoadingState message="Loading category..." />;
    if (!data) return <ErrorState message="Category not found" />;

    return <EditFAQCategoryForm data={data} />;
}

function EditFAQCategoryForm({ data }: { data: any }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        slug: "",
        description: "",
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateFAQCategory();

    useEffect(() => {
        setFormState({
            name: data.name || "",
            slug: data.slug || "",
            description: data.description || "",
            isActive: data.isActive ?? true,
            order: data.order ?? 0,
        });
    }, [data]);

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
                isActive: formState.isActive,
                order: formState.order,
            };

            const result = await updateMutation.mutateAsync({ id: data.id, categoryData: updateData });
            if (result?.success) {
                showAlert("Category Updated", "FAQ category has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/faq-management/categories"), 1500);
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
        <FormLayout breadcrumb="FAQ Management" title="Edit FAQ Category">
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
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. general-questions"
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
                            hint="Display order (0 = first)"
                            isInvalid={!!fieldErrors.order}
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: data.createdAt,
                        updatedAt: data.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
