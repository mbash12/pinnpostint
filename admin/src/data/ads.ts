export interface AdRecord {
    id: string;
    title: string;
    description: string;
    category: {
        id: string;
        name: string;
        slug: string;
    };
    subcategory?: {
        id: string;
        name: string;
        slug: string;
    };
    price: number | null;
    status: 'REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    images: string[];
    location?: string; // For display purposes
    userId: string;
    isFeatured: boolean;
    views?: number;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
    // Moderation fields
    moderatedBy?: string;
    moderatedAt?: string;
    rejectionReason?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const adsData: AdRecord[] = [];

export const statusStyles: Record<string, string> = {
    REVIEW: "bg-warning-subtle text-warning-primary",
    APPROVED: "bg-success-subtle text-success-primary",
    REJECTED: "bg-error-subtle text-error-primary",
    EXPIRED: "bg-secondary text-primary"
};

export const priorityStyles: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-red-100 text-red-800"
};
