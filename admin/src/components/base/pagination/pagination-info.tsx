"use client";

import type { PaginationInfo } from "./pagination";

export interface PaginationInfoProps {
  paginationInfo: PaginationInfo;
  itemName?: string;
  className?: string;
}

export function PaginationInfoComponent({
  paginationInfo,
  itemName = "items",
  className = "",
}: PaginationInfoProps) {
  const { startItem, endItem, totalItems } = paginationInfo;

  if (totalItems === 0) {
    return (
      <div className={`text-sm text-tertiary ${className}`}>
        No {itemName} found
      </div>
    );
  }

  return (
    <div className={`text-sm text-tertiary ${className}`}>
      Showing {startItem} to {endItem} of {totalItems} {itemName}
    </div>
  );
}
