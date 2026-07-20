"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CurrencyDollar, User01, Calendar, Printer, Mail05, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";
import { useTransaction, type Transaction } from "@/hooks/use-transactions";
import { formatCurrency } from "@/utils/currency";

const transactionStatusStyles = {
    PENDING: "bg-warning-subtle text-warning-primary",
    COMPLETED: "bg-success-subtle text-success-primary",
    FAILED: "bg-error-subtle text-error-primary",
    REFUNDED: "bg-gray-50 text-gray-700"
};

export default function TransactionDetailPage() {
    const params = useParams<{ id: string }>();
    const transactionId = params?.id;
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const { data: response, isLoading, error } = useTransaction(transactionId!);
    const transaction = response?.data;

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/transactions">
                        Back to Transactions
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <div className="animate-pulse">
                        <div className="h-4 bg-secondary rounded mb-4"></div>
                        <div className="h-4 bg-secondary rounded w-3/4 mx-auto"></div>
                    </div>
                    <p className="text-tertiary mt-4">Loading transaction details...</p>
                </div>
            </div>
        );
    }

    if (error || !transaction) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/transactions">
                        Back to Transactions
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <CurrencyDollar className="mx-auto h-12 w-12 text-tertiary mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">Transaction Not Found</h3>
                    <p className="text-tertiary">The requested transaction could not be found or may have been deleted.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/transactions">
                            Back
                        </Button>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold text-primary">Transaction {transaction.id.slice(0, 8)}...</h1>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-tertiary">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {new Date(transaction.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            color="secondary"
                            size="sm"
                            onClick={() => setShowReceiptModal(true)}
                        >
                            View Receipt
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Payment Details */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <CurrencyDollar className="h-5 w-5" />
                            Payment Details
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {formatCurrency(Number(transaction.amount))}
                                    </div>
                                    <div className="text-sm text-tertiary">Amount</div>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {transaction.currency}
                                    </div>
                                    <div className="text-sm text-tertiary">Currency</div>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary capitalize">
                                        {transaction.status}
                                    </div>
                                    <div className="text-sm text-tertiary">Status</div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-secondary">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-tertiary">Payment Intent ID:</span>
                                        <span className="ml-2 font-mono text-primary">{transaction.paymentIntentId || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">Payment Method:</span>
                                        <span className="ml-2 font-medium text-primary capitalize">
                                            {transaction.paymentMethod || 'Unknown'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">Payment Provider:</span>
                                        <span className="ml-2 text-primary">{transaction.paymentProvider}</span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">Created At:</span>
                                        <span className="ml-2 text-primary">{new Date(transaction.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Associated Subscription */}
                    {transaction.subscription && (
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Associated Subscription
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-primary">{transaction.subscription.ad.title}</h3>
                                        <p className="text-sm text-tertiary">Ad ID: {transaction.subscription.ad.id}</p>
                                        <div className="text-lg font-bold text-primary mt-2">
                                            {formatCurrency(Number(transaction.subscription.ad.price))}
                                        </div>
                                    </div>
                                    <Button color="secondary" size="sm" href={`/dashboard/ad-moderation/${transaction.subscription.ad.id}`}>
                                        View Ad
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-tertiary">Start Date:</span>
                                        <span className="ml-2 text-primary">{new Date(transaction.subscription.startDate).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">End Date:</span>
                                        <span className="ml-2 text-primary">{new Date(transaction.subscription.endDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">

                    {/* User Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <User01 className="h-5 w-5" />
                            Customer Information
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-base font-medium text-tertiary">
                                    {transaction.user.firstName.slice(0, 1).toUpperCase()}{transaction.user.lastName?.slice(0, 1).toUpperCase() || ''}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-primary">
                                        {transaction.user.firstName} {transaction.user.lastName || ''}
                                    </h3>
                                    <p className="text-sm text-tertiary">{transaction.user.phone || transaction.user.email}</p>
                                    {transaction.user.phone && <p className="text-xs text-tertiary">{transaction.user.email}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Transaction Details</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-tertiary mb-1">Transaction ID</div>
                                <div className="text-sm font-medium text-primary break-all">{transaction.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">User ID</div>
                                <div className="text-sm font-medium text-primary break-all">{transaction.user.id}</div>
                            </div>
                            {transaction.subscription && (
                                <div>
                                    <div className="text-xs text-tertiary mb-1">Subscription ID</div>
                                    <div className="text-sm font-medium text-primary break-all">{transaction.subscription.id}</div>
                                </div>
                            )}
                            <div>
                                <div className="text-xs text-tertiary mb-1">Last Updated</div>
                                <div className="text-sm font-medium text-primary">{new Date(transaction.updatedAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            <DialogTrigger isOpen={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <ModalOverlay>
                    <Modal>
                        <Dialog className="w-full max-w-4xl mx-auto">
                            <div className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-xl">
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-secondary">
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary font-bold text-lg">
                                            PN
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-primary">Payment Receipt</h3>
                                            <p className="text-sm text-tertiary">Transaction ID: {transaction?.id}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm text-tertiary">Date Issued:</p>
                                            <p className="font-medium text-primary">{transaction ? new Date(transaction.createdAt).toLocaleDateString() : ''}</p>
                                        </div>
                                        <button
                                            onClick={() => setShowReceiptModal(false)}
                                            className="flex size-8 items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                                        >
                                            <XClose className="h-5 w-5 text-tertiary" />
                                        </button>
                                    </div>
                                </div>

                                {/* Transaction Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="rounded-lg border border-secondary bg-primary p-4">
                                        <h4 className="font-semibold text-primary mb-3 pb-2 border-b border-secondary">Transaction Information</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Transaction ID:</span>
                                                <span className="font-medium text-primary">{transaction?.id}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Date:</span>
                                                <span className="font-medium text-primary">{transaction ? new Date(transaction.createdAt).toLocaleDateString() : ''}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Time:</span>
                                                <span className="font-medium text-primary">{transaction ? new Date(transaction.createdAt).toLocaleTimeString() : ''}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Status:</span>
                                                <span className={`font-medium ${transactionStatusStyles[transaction?.status || 'PENDING']}`}>
                                                    {transaction?.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-secondary bg-primary p-4">
                                        <h4 className="font-semibold text-primary mb-3 pb-2 border-b border-secondary">Payment Information</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Amount:</span>
                                                <span className="font-bold text-primary text-lg">
                                                    {transaction ? formatCurrency(Number(transaction.amount)) : ''} {transaction?.currency}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Payment Method:</span>
                                                <span className="font-medium text-primary">Credit Card</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-tertiary">Payment Intent:</span>
                                                <span className="font-mono text-xs text-primary truncate max-w-[120px]">
                                                    {transaction?.paymentIntentId || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Details */}
                                <div className="rounded-lg border border-secondary bg-primary p-4">
                                    <h4 className="font-semibold text-primary mb-3 pb-2 border-b border-secondary">Customer Information</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-base font-medium text-tertiary">
                                            {transaction?.user.firstName.slice(0, 1).toUpperCase()}{transaction?.user.lastName?.slice(0, 1).toUpperCase() || ''}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-primary text-lg">
                                                {transaction?.user.firstName} {transaction?.user.lastName || ''}
                                            </div>
                                            <div className="flex flex-wrap gap-4 mt-2">
                                                <div>
                                                    <p className="text-xs text-tertiary">Phone</p>
                                                    <p className="text-sm text-primary">{transaction?.user.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-tertiary">Email</p>
                                                    <p className="text-sm text-primary">{transaction?.user.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ad Details (if subscription exists) */}
                                {transaction?.subscription && (
                                    <div className="rounded-lg border border-secondary bg-primary p-4">
                                        <h4 className="font-semibold text-primary mb-3 pb-2 border-b border-secondary">Subscription Details</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-tertiary">Ad Title</p>
                                                <p className="font-medium text-primary">{transaction.subscription.ad?.title || 'N/A'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-tertiary">Start Date</p>
                                                    <p className="font-medium text-primary">{new Date(transaction.subscription.startDate).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-tertiary">End Date</p>
                                                    <p className="font-medium text-primary">{new Date(transaction.subscription.endDate).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <p className="text-xs text-tertiary">Ad ID</p>
                                                <p className="font-mono text-sm text-primary">{transaction.subscription.ad?.id || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-secondary">
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 border-t border-secondary">
                                        <div className="text-xs text-tertiary text-center sm:text-left">
                                            <p>This receipt is computer generated and does not require a signature.</p>
                                            <p className="mt-1">For any queries, contact support@pinnpost.com</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button
                                                color="secondary"
                                                size="sm"
                                                iconLeading={<Printer />}
                                                onClick={() => window.print()}
                                            >
                                                Print Receipt
                                            </Button>
                                            <Button
                                                color="primary"
                                                size="sm"
                                                iconLeading={<Mail05 />}
                                                onClick={() => {
                                                    // Implementation would go here to email receipt
                                                    alert('Email receipt functionality would be implemented here');
                                                }}
                                            >
                                                Email Receipt
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </DialogTrigger>
        </div>
    );
}