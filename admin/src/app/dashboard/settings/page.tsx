"use client";

import React, { useState, useEffect } from "react";
import {
    Settings01,
    FileCheck02,
    Database01
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { NumberArrayInput } from "@/components/base/number-array-input/number-array-input";
import { Toggle } from "@/components/base/toggle/toggle";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { ImageUpload } from "@/components/base/image-upload/image-upload";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

export default function SettingsPage() {
    const { data: settingsData, isLoading: isSettingsLoading, error } = useSettings();
    const updateSettingsMutation = useUpdateSettings();
    const [hasChanges, setHasChanges] = useState(false);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const [localSettings, setLocalSettings] = useState<{
        bookingPrice: number;
        reminderExpirationDays: number[];
        smsNotificationsEnabled: boolean;
        autoCompleteBookingDays: number;
        autoCancelBookingDays: number;
        subscriptionPrice: number;
        subscriptionDuration: number;
        freeAdDuration: number;
        serviceFeeFixed: number;
        heroTitle: string;
        heroSubtitle: string;
        customerCareEmail: string;
    }>({
        bookingPrice: 0,
        reminderExpirationDays: [7, 3, 1],
        smsNotificationsEnabled: true,
        autoCompleteBookingDays: 7,
        autoCancelBookingDays: 3,
        subscriptionPrice: 0,
        subscriptionDuration: 0,
        freeAdDuration: 3,
        serviceFeeFixed: 0,
        heroTitle: '',
        heroSubtitle: '',
        customerCareEmail: 'info@pinnpost.com',
    });

    const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (settingsData?.data?.system) {
            const systemData = settingsData.data.system;
            setLocalSettings({
                bookingPrice: systemData.bookingPrice || 0,
                reminderExpirationDays: systemData.reminderExpirationDays || [7, 3, 1],
                smsNotificationsEnabled: systemData.smsNotificationsEnabled !== false,
                autoCompleteBookingDays: systemData.autoCompleteBookingDays || 7,
                autoCancelBookingDays: systemData.autoCancelBookingDays || 3,
                subscriptionPrice: systemData.subscriptionPrice || 0,
                subscriptionDuration: systemData.subscriptionDuration || 0,
                freeAdDuration: systemData.freeAdDuration || 3,
                serviceFeeFixed: systemData.serviceFeeFixed || 0,
                heroTitle: systemData.heroTitle || '',
                heroSubtitle: systemData.heroSubtitle || '',
                customerCareEmail: systemData.customerCareEmail || 'info@pinnpost.com',
            });

            // Set the initial image URL if there's an existing hero image
            if (systemData.heroImage) {
                setHeroImageUrl(systemData.heroImage);
            }
        }
    }, [settingsData]);

    const updateSetting = (key: keyof typeof localSettings, value: any) => {
        setLocalSettings(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    };

    // Handle hero image URL changes separately
    const handleHeroImageChange = (url: string) => {
        setHeroImageUrl(url);
        setHasChanges(true);
    };

    const handleSave = async () => {
        const updatedSettings = {
            system: {
                ...localSettings,
                heroImage: heroImageUrl || ''
            }
        };

        updateSettingsMutation.mutate(updatedSettings as any, {
            onSuccess: () => {
                setHasChanges(false);
                setAlertDialog({
                    isOpen: true,
                    title: "Settings Saved",
                    description: "System settings have been successfully updated.",
                    type: "success",
                });
            },
            onError: (error: any) => {
                setAlertDialog({
                    isOpen: true,
                    title: "Save Failed",
                    description: error?.message || "Failed to save settings. Please try again.",
                    type: "error",
                });
            }
        });
    };

    const renderSettingField = (
        key: keyof typeof localSettings,
        label: string,
        type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'email' | 'tel' | 'password' | 'array' = 'text',
        options?: string[],
        hint?: string
    ) => {
        const settingValue = localSettings[key];

        // Helper to render info icon with hint
        const renderLabelWithHint = () => (
            <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-primary">{label}</label>
                {hint && (
                    <div className="group relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-tertiary cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute left-full ml-2 top-0 z-10 hidden group-hover:block w-64 p-3 bg-secondary text-primary text-xs rounded-lg shadow-lg border border-tertiary">
                            {hint}
                        </div>
                    </div>
                )}
            </div>
        );

        switch (type) {
            case 'boolean':
                return (
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            {renderLabelWithHint()}
                        </div>
                        <Toggle
                            isSelected={!!settingValue}
                            onChange={(selected) => updateSetting(key, selected)}
                        />
                    </div>
                );

            case 'textarea':
                return (
                    <div>
                        {renderLabelWithHint()}
                        <TextArea
                            value={String(settingValue)}
                            onChange={(value) => updateSetting(key, value)}
                            rows={3}
                            placeholder={`Enter ${label.toLowerCase()}`}
                        />
                    </div>
                );

            case 'number':
                const formatNumber = (num: number) => num.toLocaleString('en-US');
                const parseNumber = (str: string) => Number(str.replace(/,/g, '')) || 0;
                return (
                    <div>
                        {renderLabelWithHint()}
                        <Input
                            type="text"
                            value={formatNumber(Number(settingValue))}
                            onChange={(value) => updateSetting(key, parseNumber(value))}
                            placeholder={`Enter ${label.toLowerCase()}`}
                        />
                    </div>
                );

            case 'array':
                return (
                    <div>
                        {renderLabelWithHint()}
                        <NumberArrayInput
                            value={Array.isArray(settingValue) ? settingValue : []}
                            onChange={(newValue) => updateSetting(key, newValue)}
                            placeholder="Type days and press Enter"
                            hint="Type a number and press Enter or comma to add a reminder."
                        />
                    </div>
                );

            case 'select':
                return (
                    <div>
                        {renderLabelWithHint()}
                        <select
                            value={String(settingValue)}
                            onChange={(e) => updateSetting(key, e.target.value)}
                            className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm"
                        >
                            {options?.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                );

            default:
                return (
                    <div>
                        {renderLabelWithHint()}
                        <Input
                            type={type}
                            value={String(settingValue)}
                            onChange={(value) => updateSetting(key, value)}
                            placeholder={`Enter ${label.toLowerCase()}`}
                        />
                    </div>
                );
        }
    };

    const renderSystemSettings = () => {
        if (isSettingsLoading) {
            return (
                <div className="flex justify-center items-center h-32">
                    <p className="text-tertiary">Loading settings...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex justify-center items-center h-32">
                    <p className="text-error-primary">Error loading settings: {(error as Error).message}</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                {/* Booking & Payment Settings */}
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Booking & Payments</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {renderSettingField('bookingPrice', 'Booking Deposit Amount (₹)', 'number', undefined,
                            'Required deposit amount for booking reservations. Secured as commitment and applied toward final transaction settlement.'
                        )}
                        {renderSettingField('serviceFeeFixed', 'Platform Service Fee (₹)', 'number', undefined,
                            'Administrative fee for platform services and transaction processing. Applied to all booking transactions.'
                        )}
                    </div>
                </section>

                {/* Ad Management Settings */}
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Advertisement Management</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {renderSettingField('freeAdDuration', 'Initial Publication Duration (Days)', 'number', undefined,
                            'Standard validity period for complimentary advertisement postings before expiration.'
                        )}
                        {renderSettingField('subscriptionPrice', 'Publication Extension Fee (₹)', 'number', undefined,
                            'Fee required to extend advertisement publication duration beyond initial complimentary period.'
                        )}
                        {renderSettingField('subscriptionDuration', 'Extension Period (Days)', 'number', undefined,
                            'Duration of extended advertisement visibility upon payment renewal (typically 30-day cycles).'
                        )}
                        {renderSettingField('reminderExpirationDays', 'Expiration Notice Lead Time (Days)', 'array', undefined,
                            'Advance notification periods prior to advertisement expiration to alert users. Comma-separated values (e.g., 7, 3, 1 sends reminders 7, 3, and 1 day before expiry).'
                        )}
                        {renderSettingField('smsNotificationsEnabled', 'SMS for user notifications', 'boolean', undefined,
                            'When off, ad/booking/system notifications are not sent via SMS (push and email still follow user preferences). OTP and auth SMS are not affected.'
                        )}
                    </div>
                </section>

                {/* Booking Automation Settings */}
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Booking Automation</h3>
                    <p className="text-sm text-tertiary mb-4">Automated booking lifecycle management processes</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        {renderSettingField('autoCompleteBookingDays', 'Auto-Completion Threshold (Days)', 'number', undefined,
                            'Post-completion window before confirmed bookings are automatically marked as fulfilled. Excludes bookings under active dispute review.'
                        )}
                        {renderSettingField('autoCancelBookingDays', 'Auto-Cancellation Threshold (Days)', 'number', undefined,
                            'Confirmation window before pending bookings are automatically voided due to inactivity. Excludes bookings under active dispute review.'
                        )}
                    </div>
                </section>

                {/* Customer Support */}
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Customer Support</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {renderSettingField('customerCareEmail', 'Support Contact Email', 'email', undefined,
                            'Primary contact channel for user inquiries and support requests.'
                        )}
                    </div>
                </section>

                {/* Home Page Hero Section */}
                <section className="border-t border-secondary pt-6">
                    <h3 className="text-lg font-semibold text-primary mb-4">Homepage Branding</h3>
                    <p className="text-sm text-tertiary mb-4">Configure platform homepage visual identity and messaging</p>
                    <div className="space-y-4">
                        {renderSettingField('heroTitle', 'Primary Headline', 'text', undefined,
                            'Main promotional messaging displayed on platform homepage hero section.'
                        )}
                        {renderSettingField('heroSubtitle', 'Supporting Tagline', 'textarea', undefined,
                            'Secondary messaging providing context to the primary headline.'
                        )}
                        <ImageUpload
                            value={heroImageUrl}
                            onChange={handleHeroImageChange}
                            onRemove={() => {
                                setHeroImageUrl('');
                                setHasChanges(true);
                            }}
                            label="Hero Banner Image"
                            hint="Upload high-resolution brand imagery (recommended: 1200x630px, maximum 5MB)"
                        />
                    </div>
                </section>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">System configuration</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">System Settings</h1>
                    <p className="text-sm text-tertiary">
                        Manage your application settings and preferences.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        color="primary"
                        size="sm"
                        iconLeading={<FileCheck02 />}
                        onClick={handleSave}
                        disabled={!hasChanges || updateSettingsMutation.isPending}
                    >
                        {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </header>

            {/* System Settings Content */}
            <div className="bg-primary border border-secondary rounded-2xl shadow-sm p-6">
                <div className="mb-6 flex items-center gap-3">
                    <Database01 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-primary">
                        System Settings
                    </h2>
                    {hasChanges && (
                        <span className="rounded-full bg-warning-subtle px-2 py-1 text-xs font-medium text-warning-primary">
                            Unsaved changes
                        </span>
                    )}
                </div>

                <div>
                    {renderSystemSettings()}
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