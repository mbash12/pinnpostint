"use client";

import React, { useState, useEffect } from "react";
import { SearchLg, CheckCircle, XCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useAds, useModerateAd } from "@/hooks/use-ads";
import { Ad, AdStatus } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";
import { getDaysRemaining, formatLocalDate } from "@/utils/date-utils";
import { cx } from "@/utils/cx";

function AdActions({ ad }: { ad: Ad }) {
    return (
        <div className="flex justify-end">
            <Button color="secondary" size="sm" href={`/dashboard/ad-moderation/${ad.id}`}>View</Button>
        </div>
    );
}

export default function AdModerationPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<AdStatus>("REVIEW");
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const {
        data: ads,
        pagination,
        isLoading,
        isError,
        error,
        currentPage,
        setPage,
        updateParams,
    } = useAds({
        status: selectedStatus,
        search: debouncedSearchTerm.trim() || undefined,
    });

    const moderateMutation = useModerateAd();

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page when filters change
    useEffect(() => {
        updateParams({ status: selectedStatus, search: debouncedSearchTerm.trim() || undefined });
    }, [selectedStatus, debouncedSearchTerm, updateParams]);

    const paginationInfo = usePaginationInfo({
        data: ads || [],
        pagination: pagination || {
            page: currentPage,
            limit: 10,
            total: 0,
            totalPages: 0
        },
        currentPage,
        itemsPerPage: 10
    });

    const handleModerate = async (adId: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await moderateMutation.mutateAsync({ id: adId, status });
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Moderation Failed",
                description: error.message || "Failed to moderate ad. Please try again.",
                type: "error",
            });
        }
    };

    const columns: Column<Ad>[] = [
        { key: "ad", label: "Advertisement", render: (ad) => <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">{ad.images?.[0] ? <Avatar size="sm" src={getProxiedImageUrl(ad.images[0])} alt={ad.title} /> : <ImagePlaceholder size="sm" />}</div><div className="flex flex-col"><span className="font-semibold text-primary">{ad.title}</span><span className="text-xs text-tertiary">{ad.id}</span></div></div> },
        {
            key: "price",
            label: "Price",
            render: (ad) => (
                <div className="flex flex-col">
                    <span className={cx("font-medium", ad.discountedPrice ? "text-xs text-tertiary line-through" : "")}>
                        {ad.price ? formatCurrency(ad.price) : 'N/A'}
                    </span>
                    {ad.discountedPrice && (
                        <span className="font-semibold text-success-primary">
                            {formatCurrency(ad.discountedPrice)}
                        </span>
                    )}
                </div>
            ),
        },
        { key: "user", label: "User", render: (ad) => <div className="flex items-center gap-2">{ad.user?.avatar ? <Avatar size="xs" src={getProxiedImageUrl(ad.user.avatar)} alt={`${ad.user.firstName} ${ad.user.lastName}`} /> : <ImagePlaceholder size="sm" className="h-6 w-6" />}<span className="text-sm font-medium text-primary">{ad.user ? `${ad.user.firstName} ${ad.user.lastName}` : 'Unknown User'}</span></div> },
        { key: "status", label: "Status", render: (ad) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ad.status === 'APPROVED' ? "bg-success-subtle text-success-primary" : ad.status === 'REVIEW' ? "bg-warning-subtle text-warning-primary" : "bg-error-subtle text-error-primary"}`}>{ad.status}</span> },
        {
            key: "expiration", label: "Expires", render: (ad) => {
                if (!ad.expiresAt) return <span className="text-tertiary">-</span>;
                const daysLeft = getDaysRemaining(ad.expiresAt);
                const isExpired = daysLeft <= 0;
                return (
                    <div className="flex flex-col">
                        <span className={`text-xs font-medium ${isExpired ? 'text-error-primary' : daysLeft <= 3 ? 'text-warning-primary' : 'text-tertiary'}`}>
                            {isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                        </span>
                        <span className="text-xs text-tertiary">{formatLocalDate(ad.expiresAt)}</span>
                    </div>
                );
            }
        },
        {
            key: "location", label: "Location", render: (ad) => (
                <div className="flex flex-col">
                    <span className="text-sm text-primary">{ad.locationCity || ad.location?.city || 'N/A'}</span>
                    {ad.locationState && <span className="text-xs text-tertiary">{ad.locationState}</span>}
                </div>
            )
        },
        { key: "created", label: "Created", render: (ad) => <span className="text-tertiary">{new Date(ad.createdAt).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (ad) => <AdActions ad={ad} /> },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Ad Moderation</h1>
                    </div>
                </header>
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search ads"
                                icon={SearchLg}
                                iconClassName="size-5"
                                className="max-w-md"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
                            <Select selectedKey={selectedStatus} onSelectionChange={(key) => typeof key === "string" && setSelectedStatus(key as any)} items={[{ id: "REVIEW", label: "Review" }, { id: "APPROVED", label: "Approved" }, { id: "REJECTED", label: "Rejected" }, { id: "EXPIRED", label: "Expired" }]} size="sm" className="min-w-32">
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="ads" />
                    </div>
                    <DataTable columns={columns} data={ads || []} keyExtractor={(ad) => ad.id} isLoading={isLoading} isError={isError} error={error} emptyTitle="No ads found" emptyDescription="No ads require moderation." paginationInfo={paginationInfo} onPageChange={setPage} itemName="ads" />
                </section>
            </div>
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </>
    );
}
