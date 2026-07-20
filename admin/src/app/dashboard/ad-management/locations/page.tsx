"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useLocations, useDeleteLocation } from "@/hooks/use-locations";
import { Location } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function LocationActions({ location, onDelete, onError }: { location: Location; onDelete: () => void; onError: (error: string) => void }) {
    const [locationToDelete, setLocationToDelete] = useState(false);
    const deleteLocationMutation = useDeleteLocation();

    const confirmDelete = async () => {
        try {
            await deleteLocationMutation.mutateAsync(location.id);
            setLocationToDelete(false);
            onDelete();
        } catch (error: any) {
            onError(error.message || "Failed to delete location");
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/locations/${location.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${location.name}?`}
                description={`Are you sure you want to delete "${location.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={deleteLocationMutation.isPending}
                    onClick={() => setLocationToDelete(true)}
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

export default function LocationsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedActive, setSelectedActive] = useState<"all" | "true" | "false">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const { data: locationsResponse, isLoading } = useLocations({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm.trim() || undefined,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
    });

    const locations = (locationsResponse?.data || []) as Location[];
    const pagination = (locationsResponse as any)?.pagination;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedActive]);

    const paginationInfo = usePaginationInfo({
        data: locations,
        pagination: pagination || {
            page: currentPage,
            limit: itemsPerPage,
            total: locations.length,
            totalPages: Math.ceil(locations.length / itemsPerPage)
        },
        currentPage,
        itemsPerPage,
    });

    const handleLocationDelete = useCallback(() => {
        // Refresh handled by react-query
    }, []);

    const handleLocationDeleteError = (error: string) => {
        setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            description: error,
            type: "error",
        });
    };

    const columns: Column<Location>[] = [
        {
            key: "name",
            label: "Location",
            render: (location) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{location.name}</span>
                    <span className="text-xs text-tertiary">{location.id}</span>
                </div>
            ),
        },
        {
            key: "city",
            label: "City",
            render: (location) => <span className="text-tertiary">{location.city?.name || '-'}</span>,
        },
        {
            key: "state",
            label: "State",
            render: (location) => <span className="text-tertiary">{location.state?.name || '-'}</span>,
        },
        {
            key: "country",
            label: "Country",
            render: (location) => <span className="text-tertiary">{location.country}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (location) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        location.isActive
                            ? "bg-success-subtle text-success-primary"
                            : "bg-warning-subtle text-warning-primary"
                    }`}
                >
                    {location.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (location) => (
                <span className="text-tertiary">{new Date(location.createdAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "updated",
            label: "Updated",
            render: (location) => (
                <span className="text-tertiary">{new Date(location.updatedAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (location) => <LocationActions location={location} onDelete={handleLocationDelete} onError={handleLocationDeleteError} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Locations</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/locations/create">
                        New location
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search locations"
                                icon={SearchLg}
                                iconClassName="size-5"
                                aria-label="Search locations"
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

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="locations" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={locations}
                        keyExtractor={(location) => location.id}
                        isLoading={isLoading}
                        emptyTitle="No locations found"
                        emptyDescription="Get started by creating your first location."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/ad-management/locations/create">
                                New location
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setCurrentPage}
                        itemName="locations"
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