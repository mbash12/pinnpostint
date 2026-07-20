"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreateCity } from "@/hooks/use-locations";
import { searchStates } from "@/hooks/use-location-hierarchy";
import { cityValidationSchema } from "@/utils/validation";

export default function CreateCityPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        code: "",
        stateId: "",
        isActive: true,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateCity();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["name", "code"].includes(field)) {
            validateFieldValue(field, value, cityValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, cityValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        try {
            const cityData = {
                name: formState.name,
                code: formState.code,
                stateId: formState.stateId,
                isActive: formState.isActive,
            };

            const result = await createMutation.mutateAsync(cityData);
            if (result?.success) {
                showAlert("City Created", "City has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/location-management/cities"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create city. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Location Management" title="Create City">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="City Name"
                            placeholder="Enter city name"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                            maxLength={100}
                        />
                        <Input
                            label="City Code"
                            placeholder="Enter city code (e.g. MUM for Mumbai)"
                            value={formState.code}
                            onChange={(v) => handleChange("code", v.toUpperCase())}
                            isInvalid={!!fieldErrors.code}
                            hint={fieldErrors.code || "Unique code for this city (e.g., MUM, NYC)"}
                            maxLength={10}
                        />
                        <SearchableSelect
                            label="State"
                            placeholder="Search for a state..."
                            value={formState.stateId}
                            onSelectionChange={(v) => handleChange("stateId", v)}
                            searchFn={searchStates}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />
                    </FormGrid>
                </FormSection>

                <SettingsSection title="City settings" description="Configure visibility and other settings.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the city is active."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/location-management/cities"
                    submitLabel="Create City"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}