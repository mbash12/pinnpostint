"use client";

import React, { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { useFormAlert } from "@/hooks/use-form-alert";
import { useBooking, useUpdateBookingStatus } from "@/hooks/use-bookings";
import { Booking, BookingStatus } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";
import { useParams, useRouter } from "next/navigation";
import { Clock, User01, Calendar, ArrowLeft, Eye } from "@untitledui/icons";

export default function BookingDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    
    const { data: bookingResponse, isLoading, isError } = useBooking(id);
    const booking = (bookingResponse?.data || bookingResponse) as Booking | null;
    const updateStatusMutation = useUpdateBookingStatus();
    const { showAlert } = useFormAlert();
    
    const [notes, setNotes] = useState("");
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [currentStatus, setCurrentStatus] = useState<BookingStatus | null>(null);

    const handleStatusUpdate = async (newStatus: BookingStatus, statusNotes?: string) => {
        if (!booking || !booking.id) return;

        // Validate status transition
        const isValidTransition = validateStatusTransition(booking.status, newStatus);
        if (!isValidTransition) {
            showAlert('Error', `Invalid status transition from ${booking.status} to ${newStatus}`, 'error');
            return;
        }

        try {
            await updateStatusMutation.mutateAsync({
                bookingId: booking.id,
                status: newStatus,
                notes: statusNotes || undefined
            });

            showAlert('Success', `Booking status updated to ${newStatus.toLowerCase()}`, 'success');

            // Refresh the page to show updated data
            router.refresh();
        } catch (error: any) {
            showAlert('Error', error?.message || 'Failed to update booking status', 'error');
        }
    };

    // Helper function to validate status transitions
    const validateStatusTransition = (currentStatus: BookingStatus, newStatus: BookingStatus): boolean => {
        // Define valid status transitions
        const validTransitions: Record<BookingStatus, BookingStatus[]> = {
            SUBMITTED: ['CONFIRMED', 'REJECTED'],
            CONFIRMED: ['COMPLETED', 'CANCELLED', 'CANCELLATION_REQUESTED'],
            COMPLETED: ['SUBMITTED'], // Admin can reset to submitted if needed
            CANCELLED: ['SUBMITTED'],  // Admin can reset to submitted if needed
            REJECTED: ['SUBMITTED'],  // Admin can reset to submitted if needed
            CANCELLATION_REQUESTED: ['CONFIRMED', 'CANCELLED']  // Admin can approve or cancel
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    };

    // Centralized function to determine available actions based on current status
    const getAvailableActions = (currentStatus: BookingStatus) => {
        const actions = {
            quickActions: [] as Array<{label: string, status: BookingStatus, color: string, isTextOnly?: boolean}>,
            sidebarActions: [] as Array<{label: string, status: BookingStatus, color: string}>
        };

        switch(currentStatus) {
            case 'SUBMITTED':
                // For submitted bookings, show confirm and reject options
                actions.quickActions = [
                    { label: 'Confirm', status: 'CONFIRMED', color: 'secondary' },
                    { label: 'Reject', status: 'REJECTED', color: 'secondary-destructive' }
                ];
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' },
                    { label: 'Confirm Booking', status: 'CONFIRMED', color: 'secondary' },
                    { label: 'Reject Booking', status: 'REJECTED', color: 'secondary-destructive' },
                    { label: 'Cancel Booking', status: 'CANCELLED', color: 'secondary-destructive' }
                ];
                break;

            case 'CONFIRMED':
                // For confirmed bookings, show complete option
                actions.quickActions = [
                    { label: 'Mark as Completed', status: 'COMPLETED', color: 'secondary' }
                ];
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' },
                    { label: 'Mark as Completed', status: 'COMPLETED', color: 'secondary' },
                    { label: 'Cancel Booking', status: 'CANCELLED', color: 'secondary-destructive' }
                ];
                break;
                
            case 'COMPLETED':
                // For completed bookings, admin can reset to submitted if needed
                actions.quickActions = [
                    { label: 'Booking is finalized', status: 'COMPLETED', color: '', isTextOnly: true }
                ];
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' }
                ];
                break;
                
            case 'CANCELLED':
                // For cancelled bookings, admin can reset to submitted if needed
                actions.quickActions = [
                    { label: 'Booking is finalized', status: 'CANCELLED', color: '', isTextOnly: true }
                ];
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' }
                ];
                break;

            case 'REJECTED':
                // For rejected bookings, admin can reset to submitted if needed
                actions.quickActions = [
                    { label: 'Booking is finalized', status: 'REJECTED', color: '', isTextOnly: true }
                ];
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' }
                ];
                break;

            default:
                // For any other status, allow all admin overrides
                actions.sidebarActions = [
                    { label: 'Mark as Submitted', status: 'SUBMITTED', color: 'secondary' },
                    { label: 'Confirm Booking', status: 'CONFIRMED', color: 'secondary' },
                    { label: 'Mark as Completed', status: 'COMPLETED', color: 'secondary' },
                    { label: 'Cancel Booking', status: 'CANCELLED', color: 'secondary-destructive' }
                ];
        }

        return actions;
    };
    
    const handleStatusChangeWithNotes = (newStatus: BookingStatus) => {
        setCurrentStatus(newStatus);
        setNotes("");
        setShowNotesModal(true);
    };
    
    const confirmStatusUpdate = () => {
        if (currentStatus) {
            handleStatusUpdate(currentStatus, notes);
            setNotes("");
            setShowNotesModal(false);
            setCurrentStatus(null);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management">
                        Back to Bookings
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Loading booking details...</p>
                </div>
            </div>
        );
    }

    if (isError || !booking) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management">
                        Back to Bookings
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Booking not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management">
                        Back
                    </Button>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-primary">Booking {booking?.id?.substring(0, 8) || '...'}...</h1>
                        <div className="flex items-center gap-4 text-sm text-tertiary">
                            <span className="flex items-center gap-1">
                                <Calendar className="size-4" />
                                {booking?.createdAt ? new Date(booking.createdAt).toLocaleDateString() : '...'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Booking Details */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Booking Information</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-sm text-tertiary">Booking ID</span>
                                    <p className="font-medium text-primary">#{booking?.id || '...'}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-tertiary">Status</span>
                                    <p className="font-medium text-primary">
                                        <Badge
                                            color={
                                                booking?.status === 'SUBMITTED' ? "warning" :
                                                booking?.status === 'CONFIRMED' ? "success" :
                                                booking?.status === 'CANCELLED' ? "error" :
                                                booking?.status === 'REJECTED' ? "error" :
                                                booking?.status === 'COMPLETED' ? "brand" : "gray"
                                            }
                                        >
                                            {booking?.status === 'SUBMITTED' ? 'Submitted' :
                                             booking?.status === 'CANCELLED' ? 'Cancelled' :
                                             booking?.status === 'REJECTED' ? 'Rejected' :
                                             (booking?.status?.charAt(0) || '') + (booking?.status?.slice(1).toLowerCase() || '')}
                                        </Badge>
                                    </p>
                                </div>
                                {booking?.slotId && booking?.bookingDate ? (
                                    <>
                                        <div>
                                            <span className="text-sm text-tertiary">Appointment Date</span>
                                            <p className="font-medium text-primary">
                                                {new Date(booking.bookingDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-tertiary">Time Slot</span>
                                            <p className="font-medium text-primary">
                                                {(() => {
                                                    const slot = booking.ad?.slots?.find((s: any) => s.id === booking.slotId);
                                                    return slot ? `${slot.startTime} - ${slot.endTime}` : 'Specific Slot';
                                                })()}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <span className="text-sm text-tertiary">Start Date</span>
                                            <p className="font-medium text-primary">
                                                {booking?.startDate ? new Date(booking.startDate).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-tertiary">End Date</span>
                                            <p className="font-medium text-primary">
                                                {booking?.endDate ? new Date(booking.endDate).toLocaleDateString() : 'N/A'}
                                            </p>
                                        </div>
                                    </>
                                )}
                                <div className="sm:col-span-2">
                                    <span className="text-sm text-tertiary">Notes</span>
                                    <p className="font-medium text-primary">
                                        {booking?.notes || 'No notes provided'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ad Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Associated Ad
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-primary">{booking?.ad?.title}</h3>
                                    <p className="text-sm text-tertiary">Status: {booking?.ad?.status}</p>
                                    <p className="text-lg font-bold text-primary mt-2">
                                        {booking?.ad?.price ? formatCurrency(booking.ad.price) : 'N/A'}
                                    </p>
                                    <p className="text-sm text-tertiary mt-2 line-clamp-2">
                                        {booking?.ad?.description ? booking.ad.description.replace(/<[^>]*>/g, ' ') : 'No description provided'}
                                    </p>
                                </div>
                                <Button color="secondary" size="sm" href={`/dashboard/ad-moderation/${booking.ad?.id}`}>
                                    View Ad
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* User Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">User Information</h2>
                        {booking?.user ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {booking.user.avatar ? (
                                        <Avatar size="md" src={getProxiedImageUrl(booking.user.avatar)} alt={`${booking.user.firstName} ${booking.user.lastName}`} />
                                    ) : (
                                        <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-xs font-medium text-tertiary">
                                            {booking.user.firstName.slice(0, 1).toUpperCase()}{booking.user.lastName?.slice(0, 1).toUpperCase() || ''}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-primary">{booking.user.firstName} {booking.user.lastName}</p>
                                        <p className="text-sm text-tertiary">{booking.user.phone || booking.user.email}</p>
                                        {booking.user.phone && <p className="text-xs text-tertiary">{booking.user.email}</p>}
                                    </div>                                </div>
                            </div>
                        ) : (
                            <p className="text-tertiary">No user information</p>
                        )}
                    </div>

                    {/* Booking Stats */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Booking Details</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-tertiary mb-1">Created At</div>
                                <div className="text-sm font-medium text-primary">{booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Updated At</div>
                                <div className="text-sm font-medium text-primary">{booking?.updatedAt ? new Date(booking.updatedAt).toLocaleString() : 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Booking ID</div>
                                <div className="text-sm font-mono text-primary break-all">{booking?.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Ad ID</div>
                                <div className="text-sm font-mono text-primary break-all">{booking?.ad?.id}</div>
                            </div>
                        </div>
                    </div>

                    {/* More Actions - Allow status changes where appropriate */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Actions</h2>
                        <div className="space-y-3">
                            {booking && getAvailableActions(booking.status).sidebarActions.map((action, index) => (
                                <Button
                                    key={index}
                                    color={action.color as any}
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleStatusChangeWithNotes(action.status)}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes Modal */}
            {showNotesModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-primary rounded-2xl border border-secondary shadow-lg w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-primary mb-4">
                            Add Notes for {currentStatus} Status
                        </h3>

                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter any notes about this status change..."
                            className="w-full p-3 border border-secondary rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[100px]"
                        />

                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                color="secondary"
                                onClick={() => {
                                    setShowNotesModal(false);
                                    setCurrentStatus(null);
                                    setNotes("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onClick={confirmStatusUpdate}
                                disabled={!currentStatus}
                            >
                                Update Status
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}