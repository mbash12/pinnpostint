"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useUpdatePostalCode } from "@/hooks/use-locations";
import { searchCities } from "@/hooks/use-location-hierarchy";
import { apiClient } from "@/lib/api-client";
import { PostalCode } from "@/lib/api-types";
import { useParams } from "next/navigation";

export default function EditPostalCodePage() {
    const router = useRouter();
    const { id } = useParams();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        code: "",
        cityId: "",
        isActive: true,
    });

    const [postalCodeData, setPostalCodeData] = useState<{ data?: PostalCode } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCityName, setSelectedCityName] = useState<string>("");
    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdatePostalCode();

    useEffect(() => {
        const fetchPostalCodeAndCity = async () => {
            try {
                // Fetch the postal code data
                const response = await apiClient.get<{ data: PostalCode }>(`/admin/granular-locations/postal-codes/${id}`);
                setPostalCodeData(response.data ? { data: response.data.data } : null);

                if (response.data?.data) {
                    const newFormState = {
                        code: response.data.data.code || "",
                        cityId: response.data.data.cityId || "",
                        isActive: response.data.data.isActive,
                    };

                    setFormState(newFormState);

                    // Also fetch the city name to ensure it's displayed
                    if (response.data?.data.cityId) {
                        const cityResponse = await apiClient.get<{ data: any }>(`/admin/granular-locations/cities/${response.data.data.cityId}`);
                        if (cityResponse.data?.data) {
                            setSelectedCityName(cityResponse.data.data.name || "");
                        }
                    }
                }
            } catch (error) {
                // Error fetching postal code: error
                setPostalCodeData(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchPostalCodeAndCity();
        }
    }, [id]);

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const postalCodeDataToUpdate = {
                code: formState.code,
                cityId: formState.cityId,
                isActive: formState.isActive,
            };

            const result = await updateMutation.mutateAsync({ id: id as string, data: postalCodeDataToUpdate });
            if (result?.success) {
                showAlert("Postal Code Updated", "Postal code has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/location-management/postal-codes"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update postal code. Please try again.", "error");
            }
        }
    };

    if (isLoading) {
        return (
            <FormLayout breadcrumb="Location Management" title="Edit Postal Code">
                <div className="flex justify-center items-center h-64">
                    <p>Loading...</p>
                </div>
            </FormLayout>
        );
    }

    return (
        <FormLayout breadcrumb="Location Management" title="Edit Postal Code">
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
                            selectedDisplayValue={selectedCityName}
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: postalCodeData?.data?.createdAt,
                        updatedAt: postalCodeData?.data?.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}