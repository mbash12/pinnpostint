"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { TextArea } from "@/components/base/textarea/textarea";
import { MultipleImageUpload } from "@/components/base/multiple-image-upload/multiple-image-upload";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useAttributes } from "@/hooks/use-categories";
import { DynamicLocationPicker, type AdLocation } from "@/components/shared/dynamic-location-picker";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse, CreateAdRequest } from "@/lib/api-types";
import { adValidationSchema, validateField } from "@/utils/validation";

type AdFormState = {
    title: string;
    description: string;
    price: string;
    discountedPrice: string;
    userId: string;
    images: string[];
    location?: AdLocation;
    categoryId: string;
    categoryName?: string;
    subcategoryId: string;
    subcategoryName?: string;
};

export default function CreateAdPage() {
    const router = useRouter();

    const [formState, setFormState] = useState<AdFormState>({
        title: "",
        description: "",
        price: "",
        discountedPrice: "",
        userId: "", // Don't default to current user ID since we're showing all users
        images: [],
        categoryId: "",
        subcategoryId: "",
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const [isPending, setIsPending] = useState(false);

    // Search functions for API-based dropdowns
    const searchUsers = async (query: string) => {
        const response = await apiClient.get<any>('/admin/users', {
            search: query,
            limit: 20,
            // Include both regular users and admins in the search
        }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const searchLocations = async (query: string) => {
        const response = await apiClient.get<any>('/admin/locations', { search: query, limit: 20, isActive: 'true' }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/categories/for-ad-creation', { search: query, limit: 20 }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const searchSubcategories = async (query: string) => {
        if (!formState.categoryId) return [];
        const response = await apiClient.get<any>(`/admin/categories/${formState.categoryId}/subcategories`, { search: query, limit: 20 }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const handleCategoryChange = async (categoryId: string) => {
        // Find category name from the API to check for job category
        try {
            const response = await apiClient.get<any>(`/admin/categories/${categoryId}`);
            const categoryName = response.data?.name || "";
            
            setFormState(prev => ({
                ...prev,
                categoryId,
                categoryName,
                subcategoryId: "", // Reset subcategory when category changes
                subcategoryName: "",
            }));
        } catch (error) {
            handleChange("categoryId", categoryId);
            handleChange("subcategoryId", "");
        }
    };

    const handleSubcategoryChange = async (subcategoryId: string) => {
        try {
            const response = await apiClient.get<any>(`/admin/categories/subcategories/${subcategoryId}`);
            const subcategoryName = response.data?.name || "";
            
            setFormState(prev => ({
                ...prev,
                subcategoryId,
                subcategoryName,
            }));
        } catch (error) {
            handleChange("subcategoryId", subcategoryId);
        }
    };

    // State for attribute values
    const [attributeValues, setAttributeValues] = useState<Record<string, string | boolean>>({});

    // Fetch attributes only when subcategoryId is available
    const { data: attributesData } = useAttributes(formState.subcategoryId);
    const attributes = Array.isArray(attributesData?.data) ? attributesData.data : (attributesData?.data?.data || []);

    const handleChange = (field: keyof AdFormState | "location", value: any) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }));

        // Clear field error when user makes changes
        if (fieldErrors[field as string]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field as string];
                return newErrors;
            });
        }

        // Real-time validation for critical fields
        if (typeof value === 'string' && ["title", "description", "price"].includes(field)) {
            const schemaField = field === "price" ? "price" : field;
            const error = validateField(value, adValidationSchema[schemaField as string]);
            if (error) {
                setFieldErrors(prev => ({ ...prev, [field]: error }));
            }
        }
    };

    const handleImagesChange = (images: string[]) => {
        setFormState((prev) => ({
            ...prev,
            images,
        }));
        
        // Clear images error if user uploads images
        if (images.length > 0 && fieldErrors.images) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.images;
                return newErrors;
            });
        }
    };

    const handleAttributeChange = (attributeId: string, value: string | boolean) => {
        setAttributeValues((prev) => ({
            ...prev,
            [attributeId]: value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Validate form before submission
        const errors: Record<string, string> = {};

        const titleError = validateField(formState.title, adValidationSchema.title);
        if (titleError) errors.title = titleError;

        const descriptionError = validateField(formState.description, adValidationSchema.description);
        if (descriptionError) errors.description = descriptionError;

        const priceError = validateField(formState.price, adValidationSchema.price);
        if (priceError) errors.price = priceError;

        const locationError = validateField(formState.location, adValidationSchema.location);
        if (locationError) errors.location = locationError;

        // Conditional image validation
        const isJobCategory = 
            formState.categoryName?.toLowerCase().includes("job") || 
            formState.subcategoryName?.toLowerCase().includes("job");
            
        if (!isJobCategory && (!formState.images || formState.images.length === 0)) {
            errors.images = "At least one image is required for this category.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setAlertDialog({
                isOpen: true,
                title: "Validation Error",
                description: "Please check the form fields and correct the errors.",
                type: "error",
            });
            return;
        }

        setIsPending(true);
        try {
            // Prepare ad data without userId since it's not in the CreateAdRequest type
            const adData: CreateAdRequest = {
                title: formState.title,
                description: formState.description,
                price: parseFloat(formState.price) || 0,
                discountedPrice: formState.discountedPrice ? parseFloat(formState.discountedPrice) : null,
                locationLatitude: formState.location?.latitude,
                locationLongitude: formState.location?.longitude,
                locationRoad: formState.location?.address.road,
                locationHouseNumber: formState.location?.address.house_number,
                locationCity: formState.location?.address.city,
                locationState: formState.location?.address.state,
                locationCountry: formState.location?.address.country,
                locationPostalCode: formState.location?.address.postalCode,
                locationFormatted: formState.location?.displayName,
                categoryId: formState.categoryId,
                subcategoryId: formState.subcategoryId,
                images: formState.images,
                status: "APPROVED",
                attributes: Object.entries(attributeValues).map(([attributeId, value]) => ({
                    attributeId,
                    value: String(value)
                })),
            };

            // For admin creating ads for other users, we need to send the userId separately
            // or the backend might handle this differently for admin users
            const response = await apiClient.post<ApiResponse<any>>('/admin/ads', {
                ...adData,
                userId: formState.userId, // Include the selected user ID for admin endpoint
            });

            if (response.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Ad Created",
                    description: "Ad has been successfully created.",
                    type: "success",
                });
                setTimeout(() => {
                    router.push('/dashboard/ad-management/ads');
                }, 1500);
            } else {
                throw new Error(response.error?.message || 'Failed to create ad');
            }
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Create Failed",
                description: error?.message || "Failed to create ad. Please try again.",
                type: "error",
            });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Create ad</h1>
                <p className="text-sm text-tertiary">Create a new marketplace listing with detailed information and contact details.</p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header>
                        <h2 className="text-lg font-semibold text-primary">User Selection</h2>
                        <p className="text-sm text-tertiary">Select which user this ad belongs to.</p>
                    </header>

                    <SearchableSelect
                        label="Owner"
                        placeholder="Search for a user..."
                        value={formState.userId}
                        onSelectionChange={(value) => handleChange("userId", value)}
                        searchFn={searchUsers}
                        displayKey="email"
                        valueKey="id"
                        isRequired
                        renderOption={(user) => (
                            <div className="flex flex-col">
                                <span className="font-medium text-primary">
                                    {user.firstName} {user.lastName} {user.role === 'ADMIN' && '(Admin)'}
                                </span>
                                <span className="text-sm text-tertiary">{user.phone || user.email} • {user.role}</span>
                            </div>
                        )}
                    />
                </section>

                <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header>
                        <h2 className="text-lg font-semibold text-primary">Images</h2>
                        <p className="text-sm text-tertiary">
                            {(formState.categoryName?.toLowerCase().includes('job') || formState.subcategoryName?.toLowerCase().includes('job'))
                                ? "Photos are optional for job categories. Add them for better visibility."
                                : "Add photos to showcase your ad. First image will be the cover."}
                        </p>
                    </header>

                    <div className="w-full">
                        <MultipleImageUpload
                            value={formState.images}
                            onChange={handleImagesChange}
                            maxSize={5 * 1024 * 1024} // 5MB
                        />
                    </div>
                </section>

                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div>
                        <Input
                            label="Title"
                            placeholder="Enter ad title"
                            value={formState.title}
                            onChange={(value) => handleChange("title", value)}
                            isRequired
                            isInvalid={!!fieldErrors.title}
                            hint={fieldErrors.title}
                            maxLength={100}
                        />
                    </div>

                    <div>
                        <TextArea
                            label="Description"
                            placeholder="Enter detailed description"
                            value={formState.description}
                            onChange={(value) => handleChange("description", value)}
                            rows={10}
                            isInvalid={!!fieldErrors.description}
                            hint={fieldErrors.description}
                            maxLength={1000}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <NumberInput
                            label="Original Price"
                            placeholder="0.00"
                            value={Number(formState.price) || 0}
                            onChange={(value) => handleChange("price", value.toString())}
                            isInvalid={!!fieldErrors.price}
                            hint={fieldErrors.price || "Enter the listing price"}
                            min={0}
                            max={999999999999}
                            isRequired
                        />

                        <NumberInput
                            label="Discount Price (Optional)"
                            placeholder="0.00"
                            value={Number(formState.discountedPrice) || 0}
                            onChange={(value) => handleChange("discountedPrice", value.toString())}
                            min={0}
                            max={999999999999}
                        />

                        <div className="md:col-span-3">
                            <DynamicLocationPicker
                                label="Location"
                                value={formState.location}
                                onChange={(location) => handleChange("location", location)}
                                error={fieldErrors.location}
                                isRequired
                            />
                        </div>
                    </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header>
                        <h2 className="text-lg font-semibold text-primary">Category & Subcategory</h2>
                        <p className="text-sm text-tertiary">Choose the appropriate category and subcategory for this ad.</p>
                    </header>

                    <div className="grid gap-4 md:grid-cols-2">
                        <SearchableSelect
                            label="Category"
                            placeholder="Search for a category..."
                            value={formState.categoryId}
                            onSelectionChange={(value) => {
                                handleChange("categoryId", value);
                                handleChange("subcategoryId", "");
                            }}
                            searchFn={searchCategories}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />

                        <SearchableSelect
                            label="Subcategory"
                            placeholder="Search for a subcategory..."
                            value={formState.subcategoryId}
                            onSelectionChange={(value) => handleChange("subcategoryId", value)}
                            searchFn={searchSubcategories}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />
                    </div>
                </section>

                {attributes.length > 0 && (
                    <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <header>
                            <h2 className="text-lg font-semibold text-primary">Additional Details</h2>
                            <p className="text-sm text-tertiary">Provide specific details for this type of listing.</p>
                        </header>

                        <div className="grid gap-4 md:grid-cols-2">
                            {attributes
                                .sort((a, b) => a.order - b.order)
                                .map((attribute) => (
                                    <div key={attribute.id}>
                                        {attribute.type === "text" && (
                                            <Input
                                                label={attribute.name}
                                                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                                                value={(attributeValues[attribute.id] as string) || ""}
                                                onChange={(value) => handleAttributeChange(attribute.id, value)}
                                                isRequired={attribute.isRequired}
                                                maxLength={500}
                                            />
                                        )}

                                        {attribute.type === "number" && (
                                            <NumberInput
                                                label={attribute.name}
                                                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                                                value={Number(attributeValues[attribute.id]) || 0}
                                                onChange={(value) => handleAttributeChange(attribute.id, value.toString())}
                                                isRequired={attribute.isRequired}
                                                min={0}
                                                max={999999999999}
                                            />
                                        )}

                                        {attribute.type === "boolean" && (
                                            <label className="flex items-center gap-3 rounded-lg border border-secondary bg-secondary p-4">
                                                <input
                                                    type="checkbox"
                                                    checked={!!attributeValues[attribute.id]}
                                                    onChange={(event) => handleAttributeChange(attribute.id, event.target.checked)}
                                                    className="rounded border-secondary"
                                                />
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">
                                                        {attribute.name} {attribute.required && "*"}
                                                    </p>
                                                </div>
                                            </label>
                                        )}

                                        {attribute.type === "select" && (
                                            <Select
                                                label={attribute.name}
                                                aria-label={`Select ${attribute.name.toLowerCase()}`}
                                                selectedKey={(attributeValues[attribute.id] as string) || ""}
                                                onSelectionChange={(key) => {
                                                    if (typeof key === "string") {
                                                        handleAttributeChange(attribute.id, key);
                                                    }
                                                }}
                                                items={attribute.options?.map((option: any) => ({
                                                    id: option,
                                                    label: option,
                                                })) || []}
                                                size="md"
                                                isRequired={attribute.isRequired}
                                            >
                                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                            </Select>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </section>
                )}



                <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button color="secondary" size="sm" href="/dashboard/ad-management/ads">
                        Cancel
                    </Button>
                    <Button color="primary" size="sm" type="submit" isDisabled={isPending} isLoading={isPending}>
                        {isPending ? "Creating..." : "Create ad"}
                    </Button>
                </footer>
            </form>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}
