"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useCreateUser, useUpdateUserVerification } from "@/hooks/use-users";
import { searchStates, searchCities, searchPostalCodes } from "@/hooks/use-location-hierarchy";
import { userValidationSchema } from "@/utils/validation";
import { ImageUpload } from "@/components/base/image-upload/image-upload";

const roleOptions = [
    { id: "ADMIN", label: "Administrator" },
    { id: "USER", label: "Standard user" },
];

const genderOptions = [
    { id: "male", label: "Male" },
    { id: "female", label: "Female" },
    { id: "other", label: "Other" },
    { id: "", label: "Prefer not to say" },
];

export default function CreateUserPage() {
    const router = useRouter();
    const [formState, setFormState] = useState<{
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        role: "ADMIN" | "USER";
        isVerified: boolean;
        password: string;
        bio: string;
        address: string;
        stateId: string;
        cityId: string;
        postalCodeId: string;
        dob: string;
        gender: string;
        emailNotifications: boolean;
        pushNotifications: boolean;
        avatar?: string;
    }>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "USER",
        isVerified: false,
        password: "",
        bio: "",
        address: "",
        stateId: "",
        cityId: "",
        postalCodeId: "",
        dob: "",
        gender: "",
        emailNotifications: true,
        pushNotifications: true,
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const createMutation = useCreateUser();
    const updateVerificationMutation = useUpdateUserVerification();

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
        if (["firstName", "email", "password", "phone"].includes(field)) {
            validateFieldValue(field, value, userValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate entire form before submission
        const isValid = validateFormData(formState, userValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct the errors in the form.", "error");
            return;
        }

        try {

            const userData = {
                firstName: formState.firstName,
                lastName: formState.lastName,
                email: formState.email,
                password: formState.password,
                role: formState.role,
                isVerified: formState.isVerified,
                ...(formState.phone && { phone: formState.phone }),
                ...(formState.avatar && { avatar: formState.avatar }),
                profile: {
                    ...(formState.bio && { bio: formState.bio }),
                    ...(formState.address && { address: formState.address }),
                    country: "India",
                    ...(formState.stateId && { stateId: formState.stateId }),
                    ...(formState.cityId && { cityId: formState.cityId }),
                    ...(formState.postalCodeId && { postalCodeId: formState.postalCodeId }),
                    ...(formState.dob && { dob: formState.dob }),
                    ...(formState.gender && { gender: formState.gender }),
                    emailNotifications: formState.emailNotifications,
                    pushNotifications: formState.pushNotifications,
                },
            };

            const result = await createMutation.mutateAsync(userData);

            if (result?.success) {
                // If the user was created as verified, update the verification status
                if (formState.isVerified && result.data?.id) {
                    await updateVerificationMutation.mutateAsync({
                        id: result.data.id,
                        isVerified: formState.isVerified
                    });
                }

                showAlert("User Created", "User has been successfully created.", "success");
                setTimeout(() => router.push("/dashboard/user-management/users"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Create failed');
            }
        } catch (error: any) {
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Create Failed", error?.message || "Failed to create user. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="User management" title="Create user">
            <form onSubmit={handleSubmit} className="space-y-6">
                <FormSection>
                    <FormGrid cols={2}>
                        <Input
                            label="First name"
                            type="text"
                            placeholder="First name"
                            value={formState.firstName}
                            onChange={(v) => handleChange("firstName", v.replace(/[^a-zA-Z\s'-]/g, ''))}
                            isRequired
                            isInvalid={!!fieldErrors.firstName}
                            hint={fieldErrors.firstName}
                            autoComplete="given-name"
                            maxLength={50}
                        />
                        <Input
                            label="Last name"
                            type="text"
                            placeholder="Last name"
                            value={formState.lastName}
                            onChange={(v) => handleChange("lastName", v.replace(/[^a-zA-Z\s'-]/g, ''))}
                            isInvalid={!!fieldErrors.lastName}
                            hint={fieldErrors.lastName}
                            autoComplete="family-name"
                            maxLength={50}
                        />
                        <Input
                            label="Email"
                            type="email"
                            placeholder="user@example.com"
                            value={formState.email}
                            onChange={(v) => handleChange("email", v)}
                            isRequired
                            isInvalid={!!fieldErrors.email}
                            hint={fieldErrors.email}
                            autoComplete="email"
                        />
                        <Input
                            label="Phone"
                            type="tel"
                            placeholder="e.g. +62 812-3456-7890"
                            value={formState.phone}
                            onChange={(v) => handleChange("phone", v.replace(/[^\d\s\-\+\(\)]/g, ''))}
                            isInvalid={!!fieldErrors.phone}
                            hint={fieldErrors.phone}
                            autoComplete="tel"
                            maxLength={20}
                        />
                        <Input
                            label="Password"
                            type="password"
                            placeholder="Minimum 6 alphanumeric characters"
                            value={formState.password}
                            onChange={(v) => handleChange("password", v)}
                            isRequired
                            isInvalid={!!fieldErrors.password}
                            hint={fieldErrors.password}
                            autoComplete="new-password"
                        />
                        <Select
                            label="Role"
                            placeholder="Select role"
                            selectedKey={formState.role}
                            onSelectionChange={(key) => handleChange("role", key)}
                            items={roleOptions}
                            isRequired
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <ToggleField
                            label="Verified"
                            description="Indicates if the user has been verified"
                            checked={formState.isVerified}
                            onChange={(v) => handleChange("isVerified", v)}
                        />
                    </FormGrid>

                    <TextArea
                        label="Bio"
                        placeholder="Short introduction about the user (max 500 characters)"
                        value={formState.bio}
                        onChange={(v) => handleChange("bio", v)}
                        rows={4}
                        isInvalid={!!fieldErrors.bio}
                        hint={fieldErrors.bio}
                        maxLength={500}
                    />

                    <div className="max-w-md">
                        <ImageUpload
                            value={formState.avatar}
                            onChange={(url) => handleChange("avatar", url)}
                            onRemove={() => handleChange("avatar", "")}
                            label="Avatar upload"
                            hint={fieldErrors.avatar || "Upload a profile picture (recommended: 400x400px, max 5MB)"}
                            isInvalid={!!fieldErrors.avatar}
                        />
                    </div>
                </FormSection>

                <FormSection title="Profile details" description="Optional information from the Profile model to personalize the user account.">
                    <FormGrid cols={2}>
                        <Input
                            label="Address"
                            type="text"
                            placeholder="Street address"
                            value={formState.address}
                            onChange={(v) => handleChange("address", v)}
                            isInvalid={!!fieldErrors.address}
                            hint={fieldErrors.address}
                            autoComplete="street-address"
                            maxLength={200}
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
                        <Input
                            label="Date of birth"
                            type="date"
                            value={formState.dob}
                            onChange={(v) => handleChange("dob", v)}
                            isInvalid={!!fieldErrors.dob}
                            hint={fieldErrors.dob}
                        />
                        <Select
                            label="Gender"
                            placeholder="Select gender"
                            selectedKey={formState.gender}
                            onSelectionChange={(key) => handleChange("gender", key)}
                            items={genderOptions}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </FormGrid>
                </FormSection>

                <SettingsSection title="Notification preferences" description="Toggle communication channels derived from the Profile notification fields.">
                    <ToggleField label="Email notifications" description="Receive updates via email" checked={formState.emailNotifications} onChange={(v) => handleChange("emailNotifications", v)} />
                    <ToggleField label="Push notifications" description="Receive push notifications" checked={formState.pushNotifications} onChange={(v) => handleChange("pushNotifications", v)} />
                </SettingsSection>

                <FormActions
                    cancelHref="/dashboard/user-management/users"
                    submitLabel="Create user"
                    isLoading={createMutation.isPending}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
