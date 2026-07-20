export interface SubscriptionRecord {
    id: string;
    userId: string;
    adId: string;
    startDate: string;
    endDate: string;
    isRenewed: boolean;
    isActive: boolean;
    createdAt: string;
}

export const subscriptionsData: SubscriptionRecord[] = [];
