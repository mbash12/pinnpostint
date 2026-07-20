'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
    RefreshCcw01,
    ClockRefresh,
    Zap,
    Calendar,
    MessageTextCircle01,
    AlertCircle,
    Copy01,
    Check,
    XClose,
    ChevronRight,
} from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { DataTable, type Column } from '@/components/application/data-table';
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { PaginationInfoComponent } from '@/components/base/pagination';
import { usePaginationInfo } from '@/hooks/use-pagination-info';
import { useFormAlert } from '@/hooks/use-form-alert';
import { useClipboard } from '@/hooks/use-clipboard';
import { config } from '@/config/environment';
import { useSettings } from '@/hooks/use-settings';
import {
    useOutboxOverview,
    useRetryOutboxRow,
    useTriggerOutboxDrain,
    useAdSmsTracker,
    type OutgoingSmsRow,
    type OutgoingSmsStatus,
    type OutgoingSmsKind,
    type AdSmsTrackerRow,
    type TrackerSmsSlot,
    type TrackerSmsStatus,
    type SmsOutboxMeta,
} from '@/hooks/use-sms-outbox';

// ── Filters ─────────────────────────────────────────────────

const KIND_CHIPS: Array<{ id: 'ALL' | OutgoingSmsKind; label: string }> = [
    { id: 'ALL', label: 'All kinds' },
    { id: 'notification', label: 'Notification' },
    { id: 'otp', label: 'OTP' },
    { id: 'admin-test', label: 'Admin test' },
];

const TYPE_CHIPS: Array<{ id: string; label: string }> = [
    { id: '', label: 'Any type' },
    { id: 'pre-expiry', label: 'Pre-expiry' },
    { id: 'expiry', label: 'Expiry' },
    { id: 'post-expiry', label: 'Post-expiry' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'extended', label: 'Extended' },
    { id: 'booking', label: 'Booking' },
    { id: 'payment', label: 'Payment' },
];

const statusStyles: Record<OutgoingSmsStatus, string> = {
    PENDING: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-200',
    SENT: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-200',
    FAILED: 'bg-error-50 text-error-700 ring-1 ring-inset ring-error-200',
    DEAD: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
};


const trackerStatusStyles: Record<TrackerSmsStatus, string> = {
    sent: 'bg-success-50 text-success-800 ring-1 ring-inset ring-success-200',
    pending: 'bg-warning-50 text-warning-800 ring-1 ring-inset ring-warning-200',
    failed: 'bg-error-50 text-error-800 ring-1 ring-inset ring-error-200',
    dead: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200',
    scheduled: 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200',
    missed: 'bg-error-50 text-error-700 ring-1 ring-inset ring-error-200',
    'n/a': 'bg-secondary text-tertiary ring-1 ring-inset ring-secondary',
};

function formatTrackerWhen(slot: TrackerSmsSlot): string {
    if (slot.sentAt) {
        try {
            return new Date(slot.sentAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Kolkata',
            });
        } catch {
            return slot.sentAt;
        }
    }
    return slot.scheduledLabel || slot.scheduledDate || '—';
}

