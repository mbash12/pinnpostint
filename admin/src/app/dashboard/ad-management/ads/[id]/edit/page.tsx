"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NumberInput } from "@/components/base/number-input/number-input";
import { Select } from "@/components/base/select/select";
import { SearchableSelect } from "@/components/base/searchable-select";
import { TextArea } from "@/components/base/textarea/textarea";
import { MultipleImageUpload } from "@/components/base/multiple-image-upload/multiple-image-upload";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";
import { useAd, useUpdateAd } from "@/hooks/use-ads";
import { useAttributes } from "@/hooks/use-categories";
import { DynamicLocationPicker, type AdLocation } from "@/components/shared/dynamic-location-picker";
import { apiClient } from "@/lib/api-client";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import type { UpdateAdRequest } from "@/lib/api-types";
import type { Ad } from "@/lib/api-types";
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
    enableBooking: boolean;
};

export default function EditAdPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const adId = params?.id;
    const hasSubmitted = useRef(false);

    const { data: adResponse, isLoading: isLoadingAd } = useAd(adId!);
    const ad = (adResponse?.data || adResponse) as any;
    const { mutateAsync: updateAd, isPending } = useUpdateAd();

    // Search functions for API-based dropdowns
    const searchLocations = async (query: string) => {
        const response = await apiClient.get<any>('/admin/locations', { search: query, limit: 20, isActive: 'true' }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const searchCategories = async (query: string) => {
        const response = await apiClient.get<any>('/admin/categories', { search: query, limit: 20 }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const searchSubcategories = async (query: string) => {
        if (!formState.categoryId) return [];
        const response = await apiClient.get<any>(`/admin/categories/${formState.categoryId}/subcategories`, { search: query, limit: 20 }, { skipLoading: true });
        return response.data?.data || response.data || [];
    };

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const [formState, setFormState] = useState<AdFormState>({
        title: "",
        description: "",
        price: "",
        discountedPrice: "",
        userId: "",
        images: [],
        categoryId: "",
        subcategoryId: "",
        enableBooking: false,
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // State for attribute values
    const [attributeValues, setAttributeValues] = useState<Record<string, string | boolean>>({});
    const [subcategorySupportsBooking, setSubcategorySupportsBooking] = useState(false);
    const [showSlotsModal, setShowSlotsModal] = useState(false);

    // Fetch attributes only when subcategoryId is available
    const { data: attributesData } = useAttributes(formState.subcategoryId);
    const attributesDataAny = attributesData as any;
    const attributes = Array.isArray(attributesDataAny?.data) ? attributesDataAny.data : (attributesDataAny?.data?.data || []);

    // Check if subcategory supports booking
    useEffect(() => {
        const checkSubcategoryBooking = async () => {
            if (formState.subcategoryId) {
                try {
                    const response = await apiClient.get<any>(`/admin/categories/subcategories/${formState.subcategoryId}`, {}, { skipLoading: true });
                    const subcategory = response.data?.data || response.data;
                    setSubcategorySupportsBooking(subcategory?.supportsBooking || false);
                } catch (error) {
                    setSubcategorySupportsBooking(false);
                }
            } else {
                setSubcategorySupportsBooking(false);
            }
        };
        checkSubcategoryBooking();
    }, [formState.subcategoryId]);

    // Initialize form when ad data loads
    useEffect(() => {
        if (ad) {
            setFormState({
                title: ad.title || "",
                description: ad.description || "",
                price: ad.price?.toString() || "",
                discountedPrice: ad.discountedPrice?.toString() || "",
                userId: ad.userId || "",
                images: ad.images || [],
                location: ad.locationLatitude ? {
                    latitude: ad.locationLatitude,
                    longitude: ad.locationLongitude,
                    address: {
                        road: ad.locationRoad,
                        house_number: ad.locationHouseNumber,
                        city: ad.locationCity,
                        state: ad.locationState,
                        country: ad.locationCountry || 'IN',
                        postalCode: ad.locationPostalCode,
                        formatted: ad.locationFormatted || ad.locationCity || '',
                    },
                    displayName: ad.locationFormatted || ad.locationCity || '',
                } : undefined,
                categoryId: ad.categoryId || "",
                categoryName: ad.category?.name || "",
                subcategoryId: ad.subcategoryId || "",
                subcategoryName: ad.subcategory?.name || "",
                enableBooking: ad.enableBooking ?? false,
            });

            // Initialize attribute values
            if (ad.attributes) {
                const initialAttributes: Record<string, string | boolean> = {};
                ad.attributes.forEach((attr: any) => {
                    if (attr.attribute?.type === 'boolean') {
                        initialAttributes[attr.attributeId] = attr.value === 'true';
                    } else {
                        initialAttributes[attr.attributeId] = attr.value;
                    }
                });
                setAttributeValues(initialAttributes);
            }
        }
    }, [ad]);

    const handleCategoryChange = async (categoryId: string) => {
        try {
            const response = await apiClient.get<any>(`/admin/categories/${categoryId}`);
            const categoryName = response.data?.name || "";
            
            setFormState(prev => ({
                ...prev,
                categoryId,
                categoryName,
                subcategoryId: "",
                subcategoryName: "",
            }));
        } catch (error: any) {
            console.error('[EditAd] Failed to fetch category:', error);
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: error?.message || "Failed to fetch category details. Please try again.",
                type: "error",
            });
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
        } catch (error: any) {
            console.error('[EditAd] Failed to fetch subcategory:', error);
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: error?.message || "Failed to fetch subcategory details. Please try again.",
                type: "error",
            });
            handleChange("subcategoryId", subcategoryId);
        }
    };

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
        if (field === "price" && typeof value === 'string') {
            const error = validateField(value, adValidationSchema.price);
            if (error) {
                setFieldErrors(prev => ({ ...prev, price: error }));
            }
        }

        if (field === "location") {
            const error = validateField(value, adValidationSchema.location);
            if (error) {
                setFieldErrors(prev => ({ ...prev, location: error }));
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

        // Prevent double submission
        if (hasSubmitted.current) return;

        if (!adId) return;

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

        try {
            hasSubmitted.current = true;

            const adData: UpdateAdRequest = {
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
                enableBooking: formState.enableBooking,
                attributes: Object.entries(attributeValues).map(([attributeId, value]) => ({
                    attributeId,
                    value: String(value)
                })),
            };

            const result = await updateAd({ id: adId, data: adData });

            if (result?.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Ad Updated",
                    description: "Ad has been successfully updated.",
                    type: "success",
                });
                setTimeout(() => {
                    router.push('/dashboard/ad-management/ads');
                }, 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }
        } catch (error: any) {
            hasSubmitted.current = false;

            // Extract validation details if available
            let description = error?.message || "Failed to update ad. Please try again.";
            if (error?.data?.error?.details) {
                const validationErrors = error.data.error.details.map((d: any) => d.message).join(', ');
                description = `${description}: ${validationErrors}`;
            }

            setAlertDialog({
                isOpen: true,
                title: "Update Failed",
                description: description,
                type: "error",
            });
        }
    };

    if (isLoadingAd) {
        return (
            <div className="space-y-8">
                <header className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Edit ad</h1>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-primary">Loading ad...</p>
                </div>
            </div>
        );
    }

    if (!ad) {
        return (
            <div className="space-y-8">
                <header className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Edit ad</h1>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Ad not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Edit ad</h1>
                <p className="text-sm text-tertiary">Update the marketplace listing details and settings.</p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-primary">User</label>
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-secondary bg-secondary">
                            {ad?.user?.avatar ? (
                                <Avatar size="sm" src={getProxiedImageUrl(ad.user.avatar)} alt={`${ad.user.firstName} ${ad.user.lastName}`} />
                            ) : (
                                <ImagePlaceholder size="sm" />
                            )}
                            <div className="flex flex-col">
                                <span className="font-medium text-primary">
                                    {ad?.user ? `${ad.user.firstName} ${ad.user.lastName}` : 'Unknown User'}
                                </span>
                                <span className="text-sm text-tertiary">{ad?.user?.email || ad?.userId}</span>
                            </div>
                        </div>
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
                        />
                    </div>

                    <div>
                        <TextArea
                            label="Description"
                            placeholder="Enter detailed description"
                            value={formState.description}
                            onChange={(value) => handleChange("description", value)}
                            rows={10}
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
                        <h2 className="text-lg font-semibold text-primary">Images</h2>
                        <p className="text-sm text-tertiary">
                            {(formState.categoryName?.toLowerCase().includes('job') || formState.subcategoryName?.toLowerCase().includes('job'))
                                ? "Photos are optional for job categories. Add them for better visibility."
                                : "Update photos to showcase your ad. First image will be the cover."}
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
                            onSelectionChange={handleCategoryChange}
                            searchFn={searchCategories}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />

                        <SearchableSelect
                            label="Subcategory"
                            placeholder="Search for a subcategory..."
                            value={formState.subcategoryId}
                            onSelectionChange={handleSubcategoryChange}
                            searchFn={searchSubcategories}
                            displayKey="name"
                            valueKey="id"
                            isRequired
                        />
                    </div>
                </section>

                {formState.subcategoryId && subcategorySupportsBooking && (
                    <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-primary">Booking Settings</h2>
                                <p className="text-sm text-tertiary">Enable booking functionality for this ad.</p>
                            </div>
                            {ad?.bookingType === 'SLOTS' && Array.isArray(ad?.slots) && ad.slots.length > 0 && (
                                <Button color="secondary" size="sm" onClick={() => setShowSlotsModal(true)}>
                                    View Slots
                                </Button>
                            )}
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formState.enableBooking}
                                onChange={(e) => handleChange("enableBooking", e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-primary">Enable booking for this ad</span>
                        </label>
                    </section>
                )}
                
                <DialogTrigger isOpen={showSlotsModal} onOpenChange={(open) => !open && setShowSlotsModal(false)}>
                    <ModalOverlay>
                        <Modal>
                            <Dialog className="mx-auto w-full max-w-sm">
                                <div className="bg-primary rounded-2xl border border-secondary shadow-lg p-5 w-full">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-md font-semibold text-primary">Appointment Slots</h4>
                                        <Button color="secondary" size="sm" onClick={() => setShowSlotsModal(false)}>
                                            Close
                                        </Button>
                                    </div>
                                    {ad?.bookingType === 'SLOTS' && Array.isArray(ad?.slots) && ad.slots.length > 0 ? (
                                        <div className="space-y-2">
                                            {ad.slots.map((slot: any, index: number) => (
                                                <div key={index} className="flex items-center justify-between rounded-lg border border-secondary p-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-primary">{slot.date?.split('T')[0]}</span>
                                                        <span className="text-[11px] text-tertiary">{slot.startTime} - {slot.endTime}</span>
                                                    </div>
                                                    <span className="text-[10px] text-tertiary bg-secondary px-2 py-0.5 rounded border border-secondary/70">Max {slot.maxBookings}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-tertiary">No slots defined</div>
                                    )}
                                </div>
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                </DialogTrigger>

                {attributes.length > 0 && (
                    <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <header>
                            <h2 className="text-lg font-semibold text-primary">Additional Details</h2>
                            <p className="text-sm text-tertiary">Provide specific details for this type of listing.</p>
                        </header>

                        <div className="grid gap-4 md:grid-cols-2">
                            {attributes
                                .sort((a: any, b: any) => a.order - b.order)
                                .map((attribute: any) => (
                                    <div key={attribute.id}>
                                        {attribute.type === "text" && (
                                            <Input
                                                label={attribute.name}
                                                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                                                value={(attributeValues[attribute.id] as string) || ""}
                                                onChange={(value) => handleAttributeChange(attribute.id, value)}
                                                isRequired={attribute.isRequired}
                                            />
                                        )}

                                        {attribute.type === "number" && (
                                            <NumberInput
                                                label={attribute.name}
                                                placeholder={`Enter ${attribute.name.toLowerCase()}`}
                                                value={Number(attributeValues[attribute.id]) || 0}
                                                onChange={(value) => handleAttributeChange(attribute.id, value.toString())}
                                                isRequired={attribute.isRequired}
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
                    <Button color="secondary" size="sm" href={`/dashboard/ad-management/ads/${ad.id}`}>
                        Cancel
                    </Button>
                    <Button color="primary" size="sm" type="submit" isDisabled={isPending} isLoading={isPending}>
                        {isPending ? "Saving..." : "Save changes"}
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
