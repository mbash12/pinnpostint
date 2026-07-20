"use client";

import React, { useState } from "react";
import {
    ArrowLeft,
    User01,
    Wallet01,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    File02,
    SwitchHorizontal01,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import { TextArea } from "@/components/base/textarea/textarea";
import { useTransfer, useUpdateTransferStatus, useDeleteTransfer } from "@/hooks/use-transfers";
import { Transfer, TransferStatus, TransferType } from "@/lib/api-types";
import { useFormAlert } from "@/hooks/use-form-alert";

const statusConfig: Record<TransferStatus, { color: 'warning' | 'success' | 'error'; icon: React.FunctionComponent<{ className?: string; strokeWidth?: string | number }>; label: string }> = {
    PENDING: { color: 'warning', icon: Clock, label: 'Pending' },
    COMPLETED: { color: 'success', icon: CheckCircle, label: 'Completed' },
    CANCELLED: { color: 'error', icon: XCircle, label: 'Cancelled' },
};

const typeLabels: Record<TransferType, string> = {
    BOOKING_REFUND: 'Booking Refund',
    BOOKING_PAYMENT_TO_SELLER: 'Booking Payment to Seller',
    SUBSCRIPTION_REFUND: 'Subscription Refund',
    SUBSCRIPTION_PAYOUT: 'Subscription Payout',
    AD_PAYMENT: 'Ad Payment',
    OTHER: 'Other',
};

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { showAlert } = useFormAlert();
    const resolvedParams = React.use(params);
    const { data: transferResponse, isLoading, refetch } = useTransfer(resolvedParams.id);
    const updateStatusMutation = useUpdateTransferStatus();
    const deleteTransferMutation = useDeleteTransfer();

    const [notes, setNotes] = useState("");
    const [showActionModal, setShowActionModal] = useState(false);
    const [action, setAction] = useState<'COMPLETE' | 'CANCEL' | null>(null);

    const transfer = transferResponse?.data;

    const handleStatusUpdate = async () => {
        if (!action) return;

        const status = action === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED';

        try {
            await updateStatusMutation.mutateAsync({
                transferId: resolvedParams.id,
                data: {
                    status,
                    notes: notes.trim() || undefined,
                }
            });
            showAlert(
                "Success",
                `Transfer marked as ${action === 'COMPLETE' ? 'Completed' : 'Cancelled'}`,
                "success"
            );
            setNotes("");
            setShowActionModal(false);
            setAction(null);
            refetch();
        } catch (error: any) {
            showAlert("Error", error?.message || "Failed to update transfer status", "error");
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this transfer? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteTransferMutation.mutateAsync(resolvedParams.id);
            showAlert("Success", "Transfer deleted successfully", "success");
            window.location.href = '/dashboard/payments/transfers';
        } catch (error: any) {
            showAlert("Error", error?.message || "Failed to delete transfer", "error");
        }
    };

    const openActionModal = (actionType: 'COMPLETE' | 'CANCEL') => {
        setAction(actionType);
        setNotes("");
        setShowActionModal(true);
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button
                        color="secondary"
                        size="sm"
                        iconLeading={<ArrowLeft />}
                        href="/dashboard/payments/transfers"
                    >
                        Back to Transfers
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Loading transfer details...</p>
                </div>
            </div>
        );
    }

    if (!transfer) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button
                        color="secondary"
                        size="sm"
                        iconLeading={<ArrowLeft />}
                        href="/dashboard/payments/transfers"
                    >
                        Back to Transfers
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <File02 className="mx-auto mb-4 h-12 w-12 text-error-primary" />
                    <h2 className="mb-2 text-lg font-semibold text-primary">Transfer not found</h2>
                    <p className="text-tertiary">The transfer you&apos;re looking for doesn&apos;t exist.</p>
                </div>
            </div>
        );
    }

    const config = statusConfig[transfer.status];
    const StatusIcon = config.icon;

    const canModify = transfer.status === 'PENDING';

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        color="secondary"
                        size="sm"
                        iconLeading={<ArrowLeft />}
                        href="/dashboard/payments/transfers"
                    >
                        Back to Transfers
                    </Button>
                    <BadgeWithIcon color={config.color} iconLeading={StatusIcon}>
                        {config.label}
                    </BadgeWithIcon>
                </div>
                {canModify && (
                    <div className="flex gap-2">
                        <Button
                            color="primary-destructive"
                            size="sm"
                            onClick={handleDelete}
                        >
                            Delete Transfer
                        </Button>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left Column - Transfer Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Information */}
                    <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold text-primary">Transfer Information</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-tertiary">Transfer ID</p>
                                    <p className="font-mono text-sm font-medium text-primary">#{transfer.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-tertiary">Type</p>
                                    <p className="font-medium text-primary">{typeLabels[transfer.transferType]}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-tertiary">Amount</p>
                                    <div className="flex items-center gap-2">
                                        <Wallet01 className="size-4 text-tertiary" />
                                        <p className="text-lg font-semibold text-primary">
                                            {transfer.currency} {Number(transfer.amount).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-tertiary">Created</p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="size-4 text-tertiary" />
                                        <p className="text-primary">
                                            {new Date(transfer.createdAt).toLocaleDateString()} at{' '}
                                            {new Date(transfer.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {transfer.description && (
                                <div>
                                    <p className="text-sm text-tertiary">Description</p>
                                    <p className="text-primary">{transfer.description}</p>
                                </div>
                            )}
                            {transfer.notes && (
                                <div>
                                    <p className="text-sm text-tertiary">Notes</p>
                                    <p className="text-primary">{transfer.notes}</p>
                                </div>
                            )}
                            {transfer.processedAt && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-tertiary">Processed At</p>
                                        <p className="text-sm text-primary">
                                            {new Date(transfer.processedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    {transfer.processedByUser && (
                                        <div>
                                            <p className="text-sm text-tertiary">Processed By</p>
                                            <p className="text-sm text-primary">
                                                {transfer.processedByUser.firstName} {transfer.processedByUser.lastName}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Related Entity */}
                    {(transfer.booking || transfer.subscription || transfer.ad) && (
                        <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-primary">Related To</h2>
                            {transfer.booking && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-tertiary">Booking</p>
                                            <p className="font-medium text-primary">#{transfer.bookingId}</p>
                                        </div>
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            href={`/dashboard/booking-management/bookings/${transfer.bookingId}`}
                                        >
                                            View Booking
                                        </Button>
                                    </div>
                                    {transfer.booking.ad && (
                                        <div>
                                            <p className="text-sm text-tertiary">Service</p>
                                            <p className="text-primary">{transfer.booking.ad.title}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {transfer.subscription && (
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-sm text-tertiary">Subscription</p>
                                        <p className="font-medium text-primary">#{transfer.subscriptionId}</p>
                                    </div>
                                    {transfer.subscription.ad && (
                                        <div>
                                            <p className="text-sm text-tertiary">Service</p>
                                            <p className="text-primary">{transfer.subscription.ad.title}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {transfer.ad && (
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-sm text-tertiary">Ad</p>
                                        <p className="font-medium text-primary">{transfer.ad.title}</p>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Right Column - Users & Actions */}
                <div className="space-y-6">
                    {/* From User */}
                    <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold text-primary flex items-center gap-2">
                            <SwitchHorizontal01 className="size-5" />
                            From
                        </h2>
                        {transfer.fromUser ? (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
                                    <User01 className="w-5 h-5 text-brand-primary" />
                                </div>
                                <div>
                                    <p className="font-medium text-primary">
                                        {transfer.fromUser.firstName} {transfer.fromUser.lastName}
                                    </p>
                                    <p className="text-sm text-tertiary">
                                        {transfer.fromUser.phone || transfer.fromUser.email}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-tertiary">Platform</p>
                        )}
                    </section>

                    {/* To User */}
                    <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold text-primary flex items-center gap-2">
                            <SwitchHorizontal01 className="size-5 rotate-180" />
                            To
                        </h2>
                        {transfer.toUser ? (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-success-subtle flex items-center justify-center">
                                    <User01 className="w-5 h-5 text-success-primary" />
                                </div>
                                <div>
                                    <p className="font-medium text-primary">
                                        {transfer.toUser.firstName} {transfer.toUser.lastName}
                                    </p>
                                    <p className="text-sm text-tertiary">
                                        {transfer.toUser.phone || transfer.toUser.email}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-tertiary">Platform</p>
                        )}
                    </section>

                    {/* Actions */}
                    {canModify && (
                        <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-primary">Actions</h2>
                            <div className="space-y-2">
                                <Button
                                    color="primary"
                                    className="w-full"
                                    onClick={() => openActionModal('COMPLETE')}
                                >
                                    <CheckCircle className="size-4" />
                                    Mark as Completed
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    className="w-full"
                                    onClick={() => openActionModal('CANCEL')}
                                >
                                    <XCircle className="size-4" />
                                    Mark as Cancelled
                                </Button>
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Action Modal */}
            {showActionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold text-primary">
                            {action === 'COMPLETE' ? 'Mark Transfer as Completed' : 'Mark Transfer as Cancelled'}
                        </h2>
                        <p className="mb-4 text-sm text-tertiary">
                            {action === 'COMPLETE'
                                ? 'Confirm that this transfer has been completed and funds have been transferred.'
                                : 'Cancel this transfer. No funds will be moved.'}
                        </p>
                        <TextArea
                            placeholder="Add notes (optional)..."
                            value={notes}
                            onChange={setNotes}
                            rows={3}
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button
                                color="secondary"
                                onClick={() => {
                                    setShowActionModal(false);
                                    setAction(null);
                                    setNotes("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={action === 'COMPLETE' ? 'primary' : 'primary-destructive'}
                                onClick={handleStatusUpdate}
                                disabled={updateStatusMutation.isPending}
                            >
                                {updateStatusMutation.isPending ? 'Processing...' : action === 'COMPLETE' ? 'Complete' : 'Cancel Transfer'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
