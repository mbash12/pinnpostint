"use client";

import { useState } from "react";
import { Bell01, Send01, Users01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useSendBulkNotifications, useGetUserCountByCriteria } from "@/hooks/use-bulk-operations";

export default function BulkNotificationsPage() {
    const [notificationTitle, setNotificationTitle] = useState("");
    const [notificationMessage, setNotificationMessage] = useState("");
    const [notificationType, setNotificationType] = useState("GENERAL");
    const [targetAudience, setTargetAudience] = useState("all");
    const [selectedLocation, setSelectedLocation] = useState("all");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [deliveryPush, setDeliveryPush] = useState(true);
    const [deliveryEmail, setDeliveryEmail] = useState(true);
    const [tapDeepLink, setTapDeepLink] = useState("");
    const [tapUrl, setTapUrl] = useState("");

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const notificationTypes = [
        { id: "GENERAL", label: "General" },
        { id: "SYSTEM", label: "System Alert" },
        { id: "PROMOTION", label: "Promotional" },
        { id: "BOOKING", label: "Booking Update" },
    ];

    const audienceOptions = [
        { id: "all", label: "All app users" },
        { id: "active", label: "Verified users only" },
        { id: "with_ads", label: "Users with active ads" },
        { id: "location", label: "By location" },
        { id: "category", label: "By category interest" },
    ];

    const criteria = {
        role: "user" as const,
        isVerified: targetAudience === "active" ? true : undefined,
        hasActiveAds: targetAudience === "with_ads" ? true : undefined,
        locationId: selectedLocation !== "all" ? parseInt(selectedLocation) : undefined,
    };

    const { data: estimatedRecipients = 0, isLoading: isRecipientCountLoading } = useGetUserCountByCriteria(criteria);

    const sendNotificationMutation = useSendBulkNotifications();

    const handleSendNotification = async () => {
        const selectedChannels = [
            ...(deliveryPush ? (["push"] as const) : []),
            ...(deliveryEmail ? (["email"] as const) : []),
        ];
        if (selectedChannels.length === 0) {
            setAlertDialog({
                isOpen: true,
                title: "Select a channel",
                description: "Choose at least one of Push or Email.",
                type: "warning",
            });
            return;
        }
        try {
            const result = await sendNotificationMutation.mutateAsync({
                criteria: {
                    isVerified: targetAudience === "active" ? true : undefined,
                    hasActiveAds: targetAudience === "with_ads" ? true : undefined,
                },
                notification: {
                    title: notificationTitle,
                    message: notificationMessage,
                    type: notificationType,
                    ...(tapDeepLink.trim() || tapUrl.trim()
                        ? {
                              data: {
                                  ...(tapDeepLink.trim() ? { deepLink: tapDeepLink.trim() } : {}),
                                  ...(tapUrl.trim() ? { url: tapUrl.trim() } : {}),
                              },
                          }
                        : {}),
                },
                channels: [...selectedChannels],
            });

            if (!result.success) {
                throw new Error((result as { error?: { message?: string } }).error?.message || "Request failed");
            }

            const data = result.data as { sentCount?: number; channelsQueued?: string[] } | undefined;
            const ch = data?.channelsQueued?.length ? data.channelsQueued.join(", ") : selectedChannels.join(", ");

            setNotificationTitle("");
            setNotificationMessage("");
            setTapDeepLink("");
            setTapUrl("");
            setAlertDialog({
                isOpen: true,
                title: "Success",
                description: `Announcement saved for ${data?.sentCount ?? estimatedRecipients} app user(s) and queued for: ${ch}.`,
                type: "success",
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setAlertDialog({
                isOpen: true,
                title: "Error",
                description: `Failed to send: ${message}`,
                type: "error",
            });
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Communications</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">User announcements</h1>
                    <p className="text-sm text-tertiary">
                        Send to app users only (not admin accounts). Each recipient gets an in-app notification; enable Push
                        and/or Email for device and inbox delivery. SMS is not used for announcements.
                    </p>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary mb-4">Notification details</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">Title</label>
                                <Input
                                    placeholder="Announcement title"
                                    value={notificationTitle}
                                    onChange={setNotificationTitle}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">Message</label>
                                <textarea
                                    className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                    rows={4}
                                    placeholder="Announcement message"
                                    value={notificationMessage}
                                    onChange={(e) => setNotificationMessage(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">Type</label>
                                <Select
                                    aria-label="Notification type"
                                    selectedKey={notificationType}
                                    onSelectionChange={(key) => {
                                        if (typeof key === "string") {
                                            setNotificationType(key);
                                        }
                                    }}
                                    items={notificationTypes}
                                    size="md"
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                            </div>

                            <div className="rounded-xl border border-secondary bg-secondary/30 p-4 space-y-3">
                                <p className="text-sm font-medium text-primary">Tap action (optional)</p>
                                <p className="text-xs text-tertiary">
                                    When set, tapping the push notification or in-app row opens this target. External URL opens
                                    in the browser; in-app path uses the app router (e.g.{" "}
                                    <code className="text-xs">/(tabs)/browse</code>).
                                </p>
                                <Input
                                    placeholder="In-app path, e.g. /(tabs)/browse"
                                    value={tapDeepLink}
                                    onChange={setTapDeepLink}
                                />
                                <Input
                                    placeholder="https://… (external link)"
                                    value={tapUrl}
                                    onChange={setTapUrl}
                                />
                            </div>

                            <div className="rounded-xl border border-secondary bg-secondary/30 p-4 space-y-3">
                                <p className="text-sm font-medium text-primary">Delivery</p>
                                <p className="text-xs text-tertiary">
                                    In-app notification is always created. Push and email respect user preferences where
                                    applicable.
                                </p>
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                    <Checkbox
                                        isSelected={deliveryPush}
                                        onChange={setDeliveryPush}
                                        label="Push (FCM)"
                                    />
                                    <Checkbox isSelected={deliveryEmail} onChange={setDeliveryEmail} label="Email" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-secondary pt-6">
                        <h2 className="text-lg font-semibold text-primary mb-4">Audience</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">Filter</label>
                                <Select
                                    aria-label="Target audience"
                                    selectedKey={targetAudience}
                                    onSelectionChange={(key) => {
                                        if (typeof key === "string") {
                                            setTargetAudience(key);
                                        }
                                    }}
                                    items={audienceOptions}
                                    size="md"
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>
                            </div>

                            {targetAudience === "location" && (
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-2">Location</label>
                                    <Input
                                        placeholder="Location"
                                        value={selectedLocation}
                                        onChange={setSelectedLocation}
                                    />
                                </div>
                            )}

                            {targetAudience === "category" && (
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-2">Category</label>
                                    <Input
                                        placeholder="Category"
                                        value={selectedCategory}
                                        onChange={setSelectedCategory}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-secondary pt-6">
                        <Button
                            color="primary"
                            size="md"
                            iconLeading={<Send01 />}
                            onClick={handleSendNotification}
                            disabled={!notificationTitle || !notificationMessage}
                            isLoading={sendNotificationMutation.isPending}
                            className="w-full"
                        >
                            Send announcement
                        </Button>
                    </div>
                </section>

                <aside className="space-y-6">
                    <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Preview</h2>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-brand-subtle p-2">
                                    <Bell01 className="w-5 h-5 text-brand-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-primary">
                                        {notificationTitle || "Title"}
                                    </p>
                                    <p className="text-xs text-tertiary mt-1">
                                        {notificationMessage || "Message preview…"}
                                    </p>
                                    <p className="text-xs text-quaternary mt-2">Just now</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Estimated recipients</h2>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users01 className="w-5 h-5 text-brand-primary" />
                                    <span className="text-sm font-medium text-primary">App users (matching filters)</span>
                                </div>
                                {isRecipientCountLoading ? (
                                    <span className="text-lg font-semibold text-primary">…</span>
                                ) : (
                                    <span className="text-lg font-semibold text-primary">
                                        {estimatedRecipients.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </section>
                </aside>
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
