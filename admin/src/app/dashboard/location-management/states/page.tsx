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
import { useStates, useDeleteState } from "@/hooks/use-states";
import { State } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

function StateActions({ state, onDelete, onError }: { state: State; onDelete: () => void; onError: (error: string) => void }) {
    const deleteStateMutation = useDeleteState();

    const confirmDelete = async () => {
        try {
            await deleteStateMutation.mutateAsync(state.id);
            onDelete();
        } catch (error: any) {
            onError(error.message || "Failed to delete state");
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/location-management/cities?stateId=${state.id}`}>
                Cities
            </Button>
            <Button color="secondary" size="sm" href={`/dashboard/location-management/states/${state.id}/edit`}>
                Edit
            </Button>
            <ConfirmationDialog
                title={`Delete ${state.name}?`}
                description={`Are you sure you want to delete "${state.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            >
                <Button
                    color="secondary-destructive"
                    size="sm"
                    type="button"
                    isLoading={deleteStateMutation.isPending}
                >
                    Delete
                </Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function StatesPage() {
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

    const { data, pagination, isLoading, refresh } = useStates({
        page: currentPage,
        limit: itemsPerPage,
        isActive: selectedActive === "all" ? undefined : selectedActive === "true",
        search: debouncedSearchTerm.trim() || undefined,
    });

    const states = (data || []) as State[];

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
        data: states,
        pagination: pagination || undefined,
        currentPage,
        itemsPerPage
    });

    const handleStateDelete = () => {
        refresh();
    };

    const handleStateDeleteError = (error: string) => {
        setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            description: error,
            type: "error",
        });
    };

    const columns: Column<State>[] = [
        {
            key: "name",
            label: "State",
            render: (state) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{state.name}</span>
                    <span className="text-xs text-tertiary">{state.code || 'No code'}</span>
                </div>
            ),
        },
        {
            key: "country",
            label: "Country",
            render: (state) => <span className="text-tertiary">India</span>,
        },
        {
            key: "status",
            label: "Status",
            render: (state) => (
                <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        state.isActive
                            ? "bg-success-subtle text-success-primary"
                            : "bg-warning-subtle text-warning-primary"
                    }`}
                >
                    {state.isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            key: "created",
            label: "Created",
            render: (state) => (
                <span className="text-tertiary">{new Date(state.createdAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "updated",
            label: "Updated",
            render: (state) => (
                <span className="text-tertiary">{new Date(state.updatedAt).toLocaleDateString()}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (state) => <StateActions state={state} onDelete={handleStateDelete} onError={handleStateDeleteError} />,
        },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Location Management</p>
                        <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">States</h1>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/states/create">
                        New state
                    </Button>
                </header>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input
                                placeholder="Search states"
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

                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="states" />
                    </div>

                    <DataTable
                        columns={columns}
                        data={states}
                        keyExtractor={(state) => state.id}
                        isLoading={isLoading}
                        emptyTitle="No states found"
                        emptyDescription="Get started by creating your first state."
                        emptyAction={
                            <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/states/create">
                                New state
                            </Button>
                        }
                        paginationInfo={paginationInfo}
                        onPageChange={setCurrentPage}
                        itemName="states"
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
