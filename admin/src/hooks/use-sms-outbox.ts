/**
 * SMS Outbox hooks for the admin monitor page.
 *
 * The outbox is the durable record of every SMS we tried to send. If
 * `ADMIN_SMS_OUTBOX_MONITORING_ENABLED` (api) / `NEXT_PUBLIC_ENABLE_SMS_OUTBOX_MONITORING`
 * (admin) is off the api returns 404 and these hooks surface a clean
 * empty state instead of throwing.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type OutgoingSmsStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';
export type OutgoingSmsKind = 'notification' | 'otp' | 'admin-test';

export interface SmsOutboxMeta {
  adId?: string;
  adTitle?: string;
  notificationType?: string;
  reminderDays?: number;
  expiryDate?: string;
  label?: string;
}

export interface OutgoingSmsRow {
  id: string;
  to: string;
  message: string;
  templateId: string | null;
  kind: string;
  status: OutgoingSmsStatus;
  retryCount: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastError: string | null;
  providerResponse: unknown;
  meta: SmsOutboxMeta | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface OutboxCounts {
  PENDING: number;
  SENT: number;
  FAILED: number;
  DEAD: number;
}

export interface OutboxOverview {
  counts: OutboxCounts;
  rows: OutgoingSmsRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseOutboxOverviewOptions {
  status?: OutgoingSmsStatus | undefined;
  kind?: OutgoingSmsKind | undefined;
  search?: string | undefined;
  label?: string | undefined;
  reminderDays?: number | undefined;
  page?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const EMPTY_COUNTS: OutboxCounts = { PENDING: 0, SENT: 0, FAILED: 0, DEAD: 0 };
const EMPTY_OVERVIEW: OutboxOverview = {
  counts: EMPTY_COUNTS,
  rows: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
};

function isFeatureDisabled(error: unknown): boolean {
  const e = error as { data?: { error?: { code?: string } }; message?: string };
  return (
    e?.data?.error?.code === 'FEATURE_DISABLED' ||
    e?.message?.includes('FEATURE_DISABLED') === true
  );
}

export function useOutboxOverview(options: UseOutboxOverviewOptions = {}) {
  const {
    status,
    kind,
    search,
    label,
    reminderDays,
    page = 1,
    limit = 25,
    autoRefresh = false,
    refreshInterval = 30_000,
  } = options;

  const query = useQuery({
    queryKey: ['sms-outbox-overview', { status, kind, search, label, reminderDays, page, limit }],
    queryFn: async (): Promise<OutboxOverview> => {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;
      if (kind) params.kind = kind;
      if (search && search.trim()) params.search = search.trim();
      if (label && label.trim()) params.label = label.trim();
      if (typeof reminderDays === 'number') params.reminderDays = reminderDays;

      const res = await apiClient.get<OutboxOverview>('/admin/sms-outbox', params);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load SMS outbox');
      }
      return (res as unknown as { data: OutboxOverview }).data ?? EMPTY_OVERVIEW;
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error) => {
      if (isFeatureDisabled(error)) return false;
      return failureCount < 2;
    },
  });

  return {
    ...query,
    data: query.data ?? EMPTY_OVERVIEW,
    isFeatureDisabled: query.error ? isFeatureDisabled(query.error) : false,
  };
}

export interface RetryOutboxRowResult {
  row: {
    id: string;
    status: OutgoingSmsStatus;
    retryCount: number;
    nextRetryAt: string;
  };
}

export function useRetryOutboxRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<RetryOutboxRowResult> => {
      const res = await apiClient.post<RetryOutboxRowResult>(`/admin/sms-outbox/${id}/retry`);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to retry outbox row');
      }
      return (res as unknown as { data: RetryOutboxRowResult }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-outbox-overview'] });
    },
  });
}

export interface TriggerDrainResult {
  scanned: number;
  sent: number;
  failed: number;
  exhausted: number;
}

export function useTriggerOutboxDrain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TriggerDrainResult> => {
      const res = await apiClient.post<TriggerDrainResult>('/admin/sms-outbox/drain');
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to trigger outbox drain');
      }
      return (res as unknown as { data: TriggerDrainResult }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-outbox-overview'] });
    },
  });
}

// ── Forecast / ad SMS tracker ───────────────────────────────

export type TrackerSmsStatus =
  | 'sent'
  | 'pending'
  | 'failed'
  | 'dead'
  | 'scheduled'
  | 'missed'
  | 'n/a';

export interface TrackerSmsSlot {
  status: TrackerSmsStatus;
  scheduledDate: string | null;
  scheduledLabel: string | null;
  sentAt: string | null;
  outboxId: string | null;
  outboxStatus: string | null;
  detail?: string | null;
}

export interface TrackerPreExpirySlot extends TrackerSmsSlot {
  reminderDays: number;
}

export interface AdSmsTrackerRow {
  adId: string;
  adTitle: string;
  adStatus: string;
  userId: string;
  userName: string;
  userPhone: string;
  expiresAt: string;
  expiresAtIso: string;
  daysLeft: number;
  preExpiry: TrackerPreExpirySlot[];
  expiry: TrackerSmsSlot;
  lastPostExpiry: TrackerSmsSlot;
  nextPostExpiry: TrackerSmsSlot;
}

export interface AdSmsTrackerResult {
  mode: 'ads';
  rows: AdSmsTrackerRow[];
  leadDays: number[];
  summary: {
    total: number;
    withUpcoming: number;
    withMissed: number;
    expired: number;
    active: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useAdSmsTracker(options: {
  search?: string;
  page?: number;
  limit?: number;
  autoRefresh?: boolean;
} = {}) {
  const { search = '', page = 1, limit = 25, autoRefresh = true } = options;
  return useQuery({
    queryKey: ['sms-forecast-tracker', { search, page, limit }],
    queryFn: async (): Promise<AdSmsTrackerResult> => {
      const params: Record<string, string | number> = { page, limit };
      if (search.trim()) params.search = search.trim();
      const res = await apiClient.get<AdSmsTrackerResult>('/admin/sms-outbox/forecast', params);
      if (!res.success) {
        throw new Error(res.error?.message ?? 'Failed to load SMS tracker');
      }
      return (res as unknown as { data: AdSmsTrackerResult }).data;
    },
    refetchInterval: autoRefresh ? 30_000 : false,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}
