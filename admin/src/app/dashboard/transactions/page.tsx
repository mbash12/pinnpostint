"use client";

import React, { useState, useEffect } from "react";
import { SearchLg } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";
import { PaginationInfoComponent } from "@/components/base/pagination";
import { DataTable, type Column } from "@/components/application/data-table";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTransactions, useRefundTransaction, type Transaction } from "@/hooks/use-transactions";
import { formatCurrency } from '@/utils/currency';
import { useFormAlert } from "@/hooks/use-form-alert";

const transactionStatusStyles = {
    PENDING: "bg-warning-50 text-warning-700",
    COMPLETED: "bg-success-50 text-success-700",
    FAILED: "bg-error-50 text-error-700",
    REFUNDED: "bg-gray-50 text-gray-700"
};

function TransactionActions({ txn }: { txn: Transaction }) {
    const refundTransactionMutation = useRefundTransaction();
    const { showAlert } = useFormAlert();

    const handleRefund = async () => {
        try {
            await refundTransactionMutation.mutateAsync({
                id: txn.id,
                reason: 'Admin refund',
                amount: Number(txn.amount)
            });
            showAlert('Success', 'Transaction refunded successfully', 'success');
        } catch (error: any) {
            showAlert('Error', error?.message || 'Failed to refund transaction', 'error');
        }
    };

    return (
        <div className="flex justify-end gap-2">
            <Button color="secondary" size="sm" href={`/dashboard/transactions/${txn.id}`}>View</Button>
            {/* {txn.status === 'COMPLETED' && (
                <ConfirmationDialog 
                    title={`Refund Transaction?`} 
                    description={`Confirm refund of ${formatCurrency(Number(txn.amount))} ${txn.currency} for ${txn.user.firstName}?`} 
                    onConfirm={handleRefund}
                >
                    <Button color="secondary-destructive" size="sm">Refund</Button>
                </ConfirmationDialog>
            )} */}
        </div>
    );
}

export default function TransactionsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const { showAlert, AlertComponent } = useFormAlert();
    const { data: response, isLoading, isError, error } = useTransactions({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm.trim() || undefined,
    });

    const transactions = (response?.data || []) as Transaction[];
    const pagination = response?.pagination;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const paginationInfo = usePaginationInfo({
        data: transactions,
        pagination: pagination || {
            page: currentPage,
            limit: itemsPerPage,
            total: transactions.length,
            totalPages: Math.ceil(transactions.length / itemsPerPage)
        },
        currentPage,
        itemsPerPage
    });

    const columns: Column<Transaction>[] = [
        {
            key: "transaction",
            label: "Transaction",
            render: (txn) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{txn.id.slice(0, 8)}...</span>
                    <span className="text-xs text-tertiary">{txn.paymentIntentId?.slice(0, 20) || 'N/A'}</span>
                </div>
            )
        },
        {
            key: "customer",
            label: "Customer",
            render: (txn) => (
                <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-tertiary">
                        {txn.user.firstName.slice(0, 1).toUpperCase()}{txn.user.lastName?.slice(0, 1).toUpperCase() || ''}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{txn.user.firstName} {txn.user.lastName || ''}</span>
                        <span className="text-xs text-tertiary">{txn.user.phone || txn.user.email}</span>
                    </div>
                </div>
            )
        },
        {
            key: "amount",
            label: "Amount",
            render: (txn) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-primary">{formatCurrency(Number(txn.amount))} {txn.currency}</span>
                </div>
            )
        },
        {
            key: "paymentMethod",
            label: "Payment Method",
            render: (txn) => (
                <span className="text-sm text-primary capitalize">
                    {txn.paymentMethod || 'Unknown'}
                </span>
            )
        },
        {
            key: "status",
            label: "Status",
            render: (txn) => (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${transactionStatusStyles[txn.status]}`}>
                    {txn.status}
                </span>
            )
        },
        {
            key: "created",
            label: "Created",
            render: (txn) => <span className="text-tertiary">{new Date(txn.createdAt).toLocaleDateString()}</span>
        },
        {
            key: "actions",
            label: "Actions",
            className: "px-4 py-3 text-right",
            render: (txn) => <TransactionActions txn={txn} />
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Payment Operations</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Transactions</h1>
                </div>
            </header>
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        placeholder="Search transactions"
                        icon={SearchLg}
                        iconClassName="size-5"
                        className="max-w-md"
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />
                    <PaginationInfoComponent paginationInfo={paginationInfo} itemName="transactions" />
                </div>
                <DataTable
                    columns={columns}
                    data={transactions}
                    keyExtractor={(txn) => txn.id}
                    isLoading={isLoading}
                    isError={isError}
                    error={error}
                    emptyTitle="No transactions found"
                    emptyDescription="No payment records available."
                    paginationInfo={paginationInfo}
                    onPageChange={setCurrentPage}
                    itemName="transactions"
                />
            </section>
            <AlertComponent />
        </div>
    );
}