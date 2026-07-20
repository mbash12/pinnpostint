"use client";

import { CheckCircle, XCircle, Bell01, Trash01, RefreshCw01, FileCheck02 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

export default function BulkOperationsPage() {
    const operationModules = [
        {
            title: "Bulk Ad Status Updates",
            description: "Approve, reject, or modify multiple ads at once",
            icon: FileCheck02,
            href: "/dashboard/bulk-operations/ads",
            color: "brand",
            actions: ["Bulk Approve", "Bulk Reject", "Bulk Feature"],
        },
        {
            title: "Bulk Notifications",
            description: "Send targeted notifications to multiple users",
            icon: Bell01,
            href: "/dashboard/bulk-operations/notifications",
            color: "warning",
            actions: ["Campaign", "System Alert", "Promotional"],
        },
        {
            title: "Expired Content Management",
            description: "Manage and renew expired ads and subscriptions",
            icon: RefreshCw01,
            href: "/dashboard/bulk-operations/expired",
            color: "error",
            actions: ["Bulk Renew", "Archive", "Delete"],
        },
        {
            title: "System Cleanup",
            description: "Clean up old notifications and archived content",
            icon: Trash01,
            href: "/dashboard/bulk-operations/cleanup",
            color: "tertiary",
            actions: ["Clean Notifications", "Archive Old Data", "Optimize"],
        },
    ];

    const recentOperations = [
        {
            id: "OP-2108",
            operation: "Bulk Ad Approval",
            items: 45,
            status: "Completed",
            date: "2 hours ago",
        },
        {
            id: "OP-2107",
            operation: "System Notification",
            items: 1250,
            status: "Completed",
            date: "5 hours ago",
        },
        {
            id: "OP-2106",
            operation: "Expired Ads Cleanup",
            items: 23,
            status: "In Progress",
            date: "1 day ago",
        },
        {
            id: "OP-2105",
            operation: "Bulk Ad Rejection",
            items: 12,
            status: "Completed",
            date: "2 days ago",
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">System Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Bulk Operations</h1>
                </div>
            </header>

            {/* Operation Modules */}
            <section className="grid gap-6 lg:grid-cols-2">
                {operationModules.map((module) => {
                    const Icon = module.icon;
                    return (
                        <article key={module.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`rounded-lg bg-${module.color}-subtle p-3`}>
                                    <Icon className={`w-6 h-6 text-${module.color}-primary`} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-primary">{module.title}</h2>
                                    <p className="text-sm text-tertiary mt-1">{module.description}</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-4">
                                {module.actions.map((action) => (
                                    <span 
                                        key={action}
                                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-secondary text-tertiary"
                                    >
                                        {action}
                                    </span>
                                ))}
                            </div>

                            <Button color="secondary" size="sm" href={module.href} className="w-full">
                                Open Module
                            </Button>
                        </article>
                    );
                })}
            </section>

            {/* Recent Operations */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">Recent Operations</h2>
                        <p className="text-sm text-tertiary">Latest bulk operations performed</p>
                    </div>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Operation ID</th>
                                <th scope="col" className="px-4 py-3">Type</th>
                                <th scope="col" className="px-4 py-3">Items Affected</th>
                                <th scope="col" className="px-4 py-3">Status</th>
                                <th scope="col" className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {recentOperations.map((operation) => (
                                <tr key={operation.id} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3 font-medium text-brand-primary">{operation.id}</td>
                                    <td className="px-4 py-3">{operation.operation}</td>
                                    <td className="px-4 py-3">{operation.items}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                operation.status === "Completed"
                                                    ? "bg-success-subtle text-success-primary"
                                                    : "bg-warning-subtle text-warning-primary"
                                            }`}
                                        >
                                            {operation.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{operation.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Quick Stats */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="w-5 h-5 text-success-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Completed Today</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">12</p>
                    <p className="text-sm text-quaternary">Bulk operations</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <RefreshCw01 className="w-5 h-5 text-warning-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">In Progress</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">3</p>
                    <p className="text-sm text-quaternary">Active operations</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <FileCheck02 className="w-5 h-5 text-brand-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Items Processed</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">1,847</p>
                    <p className="text-sm text-quaternary">This week</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <XCircle className="w-5 h-5 text-error-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Failed</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">2</p>
                    <p className="text-sm text-quaternary">Requires attention</p>
                </article>
            </section>
        </div>
    );
}
