"use client";

import React, { useState, useEffect } from "react";
import { SearchLg, Calendar, Clock, User01, Plus } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useBookings, useDeleteBooking } from "@/hooks/use-bookings";
import { Booking, BookingStatus } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { useFormAlert } from "@/hooks/use-form-alert";

const statusOptions = [
    { id: "all", label: "All Status" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "REJECTED", label: "Rejected" },
    { id: "COMPLETED", label: "Completed" },
];

function BookingActions({ booking }: { booking: Booking }) {
    const deleteBookingMutation = useDeleteBooking();
    const { showAlert } = useFormAlert();

    const handleDelete = async () => {
        try {
            await deleteBookingMutation.mutateAsync(booking.id);
        } catch (error: any) {
            showAlert(
                "Delete Failed",
                error.message || "Failed to delete booking. Please try again.",
                "error"
            );
        }
    };

    return (
        <>
            <div className="flex justify-end gap-2">
                <Button color="secondary" size="sm" href={`/dashboard/booking-management/${booking.id}`}>
                    View
                </Button>
                <ConfirmationDialog
                    title={`Delete booking #${booking.id.substring(0, 8)}?`}
                    description={`Are you sure you want to delete this booking? This action cannot be undone.`}
                    onConfirm={handleDelete}
                >
                    <Button color="secondary-destructive" size="sm" type="button" isLoading={deleteBookingMutation.isPending}>Delete</Button>
                </ConfirmationDialog>
            </div>

        </>
    );
}

export default function BookingManagementPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"all" | BookingStatus>("all");
    
    const { data: bookings, pagination, isLoading, currentPage, setPage } = useBookings({
        search: searchTerm || undefined,
        status: selectedStatus === "all" ? undefined : selectedStatus,
    });
    const paginationInfo = usePaginationInfo({
        data: bookings,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage: 10
    });

    const columns: Column<Booking>[] = [
        {
            key: "booking",
            label: "Booking ID",
            render: (booking) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">
                        <Button
                            color="primary"
                            size="sm"
                            href={`/dashboard/booking-management/${booking.id}`}
                            className="p-0 h-auto underline"
                        >
                            #{booking.id.substring(0, 8)}
                        </Button>
                    </span>
                    <span className="text-xs text-tertiary">{new Date(booking.createdAt).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: "user",
            label: "User",
            render: (booking) => (
                <div className="flex items-center gap-3">
                    {booking.user?.avatar ? (
                        <img
                            src={getProxiedImageUrl(booking.user.avatar)}
                            alt={`${booking.user.firstName} ${booking.user.lastName}`}
                            className="w-8 h-8 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User01 className="w-4 h-4 text-gray-500" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-medium text-primary">{booking.user?.firstName} {booking.user?.lastName}</span>
                        <span className="text-xs text-tertiary">{booking.user?.phone}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "ad",
            label: "Ad",
            render: (booking) => (
                <div className="flex flex-col">
                    <span className="font-medium text-primary">{booking.ad?.title}</span>
                    <span className="text-xs text-tertiary">ID: {booking.ad?.id.substring(0, 8)}</span>
                </div>
            ),
        },
        {
            key: "dates",
            label: "Dates",
            render: (booking) => (
                <div className="flex flex-col">
                    {booking.startDate && (
                        <div className="flex items-center gap-1 text-sm">
                            <Calendar className="size-4" />
                            <span>{new Date(booking.startDate).toLocaleDateString()}</span>
                        </div>
                    )}
                    {booking.endDate && (
                        <div className="flex items-center gap-1 text-sm text-tertiary">
                            <Clock className="size-4" />
                            <span>{new Date(booking.endDate).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (booking) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    booking.status === 'SUBMITTED' ? "bg-warning-subtle text-warning-primary" :
                    booking.status === 'CONFIRMED' ? "bg-success-subtle text-success-primary" :
                    booking.status === 'CANCELLED' ? "bg-error-subtle text-error-primary" :
                    booking.status === 'REJECTED' ? "bg-error-subtle text-error-primary" :
                    booking.status === 'COMPLETED' ? "bg-info-subtle text-info-primary" :
                    "bg-secondary text-tertiary"
                }`}>
                    {booking.status === 'SUBMITTED' ? 'Submitted' : 
                     booking.status === 'CANCELLED' ? 'Cancelled' :
                     booking.status === 'REJECTED' ? 'Rejected' :
                     booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                </span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (booking) => <BookingActions booking={booking} />,
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Booking management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Bookings</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="primary" size="sm" iconLeading={<Plus />}>
                        New booking
                    </Button>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search bookings"
                            icon={SearchLg}
                            iconClassName="size-5"
                            aria-label="Search bookings"
                            className="max-w-md"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />

                        <Select
                            aria-label="Filter by status"
                            selectedKey={selectedStatus}
                            onSelectionChange={(key) => {
                                if (typeof key === "string") {
                                    setSelectedStatus(key as "all" | BookingStatus);
                                }
                            }}
                            items={statusOptions}
                            size="sm"
                            className="min-w-32"
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>

                    <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName="bookings"
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={bookings}
                    keyExtractor={(booking) => booking.id}
                    isLoading={isLoading}
                    emptyTitle="No bookings found"
                    emptyDescription="Try adjusting your search or filter criteria."
                    emptyAction={
                        <Button color="primary" size="sm" iconLeading={<Plus />}>
                            New booking
                        </Button>
                    }
                    paginationInfo={paginationInfo}
                    onPageChange={setPage}
                    itemName="bookings"
                />
            </section>
        </div>
    );
}