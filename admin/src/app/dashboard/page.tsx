"use client";

import {
  FiPlus,
  FiEye,
  FiUsers,
  FiClock,
  FiTrendingUp,
  FiChevronDown
} from "react-icons/fi";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/utils/currency";
import { useDashboardAllData } from "@/hooks/use-analytics";

export default function DashboardPage() {
    const [dateRange, setDateRange] = useState("30d");

    // Single query fetches all data in parallel
    const { data: allData, isLoading } = useDashboardAllData(dateRange);

    // Handle the API response structure - extract data from the nested response
    const dashData = allData?.dashboard?.success ?
      (allData.dashboard.data?.data || allData.dashboard.data) : null;
    const adData = allData?.ads?.success ? allData.ads.data : null;
    const revenueData = allData?.revenue?.success ? allData.revenue.data : null;

    // Check for errors in API responses
    const hasDashboardError = allData?.dashboard && 'success' in allData.dashboard && allData.dashboard.success === false;
    const hasAdError = allData?.ads && 'success' in allData.ads && allData.ads.success === false;
    const hasRevenueError = allData?.revenue && 'success' in allData.revenue && allData.revenue.success === false;

    // Show error if any of the API calls failed
    if (hasDashboardError || hasAdError || hasRevenueError) {
        return (
            <div className="min-h-screen bg-primary px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center min-h-96">
                    <div className="text-center">
                        <div className="text-error-primary text-lg font-semibold">Error loading dashboard data</div>
                        <div className="text-error-secondary mt-2">
                            {hasDashboardError && <p>Dashboard stats failed to load</p>}
                            {hasAdError && <p>Ad analytics failed to load</p>}
                            {hasRevenueError && <p>Revenue analytics failed to load</p>}
                        </div>
                        <button
                            className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary"
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Only proceed if we have valid data
    const stats = [
        {
            title: "Total Users",
            value: dashData && 'totalUsers' in dashData ? 
              (dashData as any).totalUsers?.toLocaleString() || "0" : "0",
            description: "Total registered users",
            icon: FiUsers,
        },
        {
            title: "Total Ads",
            value: dashData && 'totalAds' in dashData ? 
              (dashData as any).totalAds?.toLocaleString() || "0" : "0",
            description: "All ads created",
            icon: FiPlus,
        },
        {
            title: "Approved Ads",
            value: dashData && 'approvedAds' in dashData ? 
              (dashData as any).approvedAds?.toLocaleString() || "0" : "0",
            description: "Ads approved by moderators",
            icon: FiEye,
        },
        {
            title: "Pending Review",
            value: dashData && 'pendingAds' in dashData ? 
              (dashData as any).pendingAds?.toLocaleString() || "0" : "0",
            description: "Awaiting moderation",
            icon: FiClock,
        },
        {
            title: "Total Bookings",
            value: dashData && 'totalBookings' in dashData ? 
              (dashData as any).totalBookings?.toLocaleString() || "0" : "0",
            description: "Total bookings made",
            icon: FiPlus,
        },
        {
            title: "Revenue",
            value: formatCurrency(dashData && 'totalRevenue' in dashData ? 
              (dashData as any).totalRevenue || 0 : 0),
            description: getPeriodLabel(dateRange),
            icon: FiTrendingUp,
        }
    ];

    function getPeriodLabel(period: string) {
        switch(period) {
            case '7d': return 'Last 7 days';
            case '30d': return 'Last 30 days';
            case '90d': return 'Last 90 days';
            case '1y': return 'Last year';
            default: return 'Last 30 days';
        }
    }

    // Process revenue trend data for chart using actual data from API
    const dailyTransactions = revenueData && 'revenueTrend' in revenueData ? 
      (revenueData as any).revenueTrend?.map((item: any) => ({
        day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
        amount: item.revenue || 0
      })) : [
        { day: "Mon", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Tue", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Wed", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Thu", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Fri", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Sat", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
        { day: "Sun", amount: revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0 },
      ];

    // Process top categories from ad data using actual data from API
    const topCategories = adData && 'topCategories' in adData ? 
      (adData as any).topCategories?.map((category: any) => {
        const totalAds = dashData && 'totalAds' in dashData ? (dashData as any).totalAds || 1 : 1;
        const percentage = ((category.count / totalAds) * 100).toFixed(1);
        return {
          name: category.categoryName,
          count: category.count,
          percentage: parseFloat(percentage)
        };
      }) : [];

    return (
        <div className="min-h-screen bg-primary px-4 py-8 sm:px-6 lg:px-8">
            {isLoading ? (
                <div className="flex items-center justify-center min-h-96">
                    <div className="text-primary">Loading dashboard...</div>
                </div>
            ) : (
                <>
                    <header className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Ad Posting Dashboard</h1>
                            </div>

                            {/* Date Range Filter */}
                            <div className="relative">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                    className="appearance-none rounded-xl border border-secondary bg-primary px-4 py-2 pr-10 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                >
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                    <option value="90d">Last 90 Days</option>
                                    <option value="1y">Last Year</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <FiChevronDown className="w-4 h-4 text-tertiary" />
                                </div>
                            </div>
                        </div>
                    </header>

            <main className="mx-auto mt-8 flex w-full max-w-6xl flex-col gap-8">
                {/* Statistics Overview - 3x2 Grid */}
                <section aria-label="Statistics overview" className="grid gap-4 grid-cols-3">
                    {stats.map((stat) => (
                        <article key={stat.title} className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-tertiary uppercase tracking-wide">{stat.title}</p>
                                    <p className="text-display-xs font-semibold text-primary">{stat.value}</p>
                                    <p className="text-sm text-quaternary">{stat.description}</p>
                                </div>
                                <div className="rounded-lg bg-brand-subtle p-3">
                                    <stat.icon className="w-5 h-5 text-brand-primary" />
                                </div>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Daily Transaction Chart using Recharts */}
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-6">
                        <h2 className="text-lg font-semibold text-primary">Revenue Trend</h2>
                        <p className="text-sm text-tertiary">Revenue over {getPeriodLabel(dateRange).toLowerCase()}</p>
                    </header>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyTransactions} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis
                                    dataKey="day"
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                />
                                <YAxis
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                    tickFormatter={(value) => formatCurrency(value / 1000).replace('₹', '₹') + 'k'}
                                />
                                <Tooltip
                                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                                    contentStyle={{
                                        backgroundColor: '#FFFFFF',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="rgb(99, 102, 241)"
                                    radius={[4, 4, 0, 0]}
                                    className="hover:opacity-80 transition-opacity"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-secondary">
                        <div className="text-sm text-tertiary">
                            Total: <span className="text-primary font-semibold">
                                {formatCurrency(dailyTransactions.reduce((sum: number, day: any) => sum + day.amount, 0))}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Top Categories */}
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-6">
                        <h2 className="text-lg font-semibold text-primary">Top Categories</h2>
                        <p className="text-sm text-tertiary">Most popular ad categories</p>
                    </header>
                    {topCategories.length > 0 ? (
                        <div className="space-y-3">
                            {topCategories.map((category: any) => (
                                <div key={category.name} className="flex items-center justify-between rounded-xl border border-secondary bg-secondary p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-medium text-primary w-32">{category.name}</div>
                                        <div className="text-xs text-tertiary">{category.count} ads</div>
                                    </div>
                                    <div className="text-sm font-medium text-primary">{category.percentage}%</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-tertiary py-8">No category data available</div>
                    )}
                </section>

                {/* Ad Analytics Section */}
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-6">
                        <h2 className="text-lg font-semibold text-primary">Ad Analytics</h2>
                        <p className="text-sm text-tertiary">Detailed ad statistics</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Total Ads</p>
                            <p className="text-2xl font-semibold text-primary">{adData && 'totalAds' in adData ? (adData as any).totalAds?.toLocaleString() || '0' : '0'}</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Featured Ads</p>
                            <p className="text-2xl font-semibold text-primary">{adData && 'featuredAds' in adData ? (adData as any).featuredAds?.toLocaleString() || '0' : '0'}</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Expired Ads</p>
                            <p className="text-2xl font-semibold text-primary">{adData && 'expiredAds' in adData ? (adData as any).expiredAds?.toLocaleString() || '0' : '0'}</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Ad Growth</p>
                            <p className="text-2xl font-semibold text-primary">{adData && 'adGrowth' in adData ? (adData as any).adGrowth?.toLocaleString() || '0' : '0'}%</p>
                        </article>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-md font-semibold text-primary mb-3">Ads by Status</h3>
                            <div className="space-y-2">
                                {Object.entries(adData && 'adsByStatus' in adData ? (adData as any).adsByStatus || {} : {}).map(([status, count]) => (
                                    <div key={status} className="flex justify-between">
                                        <span className="text-sm text-tertiary capitalize">{status.toLowerCase()}</span>
                                        <span className="text-sm font-medium text-primary">{count?.toString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-md font-semibold text-primary mb-3">Ads by Type</h3>
                            <div className="space-y-2">
                                {Object.entries(adData && 'adsByType' in adData ? (adData as any).adsByType || {} : {}).map(([type, count]) => (
                                    <div key={type} className="flex justify-between">
                                        <span className="text-sm text-tertiary capitalize">{type.toLowerCase()}</span>
                                        <span className="text-sm font-medium text-primary">{count?.toString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Revenue Analytics Section */}
                <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-6">
                        <h2 className="text-lg font-semibold text-primary">Revenue Analytics</h2>
                        <p className="text-sm text-tertiary">Financial performance metrics</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Total Revenue</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(revenueData && 'totalRevenue' in revenueData ? (revenueData as any).totalRevenue || 0 : 0)}</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Monthly Revenue</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(revenueData && 'monthlyRevenue' in revenueData ? (revenueData as any).monthlyRevenue || 0 : 0)}</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Revenue Growth</p>
                            <p className="text-2xl font-semibold text-primary">{revenueData && 'revenueGrowth' in revenueData ? (revenueData as any).revenueGrowth?.toLocaleString() || '0' : '0'}%</p>
                        </article>

                        <article className="rounded-xl border border-secondary bg-primary p-4 shadow-sm">
                            <p className="text-sm font-medium text-tertiary">Subscription Revenue</p>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(revenueData && 'subscriptionRevenue' in revenueData ? (revenueData as any).subscriptionRevenue || 0 : 0)}</p>
                        </article>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-md font-semibold text-primary mb-3">Revenue by Provider</h3>
                            <div className="space-y-2">
                                {Object.entries(revenueData && 'revenueByProvider' in revenueData ? (revenueData as any).revenueByProvider || {} : {}).map(([provider, amount]) => (
                                    <div key={provider} className="flex justify-between">
                                        <span className="text-sm text-tertiary capitalize">{provider.toLowerCase()}</span>
                                        <span className="text-sm font-medium text-primary">{formatCurrency(amount as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-md font-semibold text-primary mb-3">Revenue by Source</h3>
                            <div className="space-y-2">
                                {Object.entries(revenueData && 'revenueBySource' in revenueData ? (revenueData as any).revenueBySource || {} : {}).map(([source, amount]) => (
                                    <div key={source} className="flex justify-between">
                                        <span className="text-sm text-tertiary capitalize">{source.toLowerCase()}</span>
                                        <span className="text-sm font-medium text-primary">{formatCurrency(amount as number)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            </>
            )}
        </div>
    );
}
