"use client";

import React, { useState } from "react";
import { ArrowLeft, Edit03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useLocation } from "@/hooks/use-locations";
import { useRouter, useParams } from "next/navigation";
import { Location } from "@/lib/api-types";

export default function LocationPage() {
    const router = useRouter();
    const params = useParams();
    const locationId = params.id as string;
    
    const { data: locationResponse, isLoading } = useLocation(locationId);
    const location = (locationResponse?.data?.data || locationResponse?.data) as any;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading location...</div>
            </div>
        );
    }

    if (!location) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-error">Location not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex items-center gap-4">
                <Button
                    color="secondary"
                    size="sm"
                    iconLeading={<ArrowLeft />}
                    href="/dashboard/ad-management/locations"
                >
                    Back to locations
                </Button>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">
                                {location.data?.name}
                            </h1>
                            <p className="text-sm text-tertiary">
                                Location details and management options.
                            </p>
                        </div>
                        <Button
                            color="primary"
                            size="sm"
                            iconLeading={<Edit03 />}
                            href={`/dashboard/ad-management/locations/${location.data?.id}/edit`}
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-quaternary uppercase tracking-wide">Location Information</h3>
                            <dl className="mt-2 space-y-2">
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">Name</dt>
                                    <dd className="text-sm text-primary">{location.data?.name}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">City</dt>
                                    <dd className="text-sm text-primary">{location.data?.city?.name}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">State</dt>
                                    <dd className="text-sm text-primary">{location.data?.state?.name}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">Country</dt>
                                    <dd className="text-sm text-primary">{location.data?.country}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-quaternary uppercase tracking-wide">Coordinates</h3>
                            <dl className="mt-2 space-y-2">
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">Latitude</dt>
                                    <dd className="text-sm text-primary">
                                        {location.data?.latitude !== undefined && location.data?.latitude !== null 
                                            ? location.data?.latitude.toFixed(6) 
                                            : "Not set"}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">Longitude</dt>
                                    <dd className="text-sm text-primary">
                                        {location.data?.longitude !== undefined && location.data?.longitude !== null 
                                            ? location.data?.longitude.toFixed(6) 
                                            : "Not set"}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-quaternary uppercase tracking-wide">Status</h3>
                            <dl className="mt-2 space-y-2">
                                <div className="flex justify-between">
                                    <dt className="text-sm font-medium text-tertiary">Active</dt>
                                    <dd>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                location.data?.isActive ? "bg-success-subtle text-success-primary" : "bg-warning-subtle text-warning-primary"
                                            }`}
                                        >
                                            {location.data?.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-secondary">
                    <h3 className="text-sm font-medium text-quaternary uppercase tracking-wide">System Information</h3>
                    <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex justify-between">
                            <dt className="text-sm font-medium text-tertiary">Location ID</dt>
                            <dd className="text-sm text-primary font-mono">{location.data?.id}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-sm font-medium text-tertiary">Created</dt>
                            <dd className="text-sm text-primary">
                                {location.data?.createdAt ? `${new Date(location.data.createdAt).toLocaleDateString()} at ${new Date(location.data.createdAt).toLocaleTimeString()}` : 'N/A'}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-sm font-medium text-tertiary">Last Updated</dt>
                            <dd className="text-sm text-primary">
                                {location.data?.updatedAt ? `${new Date(location.data.updatedAt).toLocaleDateString()} at ${new Date(location.data.updatedAt).toLocaleTimeString()}` : 'N/A'}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="pt-6 border-t border-secondary">
                    <div className="flex items-center gap-4">
                        <Button
                            color="secondary"
                            size="md"
                            href="/dashboard/ad-management/locations"
                        >
                            Back to Locations
                        </Button>
                        <Button
                            color="primary"
                            size="md"
                            iconLeading={<Edit03 />}
                            href={`/dashboard/ad-management/locations/${location.data?.id}/edit`}
                        >
                            Edit Location
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}