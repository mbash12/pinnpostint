export type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type PaymentMethod = "Credit Card" | "Bank Transfer" | "E-Wallet" | "Cash";
export type TransactionChannel = "Marketplace" | "Subscription" | "Promotion";

export interface TransactionRecord {
    id: string;
    invoiceId: string;
    reference: string;
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    amount: number;
    currency: string;
    fee: number;
    netAmount: number;
    status: TransactionStatus;
    method: PaymentMethod;
    channel: TransactionChannel;
    riskLevel: RiskLevel;
    createdAt: string;
    updatedAt: string;
}

export const transactionsData: TransactionRecord[] = [];

export const transactionStatusStyles: Record<TransactionStatus, string> = {
    COMPLETED: "bg-success-subtle text-success-primary",
    PENDING: "bg-warning-subtle text-warning-primary",
    FAILED: "bg-error-subtle text-error-primary",
    REFUNDED: "bg-secondary text-tertiary",
};

export const riskLevelStyles: Record<RiskLevel, string> = {
    LOW: "bg-success-subtle text-success-primary",
    MEDIUM: "bg-warning-subtle text-warning-primary",
    HIGH: "bg-error-subtle text-error-primary",
};
