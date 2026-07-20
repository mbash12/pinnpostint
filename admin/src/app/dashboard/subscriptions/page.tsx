"use client";

import React, { useState, useEffect } from "react";
import { SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useSubscriptions } from "@/hooks/use-subscriptions";
import { Subscription } from "@/lib/api-types";
import { useFormAlert } from "@/hooks/use-form-alert";

function SubscriptionActions({ sub }: { sub: Subscription }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/subscriptions/${sub.id}`}>View</Button>
        </div>
    );
}

export default function SubscriptionsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"all" | "ACTIVE" | "EXPIRED" | "CANCELLED">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const { showAlert, AlertComponent } = useFormAlert();
    const { data: response, isLoading, isError, error } = useSubscriptions({
        page: currentPage,
        limit: itemsPerPage,
        status: selectedStatus === "all" ? undefined : selectedStatus === "ACTIVE" ? "active" : "inactive",
        search: debouncedSearchTerm.trim() || undefined,
    });

    const subscriptions = (response?.data || []) as Subscription[];
    const pagination = response?.pagination;

    useEffect(() => { const timer = setTimeout(() => { setDebouncedSearchTerm(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(timer); }, [searchTerm]);
    useEffect(() => { setCurrentPage(1); }, [selectedStatus]);

    const paginationInfo = usePaginationInfo({
        data: subscriptions,
        pagination: pagination || {
            page: currentPage,
            limit: itemsPerPage,
            total: subscriptions.length,
            totalPages: Math.ceil(subscriptions.length / itemsPerPage)
        },
        currentPage,
        itemsPerPage
    });

    const columns: Column<Subscription>[] = [
        { key: "user", label: "User", render: (sub) => <div className="flex flex-col"><span className="font-semibold text-primary">{sub.user?.firstName} {sub.user?.lastName}</span><span className="text-xs text-tertiary">{sub.user?.email}</span></div> },
        { key: "ad", label: "Ad", render: (sub) => <span className="font-medium">{sub.ad?.title || 'N/A'}</span> },
        { key: "status", label: "Status", render: (sub) => {
            const isExpired = new Date(sub.endDate) < new Date();
            const isActive = sub.isActive && !isExpired;
            return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? "bg-success-subtle text-success-primary" : "bg-error-subtle text-error-primary"}`}>{isActive ? "Active" : "Inactive"}</span>;
        }},
        { key: "start", label: "Start Date", render: (sub) => <span className="text-tertiary">{new Date(sub.startDate).toLocaleDateString()}</span> },
        { key: "end", label: "End Date", render: (sub) => <span className="text-tertiary">{new Date(sub.endDate).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (sub) => <SubscriptionActions sub={sub} /> },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Subscription Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Subscriptions</h1>
                </div>
            </header>
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                        <Input placeholder="Search subscriptions" icon={SearchLg} iconClassName="size-5" className="max-w-md" value={searchTerm} onChange={setSearchTerm} />
                        <Select selectedKey={selectedStatus} onSelectionChange={(key) => typeof key === "string" && setSelectedStatus(key as "all" | "ACTIVE" | "EXPIRED" | "CANCELLED")} items={[{ id: "all", label: "All Status" }, { id: "ACTIVE", label: "Active" }, { id: "EXPIRED", label: "Expired" }, { id: "CANCELLED", label: "Cancelled" }]} size="sm" className="min-w-32">
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                    <PaginationInfoComponent paginationInfo={paginationInfo} itemName="subscriptions" />
                </div>
                <DataTable columns={columns} data={subscriptions} keyExtractor={(sub) => sub.id} isLoading={isLoading} isError={isError} error={error} emptyTitle="No subscriptions found" emptyDescription="No subscriptions have been created yet." paginationInfo={paginationInfo} onPageChange={setCurrentPage} itemName="subscriptions" />
            </section>
            <AlertComponent />
        </div>
    );
}
