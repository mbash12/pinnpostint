"use client";

import { useState, useEffect } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { FormLayout } from "@/components/forms";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useCities, useDeleteCity } from "@/hooks/use-cities";
import { City } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useSearchParams } from "next/navigation";

function CityActions({ city, onDelete, onError }: { city: City; onDelete: () => void; onError: (error: string) => void }) {
    const deleteCityMutation = useDeleteCity();

    const confirmDelete = async () => {
        try {
            await deleteCityMutation.mutateAsync(city.id);
            onDelete();
        } catch (error: any) {
            onError(error.message || "Failed to delete city");
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/location-management/postal-codes?cityId=${city.id}`}>
                Postal Codes
            </Button>
            <Button color="secondary" size="sm" href={`/dashboard/location-management/cities/${city.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${city.name}?`}
                description={`Are you sure you want to delete "${city.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={deleteCityMutation.isPending}
                >
                    Delete
                </Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function CitiesPage() {
    const searchParams = useSearchParams();
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

    // Get stateId from URL params
    const stateIdFromUrl = searchParams.get("stateId") ?? undefined;

    const { data, pagination, isLoading, refresh } = useCities({
        page: currentPage,
        limit: itemsPerPage,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        search: debouncedSearchTerm.trim() || undefined,
        stateId: stateIdFromUrl || undefined,
    });

    const cities = (data || []) as City[];

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
        data: cities,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage
    });

    const handleCityDelete = () => {
        refresh();
    };

    const handleCityDeleteError = (error: string) => {
        setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            description: error,
            type: "error",
        });
    };

    const columns: Column<City>[] = [
        {
            key: "name",
            label: "City",
            render: (city) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{city.name}</span>
                    <span className="text-xs text-tertiary">{city.code || 'No code'}</span>
                </div>
            ),
        },
        {
            key: "state",
            label: "State",
            render: (city) => <span className="text-tertiary">{city.state?.name || '-'}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (city) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        city.isActive
                            ? "bg-success-subtle text-success-primary"
                            : "bg-warning-subtle text-warning-primary"
                    }`}
                >
                    {city.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (city) => (
                <span className="text-tertiary">{new Date(city.createdAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "updated",
            label: "Updated",
            render: (city) => (
                <span className="text-tertiary">{new Date(city.updatedAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (city) => <CityActions city={city} onDelete={handleCityDelete} onError={handleCityDeleteError} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Location Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Cities</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/cities/create">
                        New city
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search cities"
                                icon={SearchLg}
                                iconClassName="size-5"
                                className="max-w-md"
                                value={searchTerm}
                                onChange={setSearchTerm}
                            />
                            <Select
                                selectedKey={selectedActive}
                                onSelectionChange={(key) => typeof key === "string" && setSelectedActive(key as any)}
                                items={[
                                    { id: "all", label: "All Status" },
                                    { id: "true", label: "Active" },
                                    { id: "false", label: "Inactive" }
                                ]}
                                size="sm"
                                className="min-w-32"
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="cities" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={cities}
                        keyExtractor={(city) => city.id}
                        isLoading={isLoading}
                        emptyTitle="No cities found"
                        emptyDescription="Get started by creating your first city."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/cities/create">
                                New city
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setCurrentPage}
                        itemName="cities"
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
