"use client";

import React, { ReactNode } from "react";
import { Pagination, PaginationInfoComponent } from "@/components/base/pagination";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { SearchLg } from "@untitledui/icons";

export interface Column<T> {
    key: string;
    label: string;
    render: (item: T) => ReactNode;
    className?: string;
}

export interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    startItem: number;
    endItem: number;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (item: T) => string;
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: ReactNode;
    paginationInfo?: PaginationInfo;
    onPageChange?: (page: number) => void;
    itemName?: string;
    className?: string;
}

export function DataTable<T>({
    columns,
    data,
    keyExtractor,
    isLoading = false,
    isError = false,
    error = null,
    emptyTitle = "No data found",
    emptyDescription = "There are no items to display at the moment.",
    emptyAction,
    paginationInfo,
    onPageChange,
    itemName = "items",
    className = "",
}: DataTableProps<T>) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-primary border-r-transparent"></div>
                    <p className="mt-4 text-sm text-tertiary">Loading {itemName}...</p>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center py-16">
                <EmptyState size="md">
                    <EmptyState.Header>
                        <EmptyState.FeaturedIcon icon={SearchLg} color="error" />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <EmptyState.Title>Error loading {itemName}</EmptyState.Title>
                        <EmptyState.Description>
                            {error?.message || `Failed to load ${itemName}. Please try again.`}
                        </EmptyState.Description>
                    </EmptyState.Content>
                </EmptyState>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center py-16">
                <EmptyState size="md">
                    <EmptyState.Header>
                        <EmptyState.FeaturedIcon icon={SearchLg} color="gray" />
                    </EmptyState.Header>
                    <EmptyState.Content>
                        <EmptyState.Title>{emptyTitle}</EmptyState.Title>
                        <EmptyState.Description>{emptyDescription}</EmptyState.Description>
                    </EmptyState.Content>
                    {emptyAction && <EmptyState.Footer>{emptyAction}</EmptyState.Footer>}
                </EmptyState>
            </div>
        );
    }

    return (
        <>
            <div className={`overflow-x-auto ${className}`}>
                <table className="min-w-full divide-y divide-secondary text-sm">
                    <thead className="text-xs uppercase tracking-wide text-quaternary">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={column.className || "px-4 py-3 text-left"}
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary text-primary">
                        {data.map((item) => (
                            <tr key={keyExtractor(item)} className="transition hover:bg-secondary">
                                {columns.map((column) => (
                                    <td key={column.key} className="px-4 py-3">
                                        {column.render(item)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {paginationInfo && onPageChange && paginationInfo.totalPages > 1 && (
                <div className="flex items-center justify-between pt-6">
                    <PaginationInfoComponent
                        paginationInfo={paginationInfo}
                        itemName={itemName}
                        className="hidden sm:block"
                    />
                    <Pagination
                        currentPage={paginationInfo.currentPage}
                        totalPages={paginationInfo.totalPages}
                        onPageChange={onPageChange}
                        className="mx-auto sm:mx-0"
                    />
                </div>
            )}
        </>
    );
}
