"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit01, LinkExternal01, Trash01, CheckCircle, XCircle, Clock, Calendar, BarChart01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { usePlatformAd, useDeletePlatformAd } from "@/hooks/use-platform-ads";
import { PlatformAd } from "@/lib/api-types";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { LoadingState } from "@/components/forms/loading-state";
import { ErrorState } from "@/components/forms/error-state";
import { ConfirmationDialog } from "@/components/application/modals/confirmation-dialog";

export default function PlatformAdDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: adResponse, isLoading, isError, error } = usePlatformAd(id);
    const deleteMutation = useDeletePlatformAd();
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error";
    }>({ isOpen: false, title: "", description: "", type: "success" });

    const ad = adResponse?.data;

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(id);
            router.push("/dashboard/platform-ads");
        } catch (err: any) {
            setAlertDialog({
                isOpen: true,
                title: "Delete Failed",
                description: err.message || "Failed to delete platform ad. Please try again.",
                type: "error",
            });
        }
    };

    if (isLoading) return <LoadingState />;
    if (isError || !ad) return <ErrorState message={error?.message || "Platform ad not found"} />;

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/platform-ads">
                        Back to ads
                    </Button>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Platform Ad Details</p>
                        <h1 className="text-xl font-semibold text-primary">{ad.title || "Untitled Ad"}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button color="secondary" size="sm" iconLeading={<Edit01 />} href={`/dashboard/platform-ads/${id}/edit`}>
                        Edit ad
                    </Button>
                    <ConfirmationDialog
                        title="Delete platform ad?"
                        description="Are you sure you want to delete this ad? This action cannot be undone."
                        onConfirm={handleDelete}
                    >
                        <Button color="secondary-destructive" size="sm" iconLeading={<Trash01 />} isLoading={deleteMutation.isPending}>
                            Delete
                        </Button>
                    </ConfirmationDialog>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Image Preview Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-tertiary mb-4">Ad Preview</h3>
                        <div className="aspect-[9/16] w-full max-w-[240px] mx-auto overflow-hidden rounded-xl bg-secondary/30 flex items-center justify-center border border-secondary">
                            <img src={ad.imageUrl} alt={ad.title || ""} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-secondary">
                                <span className="text-sm text-tertiary font-medium">Position</span>
                                <span className="inline-flex items-center rounded-full bg-blue-subtle px-2.5 py-0.5 text-xs font-medium text-blue-primary">
                                    {ad.position}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-secondary">
                                <span className="text-sm text-tertiary font-medium">Status</span>
                                <span className={`flex items-center gap-1.5 text-sm font-medium ${ad.isActive ? 'text-success-primary' : 'text-warning-primary'}`}>
                                    {ad.isActive ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
                                    {ad.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-secondary">
                                <span className="text-sm text-tertiary font-medium">Order</span>
                                <span className="text-sm text-primary font-semibold">{ad.order}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration Card */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-tertiary mb-6">Configuration</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-quaternary uppercase tracking-wider block mb-2">Internal Title</label>
                                <p className="text-lg font-medium text-primary">{ad.title || "No title provided"}</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-quaternary uppercase tracking-wider block mb-2">Target Link URL</label>
                                {ad.linkUrl ? (
                                    <div className="flex items-center gap-2">
                                        <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="text-brand-secondary font-medium hover:underline break-all">
                                            {ad.linkUrl}
                                        </a>
                                        <LinkExternal01 className="size-4 text-tertiary" />
                                    </div>
                                ) : (
                                    <p className="text-sm text-tertiary italic">No target URL configured</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-secondary">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-secondary/50">
                                        <Calendar className="size-5 text-tertiary" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-quaternary uppercase block mb-1">Created At</label>
                                        <p className="text-sm text-primary font-medium">{new Date(ad.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-secondary/50">
                                        <Clock className="size-5 text-tertiary" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-quaternary uppercase block mb-1">Last Updated</label>
                                        <p className="text-sm text-primary font-medium">{new Date(ad.updatedAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Usage & Reach (Placeholder for now) */}
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart01 className="size-5 text-tertiary" />
                            <h3 className="text-sm font-semibold text-tertiary">Visibility Context</h3>
                        </div>
                        <p className="text-sm text-tertiary leading-relaxed">
                            This ad is currently positioned at the <span className="font-semibold text-primary">{ad.position}</span> of the home page. 
                            It will be visible to users on screens wider than 1650px. 
                            If multiple ads exist for the same position, they will be ordered according to the "Order" value ({ad.order}).
                        </p>
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
