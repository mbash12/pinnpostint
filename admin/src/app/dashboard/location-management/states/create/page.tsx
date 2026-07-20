"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreateState } from "@/hooks/use-locations";
import { stateValidationSchema } from "@/utils/validation";

export default function CreateStatePage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        code: "",
        isActive: true,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateState();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const stateData = {
                name: formState.name,
                code: formState.code,
                isActive: formState.isActive,
            };

            const result = await createMutation.mutateAsync(stateData);
            if (result?.success) {
                showAlert("State Created", "State has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/location-management/states"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create state. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Location Management" title="Create State">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="State Name"
                            placeholder="Enter state name"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                            maxLength={100}
                        />
                        <Input
                            label="State Code"
                            placeholder="Enter state code (e.g. MH for Maharashtra)"
                            value={formState.code}
                            onChange={(v) => handleChange("code", v.toUpperCase())}
                            isInvalid={!!fieldErrors.code}
                            hint={fieldErrors.code}
                            maxLength={5}
                        />
                    </FormGrid>
                </FormSection>

                <SettingsSection title="State settings" description="Configure visibility and other settings.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the state is active."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/location-management/states"
                    submitLabel="Create State"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}