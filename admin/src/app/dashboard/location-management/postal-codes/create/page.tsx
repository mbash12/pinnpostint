"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreatePostalCode } from "@/hooks/use-locations";
import { searchCities } from "@/hooks/use-location-hierarchy";
import { postalCodeValidationSchema } from "@/utils/validation";

export default function CreatePostalCodePage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        code: "",
        cityId: "",
        isActive: true,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreatePostalCode();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);

        // Real-time validation for critical fields
        if (["code"].includes(field)) {
            validateFieldValue(field, value, postalCodeValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, postalCodeValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct errors in the form.", "error");
            return;
        }

        try {
            const postalCodeData = {
                code: formState.code,
                cityId: formState.cityId,
                isActive: formState.isActive,
            };

            const result = await createMutation.mutateAsync(postalCodeData);
            if (result?.success) {
                showAlert("Postal Code Created", "Postal code has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/location-management/postal-codes"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create postal code. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Location Management" title="Create Postal Code">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Postal Code"
                            placeholder="Enter postal code"
                            value={formState.code}
                            onChange={(v) => handleChange("code", v)}
                            isRequired
                            isInvalid={!!fieldErrors.code}
                            hint={fieldErrors.code}
                            maxLength={10}
                        />
                        <SearchableSelect
                            label="City"
                            placeholder="Search for a city..."
                            value={formState.cityId}
                            onSelectionChange={(v) => handleChange("cityId", v)}
                            searchFn={searchCities}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />
                    </FormGrid>
                </FormSection>

                <SettingsSection title="Postal code settings" description="Configure visibility and other settings.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the postal code is active."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/location-management/postal-codes"
                    submitLabel="Create Postal Code"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}