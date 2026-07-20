"use client";

import React, { useState } from "react";
import { SearchLg, Calendar, User01, AlertTriangle, CheckCircle, XCircle, SearchSm } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useComplaints } from "@/hooks/use-complaints";
import { Complaint, ComplaintStatus } from "@/lib/api-types";

const statusOptions = [
    { id: "all", label: "All Status" },
    { id: "OPEN", label: "Open" },
    { id: "INVESTIGATING", label: "Investigating" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "REJECTED", label: "Rejected" },
];

function ComplaintActions({ complaint }: { complaint: Complaint }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/booking-management/complaints/${complaint.id}`}>
                View
            </Button>
        </div>
    );
}

const getStatusIcon = (status: ComplaintStatus) => {
    switch (status) {
        case 'OPEN': return AlertTriangle;
        case 'INVESTIGATING': return SearchSm;
        case 'RESOLVED': return CheckCircle;
        case 'REJECTED': return XCircle;
        default: return AlertTriangle;
    }
};

const getStatusConfig = (status: ComplaintStatus) => {
    switch (status) {
        case 'OPEN':
            return {
                bg: 'bg-warning-subtle',
                text: 'text-warning-primary',
                label: 'Open'
            };
        case 'INVESTIGATING':
            return {
                bg: 'bg-info-subtle',
                text: 'text-info-primary',
                label: 'Investigating'
            };
        case 'RESOLVED':
            return {
                bg: 'bg-success-subtle',
                text: 'text-success-primary',
                label: 'Resolved'
            };
        case 'REJECTED':
            return {
                bg: 'bg-error-subtle',
                text: 'text-error-primary',
                label: 'Rejected'
            };
        default:
            return {
                bg: 'bg-secondary',
                text: 'text-tertiary',
                label: status
            };
    }
};

export default function ComplaintManagementPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"all" | ComplaintStatus>("all");

    const { data: complaints, pagination, isLoading, currentPage, setPage } = useComplaints({
        status: selectedStatus === "all" ? undefined : selectedStatus,
    });
    const paginationInfo = usePaginationInfo({
        data: complaints,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage: 10
    });

    const columns: Column<Complaint>[] = [
        {
            key: "complaint",
            label: "Complaint ID",
            render: (complaint) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">
                        <Button
                            color="primary"
                            size="sm"
                            href={`/dashboard/booking-management/complaints/${complaint.id}`}
                            className="p-0 h-auto underline"
                        >
                            #{complaint.id.substring(0, 8)}
                        </Button>
                    </span>
                    <span className="text-xs text-tertiary">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: "reporter",
            label: "Reporter",
            render: (complaint) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning-subtle flex items-center justify-center">
                        <User01 className="w-4 h-4 text-warning-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium text-primary">{complaint.reporter.firstName} {complaint.reporter.lastName}</span>
                        <span className="text-xs text-tertiary">{complaint.reporter.phone || complaint.reporter.email}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "respondent",
            label: "Service Provider",
            render: (complaint) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center">
                        <User01 className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium text-primary">{complaint.respondent.firstName} {complaint.respondent.lastName}</span>
                        <span className="text-xs text-tertiary">{complaint.respondent.phone || complaint.respondent.email}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "service",
            label: "Service",
            render: (complaint) => (
                <div className="flex flex-col">
                    <span className="font-medium text-primary">{complaint.booking.ad.title}</span>
                    <span className="text-xs text-tertiary">Booking: #{complaint.bookingId ? complaint.bookingId.substring(0, 8) : 'N/A'}</span>
                </div>
            ),
        },
        {
            key: "bookingDate",
            label: "Booking Date",
            render: (complaint) => (
                <div className="flex items-center gap-1 text-sm">
                    <Calendar className="size-4 text-tertiary" />
                    <span>{new Date(complaint.booking.startDate).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (complaint) => {
                const config = getStatusConfig(complaint.status);
                const Icon = getStatusIcon(complaint.status);
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
            render: (complaint) => <ComplaintActions complaint={complaint} />,
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Booking management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Complaints</h1>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                            placeholder="Search complaints"
                            icon={SearchLg}
                            iconClassName="size-5"
                            aria-label="Search complaints"
                            className="max-w-md"
                            value={searchTerm}
                            onChange={setSearchTerm}
                        />

                        <Select
                            aria-label="Filter by status"
                            selectedKey={selectedStatus}
                            onSelectionChange={(key) => {
                                if (typeof key === "string") {
                                    setSelectedStatus(key as "all" | ComplaintStatus);
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
                        itemName="complaints"
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={complaints}
                    keyExtractor={(complaint) => complaint.id}
                    isLoading={isLoading}
                    emptyTitle="No complaints found"
                    emptyDescription="Try adjusting your search or filter criteria."
                    paginationInfo={paginationInfo}
                    onPageChange={setPage}
                    itemName="complaints"
                />
            </section>
        </div>
    );
}
