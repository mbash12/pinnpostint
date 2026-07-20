"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, CheckCircle, XCircle, AlertTriangle, Calendar, CurrencyDollar, MarkerPin01, MessageSquare02, Flag01, Users01, BarChart04, Clock, Shield01, Edit01, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";
import { useAd, useModerateAd, useDeleteAd, useToggleAdFeature, useFlagAd, useUpdateAdStatus, useAdStats } from "@/hooks/use-ads";
import { Ad, Subscription } from "@/lib/api-types";
import { formatCurrency } from "@/utils/currency";
import { DynamicMapView } from "@/components/shared/dynamic-map-view";
import { getDaysRemaining, formatLocalDate } from "@/utils/date-utils";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { cx } from "@/utils/cx";

export default function AdModerationDetailPage() {
    const params = useParams<{ id: string }>();
    const adId = params?.id;
    const [rejectionReason, setRejectionReason] = useState("");
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [showErrorAlert, setShowErrorAlert] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [alertType, setAlertType] = useState<"success" | "error">("success");
    const [showSlotsModal, setShowSlotsModal] = useState(false);

    // Fetch ad from API
    const { data: adResponse, isLoading, error } = useAd(adId!);
    const { data: statsResponse } = useAdStats(adId!);

    const ad = (adResponse?.data?.data || adResponse?.data || adResponse) as Ad | null;

    // Extract stats data from ApiResponse
    const statsData = statsResponse?.data?.data || statsResponse?.data || { views: 0, favorites: 0, shares: 0, bookings: 0 };

    // Properly type the stats object
    const stats = {
        views: ('views' in statsData && typeof statsData.views === 'number') ? statsData.views : 0,
        favorites: ('favorites' in statsData && typeof statsData.favorites === 'number') ? statsData.favorites : 0,
        shares: ('shares' in statsData && typeof statsData.shares === 'number') ? statsData.shares : 0,
        bookings: ('bookings' in statsData && typeof statsData.bookings === 'number') ? statsData.bookings : 0,
    };

    // Moderation mutations
    const moderateAdMutation = useModerateAd();
    const deleteAdMutation = useDeleteAd();
    const toggleFeatureMutation = useToggleAdFeature();
    const flagAdMutation = useFlagAd();
    const updateStatusMutation = useUpdateAdStatus();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-moderation">
                                Back
                            </Button>
                            <div className="h-8 w-48 bg-secondary rounded animate-pulse"></div>
                        </div>
                        <div className="h-6 w-16 bg-secondary rounded-full animate-pulse"></div>
                    </header>
                </div>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <div className="animate-pulse">
                        <div className="h-4 bg-secondary rounded mb-4"></div>
                        <div className="h-4 bg-secondary rounded w-3/4 mx-auto"></div>
                    </div>
                    <p className="text-tertiary mt-4">Loading ad details...</p>
                </div>
            </div>
        );
    }

    if (error || !ad) {
        return (
            <div className="space-y-6">
                <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-moderation">
                                Back
                            </Button>
                            <h1 className="text-2xl font-semibold text-primary">Ad Not Found</h1>
                        </div>
                    </header>
                </div>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <AlertTriangle className="mx-auto h-12 w-12 text-tertiary mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">Ad Not Found</h3>
                    <p className="text-tertiary">The requested ad could not be found or may have been deleted.</p>
                </div>
            </div>
        );
    }

    const handleApproveAd = async () => {
        if (!ad) return;
        try {
            await moderateAdMutation.mutateAsync({
                id: ad.id,
                status: 'APPROVED'
            });
            setSuccessMessage(`Ad "${ad.title}" approved successfully`);
            setShowSuccessAlert(true);
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to approve ad');
            setShowErrorAlert(true);
        }
    };

    const confirmApproveAd = () => {
        handleApproveAd();
    };

    const handleRejectAd = async () => {
        if (!ad || !rejectionReason.trim()) {
            setErrorMessage('Please provide a rejection reason');
            setShowErrorAlert(true);
            return;
        }
        try {
            await moderateAdMutation.mutateAsync({
                id: ad.id,
                status: 'REJECTED',
                rejectionReason: rejectionReason
            });
            setSuccessMessage(`Ad "${ad.title}" rejected with reason: ${rejectionReason}`);
            setShowSuccessAlert(true);
            setRejectionReason("");
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to reject ad');
            setShowErrorAlert(true);
        }
    };

    const confirmRejectAd = () => {
        handleRejectAd();
    };

    const handleFlagAd = async () => {
        if (!ad || !rejectionReason.trim()) {
            setErrorMessage('Please provide a flag reason');
            setShowErrorAlert(true);
            return;
        }
        try {
            await flagAdMutation.mutateAsync({
                id: ad.id,
                flagReason: rejectionReason
            });
            setSuccessMessage(`Ad "${ad.title}" flagged with reason: ${rejectionReason}`);
            setShowSuccessAlert(true);
            setRejectionReason("");
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to flag ad');
            setShowErrorAlert(true);
        }
    };

    const handleUnpublishAd = async () => {
        if (!ad || !rejectionReason.trim()) {
            setErrorMessage('Please provide a reason for unpublishing');
            setShowErrorAlert(true);
            return;
        }
        try {
            await moderateAdMutation.mutateAsync({
                id: ad.id,
                status: 'REJECTED',
                rejectionReason: rejectionReason
            });
            setSuccessMessage(`Ad "${ad.title}" unpublished`);
            setShowSuccessAlert(true);
            setRejectionReason("");
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to unpublish ad');
            setShowErrorAlert(true);
        }
    };

    const confirmUnpublishAd = () => {
        handleUnpublishAd();
    };

    const handleReapproveAd = async () => {
        if (!ad) return;
        try {
            await moderateAdMutation.mutateAsync({
                id: ad.id,
                status: 'APPROVED'
            });
            setSuccessMessage(`Ad "${ad.title}" re-approved`);
            setShowSuccessAlert(true);
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to re-approve ad');
            setShowErrorAlert(true);
        }
    };

    const handleDeleteAd = async () => {
        if (!ad) return;
        try {
            await deleteAdMutation.mutateAsync(ad.id);
            setSuccessMessage(`Ad "${ad.title}" deleted permanently`);
            setShowSuccessAlert(true);
            setTimeout(() => {
                window.location.href = '/dashboard/ad-moderation';
            }, 1500);
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to delete ad');
            setShowErrorAlert(true);
        }
    };

    const handleToggleFeature = async () => {
        if (!ad) return;
        try {
            await toggleFeatureMutation.mutateAsync({
                id: ad.id,
                isFeatured: !ad.isFeatured
            });
            setSuccessMessage(`Ad ${ad.isFeatured ? 'unfeatured' : 'featured'} successfully`);
            setShowSuccessAlert(true);
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to update feature status');
            setShowErrorAlert(true);
        }
    };

    const nextImage = () => {
        setActiveImageIndex((prev) => (prev + 1) % ad.images.length);
    };

    const prevImage = () => {
        setActiveImageIndex((prev) => (prev - 1 + ad.images.length) % ad.images.length);
    };

    // Real analytics data from API
    const analytics = {
        views: stats.views || 0,
        favorites: stats.favorites || 0,
        shares: stats.shares || 0,
        bookings: stats.bookings || 0,
    };

    const statusStyles: Record<string, string> = {
        REVIEW: "bg-warning-subtle text-warning-primary",
        APPROVED: "bg-success-subtle text-success-primary",
        REJECTED: "bg-error-subtle text-error-primary",
        EXPIRED: "bg-secondary text-primary",
        FLAGGED: "bg-red-100 text-red-800",
        active: "bg-success-subtle text-success-primary",
        inactive: "bg-warning-subtle text-warning-primary",
        review: "bg-warning-subtle text-warning-primary",
        expired: "bg-secondary text-primary"
    };

    return (
        <div className="space-y-6">
            {/* Alert Dialog */}
            <AlertDialog
                isOpen={showSuccessAlert || showErrorAlert}
                onClose={() => {
                    setShowSuccessAlert(false);
                    setShowErrorAlert(false);
                }}
                title={showSuccessAlert ? "Success" : "Error"}
                description={showSuccessAlert ? successMessage : errorMessage}
                type={showSuccessAlert ? "success" : "error"}
            />

            {/* Header */}
            <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-moderation">
                            Back
                        </Button>
                        <h1 className="text-2xl font-semibold text-primary">{ad.title}</h1>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[ad.status]}`}>
                        {ad.status}
                    </span>
                </header>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Content - Left Side */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Image Gallery with Navigation */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Images ({ad.images.length})
                        </h2>
                        <div className="relative flex justify-center bg-secondary/30 rounded-lg">
                            <div className="aspect-square w-full max-w-md overflow-hidden rounded-lg flex items-center justify-center">
                                {ad.images && ad.images.length > 0 ? (
                                    <img
                                        src={ad.images[activeImageIndex] ? getProxiedImageUrl(ad.images[activeImageIndex]) : undefined}
                                        alt={`${ad.title} - Image ${activeImageIndex + 1}`}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-tertiary">
                                        No images available
                                    </div>
                                )}
                            </div>

                            {ad.images && ad.images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}

                            {ad.images && ad.images.length > 1 && (
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                                    {activeImageIndex + 1} / {ad.images.length}
                                </div>
                            )}
                        </div>

                        {ad.images && ad.images.length > 1 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                                {ad.images.map((image, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setActiveImageIndex(index)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors flex items-center justify-center bg-secondary/30 ${index === activeImageIndex ? 'border-primary' : 'border-transparent'
                                            }`}
                                    >
                                        <img src={image ? getProxiedImageUrl(image) : undefined} alt={`Thumbnail ${index + 1}`} className="max-w-full max-h-full object-contain" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ad Content */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <MessageSquare02 className="h-5 w-5" />
                            Ad Description
                        </h2>
                        <div className="prose max-w-none">
                            <p className="text-tertiary whitespace-pre-line leading-relaxed">{ad.description ? ad.description.replace(/<[^>]*>/g, ' ') : 'No description provided'}</p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-secondary space-y-4">
                            <h3 className="text-md font-semibold text-primary flex items-center gap-2">
                                <MarkerPin01 className="h-5 w-5" />
                                Location
                            </h3>

                            <div className="text-sm space-y-1">
                                {ad.locationFormatted ? (
                                    <p className="font-medium text-primary">{ad.locationFormatted}</p>
                                ) : (
                                    <p className="font-medium text-primary">{ad.location?.name || 'Unknown location'}</p>
                                )}
                                {(ad.locationCity || ad.locationState) && (
                                    <p className="text-tertiary">
                                        {[ad.locationCity, ad.locationState, ad.locationCountry].filter(Boolean).join(', ')}
                                    </p>
                                )}
                            </div>

                            {ad.locationLatitude && ad.locationLongitude ? (
                                <DynamicMapView
                                    latitude={ad.locationLatitude}
                                    longitude={ad.locationLongitude}
                                    height={250}
                                />
                            ) : ad.location?.latitude && ad.location?.longitude ? (
                                <DynamicMapView
                                    latitude={ad.location.latitude}
                                    longitude={ad.location.longitude}
                                    height={250}
                                />
                            ) : null}
                        </div>

                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-secondary">
                            <div className="text-center">
                                <div className="flex flex-col items-center">
                                    <div className={cx("font-bold text-primary", ad.discountedPrice ? "text-sm text-tertiary line-through" : "text-2xl")}>
                                        {ad.price ? formatCurrency(ad.price) : 'N/A'}
                                    </div>
                                    {ad.discountedPrice && (
                                        <div className="text-2xl font-bold text-success-primary">
                                            {formatCurrency(ad.discountedPrice)}
                                        </div>
                                    )}
                                </div>
                                <div className="text-sm text-tertiary">Price</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{ad.category?.name || 'Unknown'}</div>
                                <div className="text-sm text-tertiary">Category</div>
                            </div>
                        </div>
                    </div>

                    {/* Ad Details */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <MessageSquare02 className="h-5 w-5" />
                            Ad Details
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-tertiary min-w-[120px]">Category</span>
                                <span className="font-medium text-primary">{ad.category?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary min-w-[120px]">Subcategory</span>
                                <span className="font-medium text-primary">{ad.subcategory?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary min-w-[120px]">Price</span>
                                <div className="flex flex-col items-end">
                                    <span className={cx("font-medium", ad.discountedPrice ? "text-xs text-tertiary line-through" : "text-primary")}>
                                        {ad.price ? formatCurrency(ad.price) : 'N/A'}
                                    </span>
                                    {ad.discountedPrice && (
                                        <span className="font-semibold text-success-primary">
                                            {formatCurrency(ad.discountedPrice)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary min-w-[120px]">Enable Booking</span>
                                <span className="font-medium text-primary">{ad.enableBooking ? 'Yes' : 'No'}</span>
                            </div>
                            {ad.attachment && ad.attachment.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    <h4 className="text-sm font-semibold text-tertiary">Attachments ({ad.attachment.length})</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {ad.attachment.map((url, index) => (
                                            <div key={index} className="flex justify-between items-center bg-secondary/30 p-3 rounded-lg border border-secondary">
                                                <span className="text-xs text-primary truncate max-w-[200px]" title={decodeURIComponent(url.split('/').pop() || '')}>
                                                    {decodeURIComponent(url.split('/').pop() || '')}
                                                </span>
                                                <a 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-medium text-brand-secondary hover:underline flex items-center gap-2"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    View
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {ad.attributes && ad.attributes.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-secondary">
                                <h3 className="text-md font-semibold text-primary mb-4">Attributes</h3>
                                <div className="bg-secondary p-4 rounded-lg">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        {ad.attributes.map((attr: any, index: number) => (
                                            <div key={index} className="flex justify-between">
                                                <span className="text-tertiary min-w-[120px]">{attr.attribute?.name || attr.label || attr.name || attr.key}</span>
                                                <span className="font-medium text-primary">{attr.value || 'N/A'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {ad.enableBooking && (
                            <div className="mt-8 pt-6 border-t border-secondary">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-semibold text-primary">Booking Configuration</h3>
                                    {ad.bookingType === 'SLOTS' && ad.slots && ad.slots.length > 0 && (
                                        <Button color="secondary" size="sm" onClick={() => setShowSlotsModal(true)}>
                                            View Slots
                                        </Button>
                                    )}
                                </div>
                                <div className="bg-secondary p-5 rounded-xl border border-secondary">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-secondary/50">
                                        <span className="text-sm text-tertiary font-medium">Type</span>
                                        <span className="text-sm font-bold text-primary bg-primary px-3 py-1 rounded-full border border-secondary">
                                            {ad.bookingType === 'SLOTS' ? 'Time-based Slots' : 'Standard Date Range'}
                                        </span>
                                    </div>

                                    {ad.bookingType === 'SLOTS' && ad.slots && ad.slots.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest mb-2">Defined Availability</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {ad.slots.map((slot: any, index: number) => (
                                                    <div key={index} className="flex justify-between items-center bg-primary/40 p-3 rounded-lg border border-secondary/50">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-primary">{slot.date?.split('T')[0]}</span>
                                                            <span className="text-[11px] text-tertiary">{slot.startTime} - {slot.endTime}</span>
                                                        </div>
                                                        <div className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded font-medium text-tertiary">
                                                            Max: {slot.maxBookings}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : ad.bookingType === 'SLOTS' ? (
                                        <p className="text-sm text-tertiary italic text-center py-2">No slots defined</p>
                                    ) : (
                                        <p className="text-xs text-tertiary italic">Provider uses the default date-range selection system.</p>
                                    )}
                                </div>
                            </div>
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
                                            {ad?.bookingType === 'SLOTS' && ad?.slots && ad.slots.length > 0 ? (
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
                    </div>

                    {/* Analytics Dashboard */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <BarChart04 className="h-5 w-5" />
                            Performance Analytics
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-secondary p-4 rounded-lg border border-secondary">
                                <div className="text-2xl font-bold text-primary">{analytics.views.toLocaleString()}</div>
                                <div className="text-sm text-tertiary">Views</div>
                            </div>
                            <div className="bg-secondary p-4 rounded-lg border border-secondary">
                                <div className="text-2xl font-bold text-primary">{analytics.favorites.toLocaleString()}</div>
                                <div className="text-sm text-tertiary">Favorites</div>
                            </div>
                            <div className="bg-secondary p-4 rounded-lg border border-secondary">
                                <div className="text-2xl font-bold text-primary">{analytics.shares.toLocaleString()}</div>
                                <div className="text-sm text-tertiary">Shares</div>
                            </div>
                            <div className="bg-secondary p-4 rounded-lg border border-secondary">
                                <div className="text-2xl font-bold text-primary">{analytics.bookings.toLocaleString()}</div>
                                <div className="text-sm text-tertiary">Bookings</div>
                            </div>
                        </div>
                    </div>

                    {/* Moderation Actions */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Shield01 className="h-5 w-5" />
                            Moderation Actions
                        </h2>

                        {ad.status === 'REVIEW' && (
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <ConfirmationDialog
                                        title="Approve Ad"
                                        description={`Are you sure you want to approve "${ad.title}"? This ad will become visible to users.`}
                                        confirmLabel="Yes, Approve"
                                        cancelLabel="Cancel"
                                        onConfirm={confirmApproveAd}
                                    >
                                        <Button color="primary" size="md" iconLeading={<CheckCircle />} className="flex-1">
                                            Approve Ad
                                        </Button>
                                    </ConfirmationDialog>
                                    <ConfirmationDialog
                                        title="Reject Ad"
                                        description={`Are you sure you want to reject "${ad.title}"? This action cannot be undone.`}
                                        confirmLabel="Yes, Reject"
                                        cancelLabel="Cancel"
                                        onConfirm={confirmRejectAd}
                                    >
                                        <Button color="secondary-destructive" size="md" className="flex-1">
                                            Reject Ad
                                        </Button>
                                    </ConfirmationDialog>
                                </div>
                                <TextArea
                                    placeholder="Rejection reason (required for rejection)"
                                    value={rejectionReason}
                                    onChange={setRejectionReason}
                                    rows={3}
                                />
                            </div>
                        )}

                        {ad.status === 'APPROVED' && (
                            <div className="space-y-4">
                                <TextArea
                                    placeholder="Reason (required for unpublishing or flagging)"
                                    value={rejectionReason}
                                    onChange={setRejectionReason}
                                    rows={3}
                                />
                                <div className="flex gap-3">
                                    <Button color="secondary" size="md" iconLeading={<Flag01 />} onClick={handleFlagAd} className="flex-1">
                                        Flag for Review
                                    </Button>
                                    <ConfirmationDialog
                                        title="Unpublish Ad"
                                        description={`Are you sure you want to unpublish "${ad.title}"? This action cannot be undone.`}
                                        confirmLabel="Yes, Unpublish"
                                        cancelLabel="Cancel"
                                        onConfirm={confirmUnpublishAd}
                                    >
                                        <Button color="secondary-destructive" size="md" className="flex-1">
                                            Unpublish
                                        </Button>
                                    </ConfirmationDialog>
                                </div>
                            </div>
                        )}

                        {ad.status === 'REJECTED' && (
                            <div className="space-y-4">
                                <ConfirmationDialog
                                    title="Re-activate Ad"
                                    description={`Are you sure you want to re-activate "${ad.title}"? This ad will become visible to users again.`}
                                    confirmLabel="Yes, Re-activate"
                                    cancelLabel="Cancel"
                                    onConfirm={handleReapproveAd}
                                >
                                    <Button color="primary" size="md" iconLeading={<CheckCircle />} className="flex-1">
                                        Re-activate Ad
                                    </Button>
                                </ConfirmationDialog>
                            </div>
                        )}

                        {ad.status === 'EXPIRED' && (
                            <div className="space-y-4">
                                <ConfirmationDialog
                                    title="Re-publish Ad"
                                    description={`Are you sure you want to re-publish "${ad.title}"? This ad will become visible to users again.`}
                                    confirmLabel="Yes, Re-publish"
                                    cancelLabel="Cancel"
                                    onConfirm={handleApproveAd}
                                >
                                    <Button color="primary" size="md" iconLeading={<CheckCircle />} className="flex-1">
                                        Re-publish Ad
                                    </Button>
                                </ConfirmationDialog>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Right Side */}
                <div className="lg:col-span-4 space-y-6">

                    {/* User Profile */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Users01 className="h-5 w-5" />
                            User Profile
                        </h2>
                        {ad.user ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Avatar size="lg" src={ad.user.avatar ? getProxiedImageUrl(ad.user.avatar) : undefined} alt={ad.user.firstName} />
                                    <div>
                                        <h3 className="font-semibold text-primary">{ad.user.firstName} {ad.user.lastName}</h3>
                                        <p className="text-sm text-tertiary">{ad.user.phone || ad.user.email}</p>
                                        {ad.user.phone && <p className="text-xs text-tertiary">{ad.user.email}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-tertiary">Verified:</span>
                                        <span className={`ml-1 font-medium ${ad.user.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {ad.user.isVerified ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">Joined:</span>
                                        <span className="ml-1 font-medium text-primary">
                                            {ad.user.createdAt ? new Date(ad.user.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-tertiary">User information not available</p>
                        )}
                    </div>

                    {/* Subscription Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <CurrencyDollar className="h-5 w-5" />
                            Subscription
                        </h2>
                        {ad.subscriptions && ad.subscriptions.length > 0 ? (
                            <div className="space-y-3">
                                {ad.subscriptions.map((subscription: Subscription, index: number) => (
                                    <div key={subscription.id} className="p-3 bg-secondary rounded-lg border border-secondary">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-sm font-medium ${subscription.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                                {subscription.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                            <div className={`w-2 h-2 rounded-full ${subscription.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                        </div>
                                        <div className="text-xs text-tertiary space-y-1">
                                            <div>Start: {subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : 'N/A'}</div>
                                            <div>End: {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'N/A'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-tertiary text-sm">No subscription found</p>
                        )}
                    </div>

                    {/* Moderation History */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Moderation History
                        </h2>
                        <div className="space-y-3">
                            {ad.moderationHistory && ad.moderationHistory.length > 0 ? (
                                ad.moderationHistory.map((history) => (
                                    <div key={history.id} className={`flex gap-3 p-3 rounded-lg border ${history.action === 'APPROVED'
                                        ? 'bg-success-subtle border-success-subtle'
                                        : 'bg-warning-subtle border-warning-subtle'
                                        }`}>
                                        {history.action === 'APPROVED' ? (
                                            <CheckCircle className="h-5 w-5 text-success-primary mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-warning-primary mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`font-medium ${history.action === 'APPROVED' ? 'text-success-primary' : 'text-warning-primary'
                                                    }`}>
                                                    {history.action}
                                                </span>
                                                <span className="text-xs text-tertiary">
                                                    {history.createdAt ? new Date(history.createdAt).toLocaleString() : 'N/A'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-tertiary">
                                                By {history.moderator.firstName} {history.moderator.lastName || ''}
                                            </p>
                                            {history.reason && (
                                                <p className="text-xs text-tertiary mt-1">Reason: {history.reason}</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex gap-3 p-3 bg-secondary rounded-lg border border-secondary">
                                    <Calendar className="h-5 w-5 text-tertiary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-primary">Created</span>
                                            <span className="text-xs text-tertiary">{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                        <p className="text-xs text-tertiary">Ad submitted for review</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Quick Stats</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-tertiary mb-1">Ad ID</div>
                                <div className="text-sm font-medium text-primary break-all">{ad.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Created</div>
                                <div className="text-sm font-medium text-primary">{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Expires</div>
                                {ad.expiresAt ? (
                                    <div className="flex flex-col">
                                        <div className="text-sm font-medium text-primary">{formatLocalDate(ad.expiresAt)}</div>
                                        <div className="text-xs text-tertiary">
                                            {(() => {
                                                const daysLeft = getDaysRemaining(ad.expiresAt);
                                                const isExpired = daysLeft <= 0;
                                                return isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm font-medium text-primary">N/A</div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Updated</div>
                                <div className="text-sm font-medium text-primary">{ad.updatedAt ? new Date(ad.updatedAt).toLocaleDateString() : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
