"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, Eye } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";
import { useAd } from "@/hooks/use-ads";
import { Ad } from "@/lib/api-types";
import { formatCurrency } from "@/utils/currency";
import { DynamicMapView } from "@/components/shared/dynamic-map-view";
import { MarkerPin01 } from "@untitledui/icons";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { useState } from "react";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";

export default function AdDetailPage() {
    const params = useParams<{ id: string }>();
    const adId = params?.id;

    const { data: adResponse, isLoading, error } = useAd(adId!);
    const ad = (adResponse?.data?.data || adResponse?.data || adResponse) as Ad | null;
    const [showSlotsModal, setShowSlotsModal] = useState(false);

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-management/ads">
                        Back to ads
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Loading ad details...</p>
                </div>
            </div>
        );
    }

    if (error || !ad) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-management/ads">
                        Back to ads
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Ad not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex items-center gap-4">
                <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/ad-management/ads">
                    Back to ads
                </Button>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h1 className="text-2xl font-semibold text-primary mb-4">{ad.title}</h1>

                        {ad.images && ad.images.length > 0 && (
                            <div className="aspect-square max-w-md overflow-hidden rounded-lg bg-secondary/30 mb-4 flex items-center justify-center">
                                <img src={ad.images[0] ? getProxiedImageUrl(ad.images[0]) : undefined} alt={ad.title} className="max-w-full max-h-full object-contain" />
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-tertiary mb-2">Description</h3>
                                <p className="text-primary whitespace-pre-line">{ad.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-secondary">
                                <div>
                                    <span className="text-sm font-semibold text-tertiary">Price</span>
                                    <div className="flex flex-col">
                                        <p className={`text-lg font-semibold ${ad.discountedPrice ? 'text-sm text-tertiary line-through' : 'text-primary'}`}>
                                            {ad.price ? formatCurrency(ad.price) : 'N/A'}
                                        </p>
                                        {ad.discountedPrice && (
                                            <p className="text-lg font-semibold text-success-primary">
                                                {formatCurrency(ad.discountedPrice)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-tertiary">Category</span>
                                    <p className="text-lg font-semibold text-primary">{ad.category?.name || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-secondary space-y-4">
                                <h3 className="text-sm font-semibold text-tertiary flex items-center gap-2">
                                    <MarkerPin01 className="h-4 w-4" />
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
                                        height={200}
                                    />
                                ) : ad.location?.latitude && ad.location?.longitude ? (
                                    <DynamicMapView
                                        latitude={ad.location.latitude}
                                        longitude={ad.location.longitude}
                                        height={200}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-primary mb-4">User Information</h3>
                        {ad.user ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Avatar size="md" src={ad.user.avatar ? getProxiedImageUrl(ad.user.avatar) : undefined} alt={ad.user.firstName} />
                                    <div>
                                        <p className="font-semibold text-primary">{ad.user.firstName} {ad.user.lastName}</p>
                                        <p className="text-sm text-tertiary">{ad.user.phone || ad.user.email}</p>
                                        {ad.user.phone && <p className="text-xs text-tertiary">{ad.user.email}</p>}
                                    </div>                                </div>
                            </div>
                        ) : (
                            <p className="text-tertiary">No user information</p>
                        )}
                    </div>

                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-primary mb-4">Ad Details</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-tertiary">Status</span>
                                <span className="font-medium text-primary">{ad.status}</span>
                            </div>
                            {ad.attachment && ad.attachment.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-tertiary text-xs block">Attachments ({ad.attachment.length})</span>
                                    <div className="space-y-1">
                                        {ad.attachment.map((url, index) => (
                                            <div key={index} className="flex justify-between items-center bg-secondary/30 p-2 rounded-md">
                                                <span className="text-xs text-primary truncate max-w-[150px]" title={decodeURIComponent(url.split('/').pop() || '')}>
                                                    {decodeURIComponent(url.split('/').pop() || '')}
                                                </span>
                                                <a 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-medium text-brand-secondary hover:underline flex items-center gap-1"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    View
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-tertiary">Views</span>
                                <span className="font-medium text-primary">{ad.views?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary">Created</span>
                                <span className="font-medium text-primary">{new Date(ad.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary">Updated</span>
                                <span className="font-medium text-primary">{new Date(ad.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {ad.enableBooking && (
                        <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-primary">Booking Configuration</h3>
                                {ad.bookingType === 'SLOTS' && ad.slots && ad.slots.length > 0 && (
                                    <Button color="secondary" size="sm" onClick={() => setShowSlotsModal(true)}>
                                        View Slots
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm border-b border-secondary pb-3">
                                    <span className="text-tertiary font-medium">Booking Type</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${ad.bookingType === 'SLOTS' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                                        <span className="font-bold text-primary">{ad.bookingType === 'SLOTS' ? 'Time Slots' : 'Standard (Date Range)'}</span>
                                    </div>
                                </div>

                                {ad.bookingType === 'SLOTS' && ad.slots && ad.slots.length > 0 ? (
                                    <div className="space-y-2">
                                        <span className="text-tertiary text-xs font-semibold uppercase tracking-wider">Weekly Availability</span>
                                        <div className="grid grid-cols-1 gap-2">
                                            {ad.slots.map((slot: any, index: number) => (
                                                <div key={index} className="flex justify-between items-center bg-secondary/50 p-3 rounded-xl border border-secondary hover:bg-secondary/80 transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-primary text-sm">{slot.date?.split('T')[0]}</span>
                                                        <span className="text-xs text-tertiary">{slot.startTime} - {slot.endTime}</span>
                                                    </div>
                                                    <div className="bg-primary/50 px-2 py-1 rounded text-[10px] font-bold text-tertiary border border-secondary">
                                                        MAX: {slot.maxBookings}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : ad.bookingType === 'SLOTS' ? (
                                    <div className="py-4 text-center bg-secondary/30 rounded-xl border border-dashed border-secondary">
                                        <p className="text-sm text-tertiary italic">No time slots configured</p>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-secondary/30 rounded-xl border border-secondary">
                                        <p className="text-xs text-tertiary leading-relaxed">
                                            This ad uses the standard booking system which allows users to select any date and time range.
                                        </p>
                                    </div>
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
            </div>
        </div>
    );
}
