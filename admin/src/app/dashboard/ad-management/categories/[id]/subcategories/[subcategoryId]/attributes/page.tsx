"use client";

import React, { useState, useEffect } from "react";
import { Plus, SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useAttributes, useDeleteAttribute } from "@/hooks/use-categories";
import { Attribute } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useParams } from "next/navigation";

function AttributeActions({ attribute, categoryId, subcategoryId, onDelete, isDeleting }: { attribute: Attribute; categoryId: string; subcategoryId: string; onDelete: () => void; isDeleting: boolean }) {
    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategoryId}/attributes/${attribute.id}/edit`}>Edit</Button>
            <ConfirmationDialog title={`Delete ${attribute.name}?`} description="This action cannot be undone." onConfirm={onDelete}>
                <Button color="secondary-destructive" size="sm" isLoading={isDeleting}>Delete</Button>
            </ConfirmationDialog>
        </div>
    );
}

export default function AttributesPage() {
    const params = useParams();
    const categoryId = params.id as string;
    const subcategoryId = params.subcategoryId as string;
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const deleteMutation = useDeleteAttribute();

    // Note: useAttributes doesn't use useApiPagination, so it doesn't support server-side pagination
    // We'll need to update this to use a paginated version if available
    const { data: response, isLoading, isError, error, refetch } = useAttributes(subcategoryId);
    const allAttributes = (Array.isArray(response?.data) ? response.data : []) as Attribute[];

    const attributes = allAttributes.filter(attr => {
        const matchesSearch = !debouncedSearchTerm || attr.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        const matchesType = selectedType === "all" || attr.type === selectedType;
        return matchesSearch && matchesType;
    });

    useEffect(() => { const timer = setTimeout(() => { setDebouncedSearchTerm(searchTerm); setCurrentPage(1); }, 500); return () => clearTimeout(timer); }, [searchTerm]);
    useEffect(() => { setCurrentPage(1); }, [selectedType]);

    const paginationInfo = usePaginationInfo({
        data: attributes,
        pagination: {
            page: currentPage,
            limit: itemsPerPage,
            total: attributes.length,
            totalPages: Math.ceil(attributes.length / itemsPerPage)
        },
        currentPage,
        itemsPerPage
    });
    const paginatedAttributes = attributes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleAttributeDeleted = (attribute: Attribute) => {
        deleteMutation.mutateAsync(attribute.id).then(() => {
            refetch(); // Trigger a refetch to update the list after deletion
        }).catch(error => {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: error.message || "Failed to delete attribute",
                type: "error",
            });
        });
    };

    const columns: Column<Attribute>[] = [
        { key: "name", label: "Attribute", render: (attr) => <div className="flex flex-col"><span className="font-semibold text-primary">{attr.name}</span><span className="text-xs text-tertiary">{attr.id}</span></div> },
        { key: "type", label: "Type", render: (attr) => <span className="text-tertiary">{attr.type}</span> },
        { key: "required", label: "Required", render: (attr) => <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${attr.isRequired ? "bg-brand-subtle text-brand-primary" : "bg-secondary text-tertiary"}`}>{attr.isRequired ? "Yes" : "No"}</span> },
        { key: "created", label: "Created", render: (attr) => <span className="text-tertiary">{new Date(attr.createdAt).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (attr) => <AttributeActions attribute={attr} categoryId={categoryId} subcategoryId={subcategoryId} onDelete={() => handleAttributeDeleted(attr)} isDeleting={deleteMutation.isPending} /> },
    ];

    return (
        <>
            <div className="space-y-8">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Ad Management</p>
                        <div className="flex items-center gap-2">
                            <Button color="secondary" size="sm" iconLeading={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/></svg>} href={`/dashboard/ad-management/categories/${categoryId}/subcategories`}>
                                Subcategories
                            </Button>
                            <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Attributes</h1>
                        </div>
                    </div>
                    <Button color="primary" size="sm" iconLeading={<Plus />} href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategoryId}/attributes/create`}>New Attribute</Button>
                </header>
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
                            <Input placeholder="Search attributes" icon={SearchLg} iconClassName="size-5" className="max-w-md" value={searchTerm} onChange={setSearchTerm} />
                            <Select selectedKey={selectedType} onSelectionChange={(key) => typeof key === "string" && setSelectedType(key)} items={[{ id: "all", label: "All Types" }, { id: "TEXT", label: "Text" }, { id: "NUMBER", label: "Number" }, { id: "SELECT", label: "Select" }]} size="sm" className="min-w-32">
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        </div>
                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="attributes" />
                    </div>
                    <DataTable columns={columns} data={paginatedAttributes} keyExtractor={(attr) => attr.id} isLoading={isLoading} isError={isError} error={error} emptyTitle="No attributes found" emptyDescription="Create your first attribute." emptyAction={<Button color="primary" size="sm" iconLeading={<Plus />} href={`/dashboard/ad-management/categories/${categoryId}/subcategories/${subcategoryId}/attributes/create`}>New Attribute</Button>} paginationInfo={paginationInfo} onPageChange={setCurrentPage} itemName="attributes" />
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
