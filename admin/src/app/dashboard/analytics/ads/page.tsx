"use client";

import { useState } from "react";
import { ArrowUpRight, FileCheck02, Clock, CheckCircle, XCircle, TrendUp01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAdAnalytics } from '@/hooks/use-analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdsAnalyticsPage() {
    const { data: adAnalytics, isLoading } = useAdAnalytics();
    const [dateRange, setDateRange] = useState("30d");

    const stats = adAnalytics?.data;

    const kpiCards = [
        {
            title: "Total Ads",
            value: stats?.totalAds?.toLocaleString() || "0",
            change: "+8.1%",
            description: "All-time ads created",
            icon: FileCheck02,
            color: "brand",
        },
        {
            title: "Active Ads",
            value: stats?.activeAds?.toLocaleString() || "0",
            change: "+12.3%",
            description: "Currently active",
            icon: CheckCircle,
            color: "success",
        },
        {
            title: "Pending Ads",
            value: stats?.pendingAds?.toLocaleString() || "0",
            change: "-5.2%",
            description: "Awaiting moderation",
            icon: Clock,
            color: "warning",
        },
        {
            title: "Rejected Ads",
            value: stats?.rejectedAds?.toLocaleString() || "0",
            change: "+2.1%",
            description: "Policy violations",
            icon: XCircle,
            color: "error",
        },
    ];

    const adsByCategory = stats?.adsByCategory || {};
    const categoryData = Object.entries(adsByCategory)
        .map(([category, count]) => ({
            category,
            count: count as number,
        }))
        .sort((a, b) => b.count - a.count);

    const topCategories = categoryData.slice(0, 5);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading ad analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Analytics</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Ad Analytics</h1>
                    <p className="text-sm text-tertiary">
                        Ad performance metrics including creation rates, approval rates, and category distribution.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                        <article key={card.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                    <p className="text-sm font-medium text-tertiary uppercase tracking-wide">{card.title}</p>
                                    <p className="text-display-xs font-semibold text-primary">{card.value}</p>
                                    <div className="flex items-center gap-1">
                                        <TrendUp01 className={`w-4 h-4 text-${card.color}-primary`} />
                                        <p className={`text-sm text-${card.color}-primary`}>{card.change}</p>
                                    </div>
                                    <p className="text-sm text-quaternary">{card.description}</p>
                                </div>
                                <div className={`rounded-lg bg-${card.color}-subtle p-3`}>
                                    <Icon className={`w-6 h-6 text-${card.color}-primary`} />
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* Ad Performance Overview */}
            <section className="grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2">
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-primary">Ad Creation Trends</h2>
                            <p className="text-sm text-tertiary">Ads created over time</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                color={dateRange === "7d" ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => setDateRange("7d")}
                            >
                                7 Days
                            </Button>
                            <Button
                                color={dateRange === "30d" ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => setDateRange("30d")}
                            >
                                30 Days
                            </Button>
                            <Button
                                color={dateRange === "90d" ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => setDateRange("90d")}
                            >
                                90 Days
                            </Button>
                        </div>
                    </header>

                    {stats && 'adCreationTrends' in stats && stats.adCreationTrends && stats.adCreationTrends.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.adCreationTrends}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                    />
                                    <Tooltip 
                                        formatter={(value) => [value, 'Ads Created']}
                                        labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
                                    />
                                    <Bar 
                                        dataKey="adsCreated" 
                                        fill="rgb(99, 102, 241)" 
                                        radius={[4, 4, 0, 0]} 
                                        className="hover:opacity-80 transition-opacity"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-secondary text-tertiary">
                            <span className="text-sm">No trend data available</span>
                        </div>
                    )}

                    <div className="grid gap-4 text-sm text-tertiary md:grid-cols-3 mt-6">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Approval Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {stats?.totalAds && stats?.activeAds 
                                    ? `${((stats.activeAds / stats.totalAds) * 100).toFixed(1)}%`
                                    : "0%"}
                            </p>
                            <p className="text-success-primary">+3.2%</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Avg. Approval Time</p>
                            <p className="mt-1 text-xl font-semibold text-primary">2.4h</p>
                            <p className="text-success-primary">-0.5h</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Rejection Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {stats?.totalAds && stats?.rejectedAds 
                                    ? `${((stats.rejectedAds / stats.totalAds) * 100).toFixed(1)}%`
                                    : "0%"}
                            </p>
                            <p className="text-error-primary">+0.8%</p>
                        </div>
                    </div>
                </article>

                {/* Ad Status Distribution */}
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Status Distribution</h2>
                        <p className="text-sm text-tertiary">Current ad statuses</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Active</span>
                                <span className="text-sm font-semibold text-primary">{stats?.activeAds || 0}</span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div 
                                    className="bg-success-primary h-2 rounded-full" 
                                    style={{ 
                                        width: stats?.totalAds 
                                            ? `${(stats.activeAds / stats.totalAds) * 100}%` 
                                            : '0%' 
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Pending</span>
                                <span className="text-sm font-semibold text-primary">{stats?.pendingAds || 0}</span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div 
                                    className="bg-warning-primary h-2 rounded-full" 
                                    style={{ 
                                        width: stats?.totalAds 
                                            ? `${(stats.pendingAds / stats.totalAds) * 100}%` 
                                            : '0%' 
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Rejected</span>
                                <span className="text-sm font-semibold text-primary">{stats?.rejectedAds || 0}</span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div 
                                    className="bg-error-primary h-2 rounded-full" 
                                    style={{ 
                                        width: stats?.totalAds 
                                            ? `${(stats.rejectedAds / stats.totalAds) * 100}%` 
                                            : '0%' 
                                    }}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Expired</span>
                                <span className="text-sm font-semibold text-primary">{stats?.expiredAds || 0}</span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div 
                                    className="bg-tertiary h-2 rounded-full" 
                                    style={{ 
                                        width: stats?.totalAds 
                                            ? `${((stats.expiredAds || 0) / stats.totalAds) * 100}%` 
                                            : '0%' 
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </article>
            </section>

            {/* Category Distribution */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">Ads by Category</h2>
                        <p className="text-sm text-tertiary">Top performing categories</p>
                    </div>
                    <Button color="secondary" size="sm" href="/dashboard/ad-management/categories">
                        Manage Categories
                    </Button>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Category</th>
                                <th scope="col" className="px-4 py-3">Total Ads</th>
                                <th scope="col" className="px-4 py-3">Percentage</th>
                                <th scope="col" className="px-4 py-3">Distribution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {topCategories.map((category) => (
                                <tr key={category.category} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3 font-medium">{category.category}</td>
                                    <td className="px-4 py-3">{category.count.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        {stats?.totalAds 
                                            ? `${((category.count / stats.totalAds) * 100).toFixed(1)}%`
                                            : "0%"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="w-full bg-tertiary rounded-full h-2 max-w-xs">
                                            <div 
                                                className="bg-brand-primary h-2 rounded-full" 
                                                style={{ 
                                                    width: stats?.totalAds 
                                                        ? `${(category.count / stats.totalAds) * 100}%` 
                                                        : '0%' 
                                                }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {categoryData.length > 5 && (
                    <div className="mt-4 text-center">
                        <Button color="secondary" size="sm">
                            View All Categories ({categoryData.length})
                        </Button>
                    </div>
                )}
            </section>
        </div>
    );
}
