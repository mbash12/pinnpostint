"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { FormLayout, FormSection, FormActions, FormGrid, SettingsSection, ToggleField, LoadingState, ErrorState } from "@/components/forms";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useUser, useUpdateUser, useUpdateUserRole, useUpdateUserVerification } from "@/hooks/use-users";
import { searchStates, searchCities, searchPostalCodes } from "@/hooks/use-location-hierarchy";
import { userValidationSchema } from "@/utils/validation";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { apiClient } from "@/lib/api-client";

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

export default function EditUserPage() {
    const params = useParams<{ userId: string }>();
    const userId = params?.userId;
    const { data: apiResponse, isLoading } = useUser(userId);
    const user = apiResponse?.data as any;

    if (isLoading) return <LoadingState message="Loading user..." />;
    if (!user) return <ErrorState message="User not found" />;

    return <EditUserForm user={user} />;
}

function EditUserForm({ user }: { user: any }) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [formState, setFormState] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "USER",
        isVerified: false,
        bio: "",
        address: "",
        stateId: "",
        cityId: "",
        postalCodeId: "",
        dob: "",
        gender: "",
        emailNotifications: true,
        pushNotifications: true,
        avatar: "",
    });

    const { fieldErrors, clearError, handleApiError, validateFieldValue, validateFormData } = useFormErrors();
    const { showAlert, AlertComponent } = useFormAlert();
    const updateMutation = useUpdateUser();
    const updateVerificationMutation = useUpdateUserVerification();

    // Create validation schema without password for edit form
    const editValidationSchema = { ...userValidationSchema };
    delete editValidationSchema.password;

    useEffect(() => {
        setFormState({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
            phone: user.phone || "",
            role: user.role || "USER",
            isVerified: user.isVerified || false,
            bio: user.profile?.bio || "",
            address: user.profile?.address || "",
            stateId: user.profile?.stateId || "",
            cityId: user.profile?.cityId || "",
            postalCodeId: user.profile?.postalCodeId || "",
            dob: user.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : "",
            gender: user.profile?.gender ? user.profile.gender.toLowerCase() : "",
            emailNotifications: user.profile?.emailNotifications ?? true,
            pushNotifications: user.profile?.pushNotifications ?? true,
            avatar: user.avatar || "",
        });
    }, [user]);

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
        if (["firstName", "email", "phone"].includes(field)) {
            validateFieldValue(field, value, editValidationSchema);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        // Validate entire form before submission
        const isValid = validateFormData(formState, editValidationSchema);
        if (!isValid) {
            showAlert("Validation Error", "Please correct the errors in the form.", "error");
            return;
        }

        try {
            hasSubmitted.current = true;

            const userData = {
                firstName: formState.firstName,
                lastName: formState.lastName,
                email: formState.email,
                role: formState.role,
                phone: formState.phone || null,
                avatar: formState.avatar || null,
                profile: {
                    bio: formState.bio || null,
                    address: formState.address || null,
                    country: "India",
                    stateId: formState.stateId || null,
                    cityId: formState.cityId || null,
                    postalCodeId: formState.postalCodeId || null,
                    dob: formState.dob || null,
                    gender: formState.gender || null,
                    emailNotifications: formState.emailNotifications,
                    pushNotifications: formState.pushNotifications,
                },
            };

            const result = await updateMutation.mutateAsync({ id: user.id, data: userData });

            if (result?.success) {
                // Update verification status separately
                if (user.isVerified !== formState.isVerified) {
                    await updateVerificationMutation.mutateAsync({
                        id: user.id,
                        isVerified: formState.isVerified
                    });
                }

                showAlert("User Updated", "User has been successfully updated.", "success");
                setTimeout(() => router.push("/dashboard/user-management/users"), 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;
            const errors = handleApiError(error);
            if (errors) {
                showAlert("Validation Error", "Please check the form fields and correct the errors.", "error");
            } else {
                showAlert("Update Failed", error?.message || "Failed to update user. Please try again.", "error");
            }
        }
    };

    return (
        <FormLayout breadcrumb="User management" title="Edit user">
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
                        />
                        <SearchableSelect
                            label="State"
                            placeholder="Search for a state..."
                            value={formState.stateId}
                            onSelectionChange={(v) => handleChange("stateId", v)}
                            searchFn={searchStates}
                            displayKey="name"
                            valueKey="id"
                            fetchByIdFn={async (id) => {
                                const response = await apiClient.get(`/admin/granular-locations/states/${id}`, {}, { skipLoading: true });
                                if (response.success && response.data) {
                                    return response.data;
                                }
                                throw new Error('State not found');
                            }}
                        />
                        <SearchableSelect
                            label="City"
                            placeholder="Search for a city..."
                            value={formState.cityId}
                            onSelectionChange={(v) => handleChange("cityId", v)}
                            searchFn={(q) => searchCities(q, formState.stateId)}
                            displayKey="name"
                            valueKey="id"
                            fetchByIdFn={async (id) => {
                                const response = await apiClient.get(`/admin/granular-locations/cities/${id}`, {}, { skipLoading: true });
                                if (response.success && response.data) {
                                    return response.data;
                                }
                                throw new Error('City not found');
                            }}
                        />
                        <SearchableSelect
                            label="Postal Code"
                            placeholder="Search for a postal code..."
                            value={formState.postalCodeId}
                            onSelectionChange={(v) => handleChange("postalCodeId", v)}
                            searchFn={(q) => searchPostalCodes(q, formState.cityId)}
                            displayKey="code"
                            valueKey="id"
                            fetchByIdFn={async (id) => {
                                const response = await apiClient.get(`/admin/granular-locations/postal-codes/${id}`, {}, { skipLoading: true });
                                if (response.success && response.data) {
                                    return response.data;
                                }
                                throw new Error('Postal code not found');
                            }}
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
                    submitLabel="Save changes"
                    isLoading={updateMutation.isPending}
                    metadata={{
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                    }}
                />
            </form>
            <AlertComponent />
        </FormLayout>
    );
}
