"use client";

import { useState, useMemo } from "react";
import { CheckCircle, XCircle, Star03, SearchLg, FilterLines } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { useAds } from "@/hooks/use-ads";
import { useBulkUpdateAdStatus } from "@/hooks/use-bulk-operations";
import { Ad, AdStatus } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";

export default function BulkAdsOperationsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<"all" | AdStatus>("REVIEW");
    const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const { data: adsResponse, isLoading } = useAds({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        search: searchTerm.trim() || undefined,
    });

    const ads = (adsResponse || []) as Ad[];

    const handleSelectAll = () => {
        if (selectedAds.size === ads.length) {
            setSelectedAds(new Set());
        } else {
            setSelectedAds(new Set(ads.map(ad => ad.id)));
        }
    };

    const handleSelectAd = (adId: string) => {
        const newSelected = new Set(selectedAds);
        if (newSelected.has(adId)) {
            newSelected.delete(adId);
        } else {
            newSelected.add(adId);
        }
        setSelectedAds(newSelected);
    };

    const bulkUpdateMutation = useBulkUpdateAdStatus();

    const handleBulkApprove = async () => {
        try {
            await bulkUpdateMutation.mutateAsync({
                adIds: Array.from(selectedAds),
                status: 'approved',
            });
            setSelectedAds(new Set());
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Successfully approved ${selectedAds.size} ads`,
                type: "success",
            });
        } catch (error: any) {
            // Bulk approve failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to approve ads: ${error.message}`,
                type: "error",
            });
        }
    };

    const handleBulkReject = async () => {
        try {
            await bulkUpdateMutation.mutateAsync({
                adIds: Array.from(selectedAds),
                status: 'rejected',
            });
            setSelectedAds(new Set());
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Successfully rejected ${selectedAds.size} ads`,
                type: "success",
            });
        } catch (error: any) {
            // Bulk reject failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to reject ads: ${error.message}`,
                type: "error",
            });
        }
    };

    const handleBulkFeature = async () => {
        try {
            await bulkUpdateMutation.mutateAsync({
                adIds: Array.from(selectedAds),
                status: 'active',
            });
            setSelectedAds(new Set());
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Successfully featured ${selectedAds.size} ads`,
                type: "success",
            });
        } catch (error: any) {
            // Bulk feature failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to feature ads: ${error.message}`,
                type: "error",
            });
        }
    };

    const statusOptions = [
        { id: "all", label: "All Status" },
        { id: "pending", label: "Pending" },
        { id: "active", label: "Active" },
        { id: "expired", label: "Expired" },
        { id: "inactive", label: "Inactive" },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading ads...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Bulk Operations</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Bulk Ad Status Updates</h1>
                    <p className="text-sm text-tertiary">
                        Select multiple ads and perform bulk status changes, approvals, or rejections.
                    </p>
                </div>
            </header>

            {/* Bulk Actions Bar */}
            {selectedAds.size > 0 && (
                <section className="rounded-2xl border border-brand-primary bg-brand-subtle p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-brand-primary">
                                {selectedAds.size} ad{selectedAds.size !== 1 ? 's' : ''} selected
                            </p>
                            <Button 
                                color="secondary" 
                                size="sm"
                                onClick={() => setSelectedAds(new Set())}
                            >
                                Clear Selection
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                color="primary"
                                size="sm"
                                iconLeading={<CheckCircle />}
                                onClick={handleBulkApprove}
                                isLoading={bulkUpdateMutation.isPending}
                            >
                                Bulk Approve
                            </Button>
                            <ConfirmationDialog
                                title="Bulk Reject Ads"
                                description={`Are you sure you want to reject ${selectedAds.size} ad${selectedAds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
                                confirmLabel="Yes, Reject All"
                                cancelLabel="Cancel"
                                onConfirm={handleBulkReject}
                            >
                                <Button
                                    color="secondary-destructive"
                                    size="sm"
                                    isLoading={bulkUpdateMutation.isPending}
                                >
                                    Bulk Reject
                                </Button>
                            </ConfirmationDialog>
                            <Button
                                color="secondary"
                                size="sm"
                                iconLeading={<Star03 />}
                                onClick={handleBulkFeature}
                                isLoading={bulkUpdateMutation.isPending}
                            >
                                Bulk Feature
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* Filters and Search */}
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
                                    setSelectedStatus(key as "all" | AdStatus);
                                }
                            }}
                            items={statusOptions}
                            size="sm"
                            className="min-w-32"
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>

                    <div className="text-sm text-tertiary">
                        Showing {ads.length} ads
                    </div>
                </div>

                {/* Ads Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedAds.size === ads.length && ads.length > 0}
                                        onChange={handleSelectAll}
                                        className="rounded border-secondary"
                                    />
                                </th>
                                <th scope="col" className="px-4 py-3 text-left">Ad</th>
                                <th scope="col" className="px-4 py-3 text-left">Status</th>
                                <th scope="col" className="px-4 py-3 text-left">Price</th>
                                <th scope="col" className="px-4 py-3 text-left">User</th>
                                <th scope="col" className="px-4 py-3 text-left">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-primary">
                            {ads.map((ad) => (
                                <tr 
                                    key={ad.id} 
                                    className={`transition hover:bg-secondary cursor-pointer ${
                                        selectedAds.has(ad.id) ? 'bg-brand-subtle' : ''
                                    }`}
                                    onClick={() => handleSelectAd(ad.id)}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedAds.has(ad.id)}
                                            onChange={() => handleSelectAd(ad.id)}
                                            className="rounded border-secondary"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-primary">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                                {ad.images?.length > 0 ? (
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
                                    </td>
                                    <td className="px-4 py-3 font-medium">{ad.price ? formatCurrency(ad.price) : 'N/A'}</td>
                                    <td className="px-4 py-3 text-tertiary">{ad.userId}</td>
                                    <td className="px-4 py-3 text-tertiary">{new Date(ad.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {ads.length === 0 && (
                    <div className="text-center py-12 text-tertiary">
                        No ads found matching your criteria
                    </div>
                )}
            </section>

            {/* Operation Guidelines */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-primary mb-4">Operation Guidelines</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <CheckCircle className="w-5 h-5 text-success-primary mb-2" />
                        <h3 className="text-sm font-semibold text-primary mb-1">Bulk Approve</h3>
                        <p className="text-xs text-tertiary">
                            Approve multiple pending ads at once. Users will receive approval notifications.
                        </p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <XCircle className="w-5 h-5 text-error-primary mb-2" />
                        <h3 className="text-sm font-semibold text-primary mb-1">Bulk Reject</h3>
                        <p className="text-xs text-tertiary">
                            Reject ads that violate platform policies. Users will be notified with rejection reasons.
                        </p>
                    </div>
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <Star03 className="w-5 h-5 text-brand-primary mb-2" />
                        <h3 className="text-sm font-semibold text-primary mb-1">Bulk Feature</h3>
                        <p className="text-xs text-tertiary">
                            Mark multiple ads as featured to increase their visibility on the platform.
                        </p>
                    </div>
                </div>
            </section>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}
