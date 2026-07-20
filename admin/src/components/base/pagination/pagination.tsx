"use client";

import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  maxVisiblePages = 7,
  className = "",
}: PaginationProps) {
  const visiblePages = useMemo(() => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const sidePages = Math.floor((maxVisiblePages - 3) / 2); // Reserve 3 spots for first, last, and ellipsis
    const startPage = Math.max(2, currentPage - sidePages);
    const endPage = Math.min(totalPages - 1, currentPage + sidePages);

    const pages: (number | string)[] = [1];

    if (startPage > 2) {
      pages.push("...");
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i);
      }
    }

    if (endPage < totalPages - 1) {
      pages.push("...");
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages, maxVisiblePages]);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className={`flex items-center justify-center gap-1 ${className}`} aria-label="Pagination">
      {/* Previous Button */}
      <Button
        color="secondary"
        size="sm"
        iconLeading={<ChevronLeft />}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Go to previous page"
      >
        Previous
      </Button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1 mx-2">
        {visiblePages.map((page, index) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-sm text-tertiary"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const pageNumber = page as number;
          const isActive = pageNumber === currentPage;

          return (
            <button
              key={pageNumber}
              onClick={() => onPageChange(pageNumber)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-brand-solid text-white"
                  : "text-tertiary hover:text-secondary hover:bg-secondary"
              }`}
              aria-label={`Go to page ${pageNumber}`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNumber}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <Button
        color="secondary"
        size="sm"
        iconTrailing={<ChevronRight />}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Go to next page"
      >
        Next
      </Button>
    </nav>
  );
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startItem: number;
  endItem: number;
}

export function usePagination<T>(
  items: T[],
  itemsPerPage: number = 10,
  initialPage: number = 1
): {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  paginatedItems: T[];
  paginationInfo: PaginationInfo;
} {
  const [currentPage, setCurrentPage] = React.useState(initialPage);

  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      startItem,
      endItem,
    };
  }, [items.length, itemsPerPage, currentPage]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  // Reset to first page when items change significantly
  React.useEffect(() => {
    if (currentPage > paginationInfo.totalPages && paginationInfo.totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items.length, currentPage, paginationInfo.totalPages]);

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    paginationInfo,
  };
}
