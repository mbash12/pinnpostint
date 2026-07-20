/**
 * API Pagination Components
 * Bridge between API pagination and admin panel pagination components
 */

"use client";

import React from 'react';
import { Pagination } from '@/components/base/pagination/pagination';
import { PaginationInfoComponent } from '@/components/base/pagination/pagination-info';
import { convertToPaginationInfo } from '@/hooks/use-api-pagination';
import type { PaginationMeta } from '@/lib/api-types';

export interface ApiPaginationProps {
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  itemName?: string;
  className?: string;
}

/**
 * Pagination component that works with API pagination format
 */
export function ApiPagination({
  pagination,
  onPageChange,
  showInfo = true,
  itemName = 'items',
  className = '',
}: ApiPaginationProps) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  const paginationInfo = convertToPaginationInfo(pagination);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {showInfo && (
        <PaginationInfoComponent
          paginationInfo={paginationInfo}
          itemName={itemName}
        />
      )}
      
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

export interface ApiPaginationInfoProps {
  pagination: PaginationMeta | null;
  itemName?: string;
  className?: string;
}

/**
 * Pagination info component that works with API pagination format
 */
export function ApiPaginationInfo({
  pagination,
  itemName = 'items',
  className = '',
}: ApiPaginationInfoProps) {
  if (!pagination) {
    return null;
  }

  const paginationInfo = convertToPaginationInfo(pagination);

  return (
    <PaginationInfoComponent
      paginationInfo={paginationInfo}
      itemName={itemName}
      className={className}
    />
  );
}

export interface ApiPaginationControlsProps {
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Pagination controls only (no info) that work with API pagination format
 */
export function ApiPaginationControls({
  pagination,
  onPageChange,
  className = '',
}: ApiPaginationControlsProps) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <Pagination
      currentPage={pagination.page}
      totalPages={pagination.totalPages}
      onPageChange={onPageChange}
      className={className}
    />
  );
}