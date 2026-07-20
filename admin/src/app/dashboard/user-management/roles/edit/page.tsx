"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { FormLayout, FormSection, FormActions, FormGrid } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";

export default function EditRolePage() {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "Administrator",
        key: "admin",
        description: "Full system access",
    });

    const { fieldErrors, clearError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        hasSubmitted.current = true;
        showAlert("Success", "Role updated successfully", "success");
        setTimeout(() => router.push("/dashboard/user-management/roles"), 1500);
    };

    return (
        <FormLayout breadcrumb="User management" title="Edit role">
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
                        />
                        <Input
                            label="Role key"
                            placeholder="e.g. admin"
                            value={formState.key}
                            onChange={(v) => handleChange("key", v)}
                            isRequired
                            isInvalid={!!fieldErrors.key}
                            hint={fieldErrors.key}
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
                    />
                </FormSection>

                <FormActions
                    cancelHref="/dashboard/user-management/roles"
                    submitLabel="Save changes"
                    isLoading={false}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