function TrackerStatusPill({ slot, label }: { slot: TrackerSmsSlot; label?: string }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-[6.5rem]">
            <span
                className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${trackerStatusStyles[slot.status]}`}
            >
                {label ? `${label} · ${slot.status}` : slot.status}
            </span>
            <span className="text-xs text-tertiary">{formatTrackerWhen(slot)}</span>
        </div>
    );
}

function PreExpiryCell({ slots }: { slots: AdSmsTrackerRow['preExpiry'] }) {
    if (slots.length === 0) {
        return <span className="text-sm text-tertiary">No lead days configured</span>;
    }
    return (
        <div className="flex flex-col gap-1.5">
            {slots.map((slot) => (
                <div key={slot.reminderDays} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-xs font-semibold text-secondary">
                        {slot.reminderDays}d
                    </span>
                    <TrackerStatusPill slot={slot} />
                </div>
            ))}
        </div>
    );
}

function ForecastDetailPanel({
    row,
    onClose,
}: {
    row: AdSmsTrackerRow;
    onClose: () => void;
}) {
    return (
        <ModalOverlay
            isOpen
            isDismissable
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="w-full max-w-3xl">
                <Dialog aria-label="Ad SMS tracker details" className="w-full max-w-3xl mx-auto">
                    <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b border-secondary bg-secondary/40 px-5 py-4">
                            <div className="min-w-0 space-y-1">
                                <p className="font-medium text-primary">{row.adTitle}</p>
                                <p className="text-sm text-secondary">
                                    {row.adStatus} · expires {row.expiresAt}
                                    {row.daysLeft >= 0
                                        ? ` · ${row.daysLeft}d left`
                                        : ` · ${Math.abs(row.daysLeft)}d ago`}
                                </p>
                                <p className="font-mono text-sm text-tertiary">{row.userPhone}</p>
                            </div>
                            <Button size="sm" color="tertiary" iconLeading={XClose} onClick={onClose}>
                                Close
                            </Button>
                        </div>
                        <div className="space-y-5 overflow-y-auto p-5">
                            <DetailField label="Pre-expiry leads">
                                <PreExpiryCell slots={row.preExpiry} />
                            </DetailField>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <DetailField label="Expiry SMS">
                                    <TrackerStatusPill slot={row.expiry} />
                                </DetailField>
                                <DetailField label="Last post-expiry">
                                    <TrackerStatusPill slot={row.lastPostExpiry} />
                                </DetailField>
                                <DetailField label="Next post-expiry">
                                    <TrackerStatusPill slot={row.nextPostExpiry} />
                                </DetailField>
                            </div>
                            <DetailField label="Ad">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs text-tertiary">{row.adId}</span>
                                    <CopyButton text={row.adId} />
                                    <Link
                                        href={`/dashboard/ad-management/ads/${row.adId}`}
                                        className="text-xs font-medium text-brand-700 hover:underline"
                                    >
                                        Open ad
                                    </Link>
                                </div>
                            </DetailField>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}

// ── Forecast tab (ad SMS tracker) ───────────────────────────

function ForecastTab() {
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const itemsPerPage = 25;

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchInput);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const tracker = useAdSmsTracker({
        search: debouncedSearch,
        page: currentPage,
        limit: itemsPerPage,
        autoRefresh: true,
    });

    const rows = tracker.data?.rows ?? [];
    const summary = tracker.data?.summary ?? {
        total: 0,
        withUpcoming: 0,
        withMissed: 0,
        expired: 0,
        active: 0,
    };
    const leadDays = tracker.data?.leadDays ?? [];
    const pagination = tracker.data?.pagination;
    const selectedRow = rows.find((r) => r.adId === selectedId) ?? null;

    const paginationInfo = usePaginationInfo({
        data: rows,
        pagination: pagination ?? {
            page: currentPage,
            limit: itemsPerPage,
            total: 0,
            totalPages: 1,
        },
        currentPage,
        itemsPerPage,
    });

    useEffect(() => {
        if (selectedId && !rows.some((r) => r.adId === selectedId)) {
            setSelectedId(null);
        }
    }, [rows, selectedId]);

    const columns: Column<AdSmsTrackerRow>[] = useMemo(
        () => [
            {
                key: 'ad',
                label: 'Ad',
                render: (row) => (
                    <div className="flex flex-col gap-0.5 min-w-[12rem] max-w-[16rem]">
                        <Link
                            href={`/dashboard/ad-management/ads/${row.adId}`}
                            className="truncate text-sm font-medium text-brand-700 hover:underline"
                            title={row.adTitle}
                        >
                            {row.adTitle}
                        </Link>
                        <span className="text-xs text-tertiary">
                            {row.adStatus}
                            {row.daysLeft >= 0
                                ? ` · ${row.daysLeft}d left`
                                : ` · ${Math.abs(row.daysLeft)}d ago`}
                        </span>
                    </div>
                ),
            },
            {
                key: 'recipient',
                label: 'Recipient',
                render: (row) => (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm font-medium text-primary">{row.userPhone}</span>
                        <span className="truncate text-xs text-tertiary">{row.userName}</span>
                    </div>
                ),
            },
            {
                key: 'expiresAt',
                label: 'Expires',
                render: (row) => (
                    <span className="text-sm text-primary">{row.expiresAt}</span>
                ),
            },
            {
                key: 'preExpiry',
                label: 'Pre-expiry SMS',
                render: (row) => <PreExpiryCell slots={row.preExpiry} />,
            },
            {
                key: 'expiry',
                label: 'Expiry SMS',
                render: (row) => <TrackerStatusPill slot={row.expiry} />,
            },
            {
                key: 'lastPost',
                label: 'Last post-expiry',
                render: (row) => <TrackerStatusPill slot={row.lastPostExpiry} />,
            },
            {
                key: 'nextPost',
                label: 'Next post-expiry',
                render: (row) => <TrackerStatusPill slot={row.nextPostExpiry} />,
            },
            {
                key: 'actions',
                label: '',
                className: 'text-right',
                render: (row) => (
                    <Button
                        size="sm"
                        color="tertiary"
                        onClick={() => setSelectedId(row.adId)}
                        iconTrailing={ChevronRight}
                    >
                        Details
                    </Button>
                ),
            },
        ],
        []
    );

    return (
        <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">
                        Planning
                    </p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">
                        SMS Forecast
                    </h1>
                    <p className="max-w-2xl text-sm text-tertiary">
                        Per-ad lifecycle of expiry SMS — pre-expiry leads
                        {leadDays.length > 0 ? ` (${leadDays.map((d) => `${d}d`).join(', ')})` : ''},
                        day-0 expiry, and weekly post-expiry. Shows whether each SMS was sent or is
                        still scheduled.
                    </p>
                </div>
                <Button
                    color="secondary"
                    size="md"
                    onClick={() => tracker.refetch()}
                    iconLeading={RefreshCcw01}
                    isLoading={tracker.isFetching && !tracker.isLoading}
                >
                    Refresh
                </Button>
            </header>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Ads tracked" value={summary.total} tone="neutral" />
                <StatCard label="Active" value={summary.active} tone="success" />
                <StatCard label="Upcoming SMS" value={summary.withUpcoming} tone="warning" />
                <StatCard label="Missed / failed" value={summary.withMissed} tone="error" />
            </section>

            <section className="rounded-lg border border-info-subtle bg-info-subtle/50 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 text-info-primary" />
                    <p className="text-sm text-info-primary">
                        <strong>Test view:</strong> Active ads are always shown. Inactive ads appear only when they were created, extended, or expired this month.
                    </p>
                </div>
            </section>

            {selectedRow && (
                <ForecastDetailPanel row={selectedRow} onClose={() => setSelectedId(null)} />
            )}

            <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        placeholder="Search ad, phone, user, adId…"
                        value={searchInput}
                        onChange={setSearchInput}
                        className="min-w-[16rem] max-w-lg"
                    />
                    <PaginationInfoComponent paginationInfo={paginationInfo} itemName="ads" />
                </div>

                <DataTable
                    columns={columns}
                    data={rows}
                    keyExtractor={(row) => row.adId}
                    isLoading={tracker.isLoading}
                    isError={tracker.isError}
                    error={tracker.error}
                    emptyTitle="No ads to track"
                    emptyDescription={
                        debouncedSearch
                            ? 'No ads match the current search.'
                            : 'No APPROVED / REVIEW / EXPIRED ads with an expiry date and phone.'
                    }
                    paginationInfo={paginationInfo}
                    onPageChange={setCurrentPage}
                    itemName="ads"
                />
            </section>
        </>
    );
}


function getDateStr(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const sec = Math.round(diffMs / 1000);
    if (Math.abs(sec) < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (Math.abs(min) < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (Math.abs(hr) < 48) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    return `${day}d ago`;
}

function formatAbsolute(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Kolkata',
        });
    } catch {
        return iso;
    }
}

function normalizeLeadDays(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value
                .map((item) => Math.abs(Math.trunc(Number(item))))
                .filter((n) => Number.isFinite(n) && n > 0)
        )
    ).sort((a, b) => b - a);
}

function metaOf(row: OutgoingSmsRow): SmsOutboxMeta {
    return (row.meta && typeof row.meta === 'object' ? row.meta : {}) as SmsOutboxMeta;
}

function humanizeToken(value: string): string {
    return value
        .replace(/[_:]+/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

type TypePresentation = {
    title: string;
    subtitle?: string;
    tone: string;
};

function presentType(row: OutgoingSmsRow): TypePresentation {
    const meta = metaOf(row);

    if (row.kind === 'otp') {
        return { title: 'OTP', subtitle: 'Login / verify', tone: 'bg-purple-50 text-purple-800' };
    }
    if (row.kind === 'admin-test') {
        return { title: 'Admin test', tone: 'bg-gray-100 text-gray-800' };
    }

    const label = meta.label ?? '';
    if (label.startsWith('pre-expiry')) {
        const days =
            typeof meta.reminderDays === 'number'
                ? meta.reminderDays
                : Number((label.match(/(\d+)d/) || [])[1]) || null;
        return {
            title: days != null ? `Pre-expiry · ${days}d` : 'Pre-expiry',
            subtitle: meta.expiryDate ? `Expires ${meta.expiryDate}` : undefined,
            tone: 'bg-amber-50 text-amber-900',
        };
    }
    if (label === 'expiry' || label === 'ad-expired') {
        return {
            title: 'Expiry',
            subtitle: meta.expiryDate ? `Expired ${meta.expiryDate}` : undefined,
            tone: 'bg-error-50 text-error-800',
        };
    }
    if (label === 'post-expiry') {
        return {
            title: 'Post-expiry',
            subtitle: meta.expiryDate ? `Cycle ${meta.expiryDate}` : undefined,
            tone: 'bg-purple-50 text-purple-800',
        };
    }
    if (label === 'approved') {
        return { title: 'Approved', tone: 'bg-success-50 text-success-800' };
    }
    if (label === 'rejected') {
        return { title: 'Rejected', tone: 'bg-error-50 text-error-800' };
    }
    if (label === 'extended') {
        return { title: 'Extended', tone: 'bg-blue-50 text-blue-800' };
    }
    if (label) {
        return {
            title: humanizeToken(label),
            subtitle: meta.notificationType
                ? humanizeToken(meta.notificationType)
                : undefined,
            tone: 'bg-blue-50 text-blue-800',
        };
    }
    if (meta.notificationType) {
        return {
            title: humanizeToken(meta.notificationType),
            tone: 'bg-blue-50 text-blue-800',
        };
    }
    return { title: humanizeToken(row.kind), tone: 'bg-gray-50 text-gray-800' };
}

function messagePreview(message: string, max = 96): string {
    const compact = message.replace(/\s+/g, ' ').trim();
    if (compact.length <= max) return compact;
    return `${compact.slice(0, max)}…`;
}

function StatCard({
    label,
    value,
    tone,
    onClick,
    active,
}: {
    label: string;
    value: number | string;
    tone: 'neutral' | 'warning' | 'success' | 'error';
    onClick?: () => void;
    active?: boolean;
}) {
    const toneClasses: Record<typeof tone, string> = {
        neutral: 'text-primary',
        warning: 'text-warning-700',
        success: 'text-success-700',
        error: 'text-error-700',
    };
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={
                'rounded-xl border bg-primary p-4 text-left shadow-xs transition ' +
                (active
                    ? 'border-brand-500 ring-2 ring-brand-100'
                    : 'border-secondary hover:border-brand-200') +
                (onClick ? ' cursor-pointer' : '')
            }
        >
            <p className="text-xs font-medium uppercase tracking-wide text-tertiary">{label}</p>
            <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>
                {value}
            </p>
        </Comp>
    );
}

function ChipGroup<T extends string | number | null>({
    items,
    value,
    onChange,
    ariaLabel,
}: {
    items: Array<{ id: T; label: string }>;
    value: T;
    onChange: (id: T) => void;
    ariaLabel: string;
}) {
    return (
        <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1">
            {items.map((item) => {
                const isActive = value === item.id;
                return (
                    <button
                        key={String(item.id)}
                        type="button"
                        onClick={() => onChange(item.id)}
                        className={
                            'rounded-md px-2.5 py-1 text-xs font-medium transition ' +
                            (isActive
                                ? 'bg-brand-600 text-white'
                                : 'bg-secondary text-tertiary hover:text-primary')
                        }
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
    const clipboard = useClipboard();
    const id = label ?? text;
    const copied = clipboard.copied === id || clipboard.copied === true;
    return (
        <button
            type="button"
            title={`Copy ${label ?? 'value'}`}
            onClick={() => clipboard.copy(text, id)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-tertiary hover:bg-secondary hover:text-primary"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy01 className="h-3.5 w-3.5" />}
            {label ? <span>{copied ? 'Copied' : label}</span> : null}
        </button>
    );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">{label}</p>
            <div className="text-sm text-primary">{children}</div>
        </div>
    );
}

function OutboxDetailPanel({
    row,
    onClose,
    onRetry,
    isRetrying,
}: {
    row: OutgoingSmsRow;
    onClose: () => void;
    onRetry: (id: string) => void;
    isRetrying: boolean;
}) {
    const meta = metaOf(row);
    const type = presentType(row);
    const providerJson =
        row.providerResponse != null
            ? JSON.stringify(row.providerResponse, null, 2)
            : null;

    return (
        <ModalOverlay
            isOpen
            isDismissable
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal className="w-full max-w-4xl">
                <Dialog aria-label="SMS outbox details" className="w-full max-w-4xl mx-auto">
                    <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b border-secondary bg-secondary/40 px-5 py-4">
                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${type.tone}`}>
                                        {type.title}
                                    </span>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[row.status]}`}
                                    >
                                        {row.status}
                                    </span>
                                    <span className="text-xs text-tertiary">
                                        {row.retryCount}/{row.maxAttempts} attempts
                                    </span>
                                </div>
                                <p className="font-mono text-sm font-medium text-primary">{row.to}</p>
                                {type.subtitle ? (
                                    <p className="text-sm text-secondary">{type.subtitle}</p>
                                ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {row.status !== 'PENDING' && (
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        iconLeading={RefreshCcw01}
                                        isLoading={isRetrying}
                                        onClick={() => onRetry(row.id)}
                                    >
                                        Retry
                                    </Button>
                                )}
                                <Button size="sm" color="tertiary" iconLeading={XClose} onClick={onClose}>
                                    Close
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-6 overflow-y-auto p-5 lg:grid-cols-2">
                            <div className="space-y-5">
                                <DetailField label="Message">
                                    <p className="whitespace-pre-wrap break-words rounded-lg border border-secondary bg-secondary/30 p-3 text-sm leading-relaxed">
                                        {row.message}
                                    </p>
                                    <div className="mt-1">
                                        <CopyButton text={row.message} label="Copy message" />
                                    </div>
                                </DetailField>

                                {row.lastError ? (
                                    <DetailField label="Last error">
                                        <p className="whitespace-pre-wrap break-words rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800">
                                            {row.lastError}
                                        </p>
                                    </DetailField>
                                ) : null}

                                {providerJson ? (
                                    <DetailField label="Provider response">
                                        <pre className="max-h-48 overflow-auto rounded-lg border border-secondary bg-secondary/30 p-3 font-mono text-xs text-secondary">
                                            {providerJson}
                                        </pre>
                                    </DetailField>
                                ) : null}
                            </div>

                            <div className="space-y-5">
                                <DetailField label="Timing">
                                    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                                        <dt className="text-tertiary">Created</dt>
                                        <dd>
                                            {formatAbsolute(row.createdAt)} IST
                                            <span className="ml-2 text-tertiary">
                                                ({formatRelative(row.createdAt)})
                                            </span>
                                        </dd>
                                        {row.sentAt ? (
                                            <>
                                                <dt className="text-tertiary">Sent</dt>
                                                <dd>
                                                    {formatAbsolute(row.sentAt)} IST
                                                    <span className="ml-2 text-tertiary">
                                                        ({formatRelative(row.sentAt)})
                                                    </span>
                                                </dd>
                                            </>
                                        ) : null}
                                        {row.status === 'PENDING' ? (
                                            <>
                                                <dt className="text-tertiary">Next retry</dt>
                                                <dd>
                                                    {formatAbsolute(row.nextRetryAt)} IST
                                                    <span className="ml-2 text-warning-700">
                                                        ({formatRelative(row.nextRetryAt)})
                                                    </span>
                                                </dd>
                                            </>
                                        ) : null}
                                        <dt className="text-tertiary">Updated</dt>
                                        <dd>{formatAbsolute(row.updatedAt)} IST</dd>
                                    </dl>
                                </DetailField>

                                <DetailField label="Identifiers">
                                    <dl className="space-y-2 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-tertiary">Row</span>
                                            <span className="font-mono text-xs">{row.id}</span>
                                            <CopyButton text={row.id} />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-tertiary">Phone</span>
                                            <span className="font-mono">{row.to}</span>
                                            <CopyButton text={row.to} />
                                        </div>
                                        {row.templateId ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-tertiary">Template</span>
                                                <span className="font-mono text-xs">{row.templateId}</span>
                                                <CopyButton text={row.templateId} />
                                            </div>
                                        ) : null}
                                        {meta.notificationType ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-tertiary">Notif type</span>
                                                <span>{humanizeToken(meta.notificationType)}</span>
                                            </div>
                                        ) : null}
                                        {typeof meta.reminderDays === 'number' ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-tertiary">Lead days</span>
                                                <span>{meta.reminderDays}</span>
                                            </div>
                                        ) : null}
                                        {meta.expiryDate ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-tertiary">Expiry date</span>
                                                <span>{meta.expiryDate}</span>
                                            </div>
                                        ) : null}
                                    </dl>
                                </DetailField>

                                {(meta.adId || meta.adTitle) && (
                                    <DetailField label="Related ad">
                                        <div className="space-y-2">
                                            {meta.adTitle ? (
                                                <p className="font-medium text-primary">{meta.adTitle}</p>
                                            ) : null}
                                            {meta.adId ? (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-mono text-xs text-tertiary">
                                                        {meta.adId}
                                                    </span>
                                                    <CopyButton text={meta.adId} />
                                                    <Link
                                                        href={`/dashboard/ad-management/ads/${meta.adId}`}
                                                        className="text-xs font-medium text-brand-700 hover:underline"
                                                    >
                                                        Open ad
                                                    </Link>
                                                </div>
                                            ) : null}
                                        </div>
                                    </DetailField>
                                )}
                            </div>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}

// ── Outbox tab ──────────────────────────────────────────────

function OutboxTab() {
    const [statusFilter, setStatusFilter] = useState<'ALL' | OutgoingSmsStatus>('ALL');
    const [kindFilter, setKindFilter] = useState<'ALL' | OutgoingSmsKind>('ALL');
    const [labelFilter, setLabelFilter] = useState('');
    const [reminderDaysFilter, setReminderDaysFilter] = useState<number | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(25);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const { showAlert, AlertComponent } = useFormAlert();
    const settingsQuery = useSettings();

    const leadDays = useMemo(
        () => normalizeLeadDays(settingsQuery.data?.data?.system?.reminderExpirationDays),
        [settingsQuery.data?.data?.system?.reminderExpirationDays]
    );

    const reminderChips = useMemo(
        () => [
            { id: null as number | null, label: 'Any' },
            ...leadDays.map((d) => ({ id: d as number | null, label: `${d}d` })),
        ],
        [leadDays]
    );

    useEffect(() => {
        if (
            reminderDaysFilter !== null &&
            leadDays.length > 0 &&
            !leadDays.includes(reminderDaysFilter)
        ) {
            setReminderDaysFilter(null);
        }
    }, [leadDays, reminderDaysFilter]);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchInput);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const overview = useOutboxOverview({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        kind: kindFilter === 'ALL' ? undefined : kindFilter,
        search: debouncedSearch || undefined,
        label: labelFilter || undefined,
        reminderDays: reminderDaysFilter ?? undefined,
        page: currentPage,
        limit: itemsPerPage,
        autoRefresh: true,
        refreshInterval: 15_000,
    });

    const retryMutation = useRetryOutboxRow();
    const drainMutation = useTriggerOutboxDrain();

    const rows = overview.data?.rows ?? [];
    const counts = overview.data?.counts ?? { PENDING: 0, SENT: 0, FAILED: 0, DEAD: 0 };
    const pagination = overview.data?.pagination;
    const needsAttention = counts.PENDING + counts.FAILED + counts.DEAD;
    const selectedRow = rows.find((r) => r.id === selectedId) ?? null;

    useEffect(() => {
        if (selectedId && !rows.some((r) => r.id === selectedId)) {
            setSelectedId(null);
        }
    }, [rows, selectedId]);

    const paginationInfo = usePaginationInfo({
        data: rows,
        pagination: pagination ?? {
            page: currentPage,
            limit: itemsPerPage,
            total: 0,
            totalPages: 1,
        },
        currentPage,
        itemsPerPage,
    });

    const handleRetry = async (id: string) => {
        try {
            const result = await retryMutation.mutateAsync(id);
            showAlert(
                'Success',
                `Row ${result.row.id.slice(0, 8)}… re-queued (status: ${result.row.status})`,
                'success'
            );
        } catch (err: any) {
            showAlert('Error', err?.message ?? 'Failed to retry', 'error');
        }
    };

    const handleDrain = async () => {
        try {
            const result = await drainMutation.mutateAsync();
            showAlert(
                'Drain complete',
                `Scanned ${result.scanned}, sent ${result.sent}, retried ${result.failed}, exhausted ${result.exhausted}.`,
                result.exhausted > 0 ? 'warning' : 'success'
            );
        } catch (err: any) {
            showAlert('Error', err?.message ?? 'Failed to trigger drain', 'error');
        }
    };

    const clearFilters = () => {
        setStatusFilter('ALL');
        setKindFilter('ALL');
        setLabelFilter('');
        setReminderDaysFilter(null);
        setSearchInput('');
        setDebouncedSearch('');
        setCurrentPage(1);
    };

    const hasActiveFilters =
        statusFilter !== 'ALL' ||
        kindFilter !== 'ALL' ||
        !!labelFilter ||
        reminderDaysFilter !== null ||
        !!debouncedSearch;

    const setStatus = (status: 'ALL' | OutgoingSmsStatus) => {
        setStatusFilter(status);
        setCurrentPage(1);
    };

    const columns: Column<OutgoingSmsRow>[] = useMemo(
        () => [
            {
                key: 'type',
                label: 'Type',
                render: (row) => {
                    const type = presentType(row);
                    return (
                        <div className="flex flex-col gap-1 min-w-[8.5rem]">
                            <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${type.tone}`}>
                                {type.title}
                            </span>
                            {type.subtitle ? (
                                <span className="text-xs text-tertiary">{type.subtitle}</span>
                            ) : null}
                        </div>
                    );
                },
            },
            {
                key: 'to',
                label: 'Recipient',
                render: (row) => (
                    <div className="flex flex-col gap-0.5 min-w-[8rem]">
                        <span className="font-mono text-sm font-medium text-primary">{row.to}</span>
                        <span className="text-xs capitalize text-tertiary">{row.kind}</span>
                    </div>
                ),
            },
            {
                key: 'context',
                label: 'Context',
                render: (row) => {
                    const meta = metaOf(row);
                    if (row.kind === 'otp') {
                        return (
                            <span className="text-sm text-secondary">
                                {messagePreview(row.message, 72)}
                            </span>
                        );
                    }
                    if (meta.adTitle || meta.adId) {
                        return (
                            <div className="flex flex-col gap-0.5 min-w-[12rem] max-w-[16rem]">
                                {meta.adTitle ? (
                                    <span className="truncate text-sm font-medium text-primary" title={meta.adTitle}>
                                        {meta.adTitle}
                                    </span>
                                ) : (
                                    <span className="text-sm text-tertiary">Ad</span>
                                )}
                                {meta.adId ? (
                                    <span className="font-mono text-xs text-tertiary" title={meta.adId}>
                                        {meta.adId.slice(0, 8)}…
                                    </span>
                                ) : null}
                            </div>
                        );
                    }
                    return (
                        <span className="block max-w-[16rem] truncate text-sm text-secondary" title={row.message}>
                            {messagePreview(row.message, 80)}
                        </span>
                    );
                },
            },
            {
                key: 'status',
                label: 'Status',
                render: (row) => (
                    <div className="flex flex-col gap-1">
                        <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[row.status]}`}>
                            {row.status}
                        </span>
                        <span className="text-xs text-tertiary tabular-nums">
                            {row.retryCount}/{row.maxAttempts}
                            {row.lastError ? ' · error' : ''}
                        </span>
                    </div>
                ),
            },
            {
                key: 'when',
                label: 'When',
                render: (row) => (
                    <div className="flex flex-col min-w-[7rem]">
                        <span className="text-sm text-primary">{formatRelative(row.createdAt)}</span>
                        <span className="text-xs text-tertiary">{formatAbsolute(row.createdAt)}</span>
                        {row.status === 'PENDING' && (
                            <span className="text-xs text-warning-700">
                                next {formatRelative(row.nextRetryAt)}
                            </span>
                        )}
                        {row.status === 'SENT' && row.sentAt && (
                            <span className="text-xs text-success-700">
                                sent {formatRelative(row.sentAt)}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                key: 'actions',
                label: '',
                className: 'text-right',
                render: (row) => (
                        <div className="flex items-center justify-end gap-1">
                            {row.status !== 'PENDING' && (
                                <Button
                                    size="sm"
                                    color="tertiary"
                                    onClick={() => handleRetry(row.id)}
                                    iconLeading={RefreshCcw01}
                                    isLoading={
                                        retryMutation.isPending && retryMutation.variables === row.id
                                    }
                                >
                                    Retry
                                </Button>
                            )}
                            <Button
                                size="sm"
                                color="tertiary"
                                onClick={() => setSelectedId(row.id)}
                                iconTrailing={ChevronRight}
                            >
                                Details
                            </Button>
                        </div>
                    ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [retryMutation.isPending, retryMutation.variables]
    );

    return (
        <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">
                        Operations
                    </p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">
                        SMS Outbox
                    </h1>
                    <p className="max-w-2xl text-sm text-tertiary">
                        Durable log of every SMS attempt — OTP, notifications, approvals, expiry, and tests.
                        Auto-refreshes every 15s.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        color="secondary"
                        size="md"
                        onClick={() => overview.refetch()}
                        iconLeading={ClockRefresh}
                        isLoading={overview.isFetching && !overview.isLoading}
                    >
                        Refresh
                    </Button>
                    <Button
                        color="primary"
                        size="md"
                        onClick={handleDrain}
                        iconLeading={Zap}
                        isLoading={drainMutation.isPending}
                    >
                        Trigger drain now
                    </Button>
                </div>
            </header>

            {needsAttention > 0 && (
                <section className="flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" />
                        <div>
                            <p className="text-sm font-semibold text-warning-800">
                                {needsAttention} message{needsAttention === 1 ? '' : 's'} need attention
                            </p>
                            <p className="text-xs text-warning-700">
                                {counts.PENDING} pending · {counts.FAILED} failed · {counts.DEAD} dead
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {counts.PENDING > 0 && (
                            <Button size="sm" color="secondary" onClick={() => setStatus('PENDING')}>
                                View pending
                            </Button>
                        )}
                        {counts.FAILED > 0 && (
                            <Button size="sm" color="secondary" onClick={() => setStatus('FAILED')}>
                                View failed
                            </Button>
                        )}
                        {counts.PENDING > 0 && (
                            <Button
                                size="sm"
                                color="primary"
                                onClick={handleDrain}
                                isLoading={drainMutation.isPending}
                            >
                                Drain now
                            </Button>
                        )}
                    </div>
                </section>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label="Pending"
                    value={counts.PENDING}
                    tone="warning"
                    active={statusFilter === 'PENDING'}
                    onClick={() => setStatus(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                />
                <StatCard
                    label="Sent"
                    value={counts.SENT}
                    tone="success"
                    active={statusFilter === 'SENT'}
                    onClick={() => setStatus(statusFilter === 'SENT' ? 'ALL' : 'SENT')}
                />
                <StatCard
                    label="Failed"
                    value={counts.FAILED}
                    tone="error"
                    active={statusFilter === 'FAILED'}
                    onClick={() => setStatus(statusFilter === 'FAILED' ? 'ALL' : 'FAILED')}
                />
                <StatCard
                    label="Dead"
                    value={counts.DEAD}
                    tone="neutral"
                    active={statusFilter === 'DEAD'}
                    onClick={() => setStatus(statusFilter === 'DEAD' ? 'ALL' : 'DEAD')}
                />
            </section>

            {selectedRow && (
                <OutboxDetailPanel
                    row={selectedRow}
                    onClose={() => setSelectedId(null)}
                    onRetry={handleRetry}
                    isRetrying={
                        retryMutation.isPending && retryMutation.variables === selectedRow.id
                    }
                />
            )}

            <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Input
                        placeholder="Search phone, message, ad title, adId…"
                        value={searchInput}
                        onChange={setSearchInput}
                        className="min-w-[16rem] max-w-lg"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <PaginationInfoComponent paginationInfo={paginationInfo} itemName="rows" />
                        {hasActiveFilters && (
                            <Button size="sm" color="tertiary" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-secondary pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-tertiary">
                            Kind
                        </span>
                        <ChipGroup
                            ariaLabel="Filter by kind"
                            items={KIND_CHIPS.map((k) => ({ id: k.id, label: k.label }))}
                            value={kindFilter}
                            onChange={(id) => {
                                setKindFilter(id);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-tertiary">
                            Type
                        </span>
                        <ChipGroup
                            ariaLabel="Filter by SMS type"
                            items={TYPE_CHIPS}
                            value={labelFilter}
                            onChange={(id) => {
                                setLabelFilter(id);
                                if (id !== 'pre-expiry') setReminderDaysFilter(null);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    {(labelFilter === 'pre-expiry' || reminderDaysFilter !== null) && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-tertiary">
                                Lead
                            </span>
                            {settingsQuery.isLoading ? (
                                <span className="text-xs text-tertiary">Loading lead days…</span>
                            ) : leadDays.length === 0 ? (
                                <span className="text-xs text-tertiary">
                                    No lead days configured in Settings.
                                </span>
                            ) : (
                                <ChipGroup
                                    ariaLabel="Filter by reminder lead days from settings"
                                    items={reminderChips}
                                    value={reminderDaysFilter}
                                    onChange={(id) => {
                                        setReminderDaysFilter(id);
                                        if (id !== null) setLabelFilter('pre-expiry');
                                        setCurrentPage(1);
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>

                <DataTable
                    columns={columns}
                    data={rows}
                    keyExtractor={(row) => row.id}
                    isLoading={overview.isLoading}
                    isError={overview.isError && !overview.isFeatureDisabled}
                    error={overview.error}
                    emptyTitle="No outbox rows"
                    emptyDescription={
                        hasActiveFilters
                            ? 'No rows match the current filters.'
                            : 'Outbox is empty — no SMS sends have been attempted yet.'
                    }
                    paginationInfo={paginationInfo}
                    onPageChange={setCurrentPage}
                    itemName="rows"
                />
            </section>

            <AlertComponent />
        </>
    );
}

// ── Main page ───────────────────────────────────────────────

export default function SmsOutboxPage() {
    const [activeTab, setActiveTab] = useState<'outbox' | 'forecast'>('outbox');

    if (!config.features.outbox) {
        notFound();
    }

    return (
        <div className="space-y-8">
            <div
                role="tablist"
                aria-label="SMS Outbox sections"
                className="flex w-fit items-center gap-1 rounded-lg border border-secondary bg-secondary p-1"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'outbox'}
                    onClick={() => setActiveTab('outbox')}
                    className={
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ' +
                        (activeTab === 'outbox'
                            ? 'bg-primary text-primary shadow-xs'
                            : 'text-tertiary hover:text-primary')
                    }
                >
                    <MessageTextCircle01 className="h-4 w-4" />
                    <span>Outbox</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'forecast'}
                    onClick={() => setActiveTab('forecast')}
                    className={
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ' +
                        (activeTab === 'forecast'
                            ? 'bg-primary text-primary shadow-xs'
                            : 'text-tertiary hover:text-primary')
                    }
                >
                    <Calendar className="h-4 w-4" />
                    <span>Forecast</span>
                </button>
            </div>

            {activeTab === 'outbox' ? <OutboxTab /> : <ForecastTab />}
        </div>
    );
}
