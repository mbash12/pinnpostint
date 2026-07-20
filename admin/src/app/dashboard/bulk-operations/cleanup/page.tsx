"use client";

import { useState } from "react";
import { Trash01, Database01, AlertCircle, CheckCircle, Clock } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useCleanupNotifications, useCleanupExpired } from "@/hooks/use-bulk-operations";

export default function SystemCleanupPage() {
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const cleanupNotificationsMutation = useCleanupNotifications();
    const cleanupExpiredMutation = useCleanupExpired();

    const handleCleanNotifications = async () => {
        try {
            await cleanupNotificationsMutation.mutateAsync({ olderThanDays: 90 });
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: "Old notifications cleaned successfully!",
                type: "success",
            });
        } catch (error: any) {
            // Cleanup notifications failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to clean notifications: ${error.message}`,
                type: "error",
            });
        }
    };

    const handleCleanOldData = async () => {
        try {
            await cleanupExpiredMutation.mutateAsync();
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: "Old data cleaned successfully!",
                type: "success",
            });
        } catch (error: any) {
            // Cleanup data failed: error
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to clean data: ${error.message}`,
                type: "error",
            });
        }
    };

    const cleanupTasks = [
        {
            title: "Old Read Notifications",
            description: "Remove read notifications older than 90 days",
            icon: Trash01,
            color: "warning",
            estimatedItems: 1250,
            action: handleCleanNotifications,
            isLoading: cleanupNotificationsMutation.isPending,
        },
        {
            title: "Archived Ads",
            description: "Permanently delete archived ads older than 1 year",
            icon: Database01,
            color: "error",
            estimatedItems: 45,
            action: handleCleanOldData,
            isLoading: cleanupExpiredMutation.isPending,
        },
        {
            title: "Expired Subscriptions",
            description: "Clean up subscription records older than 6 months",
            icon: Clock,
            color: "tertiary",
            estimatedItems: 89,
            action: () => setAlertDialog({
                isOpen: true,
                title: "Info",
                description: "Cleaning expired subscriptions...",
                type: "info",
            }),
            isLoading: false,
        },
        {
            title: "Orphaned Media Files",
            description: "Remove media files not linked to any ads",
            icon: AlertCircle,
            color: "warning",
            estimatedItems: 234,
            action: () => setAlertDialog({
                isOpen: true,
                title: "Info",
                description: "Cleaning orphaned media...",
                type: "info",
            }),
            isLoading: false,
        },
    ];

    const recentCleanups = [
        {
            id: "CL-2108",
            task: "Old Notifications Cleanup",
            itemsRemoved: 1150,
            status: "Completed",
            date: "2 hours ago",
        },
        {
            id: "CL-2107",
            task: "Archived Ads Cleanup",
            itemsRemoved: 42,
            status: "Completed",
            date: "1 day ago",
        },
        {
            id: "CL-2106",
            task: "Database Optimization",
            itemsRemoved: 0,
            status: "Completed",
            date: "3 days ago",
        },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Bulk Operations</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">System Cleanup</h1>
                    <p className="text-sm text-tertiary">
                        Clean up old notifications, archived content, and optimize database performance.
                    </p>
                </div>
            </header>

            {/* Warning Banner */}
            <section className="rounded-2xl border border-warning-primary bg-warning-subtle p-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-warning-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-warning-primary">Important Notice</p>
                        <p className="text-sm text-tertiary mt-1">
                            Cleanup operations are permanent and cannot be undone. Please review the estimated items before proceeding.
                            Critical notifications and audit trails will be preserved automatically.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats Overview */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Trash01 className="w-5 h-5 text-error-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Items to Clean</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">1,618</p>
                    <p className="text-sm text-quaternary">Across all categories</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="w-5 h-5 text-success-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Cleaned This Month</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">3,245</p>
                    <p className="text-sm text-quaternary">Items removed</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Database01 className="w-5 h-5 text-brand-primary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Space Saved</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">2.4 GB</p>
                    <p className="text-sm text-quaternary">This month</p>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-tertiary" />
                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">Last Cleanup</p>
                    </div>
                    <p className="text-display-xs font-semibold text-primary">2h ago</p>
                    <p className="text-sm text-quaternary">Notifications</p>
                </article>
            </section>

            {/* Cleanup Tasks */}
            <section className="grid gap-6 lg:grid-cols-2">
                {cleanupTasks.map((task) => {
                    const Icon = task.icon;
                    return (
                        <article key={task.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`rounded-lg bg-${task.color}-subtle p-3`}>
                                    <Icon className={`w-6 h-6 text-${task.color}-primary`} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-semibold text-primary">{task.title}</h2>
                                    <p className="text-sm text-tertiary mt-1">{task.description}</p>
                                </div>
                            </div>
                            
                            <div className="rounded-xl border border-secondary bg-secondary p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary">Estimated Items</span>
                                    <span className="text-lg font-semibold text-primary">
                                        {task.estimatedItems.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <Button 
                                color="primary" 
                                size="md" 
                                className="w-full"
                                onClick={task.action}
                                isLoading={task.isLoading}
                            >
                                {task.isLoading ? "Cleaning..." : "Run Cleanup"}
                            </Button>
                        </article>
                    );
                })}
            </section>

            {/* Automated Cleanup Schedule */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="mb-6">
                    <h2 className="text-lg font-semibold text-primary">Automated Cleanup Schedule</h2>
                    <p className="text-sm text-tertiary">Configure automatic cleanup tasks</p>
                </header>

                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-secondary bg-secondary p-4">
                        <div>
                            <p className="text-sm font-semibold text-primary">Daily Notification Cleanup</p>
                            <p className="text-xs text-tertiary mt-1">Runs every day at 2:00 AM</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-success-subtle text-success-primary">
                                Active
                            </span>
                            <Button color="secondary" size="sm">
                                Configure
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-secondary bg-secondary p-4">
                        <div>
                            <p className="text-sm font-semibold text-primary">Weekly Archive Cleanup</p>
                            <p className="text-xs text-tertiary mt-1">Runs every Sunday at 3:00 AM</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-success-subtle text-success-primary">
                                Active
                            </span>
                            <Button color="secondary" size="sm">
                                Configure
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-secondary bg-secondary p-4">
                        <div>
                            <p className="text-sm font-semibold text-primary">Monthly Database Optimization</p>
                            <p className="text-xs text-tertiary mt-1">Runs on the 1st of each month at 4:00 AM</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-secondary text-tertiary">
                                Inactive
                            </span>
                            <Button color="secondary" size="sm">
                                Configure
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Cleanup History */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">Recent Cleanup History</h2>
                        <p className="text-sm text-tertiary">Latest cleanup operations performed</p>
                    </div>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Cleanup ID</th>
                                <th scope="col" className="px-4 py-3">Task</th>
                                <th scope="col" className="px-4 py-3">Items Removed</th>
                                <th scope="col" className="px-4 py-3">Status</th>
                                <th scope="col" className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {recentCleanups.map((cleanup) => (
                                <tr key={cleanup.id} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3 font-medium text-brand-primary">{cleanup.id}</td>
                                    <td className="px-4 py-3">{cleanup.task}</td>
                                    <td className="px-4 py-3">{cleanup.itemsRemoved.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-success-subtle text-success-primary">
                                            {cleanup.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{cleanup.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Cleanup Guidelines */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-primary mb-4">Cleanup Guidelines</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <CheckCircle className="w-5 h-5 text-success-primary mb-2" />
                        <h3 className="text-sm font-semibold text-primary mb-1">What Gets Cleaned</h3>
                        <ul className="text-xs text-tertiary space-y-1">
                            <li>• Read notifications older than 90 days</li>
                            <li>• Archived ads older than 1 year</li>
                            <li>• Expired subscriptions older than 6 months</li>
                            <li>• Orphaned media files</li>
                        </ul>
                    </div>
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <AlertCircle className="w-5 h-5 text-warning-primary mb-2" />
                        <h3 className="text-sm font-semibold text-primary mb-1">What Gets Preserved</h3>
                        <ul className="text-xs text-tertiary space-y-1">
                            <li>• Unread notifications</li>
                            <li>• Active and pending ads</li>
                            <li>• Transaction records (audit trail)</li>
                            <li>• User account data</li>
                        </ul>
                    </div>
                </div>
            </section>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}
