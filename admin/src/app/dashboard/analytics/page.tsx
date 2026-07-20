"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Users01, FileCheck02, CoinsStacked01, Heart } from "@untitledui/icons";
import { MapPin } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { useDashboardStats, useUserAnalytics, useAdAnalytics, useRevenueAnalytics, useLocationAnalytics, useWishlistAnalytics } from '@/hooks/use-analytics';
import { formatCurrency } from "@/utils/currency";

export default function AnalyticsPage() {
    const [period, setPeriod] = useState("30d");
    
    const { data: dashboardResponse, isLoading: isDashboardLoading, error: dashError } = useDashboardStats(period);
    const { data: userResponse, isLoading: isUserLoading, error: userError } = useUserAnalytics(period);
    const { data: adResponse, isLoading: isAdLoading, error: adError } = useAdAnalytics(period);
    const { data: revenueResponse, isLoading: isRevenueLoading, error: revenueError } = useRevenueAnalytics(period);
    const { data: locationResponse, isLoading: isLocationLoading, error: locationError } = useLocationAnalytics(period);
    const { data: wishlistResponse, isLoading: isWishlistLoading, error: wishlistError } = useWishlistAnalytics(period);

    const isLoading = isDashboardLoading || isUserLoading || isAdLoading || isRevenueLoading || isLocationLoading || isWishlistLoading;

    // Extract data from API response
    const dashData = (dashboardResponse?.data?.data || dashboardResponse?.data) as any;
    const userData = (userResponse?.data || userResponse) as any;
    const adData = (adResponse?.data || adResponse) as any;
    const revenueData = (revenueResponse?.data || revenueResponse) as any;
    const locationData = (locationResponse?.data || locationResponse) as any;
    const wishlistData = (wishlistResponse?.data || wishlistResponse) as any;

    // Debug logging

    const kpiCards = [
        {
            title: "Total Users",
            value: userData?.totalUsers?.toLocaleString() || "0",
            description: "Total registered users",
            icon: Users01,
            href: "/dashboard/analytics/users",
        },
        {
            title: "Total Revenue",
            value: revenueData?.totalRevenue ? formatCurrency(revenueData.totalRevenue) : formatCurrency(0),
            description: "All-time revenue",
            icon: CoinsStacked01,
            href: "/dashboard/analytics/revenue",
        },
        {
            title: "Active Ads",
            value: (adData?.activeAds || 0).toLocaleString(),
            description: "Currently active ads",
            icon: FileCheck02,
            href: "/dashboard/analytics/ads",
        },
        {
            title: "Total Wishlists",
            value: wishlistData?.totalWishlists?.toLocaleString() || "0",
            description: "User wishlist items",
            icon: Heart,
            href: "/dashboard/analytics/wishlists",
        },
    ];

    const analyticsModules = [
        {
            title: "User Analytics",
            description: "Registration trends, activity patterns, and user demographics",
            icon: Users01,
            href: "/dashboard/analytics/users",
            stats: [
                { label: "Total Users", value: userData?.totalUsers?.toLocaleString() || "0" },
                { label: "Active Users", value: userData?.activeUsers?.toLocaleString() || "0" },
                { label: "New This Month", value: userData?.newUsersThisMonth?.toLocaleString() || "0" },
            ],
        },
        {
            title: "Ad Analytics",
            description: "Ad performance metrics, approval rates, and category distribution",
            icon: FileCheck02,
            href: "/dashboard/analytics/ads",
            stats: [
                { label: "Total Ads", value: adData?.totalAds?.toLocaleString() || "0" },
                { label: "Active", value: adData?.activeAds?.toLocaleString() || "0" },
                { label: "Pending", value: adData?.pendingAds?.toLocaleString() || "0" },
            ],
        },
        {
            title: "Revenue Analytics",
            description: "Subscription payments, transaction volumes, and payment methods",
            icon: CoinsStacked01,
            href: "/dashboard/analytics/revenue",
            stats: [
                { label: "Total Revenue", value: revenueData?.totalRevenue ? formatCurrency(revenueData.totalRevenue) : formatCurrency(0) },
                { label: "Monthly", value: revenueData?.monthlyRevenue ? formatCurrency(revenueData.monthlyRevenue) : formatCurrency(0) },
                { label: "Avg Order", value: revenueData?.averageOrderValue ? formatCurrency(revenueData.averageOrderValue) : formatCurrency(0) },
            ],
        },
        {
            title: "Location Analytics",
            description: "Ad distribution, user activity by region, and popular locations",
            icon: MapPin,
            href: "/dashboard/analytics/locations",
            stats: [
                { label: "Top Locations", value: locationData?.topLocations?.length?.toString() || "0" },
                { label: "Total Regions", value: Object.keys(locationData?.adsByLocation || {}).length.toString() },
                { label: "Active", value: locationData?.topLocations?.length?.toString() || "0" },
            ],
        },
        {
            title: "Wishlist Analytics",
            description: "Most wishlisted ads, conversion rates, and user engagement",
            icon: Heart,
            href: "/dashboard/analytics/wishlists",
            stats: [
                { label: "Total Wishlists", value: wishlistData?.totalWishlists?.toLocaleString() || "0" },
                { label: "Active Users", value: wishlistData?.activeWishlistUsers?.toLocaleString() || "0" },
                { label: "New Users", value: wishlistData?.newWishlistUsers?.toLocaleString() || "0" },
            ],
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading analytics...</div>
            </div>
        );
    }

    const hasErrors = dashError || userError || adError || revenueError || locationError || wishlistError;
    if (hasErrors) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-4">
                <div className="text-error-primary">Failed to load analytics data</div>
                <div className="text-sm text-tertiary">
                    {dashError && <div>Dashboard: {(dashError as any)?.message}</div>}
                    {userError && <div>Users: {(userError as any)?.message}</div>}
                    {adError && <div>Ads: {(adError as any)?.message}</div>}
                    {revenueError && <div>Revenue: {(revenueError as any)?.message}</div>}
                    {locationError && <div>Location: {(locationError as any)?.message}</div>}
                    {wishlistError && <div>Wishlist: {(wishlistError as any)?.message}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Platform Insights</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Analytics Dashboard</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="appearance-none rounded-xl border border-secondary bg-primary px-4 py-2 pr-10 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="1y">Last Year</option>
                    </select>
                    <Button color="secondary" iconLeading={<ArrowUpRight />} size="sm">
                        Export Report
                    </Button>
                </div>
            </header>

            {/* KPI Cards */}
            <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpiCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Link key={card.title} href={card.href}>
                            <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1">
                                        <p className="text-sm font-medium text-tertiary uppercase tracking-wide">{card.title}</p>
                                        <p className="text-display-xs font-semibold text-primary">{card.value}</p>
                                        <p className="text-sm text-quaternary">{card.description}</p>
                                    </div>
                                    <div className="rounded-lg bg-brand-subtle p-3">
                                        <Icon className="w-6 h-6 text-brand-primary" />
                                    </div>
                                </div>
                            </article>
                        </Link>
                    );
                })}
            </section>

            {/* Analytics Modules */}
            <section className="grid gap-6 lg:grid-cols-2">
                {analyticsModules.map((module) => {
                    const Icon = module.icon;
                    return (
                        <article key={module.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <header className="flex items-start justify-between mb-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-brand-subtle p-3">
                                        <Icon className="w-6 h-6 text-brand-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-primary">{module.title}</h2>
                                        <p className="text-sm text-tertiary mt-1">{module.description}</p>
                                    </div>
                                </div>
                            </header>
                            
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                {module.stats.map((stat) => (
                                    <div key={stat.label} className="rounded-xl border border-secondary bg-secondary p-4">
                                        <p className="text-xs uppercase tracking-wide text-quaternary">{stat.label}</p>
                                        <p className="mt-1 text-xl font-semibold text-primary">{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            <Button color="secondary" size="sm" href={module.href} iconTrailing={<ArrowUpRight />} className="w-full">
                                View Details
                            </Button>
                        </article>
                    );
                })}
            </section>

            {/* Quick Stats Summary */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="mb-6">
                    <h2 className="text-lg font-semibold text-primary">Platform Overview</h2>
                </header>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <p className="text-xs uppercase tracking-wide text-quaternary">Pending Ads</p>
                        <p className="mt-1 text-2xl font-semibold text-primary">
                            {(dashData?.pendingAds || adData?.pendingAds || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-tertiary mt-1">Awaiting moderation</p>
                    </div>
                    
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <p className="text-xs uppercase tracking-wide text-quaternary">Active Ads</p>
                        <p className="mt-1 text-2xl font-semibold text-primary">
                            {dashData?.activeAds?.toLocaleString() || "0"}
                        </p>
                        <p className="text-xs text-tertiary mt-1">Currently active</p>
                    </div>
                    
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <p className="text-xs uppercase tracking-wide text-quaternary">Total Users</p>
                        <p className="mt-1 text-2xl font-semibold text-primary">
                            {dashData?.totalUsers?.toLocaleString() || "0"}
                        </p>
                        <p className="text-xs text-tertiary mt-1">All-time</p>
                    </div>
                    
                    <div className="rounded-xl border border-secondary bg-secondary p-4">
                        <p className="text-xs uppercase tracking-wide text-quaternary">Pending Ads</p>
                        <p className="mt-1 text-2xl font-semibold text-primary">
                            {dashData?.pendingAds?.toLocaleString() || "0"}
                        </p>
                        <p className="text-xs text-tertiary mt-1">Awaiting review</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
