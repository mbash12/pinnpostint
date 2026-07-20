"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useUpdateState } from "@/hooks/use-locations";
import { apiClient } from "@/lib/api-client";
import { State } from "@/lib/api-types";
import { useParams } from "next/navigation";

export default function EditStatePage() {
    const router = useRouter();
    const { id } = useParams();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        code: "",
        isActive: true,
    });

    const [stateData, setStateData] = useState<{ data?: State } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateState();

    useEffect(() => {
        const fetchState = async () => {
            try {
                const response = await apiClient.get<{ data: State }>(`/admin/granular-locations/states/${id}`);
                setStateData(response.data ? { data: response.data.data } : null);
                if (response.data?.data) {
                    setFormState({
                        name: response.data.data.name || "",
                        code: response.data.data.code || "",
                        isActive: response.data.data.isActive,
                    });
                }
            } catch (error) {
                // Error fetching state: error
                setStateData(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchState();
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

            const stateDataToUpdate = {
                name: formState.name,
                code: formState.code,
                isActive: formState.isActive,
            };

            const result = await updateMutation.mutateAsync({ id: id as string, data: stateDataToUpdate });
            if (result?.success) {
                showAlert("State Updated", "State has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/location-management/states"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update state. Please try again.", "error");
            }
        }
    };

    if (isLoading) {
        return (
            <FormLayout breadcrumb="Location Management" title="Edit State">
                <div className="flex justify-center items-center h-64">
                    <p>Loading...</p>
                </div>
            </FormLayout>
        );
    }

    return (
        <FormLayout breadcrumb="Location Management" title="Edit State">
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
                        />
                        <Input
                            label="State Code"
                            placeholder="Enter state code (e.g. MH for Maharashtra)"
                            value={formState.code}
                            onChange={(v) => handleChange("code", v.toUpperCase())}
                            isInvalid={!!fieldErrors.code}
                            hint={fieldErrors.code}
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: stateData?.data?.createdAt,
                        updatedAt: stateData?.data?.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}