"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { Folder, HomeLine, Settings01, Users02, CreditCardMinus, HelpCircle, Calendar, Clock, MessageCircle01 } from "@untitledui/icons";
import { FloatingNotification, PushNotificationToast } from "@/components/application/notifications";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { useAuth } from "@/providers/auth-provider";
import { useAdminPushNotifications } from "@/hooks/use-admin-push-notifications";
import { useAdminChatSocketSession } from "@/hooks/use-admin-chat-realtime";
import { useAdminChatInboxUnread } from "@/hooks/use-admin-chat-inbox";
import { config as appConfig } from "@/config/environment";

const footerNav = [{ label: "Settings", href: "/dashboard/settings", icon: Settings01 }];

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { isAuthenticated } = useAuth();
    const { data: unreadByUser = {} } = useAdminChatInboxUnread();

    useAdminChatSocketSession();

    const {
        lastNotification,
        dismissNotification
    } = useAdminPushNotifications(isAuthenticated);

    const chatNavBadge = useMemo(() => {
        const total = Object.values(unreadByUser).reduce((a, n) => a + (typeof n === "number" ? n : 0), 0);
        if (total <= 0) return undefined;
        return total > 99 ? "99+" : total;
    }, [unreadByUser]);

    const primaryNav = useMemo(
        () => [
            { label: "Overview", href: "/dashboard", icon: HomeLine },
            ...(appConfig.features.outbox
                ? [{ label: "SMS outbox", href: "/dashboard/sms-outbox", icon: MessageCircle01 }]
                : []),
            {
                label: "User management",
                href: "/dashboard/user-management",
                icon: Users02,
                items: [
                    { label: "Users", href: "/dashboard/user-management/users" },
                    { label: "Messages", href: "/dashboard/user-management/chat", badge: chatNavBadge },
                ],
            },
            {
                label: "Ad management",
                href: "/dashboard/ad-management",
                icon: Folder,
                items: [
                    { label: "Ad moderation", href: "/dashboard/ad-moderation" },
                    { label: "Ad directory", href: "/dashboard/ad-management/ads" },
                    { label: "Categories", href: "/dashboard/ad-management/categories" },
                    { label: "Platform Ads", href: "/dashboard/platform-ads" },
                ],
            },
            {
                label: "Booking management",
                href: "/dashboard/booking-management",
                icon: Clock,
                items: [
                    { label: "All Bookings", href: "/dashboard/booking-management" },
                    { label: "Complaints", href: "/dashboard/booking-management/complaints" },
                ],
            },
            {
                label: "Content management",
                href: "/dashboard/content-management",
                icon: Folder,
                items: [
                    { label: "Blog", href: "/dashboard/content-management/blog" },
                    { label: "Blog Categories", href: "/dashboard/content-management/blog-categories" },
                    { label: "Legal Documents", href: "/dashboard/content-management/legal" },
                ],
            },
            {
                label: "FAQ management",
                href: "/dashboard/faq-management",
                icon: HelpCircle,
                items: [
                    { label: "FAQs", href: "/dashboard/faq-management/faqs" },
                    { label: "FAQ Categories", href: "/dashboard/faq-management/categories" },
                ],
            },
            {
                label: "Payments",
                href: "/dashboard/transactions",
                icon: CreditCardMinus,
                items: [
                    { label: "Transactions", href: "/dashboard/transactions" },
                    { label: "Subscriptions", href: "/dashboard/subscriptions", icon: Calendar },
                ],
            },
        ],
        [chatNavBadge]
    );

    return (
        <div className="min-h-screen bg-primary">
            <PushNotificationToast
                notification={lastNotification}
                onDismiss={dismissNotification}
            />

            <div className="flex min-h-screen flex-col lg:flex-row">
                <SidebarNavigationSimple
                    activeUrl={pathname ?? "/dashboard"}
                    items={primaryNav}
                    footerItems={footerNav}
                    showAccountCard
                    className="z-50 relative"
                />

                <main className="flex flex-col flex-1">
                    <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 overflow-auto">
                        <div
                            className={
                                (pathname ?? "").includes("/user-management/chat")
                                    ? "mx-auto w-full max-w-7xl"
                                    : "mx-auto w-full max-w-6xl"
                            }
                        >
                            {children}
                        </div>
                    </div>
                </main>
            </div>

            <FloatingNotification refreshInterval={10000} />
        </div>
    );
}
