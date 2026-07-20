"use client";

import { useState } from "react";
import { RefreshCw01, Trash01, Archive, Calendar, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useExpiredAds } from "@/hooks/use-ads";
import { useBulkRenewAds, useBulkArchiveAds, useBulkDeleteAds } from "@/hooks/use-bulk-operations";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";

export default function ExpiredContentPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set());
    const [renewalDays, setRenewalDays] = useState("30");

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const { data: expiredAdsResponse, isLoading } = useExpiredAds();
    const renewMutation = useBulkRenewAds();
    const archiveMutation = useBulkArchiveAds();
    const deleteMutation = useBulkDeleteAds();

    const expiredAds = (expiredAdsResponse || []).map((ad: any) => ({
        id: ad.id,
        title: ad.title,
        image: ad.images?.[0] || null,
        expiredAt: new Date(ad.expiresAt).toLocaleDateString(),
        daysExpired: Math.floor((Date.now() - new Date(ad.expiresAt).getTime()) / (1000 * 60 * 60 * 24)),
        price: ad.price,
        userId: ad.userId,
    }));

    const handleSelectAll = () => {
        if (selectedAds.size === expiredAds.length) {
            setSelectedAds(new Set());
        } else {
            setSelectedAds(new Set(expiredAds.map(ad => ad.id)));
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

    const handleBulkRenew = async () => {
        try {
            await renewMutation.mutateAsync({
                adIds: Array.from(selectedAds),
                days: parseInt(renewalDays),
            });
            setSelectedAds(new Set());
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Successfully renewed ${selectedAds.size} ads for ${renewalDays} days`,
                type: "success",
            });
        } catch (error: any) {
            // Bulk renew failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to renew ads: ${error.message}`,
                type: "error",
            });
        }
    };

    const handleBulkArchive = async () => {
        try {
            await archiveMutation.mutateAsync({
                adIds: Array.from(selectedAds),
            });
            setSelectedAds(new Set());
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Successfully archived ${selectedAds.size} ads`,
                type: "success",
            });
        } catch (error: any) {
            // Bulk archive failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to archive ads: ${error.message}`,
                type: "error",
            });
        }
    };

    const handleBulkDelete = async () => {
        // Since confirm is a browser dialog, we'll keep it for now but eventually replace with a modal
        if (confirm(`Are you sure you want to permanently delete ${selectedAds.size} ads? This action cannot be undone.`)) {
            try {
                await deleteMutation.mutateAsync({
                    adIds: Array.from(selectedAds),
                });
                setSelectedAds(new Set());
                setAlertDialog({
                    isOpen: true,
                    title: "Success",
                    description: `Successfully deleted ${selectedAds.size} ads`,
                    type: "success",
                });
            } catch (error: any) {
                // Bulk delete failed: error
                setAlertDialog({
                    isOpen: true,
                    title: "Error",
                    description: `Failed to delete ads: ${error.message}`,
                    type: "error",
                });
            }
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Bulk Operations</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Expired Content Management</h1>
                    <p className="text-sm text-tertiary">
                        Manage and renew expired ads and subscriptions, or archive old content.
                    </p>
                </div>
            </header>

            {/* Stats Overview */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-error-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Expired Ads</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">{expiredAds.length}</p>
                    <p className="text-sm text-quaternary">Requiring action</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <RefreshCw01 className="w-5 h-5 text-warning-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Expiring Soon</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">12</p>
                    <p className="text-sm text-quaternary">Within 7 days</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Archive className="w-5 h-5 text-tertiary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Archived</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">45</p>
                    <p className="text-sm text-quaternary">This month</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Trash01 className="w-5 h-5 text-error-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Auto-Deleted</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">8</p>
                    <p className="text-sm text-quaternary">Last 30 days</p>
                </article>
            </section>

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
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    placeholder="Days"
                                    value={renewalDays}
                                    onChange={setRenewalDays}
                                    className="w-20"
                                />
                                <Button 
                                    color="primary" 
                                    size="sm"
                                    iconLeading={<RefreshCw01 />}
                                    onClick={handleBulkRenew}
                                    isLoading={renewMutation.isPending}
                                >
                                    Bulk Renew
                                </Button>
                            </div>
                            <Button 
                                color="secondary" 
                                size="sm"
                                iconLeading={<Archive />}
                                onClick={handleBulkArchive}
                                isLoading={archiveMutation.isPending}
                            >
                                Archive
                            </Button>
                            <Button 
                                color="secondary-destructive" 
                                size="sm"
                                iconLeading={<Trash01 />}
                                onClick={handleBulkDelete}
                                isLoading={deleteMutation.isPending}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* Expired Ads Table */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        placeholder="Search expired ads"
                        icon={SearchLg}
                        iconClassName="size-5"
                        aria-label="Search ads"
                        className="max-w-md"
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />
                    <div className="text-sm text-tertiary">
                        Showing {expiredAds.length} expired ads
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedAds.size === expiredAds.length && expiredAds.length > 0}
                                        onChange={handleSelectAll}
                                        className="rounded border-secondary"
                                    />
                                </th>
                                <th scope="col" className="px-4 py-3 text-left">Ad</th>
                                <th scope="col" className="px-4 py-3 text-left">Price</th>
                                <th scope="col" className="px-4 py-3 text-left">Expired Date</th>
                                <th scope="col" className="px-4 py-3 text-left">Days Expired</th>
                                <th scope="col" className="px-4 py-3 text-left">User</th>
                                <th scope="col" className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-primary">
                            {expiredAds.map((ad) => (
                                <tr 
                                    key={ad.id} 
                                    className={`transition hover:bg-secondary ${
                                        selectedAds.has(ad.id) ? 'bg-brand-subtle' : ''
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedAds.has(ad.id)}
                                            onChange={() => handleSelectAd(ad.id)}
                                            className="rounded border-secondary"
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-primary">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                                {ad.image ? (
                                                    <Avatar size="sm" src={getProxiedImageUrl(ad.image)} alt={ad.title} />
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
                                    <td className="px-4 py-3 font-medium">{ad.price ? formatCurrency(ad.price) : 'N/A'}</td>
                                    <td className="px-4 py-3 text-tertiary">{ad.expiredAt}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                            ad.daysExpired <= 3 ? "bg-warning-subtle text-warning-primary" :
                                            ad.daysExpired <= 7 ? "bg-error-subtle text-error-primary" :
                                            "bg-secondary text-tertiary"
                                        }`}>
                                            {ad.daysExpired} days
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{ad.userId}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button color="primary" size="sm">
                                                Renew
                                            </Button>
                                            <Button color="secondary" size="sm">
                                                View
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {expiredAds.length === 0 && (
                    <div className="text-center py-12 text-tertiary">
                        No expired ads found
                    </div>
                )}
            </section>

            {/* Renewal Options */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-primary mb-4">Renewal Options</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <button className="rounded-xl border-2 border-secondary bg-secondary p-4 hover:border-brand-primary transition-colors text-left">
                        <p className="text-lg font-semibold text-primary">7 Days</p>
                        <p className="text-xs text-tertiary mt-1">Short-term renewal</p>
                    </button>
                    <button className="rounded-xl border-2 border-secondary bg-secondary p-4 hover:border-brand-primary transition-colors text-left">
                        <p className="text-lg font-semibold text-primary">30 Days</p>
                        <p className="text-xs text-tertiary mt-1">Standard renewal</p>
                    </button>
                    <button className="rounded-xl border-2 border-secondary bg-secondary p-4 hover:border-brand-primary transition-colors text-left">
                        <p className="text-lg font-semibold text-primary">90 Days</p>
                        <p className="text-xs text-tertiary mt-1">Extended renewal</p>
                    </button>
                    <button className="rounded-xl border-2 border-secondary bg-secondary p-4 hover:border-brand-primary transition-colors text-left">
                        <p className="text-lg font-semibold text-primary">Custom</p>
                        <p className="text-xs text-tertiary mt-1">Set custom duration</p>
                    </button>
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
