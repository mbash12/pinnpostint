"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useUpdateCity } from "@/hooks/use-locations";
import { searchStates } from "@/hooks/use-location-hierarchy";
import { apiClient } from "@/lib/api-client";
import { City } from "@/lib/api-types";
import { useParams } from "next/navigation";

export default function EditCityPage() {
    const router = useRouter();
    const { id } = useParams();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        code: "",
        stateId: "",
        isActive: true,
    });

    const [cityData, setCityData] = useState<{ data?: City } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStateName, setSelectedStateName] = useState<string>("");
    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateCity();

    useEffect(() => {
        const fetchCity = async () => {
            try {
                const response = await apiClient.get<{ data: City }>(`/admin/granular-locations/cities/${id}`);
                setCityData(response.data ? { data: response.data.data } : null);
                if (response.data?.data) {
                    const newFormState = {
                        name: response.data.data.name || "",
                        code: response.data.data.code || "",
                        stateId: response.data.data.stateId || "",
                        isActive: response.data.data.isActive,
                    };

                    setFormState(newFormState);

                    // Also fetch the state name to ensure it's displayed
                    if (response.data?.data.stateId) {
                        const stateResponse = await apiClient.get<{ data: any }>(`/admin/granular-locations/states/${response.data.data.stateId}`);
                        if (stateResponse.data?.data) {
                            setSelectedStateName(stateResponse.data.data.name || "");
                        }
                    }
                }
            } catch (error) {
                // Error fetching city: error
                setCityData(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchCity();
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

            const cityDataToUpdate = {
                name: formState.name,
                code: formState.code,
                stateId: formState.stateId,
                isActive: formState.isActive,
            };

            const result = await updateMutation.mutateAsync({ id: id as string, data: cityDataToUpdate });
            if (result?.success) {
                showAlert("City Updated", "City has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/location-management/cities"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update city. Please try again.", "error");
            }
        }
    };

    if (isLoading) {
        return (
            <FormLayout breadcrumb="Location Management" title="Edit City">
                <div className="flex justify-center items-center h-64">
                    <p>Loading...</p>
                </div>
            </FormLayout>
        );
    }

    return (
        <FormLayout breadcrumb="Location Management" title="Edit City">
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
                        />
                        <Input
                            label="City Code"
                            placeholder="Enter city code (e.g. MUM for Mumbai)"
                            value={formState.code}
                            onChange={(v) => handleChange("code", v.toUpperCase())}
                            isInvalid={!!fieldErrors.code}
                            hint={fieldErrors.code}
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
                            selectedDisplayValue={selectedStateName}
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: cityData?.data?.createdAt,
                        updatedAt: cityData?.data?.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}