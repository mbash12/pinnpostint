"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import {
    useAttribute,
    useUpdateAttribute,
    useUploadAttributeImage,
    useSubcategory,
    useCategory
} from "@/hooks/use-categories";
import { UpdateAttributeRequest, AttributeType } from "@/lib/api-types";

const attributeTypes = [
    { id: "text", label: "Text" },
    { id: "number", label: "Number" },
    { id: "boolean", label: "Boolean" },
    { id: "select", label: "Select" },
    { id: "textarea", label: "Textarea" },
    { id: "date", label: "Date" },
];

function EditAttributePage({
    attribute,
    subcategory,
    category
}: {
    attribute: any;
    subcategory: any;
    category: any;
}) {
    const router = useRouter();
    const hasSubmitted = useRef(false);

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

    const updateAttributeMutation = useUpdateAttribute();
    const uploadImageMutation = useUploadAttributeImage();

    // Initialize form with attribute data
    useEffect(() => {
        setFormState({
            name: attribute.name || "",
            type: attribute.type || "text",
            isRequired: attribute.isRequired || false,
            options: attribute.options || [],
            order: attribute.order ?? 0,
        });
    }, [attribute]);

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
    };


    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const updateData: UpdateAttributeRequest = {
                name: formState.name,
                type: formState.type,
                isRequired: formState.isRequired,
                order: formState.order,
                options: formState.options.length > 0 ? formState.options : null,
            };

            const result = await updateAttributeMutation.mutateAsync({
                id: attribute.id,
                data: updateData
            });

            if (result?.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Attribute Updated",
                    description: "Attribute has been successfully updated.",
                    type: "success",
                });

                // Redirect after short delay
                setTimeout(() => {
                    router.push(`/dashboard/ad-management/categories/${category.id}/subcategories/${subcategory.id}/attributes`);
                }, 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }

        } catch (error: any) {
            hasSubmitted.current = false;
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
                    title: "Update Failed",
                    description: error?.message || "Failed to update attribute. Please try again.",
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
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Edit attribute</h1>
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
                        <Input
                            label="Order"
                            type="number"
                            placeholder="0"
                            value={formState.order.toString()}
                            onChange={(value) => handleChange("order", parseInt(value) || 0)}
                            hint="Order in which attributes appear (0 = first)"
                            isInvalid={!!fieldErrors.order}
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
                            hint={fieldErrors.options || "Enter options separated by commas"}
                        />
                    )}
                </section>

                <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <div className="text-xs text-tertiary">
                        <p>Created: {new Date(attribute.createdAt).toLocaleDateString()}</p>
                        <p>Last updated: {new Date(attribute.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${category.id}/subcategories/${subcategory.id}/attributes`}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            size="sm"
                            type="submit"
                            isLoading={updateAttributeMutation.isPending}
                            isDisabled={updateAttributeMutation.isPending}
                        >
                            {updateAttributeMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                    </div>
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

// Loading and error states
function LoadingState() {
    return (
        <div className="flex items-center justify-center min-h-96">
            <div className="text-primary">Loading attribute...</div>
        </div>
    );
}

function ErrorState() {
    return (
        <div className="flex items-center justify-center min-h-96">
            <div className="text-error">Attribute not found</div>
        </div>
    );
}

// Main component wrapper
export default function EditAttributePageWrapper() {
    const params = useParams<{
        id: string;
        subcategoryId: string;
        attributeId: string
    }>();
    const categoryId = params?.id;
    const subcategoryId = params?.subcategoryId;
    const attributeId = params?.attributeId;

    const { data: attributeResponse, isLoading: isLoadingAttribute } = useAttribute(attributeId || '');
    const { data: subcategoryResponse } = useSubcategory(subcategoryId || '');
    const { data: categoryResponse } = useCategory(categoryId || '');

    // Handle both direct data and nested data structures
    const attribute = (attributeResponse?.data || attributeResponse);
    const subcategory = (subcategoryResponse?.data || subcategoryResponse);
    const category = (categoryResponse?.data || categoryResponse);

    if (isLoadingAttribute) {
        return <LoadingState />;
    }

    if (!attribute || !subcategory || !category) {
        return <ErrorState />;
    }

    return (
        <EditAttributePage
            attribute={attribute}
            subcategory={subcategory}
            category={category}
        />
    );
}