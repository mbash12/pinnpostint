"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User01, Eye, CurrencyDollar, Clock } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useSubscription } from "@/hooks/use-subscriptions";
import { formatCurrency } from "@/utils/currency";
import { getProxiedImageUrl } from "@/utils/image-proxy";

export default function SubscriptionDetailPage() {
    const params = useParams<{ id: string }>();
    const subscriptionId = params?.id;
    const queryClient = useQueryClient();

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const { data: subscriptionResponse, isLoading, error } = useSubscription(subscriptionId!);

    const subscription = subscriptionResponse?.data;


    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/subscriptions">
                        Back to Subscriptions
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <div className="animate-pulse">
                        <div className="h-4 bg-secondary rounded mb-4"></div>
                        <div className="h-4 bg-secondary rounded w-3/4 mx-auto"></div>
                    </div>
                    <p className="text-tertiary mt-4">Loading subscription details...</p>
                </div>
            </div>
        );
    }

    if (error || !subscription) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/subscriptions">
                        Back to Subscriptions
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <Calendar className="mx-auto h-12 w-12 text-tertiary mb-4" />
                    <h3 className="text-lg font-semibold text-primary mb-2">Subscription Not Found</h3>
                    <p className="text-tertiary">The requested subscription could not be found or may have been deleted.</p>
                </div>
            </div>
        );
    }

    const statusStyles = {
        active: "bg-success-subtle text-success-primary",
        inactive: "bg-error-subtle text-error-primary",
        cancelled: "bg-warning-subtle text-warning-primary",
    };

    const isExpired = new Date(subscription.endDate) < new Date();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/subscriptions">
                            Back
                        </Button>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold text-primary">Subscription {subscription.id.slice(0, 8)}...</h1>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-tertiary">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Created {new Date(subscription.createdAt).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {subscription.isRenewed ? 'Renewed' : 'New'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button color="secondary" size="sm" iconLeading={<Eye />}>
                            View Ad
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Subscription Details */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Subscription Details
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {new Date(subscription.startDate).toLocaleDateString()}
                                    </div>
                                    <div className="text-sm text-tertiary">Start Date</div>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {new Date(subscription.endDate).toLocaleDateString()}
                                    </div>
                                    <div className="text-sm text-tertiary">End Date</div>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {Math.ceil((new Date(subscription.endDate).getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24))}
                                    </div>
                                    <div className="text-sm text-tertiary">Duration (Days)</div>
                                </div>
                                <div className="text-center p-4 bg-secondary rounded-lg">
                                    <div className="text-2xl font-bold text-primary">
                                        {Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                                    </div>
                                    <div className="text-sm text-tertiary">Days Remaining</div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-secondary">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-tertiary">Status:</span>
                                        <span className={`ml-2 font-medium ${subscription.isActive && !isExpired ? 'text-green-600' : 'text-red-600'}`}>
                                            {subscription.isActive && !isExpired ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-tertiary">Renewed:</span>
                                        <span className={`ml-2 font-medium ${subscription.isRenewed ? 'text-blue-600' : 'text-gray-600'}`}>
                                            {subscription.isRenewed ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ad Information */}
                    {subscription.ad && (
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Associated Ad
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-primary">{subscription.ad.title}</h3>
                                        <p className="text-sm text-tertiary">Status: {subscription.ad.status}</p>
                                        <p className="text-lg font-bold text-primary mt-2">
                                            {formatCurrency(Number(subscription.ad.price))}
                                        </p>
                                    </div>
                                    <Button color="secondary" size="sm" href={`/dashboard/ad-moderation/${subscription.ad.id}`}>
                                        View Ad
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">

                    {/* User Information */}
                    {subscription.user && (
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                                <User01 className="h-5 w-5" />
                                User Information
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Avatar size="lg" src={subscription.user.avatar ? getProxiedImageUrl(subscription.user.avatar) : undefined} alt={subscription.user.firstName} />
                                    <div>
                                        <h3 className="font-semibold text-primary">
                                            {subscription.user.firstName} {subscription.user.lastName}
                                        </h3>
                                        <p className="text-sm text-tertiary">{subscription.user.phone || subscription.user.email}</p>
                                        {subscription.user.phone && <p className="text-xs text-tertiary">{subscription.user.email}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Quick Stats</h2>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-tertiary mb-1">Subscription ID</div>
                                <div className="text-sm font-medium text-primary break-all">{subscription.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Ad ID</div>
                                <div className="text-sm font-medium text-primary break-all">{subscription.ad?.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">User ID</div>
                                <div className="text-sm font-medium text-primary break-all">{subscription.user?.id}</div>
                            </div>
                            <div>
                                <div className="text-xs text-tertiary mb-1">Last Updated</div>
                                <div className="text-sm font-medium text-primary">{new Date(subscription.updatedAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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