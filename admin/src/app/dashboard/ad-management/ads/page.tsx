"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { FilterLines, Plus, SearchLg, CheckCircle, XCircle, Star03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { Pagination, PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { useAds, useModerateAd, useDeleteAd, useToggleAdFeature, useAdsSearch } from "@/hooks/use-ads";
import { Ad, AdStatus } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";
import { getDaysRemaining, formatLocalDate } from "@/utils/date-utils";
import { cx } from "@/utils/cx";

// Separate component for ads table
function AdsTable({
    ads,
    paginationInfo,
    isLoading,
    currentPage,
    onPageChange,
    onDeleteAd,
    onModerateAd,
    onToggleFeature,
    onDeleteError,
    onModerateError,
    onToggleFeatureError,
    itemName = "ads"
}: {
    ads: Ad[];
    paginationInfo: any;
    isLoading: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    onDeleteAd: (ad: Ad) => void;
    onModerateAd: (adId: string, status: 'approved' | 'rejected') => void;
    onToggleFeature: (adId: string, isFeatured: boolean) => void;
    onDeleteError: (error: string) => void;
    onModerateError: (error: string) => void;
    onToggleFeatureError: (error: string) => void;
    itemName?: string;
}) {
    const [adToDelete, setAdToDelete] = useState<Ad | null>(null);
    const deleteAdMutation = useDeleteAd();
    const moderateAdMutation = useModerateAd();
    const toggleFeatureMutation = useToggleAdFeature();

    const confirmDeleteAd = async () => {
        if (!adToDelete) return;
        try {
            await deleteAdMutation.mutateAsync(adToDelete.id);
            setAdToDelete(null);
            onDeleteAd(adToDelete);
        } catch (error: any) {
            onDeleteError(error.message || "Failed to delete ad");
        }
    };

    const handleModerateAd = async (adId: string, status: 'approved' | 'rejected') => {
        try {
            const apiStatus = status === 'approved' ? 'APPROVED' : 'REJECTED';
            await moderateAdMutation.mutateAsync({ id: adId, status: apiStatus });
            onModerateAd(adId, status);
        } catch (error: any) {
            onModerateError(error.message || "Failed to moderate ad");
        }
    };

    const handleToggleFeature = async (adId: string, isFeatured: boolean) => {
        try {
            await toggleFeatureMutation.mutateAsync({ id: adId, isFeatured });
            onToggleFeature(adId, isFeatured);
        } catch (error: any) {
            onToggleFeatureError(error.message || "Failed to toggle feature");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-primary">Loading ads...</div>
            </div>
        );
    }

    if (ads.length === 0) {
        return (
            <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <Plus className="h-6 w-6 text-tertiary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-primary">No ads found</h3>
                <p className="mt-2 text-sm text-tertiary">
                    Try adjusting your search or filter criteria.
                </p>
                <div className="mt-6">
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/ads/create">
                        New ad
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary text-sm">
                    <thead className="text-xs uppercase tracking-wide text-quaternary">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left">Ad</th>
                            <th scope="col" className="px-4 py-3 text-left">Status</th>
                            <th scope="col" className="px-4 py-3 text-left">Expires</th>
                            <th scope="col" className="px-4 py-3 text-left">Price</th>
                            <th scope="col" className="px-4 py-3 text-left">User</th>
                            <th scope="col" className="px-4 py-3 text-left">Created</th>
                            <th scope="col" className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary text-primary">
                        {ads.map((ad) => (
                            <tr key={ad.id} className="transition hover:bg-secondary">
                                <td className="px-4 py-3 font-semibold text-primary">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                            {ad.images && ad.images.length > 0 ? (
                                                <Avatar size="sm" src={getProxiedImageUrl(ad.images[0])} alt={ad.title} />
                                            ) : (
                                                <ImagePlaceholder size="sm" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span>{ad.title}</span>
                                            <span className="text-xs text-tertiary">{ad.id}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                                ad.status === 'APPROVED' ? "bg-success-subtle text-success-primary" :
                                                ad.status === 'REVIEW' ? "bg-warning-subtle text-warning-primary" :
                                                ad.status === 'EXPIRED' ? "bg-error-subtle text-error-primary" :
                                                ad.status === 'REJECTED' ? "bg-error-subtle text-error-primary" :
                                                "bg-secondary text-tertiary"
                                            }`}
                                        >
                                            {ad.status}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {(() => {
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
                                    })()}
                                </td>
                                <td className="px-4 py-3 font-medium">
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
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {ad.user?.avatar ? (
                                            <Avatar size="xs" src={getProxiedImageUrl(ad.user.avatar)} alt={`${ad.user.firstName} ${ad.user.lastName}`} />
                                        ) : (
                                            <ImagePlaceholder size="sm" className="h-6 w-6" />
                                        )}
                                        <span className="text-sm font-medium text-primary">
                                            {ad.user ? `${ad.user.firstName} ${ad.user.lastName}` : 'Unknown User'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-tertiary">{new Date(ad.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            href={`/dashboard/ad-management/ads/${ad.id}/edit`}
                                        >
                                            Edit
                                        </Button>
                                        <ConfirmationDialog
                                            title={`Delete ${ad.title}?`}
                                                    description={`Are you sure you want to delete the "${ad.title}" ad? This action cannot be undone.`}
                                                    onConfirm={confirmDeleteAd}
                                                >
                                                    <Button
                                                        color="secondary-destructive"
                                                        size="sm"
                                                        type="button"
                                                        isLoading={deleteAdMutation.isPending}
                                                        onClick={() => setAdToDelete(ad)}
                                                    >
                                                        Delete
                                                    </Button>
                                                </ConfirmationDialog>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-6">
                <PaginationInfoComponent
                    paginationInfo={paginationInfo}
                    itemName={itemName}
                    className="hidden sm:block"
                />
                <Pagination
                    currentPage={currentPage}
                    totalPages={paginationInfo.totalPages}
                    onPageChange={onPageChange}
                    className="mx-auto sm:mx-0"
                />
            </div>
        </>
    );
}

const statusOptions = [
    { id: "APPROVED", label: "Active" },
    { id: "EXPIRED", label: "Expired" },
];

export default function AdsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<AdStatus>("APPROVED");
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
        currentPage,
        setPage,
        updateParams,
    } = useAds({
        status: selectedStatus,
        search: debouncedSearchTerm.trim() || undefined,
    });

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const paginationInfo = useMemo(() => {
        if (!pagination) {
            return {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: 10,
                startItem: 0,
                endItem: 0,
            };
        }

        const startItem = (pagination.page - 1) * pagination.limit + 1;
        const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

        return {
            currentPage: pagination.page,
            totalPages: pagination.totalPages,
            totalItems: pagination.total,
            itemsPerPage: pagination.limit,
            startItem: pagination.total > 0 ? startItem : 0,
            endItem: pagination.total > 0 ? endItem : 0,
        };
    }, [pagination]);

    // Reset page when filters change
    useEffect(() => {
        updateParams({ status: selectedStatus, search: debouncedSearchTerm.trim() || undefined });
    }, [selectedStatus, debouncedSearchTerm, updateParams]);

    const handleAdDelete = useCallback((ad: Ad) => {
        // Handle ad deletion
    }, []);

    const handleAdModerate = useCallback((adId: string, status: 'approved' | 'rejected') => {
        // Handle ad moderation
    }, []);

    const handleAdToggleFeature = useCallback((adId: string, isFeatured: boolean) => {
        // Handle ad feature toggle
    }, []);

    // Move the useDeleteAd hook to the top level of the component
    const deleteAdMutation = useDeleteAd();

    const handleDeleteAd = async (adId: string) => {
        try {
            await deleteAdMutation.mutateAsync(adId);
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete ad. Please try again.",
                type: "error",
            });
        }
    };

    const columns: Column<Ad>[] = [
        {
            key: "ad",
            label: "Ad",
            render: (ad) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                        {ad.images && ad.images.length > 0 ? (
                            <Avatar size="sm" src={getProxiedImageUrl(ad.images[0])} alt={ad.title} />
                        ) : (
                            <ImagePlaceholder size="sm" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{ad.title}</span>
                        <span className="text-xs text-tertiary">{ad.id}</span>
                    </div>
                </div>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (ad) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    ad.status === 'APPROVED' ? "bg-success-subtle text-success-primary" :
                    ad.status === 'REVIEW' ? "bg-warning-subtle text-warning-primary" :
                    ad.status === 'EXPIRED' ? "bg-error-subtle text-error-primary" :
                    ad.status === 'REJECTED' ? "bg-error-subtle text-error-primary" :
                    "bg-secondary text-tertiary"
                }`}>
                    {ad.status}
                </span>
            ),
        },
        {
            key: "expiration",
            label: "Expires",
            render: (ad) => {
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
            },
        },
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
        {
            key: "user",
            label: "User",
            render: (ad) => (
                <div className="flex items-center gap-2">
                    {ad.user?.avatar ? (
                        <Avatar size="xs" src={getProxiedImageUrl(ad.user.avatar)} alt={`${ad.user.firstName} ${ad.user.lastName}`} />
                    ) : (
                        <ImagePlaceholder size="sm" className="h-6 w-6" />
                    )}
                    <span className="text-sm font-medium text-primary">
                        {ad.user ? `${ad.user.firstName} ${ad.user.lastName}` : 'Unknown User'}
                    </span>
                </div>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (ad) => <span className="text-tertiary">{new Date(ad.createdAt).toLocaleDateString()}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (ad) => {
                return (
                    <div className="flex justify-end gap-2">
                        <Button color="secondary" size="sm" href={`/dashboard/ad-management/ads/${ad.id}/edit`}>
                            Edit
                        </Button>
                        <ConfirmationDialog
                            title={`Delete ${ad.title}?`}
                            description={`Are you sure you want to delete the "${ad.title}" ad? This action cannot be undone.`}
                            onConfirm={() => handleDeleteAd(ad.id)}
                        >
                            <Button
                                color="secondary-destructive"
                                size="sm"
                                type="button"
                                isLoading={deleteAdMutation.isPending}
                            >
                                Delete
                            </Button>
                        </ConfirmationDialog>
                    </div>
                );
            },
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading ads...</div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Advertisements</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* <Button color="secondary" size="sm" iconLeading={<FilterLines />}>
                            Filters
                        </Button> */}
                        <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/ads/create">
                            New ad
                        </Button>
                    </div>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search ads"
                                icon={SearchLg}
                                iconClassName="size-5"
                                aria-label="Search ads"
                                className="max-w-md"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
                            <Select
                                aria-label="Filter by status"
                                selectedKey={selectedStatus}
                                onSelectionChange={(key) => {
                                    if (typeof key === "string") {
                                        setSelectedStatus(key as AdStatus);
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
                            itemName="ads"
                        />
                    </div>

                    <DataTable
                        columns={columns}
                        data={ads}
                        keyExtractor={(ad) => ad.id}
                        isLoading={isLoading}
                        emptyTitle="No ads found"
                        emptyDescription="Try adjusting your search or filter criteria."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/ads/create">
                                New ad
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setPage}
                        itemName="ads"
                    />
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
