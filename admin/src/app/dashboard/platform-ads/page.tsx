"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Edit01, Trash01, LinkExternal01, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { usePlatformAds, useDeletePlatformAd } from "@/hooks/use-platform-ads";
import { PlatformAd } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function AdActions({ 
  ad, 
  onDelete, 
  isDeleting 
}: { 
  ad: PlatformAd; 
  onDelete: () => void; 
  isDeleting: boolean 
}) {
    return (
        <div className="flex justify-end gap-2">
            <Button 
                color="secondary" 
                size="sm" 
                href={`/dashboard/platform-ads/${ad.id}/edit`} 
                iconLeading={<Edit01 />}
            >
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ad?`}
                description={`Are you sure you want to delete this ad? This action cannot be undone.`}
                onConfirm={onDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={isDeleting}
                    iconLeading={<Trash01 />}
                >
                    Delete
                </Button>
            </ConfirmationDialog>
        </div>
    );
}

const activeOptions = [
    { id: "all", label: "All Status" },
    { id: "true", label: "Active" },
    { id: "false", label: "Inactive" },
];

export default function PlatformAdsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    const [page, setPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const { data: allAds, isLoading, isError, error } = usePlatformAds();
    const deleteMutation = useDeletePlatformAd();

    const handleDeleteAd = useCallback((id: string) => {
        deleteMutation.mutateAsync(id).catch((error: any) => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete platform ad. Please try again.",
                type: "error",
            });
        });
    }, [deleteMutation]);

    // Client-side filtering
    const filteredAds = useMemo(() => {
        if (!allAds) return [];
        
        return allAds.filter(ad => {
            const matchesSearch = !searchTerm || 
                ad.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ad.position.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = selectedActive === "all" || 
                (selectedActive === "true" && ad.isActive) ||
                (selectedActive === "false" && !ad.isActive);
                
            return matchesSearch && matchesStatus;
        });
    }, [allAds, searchTerm, selectedActive]);

    const paginationInfo = usePaginationInfo({
        data: filteredAds,
        currentPage: page,
        itemsPerPage,
    });

    const paginatedAds = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredAds.slice(start, start + itemsPerPage);
    }, [filteredAds, page, itemsPerPage]);

    const columns: Column<PlatformAd>[] = [
        {
            key: "preview",
            label: "Preview",
            render: (ad) => (
                <div className="h-16 w-10 bg-secondary-subtle rounded border border-secondary overflow-hidden flex items-center justify-center">
                    <img src={ad.imageUrl} alt={ad.title || ""} className="max-h-full max-w-full object-contain" />
                </div>
            ),
        },
        {
            key: "info",
            label: "Ad Info",
            render: (ad) => (
                <div className="flex flex-col">
                    <a 
                        href={`/dashboard/platform-ads/${ad.id}`} 
                        className="font-semibold text-primary hover:text-brand-secondary transition-colors"
                    >
                        {ad.title || "Untitled Ad"}
                    </a>
                    <span className="text-xs text-tertiary">{ad.id}</span>
                    {ad.linkUrl && (
                        <a 
                            href={ad.linkUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1 text-xs text-brand-secondary hover:underline"
                        >
                            <LinkExternal01 className="size-3" />
                            Target Link
                        </a>
                    )}
                </div>
            ),
        },
        {
            key: "position",
            label: "Position",
            render: (ad) => (
                <span className="inline-flex items-center rounded-full bg-blue-subtle px-2.5 py-0.5 text-xs font-medium text-blue-primary">
                    {ad.position}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (ad) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${ad.isActive
                        ? "bg-success-subtle text-success-primary"
                        : "bg-warning-subtle text-warning-primary"
                        }`}
                >
                    {ad.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "order",
            label: "Order",
            render: (ad) => <span className="text-tertiary">{ad.order}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (ad) => (
                <AdActions 
                    ad={ad} 
                    onDelete={() => handleDeleteAd(ad.id)} 
                    isDeleting={deleteMutation.isPending} 
                />
            ),
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Platform Ads</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/platform-ads/create">
                        New platform ad
                    </Button>
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
                                selectedKey={selectedActive}
                                onSelectionChange={(key) => {
                                    if (typeof key === "string") {
                                        setSelectedActive(key as "all" | "true" | "false");
                                    }
                                }}
                                items={activeOptions}
                                size="sm"
                                className="min-w-32"
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="ads" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={paginatedAds}
                        keyExtractor={(ad) => ad.id}
                        isLoading={isLoading}
                        isError={isError}
                        error={error}
                        emptyTitle="No platform ads found"
                        emptyDescription={searchTerm ? "No ads match your search criteria." : "Get started by creating your first platform ad."}
                        emptyAction={
                            !searchTerm && (
                                <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/platform-ads/create">
                                    New platform ad
                                </Button>
                            )
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
