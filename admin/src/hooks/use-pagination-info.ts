import { useMemo } from 'react';
import type { PaginationInfo } from '@/components/application/data-table';

interface UsePaginationInfoProps {
    data?: any[];
    pagination?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
    currentPage: number;
    itemsPerPage: number;
}

export function usePaginationInfo({
    data = [],
    pagination,
    currentPage,
    itemsPerPage,
}: UsePaginationInfoProps): PaginationInfo {
    return useMemo(() => {
        const total = pagination?.total ?? data.length;
        const page = pagination?.page ?? currentPage;
        const limit = pagination?.limit ?? itemsPerPage;
        const totalPages = pagination?.totalPages ?? Math.ceil(total / limit);

        const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
        const endItem = Math.min(page * limit, total);

        return {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            startItem,
            endItem,
        };
    }, [data, pagination, currentPage, itemsPerPage]);
}
