"use client";

import React, { useState } from "react";
import { SearchLg, Calendar, User01, SwitchHorizontal01, CheckCircle, XCircle, Clock, Wallet01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { SelectItem } from "@/components/base/select/select-item";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTransfers } from "@/hooks/use-transfers";
import { Transfer, TransferStatus, TransferType } from "@/lib/api-types";

const statusOptions = [
    { id: "all", label: "All Status" },
    { id: "PENDING", label: "Pending" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];

const typeOptions = [
    { id: "all", label: "All Types" },
    { id: "BOOKING_REFUND", label: "Booking Refund" },
    { id: "BOOKING_PAYMENT_TO_SELLER", label: "Booking Payment to Seller" },
    { id: "SUBSCRIPTION_REFUND", label: "Subscription Refund" },
    { id: "SUBSCRIPTION_PAYOUT", label: "Subscription Payout" },
    { id: "AD_PAYMENT", label: "Ad Payment" },
    { id: "OTHER", label: "Other" },
];

function TransferActions({ transfer }: { transfer: Transfer }) {
    return (
        <div className="flex justify-end gap-2">
            <Button
                color="secondary"
                size="sm"
                href={`/dashboard/payments/transfers/${transfer.id}`}
            >
                View
            </Button>
        </div>
    );
}

const getStatusIcon = (status: TransferStatus) => {
    switch (status) {
        case 'PENDING': return Clock;
        case 'COMPLETED': return CheckCircle;
        case 'CANCELLED': return XCircle;
        default: return Clock;
    }
};

const getStatusConfig = (status: TransferStatus) => {
    switch (status) {
        case 'PENDING':
            return {
                bg: 'bg-warning-subtle',
                text: 'text-warning-primary',
                label: 'Pending'
            };
        case 'COMPLETED':
            return {
                bg: 'bg-success-subtle',
                text: 'text-success-primary',
                label: 'Completed'
            };
        case 'CANCELLED':
            return {
                bg: 'bg-error-subtle',
                text: 'text-error-primary',
                label: 'Cancelled'
            };
        default:
            return {
                bg: 'bg-secondary',
                text: 'text-tertiary',
                label: status
            };
    }
};

const getTypeLabel = (type: TransferType) => {
    const labels: Record<TransferType, string> = {
        'BOOKING_REFUND': 'Booking Refund',
        'BOOKING_PAYMENT_TO_SELLER': 'Seller Payment',
        'SUBSCRIPTION_REFUND': 'Subscription Refund',
        'SUBSCRIPTION_PAYOUT': 'Subscription Payout',
        'AD_PAYMENT': 'Ad Payment',
        'OTHER': 'Other',
    };
    return labels[type] || type;
};

const getTypeConfig = (type: TransferType) => {
    const configs: Record<TransferType, { bg: string; text: string }> = {
        'BOOKING_REFUND': {
            bg: 'bg-brand-light',
            text: 'text-brand-primary'
        },
        'BOOKING_PAYMENT_TO_SELLER': {
            bg: 'bg-success-subtle',
            text: 'text-success-primary'
        },
        'SUBSCRIPTION_REFUND': {
            bg: 'bg-warning-subtle',
            text: 'text-warning-primary'
        },
        'SUBSCRIPTION_PAYOUT': {
            bg: 'bg-info-subtle',
            text: 'text-info-primary'
        },
        'AD_PAYMENT': {
            bg: 'bg-purple-50',
            text: 'text-purple-700'
        },
        'OTHER': {
            bg: 'bg-secondary',
            text: 'text-tertiary'
        },
    };
    return configs[type] || configs.OTHER;
};

export default function TransfersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"all" | TransferStatus>("all");
    const [selectedType, setSelectedType] = useState<"all" | TransferType>("all");

    const { data: transfers, pagination, isLoading, currentPage, setPage } = useTransfers({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        type: selectedType === "all" ? undefined : selectedType,
        search: searchTerm || undefined,
    });

    const paginationInfo = usePaginationInfo({
        data: transfers,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage: 10
    });

    const columns: Column<Transfer>[] = [
        {
            key: "transfer",
            label: "Transfer ID",
            render: (transfer) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">
                        <Button
                            color="primary"
                            size="sm"
                            href={`/dashboard/payments/transfers/${transfer.id}`}
                            className="p-0 h-auto underline"
                        >
                            #{transfer.id.substring(0, 8)}
                        </Button>
                    </span>
                    <span className="text-xs text-tertiary">{new Date(transfer.createdAt).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: "type",
            label: "Type",
            render: (transfer) => {
                const config = getTypeConfig(transfer.transferType);
                return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
                        {getTypeLabel(transfer.transferType)}
                    </span>
                );
            },
        },
        {
            key: "amount",
            label: "Amount",
            render: (transfer) => (
                <div className="flex items-center gap-1.5">
                    <Wallet01 className="size-4 text-tertiary" />
                    <span className="font-semibold text-primary">
                        {transfer.currency} {Number(transfer.amount).toLocaleString()}
                    </span>
                </div>
            ),
        },
        {
            key: "from",
            label: "From",
            render: (transfer) => (
                transfer.fromUser ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center">
                            <User01 className="w-4 h-4 text-brand-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-primary">
                                {transfer.fromUser.firstName} {transfer.fromUser.lastName}
                            </span>
                            <span className="text-xs text-tertiary">
                                {transfer.fromUser.phone || transfer.fromUser.email || 'N/A'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <span className="text-sm text-tertiary">Platform</span>
                )
            ),
        },
        {
            key: "to",
            label: "To",
            render: (transfer) => (
                transfer.toUser ? (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success-subtle flex items-center justify-center">
                            <User01 className="w-4 h-4 text-success-primary" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium text-primary">
                                {transfer.toUser.firstName} {transfer.toUser.lastName}
                            </span>
                            <span className="text-xs text-tertiary">
                                {transfer.toUser.phone || transfer.toUser.email || 'N/A'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <span className="text-sm text-tertiary">Platform</span>
                )
            ),
        },
        {
            key: "relatedTo",
            label: "Related To",
            render: (transfer) => {
                if (transfer.booking) {
                    return (
                        <Button
                            color="secondary"
                            size="sm"
                            href={`/dashboard/booking-management/bookings/${transfer.bookingId}`}
                            className="p-0 h-auto underline text-xs"
                        >
                            Booking #{transfer.bookingId?.substring(0, 8)}
                        </Button>
                    );
                }
                if (transfer.subscription) {
                    return (
                        <span className="text-xs text-tertiary">
                            Subscription #{transfer.subscriptionId?.substring(0, 8)}
                        </span>
                    );
                }
                if (transfer.ad) {
                    return (
                        <span className="text-xs text-tertiary">
                            Ad: {transfer.ad.title}
                        </span>
                    );
                }
                return <span className="text-xs text-tertiary">N/A</span>;
            },
        },
        {
            key: "status",
            label: "Status",
            render: (transfer) => {
                const config = getStatusConfig(transfer.status);
                const Icon = getStatusIcon(transfer.status);
                return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
                        <Icon className="size-3.5" />
                        {config.label}
                    </span>
                );
            },
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (transfer) => <TransferActions transfer={transfer} />,
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Financial Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Manual Transfers</h1>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search transfers..."
                            icon={SearchLg}
                            iconClassName="size-5"
                            aria-label="Search transfers"
                            className="max-w-md"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />
                        <Select
                            selectedKey={selectedStatus}
                            onSelectionChange={(key) => typeof key === "string" && setSelectedStatus(key as "all" | TransferStatus)}
                            items={statusOptions}
                            size="sm"
                            className="min-w-[200px]"
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Select
                            selectedKey={selectedType}
                            onSelectionChange={(key) => typeof key === "string" && setSelectedType(key as "all" | TransferType)}
                            items={typeOptions}
                            size="sm"
                            className="min-w-[200px]"
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                </div>

                <DataTable
                    data={transfers || []}
                    columns={columns}
                    keyExtractor={(transfer) => transfer.id}
                    isLoading={isLoading}
                    paginationInfo={paginationInfo}
                    onPageChange={setPage}
                    itemName="transfers"
                    emptyTitle="No transfers found"
                    emptyDescription="There are no manual transfers to display at the moment."
                />
            </section>
        </div>
    );
}
