"use client";

import { Button } from "@/components/base/buttons/button";
import { FormLayout } from "@/components/forms";
import { Plus } from "@untitledui/icons";

export default function LocationManagementPage() {
    return (
        <FormLayout breadcrumb="Location Management" title="Location Management">
            <div className="space-y-8">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-primary mb-4">States</h2>
                        <p className="text-tertiary mb-6">Manage all states in the system</p>
                        <div className="flex gap-3">
                            <Button color="primary" size="sm" href="/dashboard/location-management/states">
                                View States
                            </Button>
                            <Button color="secondary" size="sm" href="/dashboard/location-management/states/create">
                                Add State
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-primary mb-4">Cities</h2>
                        <p className="text-tertiary mb-6">Manage all cities in the system</p>
                        <div className="flex gap-3">
                            <Button color="primary" size="sm" href="/dashboard/location-management/cities">
                                View Cities
                            </Button>
                            <Button color="secondary" size="sm" href="/dashboard/location-management/cities/create">
                                Add City
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-primary mb-4">Postal Codes</h2>
                        <p className="text-tertiary mb-6">Manage all postal codes in the system</p>
                        <div className="flex gap-3">
                            <Button color="primary" size="sm" href="/dashboard/location-management/postal-codes">
                                View Postal Codes
                            </Button>
                            <Button color="secondary" size="sm" href="/dashboard/location-management/postal-codes/create">
                                Add Postal Code
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-primary">Create New Location</h2>
                            <p className="text-tertiary">Add a new state, city, and postal code in one form</p>
                        </div>
                        <Button color="primary" size="sm" iconLeading={<Plus />} href="/dashboard/location-management/locations/create">
                            Create New Location
                        </Button>
                    </div>
                </section>
            </div>
        </FormLayout>
    );
}