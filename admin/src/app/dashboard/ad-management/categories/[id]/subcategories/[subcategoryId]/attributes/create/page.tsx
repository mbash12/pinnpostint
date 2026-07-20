"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { Select } from "@/components/base/select/select";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useCreateAttribute, useUploadAttributeImage, useSubcategory, useCategory } from "@/hooks/use-categories";
import { CreateAttributeRequest, AttributeType } from "@/lib/api-types";
import { attributeValidationSchema, validateField } from "@/utils/validation";

const attributeTypes = [
    { id: "text", label: "Text" },
    { id: "number", label: "Number" },
    { id: "boolean", label: "Boolean" },
    { id: "select", label: "Select" },
    { id: "textarea", label: "Textarea" },
    { id: "date", label: "Date" },
];

export default function CreateAttributePage() {
    const params = useParams<{ id: string; subcategoryId: string }>();
    const categoryId = params?.id ?? "";
    const subcategoryId = params?.subcategoryId ?? "";
    const router = useRouter();

    const [formState, setFormState] = useState({
        name: "",
        type: "text" as AttributeType,
        isRequired: false,
        options: [] as string[],
        order: 0,
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const createAttributeMutation = useCreateAttribute();
    const uploadImageMutation = useUploadAttributeImage();
    const { data: subcategoryResponse } = useSubcategory(subcategoryId);
    const { data: categoryResponse } = useCategory(categoryId);

    const subcategory = subcategoryResponse?.data;
    const category = categoryResponse?.data;

    const handleChange = (field: keyof typeof formState, value: any) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }));
        // Clear field error when user makes changes
        if (fieldErrors[field]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }

        // Real-time validation for name field
        if (field === "name") {
            const error = validateField(value, attributeValidationSchema.name);
            if (error) {
                setFieldErrors(prev => ({ ...prev, name: error }));
            }
        }
    };

    const handleOptionsChange = (value: string) => {
        // Parse comma-separated options into array
        const options = value
            .split(',')
            .map(opt => opt.trim())
            .filter(opt => opt.length > 0);

        setFormState(prev => ({
            ...prev,
            options,
        }));

        // Clear field error when user makes changes
        if (fieldErrors.options) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.options;
                return newErrors;
            });
        }

        // Real-time validation for options
        if (options.length > 0) {
            const error = validateField(options, attributeValidationSchema.options);
            if (error) {
                setFieldErrors(prev => ({ ...prev, options: error }));
            }
        }
    };


    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Validate form before submission
        const errors: Record<string, string> = {};

        const nameError = validateField(formState.name, attributeValidationSchema.name);
        if (nameError) errors.name = nameError;

        if (formState.type === "select" && formState.options.length > 0) {
            const optionsError = validateField(formState.options, attributeValidationSchema.options);
            if (optionsError) errors.options = optionsError;
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setAlertDialog({
                isOpen: true,
                title: "Validation Error",
                description: "Please check the form fields and correct the errors.",
                type: "error",
            });
            return;
        }

        try {
            const attributeData: CreateAttributeRequest = {
                name: formState.name,
                type: formState.type,
                isRequired: formState.isRequired,
                order: formState.order,
                ...(formState.options.length > 0 && { options: formState.options }),
            };

            const result = await createAttributeMutation.mutateAsync({ subcategoryId, data: attributeData });

            if (result?.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Attribute Created",
                    description: "Attribute has been successfully created.",
                    type: "success",
                });

                // Redirect after short delay
                setTimeout(() => {
                    router.push(`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategoryId}/attributes`);
                }, 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }

        } catch (error: any) {
            // Handle validation errors with field-specific messages
            if (error?.error?.details && Array.isArray(error.error.details)) {
                const errors: Record<string, string> = {};
                error.error.details.forEach((detail: any) => {
                    if (detail.field && detail.message) {
                        errors[detail.field] = detail.message;
                    }
                });
                setFieldErrors(errors);

                setAlertDialog({
                    isOpen: true,
                    title: "Validation Error",
                    description: "Please check the form fields and correct the errors.",
                    type: "error",
                });
            } else {
                setAlertDialog({
                    isOpen: true,
                    title: "Create Failed",
                    description: error?.message || "Failed to create attribute. Please try again.",
                    type: "error",
                });
            }
        }
    };

    const optionsString = formState.options.join(', ');

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Attribute management</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Create attribute</h1>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Input
                            label="Attribute name"
                            placeholder="e.g. Floor area"
                            value={formState.name}
                            onChange={(value) => handleChange("name", value)}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                            maxLength={100}
                        />
                        <Select
                            label="Type"
                            placeholder="Select attribute type"
                            selectedKey={formState.type}
                            onSelectionChange={(key) => handleChange("type", key as AttributeType)}
                            items={attributeTypes}
                            isRequired
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <NumberInput
                            label="Order"
                            placeholder="0"
                            value={formState.order}
                            onChange={(value) => handleChange("order", value)}
                            hint="Order in which attributes appear (0 = first)"
                            isInvalid={!!fieldErrors.order}
                            min={0}
                        />
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-lg border border-secondary bg-secondary p-4">
                        <div>
                            <p className="text-sm font-semibold text-primary">Required</p>
                            <p className="text-xs text-tertiary">Make this attribute mandatory for listings.</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={formState.isRequired}
                            onChange={(event) => handleChange("isRequired", event.target.checked)}
                        />
                    </label>

                    {formState.type === "select" && (
                        <Input
                            label="Options"
                            placeholder="Comma-separated values, e.g. Option A, Option B, Option C"
                            value={optionsString}
                            onChange={handleOptionsChange}
                            isRequired
                            isInvalid={!!fieldErrors.options}
                            hint={fieldErrors.options || "Enter options separated by commas (max 50 options, 100 characters each)"}
                        />
                    )}
                </section>

                <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategoryId}/attributes`}>
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        size="sm"
                        type="submit"
                        isLoading={createAttributeMutation.isPending}
                        isDisabled={createAttributeMutation.isPending}
                    >
                        {createAttributeMutation.isPending ? "Saving..." : "Create attribute"}
                    </Button>
                </footer>
            </form>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}