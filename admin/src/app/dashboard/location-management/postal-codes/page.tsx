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
import { usePostalCodes, useDeletePostalCode } from "@/hooks/use-postal-codes";
import { PostalCode } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useSearchParams } from "next/navigation";

function PostalCodeActions({ postalCode, onDelete, onError }: { postalCode: PostalCode; onDelete: () => void; onError: (error: string) => void }) {
    const deletePostalCodeMutation = useDeletePostalCode();

    const confirmDelete = async () => {
        try {
            await deletePostalCodeMutation.mutateAsync(postalCode.id);
            onDelete();
        } catch (error: any) {
            onError(error.message || "Failed to delete postal code");
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/location-management/postal-codes/${postalCode.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${postalCode.code}?`}
                description={`Are you sure you want to delete postal code "${postalCode.code}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={deletePostalCodeMutation.isPending}
                >
                    Delete
                </Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function PostalCodesPage() {
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

    // Get cityId from URL params
    const cityIdFromUrl = searchParams.get('cityId');

    const { data, pagination, isLoading, refresh } = usePostalCodes({
        page: currentPage,
        limit: itemsPerPage,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        search: debouncedSearchTerm.trim() || undefined,
        cityId: cityIdFromUrl || undefined,
    });

    const postalCodes = (data || []) as PostalCode[];

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
        data: postalCodes,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage
    });

    const handlePostalCodeDelete = () => {
        refresh();
    };

    const handlePostalCodeDeleteError = (error: string) => {
        setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            description: error,
            type: "error",
        });
    };

    const columns: Column<PostalCode>[] = [
        {
            key: "code",
            label: "Postal Code",
            render: (postalCode) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{postalCode.code}</span>
                    <span className="text-xs text-tertiary">{postalCode.city?.name || 'No city'}</span>
                </div>
            ),
        },
        {
            key: "city",
            label: "City",
            render: (postalCode) => <span className="text-tertiary">{postalCode.city?.name || '-'}</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (postalCode) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        postalCode.isActive
                            ? "bg-success-subtle text-success-primary"
                            : "bg-warning-subtle text-warning-primary"
                    }`}
                >
                    {postalCode.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (postalCode) => (
                <span className="text-tertiary">{new Date(postalCode.createdAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "updated",
            label: "Updated",
            render: (postalCode) => (
                <span className="text-tertiary">{new Date(postalCode.updatedAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (postalCode) => <PostalCodeActions postalCode={postalCode} onDelete={handlePostalCodeDelete} onError={handlePostalCodeDeleteError} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Location Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Postal Codes</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/postal-codes/create">
                        New postal code
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search postal codes"
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

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="postal codes" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={postalCodes}
                        keyExtractor={(postalCode) => postalCode.id}
                        isLoading={isLoading}
                        emptyTitle="No postal codes found"
                        emptyDescription="Get started by creating your first postal code."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/postal-codes/create">
                                New postal code
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setCurrentPage}
                        itemName="postal codes"
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
