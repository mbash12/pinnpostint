"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { NumberInput } from "@/components/base/number-input/number-input";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { usePlatformAd, useUpdatePlatformAd } from "@/hooks/use-platform-ads";
import { PlatformAdPosition, PlatformAd } from "@/lib/api-types";
import { LoadingState } from "@/components/forms/loading-state";
import { ErrorState } from "@/components/forms/error-state";

const positionOptions = [
    { id: "LEFT", label: "Left Sidebar" },
    { id: "RIGHT", label: "Right Sidebar" },
    { id: "TOP", label: "Top Banner" },
    { id: "BOTTOM", label: "Bottom Banner" },
    { id: "POPUP", label: "Popup Ad" },
];

export default function EditPlatformAdPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: adResponse, isLoading, isError, error } = usePlatformAd(id);
    const updateMutation = useUpdatePlatformAd();
    
    const [formState, setFormState] = useState({
        title: "",
        imageUrl: "",
        linkUrl: "",
        position: "LEFT" as PlatformAdPosition,
        isActive: true,
        order: 0,
    });

    const { fieldErrors, clearError, handleApiError } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();

    useEffect(() => {
        if (adResponse?.success && adResponse.data) {
            const ad = adResponse.data;
            setFormState({
                title: ad.title || "",
                imageUrl: ad.imageUrl || "",
                linkUrl: ad.linkUrl || "",
                position: ad.position,
                isActive: ad.isActive,
                order: ad.order,
            });
        }
    }, [adResponse]);

    const handleChange = (field: string, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
        clearError(field);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formState.imageUrl) {
            showAlert("Validation Error", "Please upload an ad image.", "error");
            return;
        }
        
        try {
            const result = await updateMutation.mutateAsync({ 
                id, 
                data: formState 
            });
            
            if (result?.success) {
                showAlert("Ad Updated", "Platform ad has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/platform-ads"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update ad. Please try again.", "error");
            }
        }
    };

    if (isLoading) return <LoadingState />;
    if (isError) return <ErrorState message={error?.message || "Failed to load ad"} />;

    return (
        <FormLayout 
            breadcrumb="Ad management" 
            title="Edit platform ad"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="Title (Admin only)"
                            placeholder="e.g. Left Sidebar Banner 1"
                            value={formState.title}
                            onChange={(v) => handleChange("title", v)}
                            isRequired
                            isInvalid={!!fieldErrors.title}
                            hint={fieldErrors.title}
                        />
                        <Select
                            label="Position"
                            selectedKey={formState.position}
                            onSelectionChange={(key) => handleChange("position", key)}
                            items={positionOptions}
                            isRequired
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </FormGrid>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="max-w-md">
                            <ImageUpload
                                value={formState.imageUrl}
                                onChange={(url) => handleChange("imageUrl", url)}
                                onRemove={() => handleChange("imageUrl", "")}
                                label="Ad image"
                                hint="Upload a portrait poster (recommended: 200x600px)"
                                isRequired
                                isInvalid={!!fieldErrors.imageUrl}
                            />
                        </div>
                        <div className="space-y-4">
                            <Input
                                label="Link URL (Optional)"
                                placeholder="https://example.com/target-page"
                                value={formState.linkUrl}
                                onChange={(v) => handleChange("linkUrl", v)}
                                isInvalid={!!fieldErrors.linkUrl}
                                hint={fieldErrors.linkUrl}
                            />
                            <NumberInput
                                label="Display Order"
                                placeholder="0"
                                value={formState.order}
                                onChange={(v) => handleChange("order", v)}
                                hint="Order in which ads appear (0 = first)"
                                isInvalid={!!fieldErrors.order}
                                min={0}
                            />
                        </div>
                    </div>
                </FormSection>

                <SettingsSection title="Ad settings" description="Configure visibility.">
                    <ToggleField
                        label="Active"
                        description="Toggle to control if the ad is shown to users."
                        checked={formState.isActive}
                        onChange={(v) => handleChange("isActive", v)}
                    />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/platform-ads"
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
