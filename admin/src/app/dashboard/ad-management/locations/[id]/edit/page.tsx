"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLocation, useUpdateLocation } from "@/hooks/use-locations";
import { searchStates, searchCities, searchPostalCodes, useStates, useCities, usePostalCodes } from "@/hooks/use-location-hierarchy";
import { apiClient } from "@/lib/api-client";
import type { Location } from "@/lib/api-types";

export default function EditLocationPage() {
    const router = useRouter();
    const params = useParams();
    const locationId = params.id as string;
    const { data: locationResponse, isLoading } = useLocation(locationId);
    const location = (locationResponse?.data?.data || locationResponse?.data) as any;

    if (isLoading) return <LoadingState message="Loading location..." />;
    if (!location) return <ErrorState message="Location not found" />;

    return <EditLocationForm location={location} />;
}

function EditLocationForm({ location }: { location: Location }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        name: "",
        address: "",
        stateId: "",
        cityId: "",
        postalCodeId: "",
        latitude: "",
        longitude: "",
        isActive: true,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateLocation();

    // Enhanced search functions that can handle both searching and fetching individual records by ID
    const enhancedSearchStates = async (query: string) => {
        if (!query) {
            // If no query, return empty array or all states (depending on component behavior)
            return await searchStates("");
        }

        // Check if query looks like an ID (contains hyphens, which is typical for UUIDs)
        if (query.includes('-')) {
            // Treat as ID and fetch individual record
            try {
                const response = await apiClient.get(`/admin/granular-locations/states/${query}`, undefined, { skipLoading: true });
                return response.data ? [response.data] : [];
            } catch (error) {
                // Error fetching state by ID: error
                // If ID fetch fails, fall back to search
                return await searchStates(query);
            }
        } else {
            // Treat as search query
            return await searchStates(query);
        }
    };

    const enhancedSearchCities = async (query: string, stateId?: string) => {
        if (!query) {
            return await searchCities("", stateId);
        }

        // Check if query looks like an ID
        if (query.includes('-')) {
            try {
                const response = await apiClient.get(`/admin/granular-locations/cities/${query}`, undefined, { skipLoading: true });
                return response.data ? [response.data] : [];
            } catch (error) {
                // Error fetching city by ID: error
                return await searchCities(query, stateId);
            }
        } else {
            return await searchCities(query, stateId);
        }
    };

    const enhancedSearchPostalCodes = async (query: string, cityId?: string) => {
        if (!query) {
            return await searchPostalCodes("", cityId);
        }

        // Check if query looks like an ID
        if (query.includes('-')) {
            try {
                const response = await apiClient.get(`/admin/granular-locations/postal-codes/${query}`, undefined, { skipLoading: true });
                return response.data ? [response.data] : [];
            } catch (error) {
                // Error fetching postal code by ID: error
                return await searchPostalCodes(query, cityId);
            }
        } else {
            return await searchPostalCodes(query, cityId);
        }
    };

    useEffect(() => {
        if (location) {
            setFormState({
                name: location.name || "",
                address: location.address || "",
                stateId: location.stateId || (location.state ? location.state.id : "") || "",
                cityId: location.cityId || (location.city ? location.city.id : "") || "",
                postalCodeId: location.postalCodeId || (location.postalCode ? location.postalCode.id : "") || "",
                latitude: location.latitude?.toString() || "",
                longitude: location.longitude?.toString() || "",
                isActive: location.isActive ?? true,
            });
        }
    }, [location]);

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
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const data = {
                name: formState.name.trim(),
                address: formState.address.trim() || null,
                country: "India",
                stateId: formState.stateId || null,
                cityId: formState.cityId || null,
                postalCodeId: formState.postalCodeId || null,
                latitude: formState.latitude ? Number(formState.latitude) : null,
                longitude: formState.longitude ? Number(formState.longitude) : null,
                isActive: formState.isActive,
            };

            const result = await updateMutation.mutateAsync({ id: location.id, data });
            if (result?.success) {
                showAlert("Location Updated", "Location has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/ad-management/locations"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update location. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="Ad management" title="Edit Location">
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
                        />
                        <Input
                            label="Address"
                            placeholder="Street address"
                            value={formState.address}
                            onChange={(v) => handleChange("address", v)}
                            isInvalid={!!fieldErrors.address}
                            hint={fieldErrors.address}
                        />
                        <SearchableSelect
                            label="State"
                            placeholder="Search for a state..."
                            value={formState.stateId}
                            onSelectionChange={(v) => handleChange("stateId", v)}
                            searchFn={enhancedSearchStates}
                            displayKey="name"
                            valueKey="id"
                        />
                        <SearchableSelect
                            label="City"
                            placeholder="Search for a city..."
                            value={formState.cityId}
                            onSelectionChange={(v) => handleChange("cityId", v)}
                            searchFn={(q) => enhancedSearchCities(q, formState.stateId)}
                            displayKey="name"
                            valueKey="id"
                        />
                        <SearchableSelect
                            label="Postal Code"
                            placeholder="Search for a postal code..."
                            value={formState.postalCodeId}
                            onSelectionChange={(v) => handleChange("postalCodeId", v)}
                            searchFn={(q) => enhancedSearchPostalCodes(q, formState.cityId)}
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
                        />
                        <NumberInput
                            label="Longitude (optional)"
                            placeholder="e.g., -74.0060"
                            value={Number(formState.longitude) || 0}
                            onChange={(v) => handleChange("longitude", v.toString())}
                            isInvalid={!!fieldErrors.longitude}
                            hint={fieldErrors.longitude}
                        />
                    </FormGrid>
                </FormSection>

                <SettingsSection title="Location settings" description="Configure visibility for ad targeting.">
                    <ToggleField
                        label="Active"
                        description="Enable this location for ad posting"
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/ad-management/locations"
                    submitLabel="Update Location"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: location?.createdAt,
                        updatedAt: location?.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
