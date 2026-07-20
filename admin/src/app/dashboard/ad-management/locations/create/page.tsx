"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreateLocation } from "@/hooks/use-locations";
import { searchStates, searchCities, searchPostalCodes } from "@/hooks/use-location-hierarchy";
import { locationValidationSchema } from "@/utils/validation";

export default function CreateLocationPage() {
    const router = useRouter();
    const [formState, setFormState] = useState({
        name: "",
        address: "",
        stateId: "",
        cityId: "",
        postalCodeId: "",
        latitude: "",
        longitude: "",
        active: true,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateLocation();

    const handleChange = (field: string, value: any) => {
        setFormState(prev => {
            const newState = { ...prev, [field]: value };
            // Reset dependent fields when parent changes
            if (field === "stateId") {
                newState.cityId = "";
                newState.postalCodeId = "";
            } else if (field === "cityId") {
                newState.postalCodeId = "";
            }
            return newState;
        });
        clearError(field);
        
        // Real-time validation for critical fields
        if (["name", "address", "latitude", "longitude"].includes(field)) {
            validateFieldValue(field, value, locationValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate entire form before submission
        const isValid = validateFormData(formState, locationValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct the errors in the form.", "error");
            return;
        }
        
        try {
            const data = {
                name: formState.name.trim(),
                address: formState.address.trim() || undefined,
                country: "India",
                stateId: formState.stateId || undefined,
                cityId: formState.cityId || undefined,
                postalCodeId: formState.postalCodeId || undefined,
                latitude: formState.latitude ? Number(formState.latitude) : 0,
                longitude: formState.longitude ? Number(formState.longitude) : 0,
                isActive: formState.active,
            };

            const result = await createMutation.mutateAsync(data);
            if (result?.success) {
                showAlert("Location Created", "Location has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/ad-management/locations"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create location. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Ad management" title="Create Location">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Location name"
                            placeholder="e.g., Downtown Mumbai"
                            value={formState.name}
                            onChange={(v) => handleChange("name", v)}
                            isRequired
                            isInvalid={!!fieldErrors.name}
                            hint={fieldErrors.name}
                            maxLength={100}
                        />
                        <Input
                            label="Address"
                            placeholder="Street address"
                            value={formState.address}
                            onChange={(v) => handleChange("address", v)}
                            isInvalid={!!fieldErrors.address}
                            hint={fieldErrors.address}
                            maxLength={250}
                        />
                        <SearchableSelect
                            label="State"
                            placeholder="Search for a state..."
                            value={formState.stateId}
                            onSelectionChange={(v) => handleChange("stateId", v)}
                            searchFn={searchStates}
                            displayKey="name"
                            valueKey="id"
                        />
                        <SearchableSelect
                            label="City"
                            placeholder="Search for a city..."
                            value={formState.cityId}
                            onSelectionChange={(v) => handleChange("cityId", v)}
                            searchFn={(q) => searchCities(q, formState.stateId)}
                            displayKey="name"
                            valueKey="id"
                        />
                        <SearchableSelect
                            label="Postal Code"
                            placeholder="Search for a postal code..."
                            value={formState.postalCodeId}
                            onSelectionChange={(v) => handleChange("postalCodeId", v)}
                            searchFn={(q) => searchPostalCodes(q, formState.cityId)}
                            displayKey="code"
                            valueKey="id"
                        />
                        <NumberInput
                            label="Latitude (optional)"
                            placeholder="e.g., 40.7128"
                            value={Number(formState.latitude) || 0}
                            onChange={(v) => handleChange("latitude", v.toString())}
                            isInvalid={!!fieldErrors.latitude}
                            hint={fieldErrors.latitude}
                            min={-90}
                            max={90}
                            decimalScale={6}
                        />
                        <NumberInput
                            label="Longitude (optional)"
                            placeholder="e.g., -74.0060"
                            value={Number(formState.longitude) || 0}
                            onChange={(v) => handleChange("longitude", v.toString())}
                            isInvalid={!!fieldErrors.longitude}
                            hint={fieldErrors.longitude}
                            min={-180}
                            max={180}
                            decimalScale={6}
                        />
                    </FormGrid>
                </FormSection>

                <SettingsSection title="Location settings" description="Configure visibility for ad targeting.">
                    <ToggleField
                        label="Active"
                        description="Enable this location for ad posting"
                        checked={formState.active}
                        onChange={(v) => handleChange("active", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/ad-management/locations"
                    submitLabel="Create Location"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
