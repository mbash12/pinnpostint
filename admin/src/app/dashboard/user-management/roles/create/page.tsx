"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { roleValidationSchema } from "@/utils/validation";

export default function CreateRolePage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        key: "",
        description: "",
    });

    const { fieldErrors, clearError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["name", "key"].includes(field)) {
            validateFieldValue(field, value, roleValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, roleValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        showAlert("Success", "Role created successfully", "success");
        setTimeout(() => router.push("/dashboard/user-management/roles"), 1500);
    };

    return (
        <FormLayout breadcrumb="User management" title="Create role">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Role name"
                            placeholder="Enter role name"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                            maxLength={50}
                        />
                        <Input
                            label="Role key"
                            placeholder="e.g. admin"
                            value={formState.key}
                            onChange={(v) => handleChange("key", v.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            isRequired
                            isInvalid={!!fieldErrors.key}
                            hint={fieldErrors.key || "Used in code. Lowercase letters, numbers, and underscores only."}
                            maxLength={50}
                        />
                    </FormGrid>

                    <TextArea
                        label="Role description"
                        placeholder="Write a short summary about this role"
                        value={formState.description}
                        onChange={(v) => handleChange("description", v)}
                        rows={4}
                        isInvalid={!!fieldErrors.description}
                        hint={fieldErrors.description}
                        maxLength={500}
                    />
                </FormSection>

                <FormActions
                    cancelHref="/dashboard/user-management/roles"
                    submitLabel="Create role"
                    isLoading={false}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
