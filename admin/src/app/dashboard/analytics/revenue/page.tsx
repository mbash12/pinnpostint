"use client";

import { useState } from "react";
import { ArrowUpRight, CoinsStacked01, TrendUp01, CreditCard01, BarChart03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useRevenueAnalytics } from '@/hooks/use-analytics';
import { formatCurrency } from "@/utils/currency";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function RevenueAnalyticsPage() {
    const { data: revenueAnalytics, isLoading } = useRevenueAnalytics();
    const [dateRange, setDateRange] = useState("30d");

    const stats = revenueAnalytics?.data;

    const kpiCards = [
        {
            title: "Total Revenue",
            value: stats?.totalRevenue ? formatCurrency(stats.totalRevenue) : formatCurrency(0),
            change: "+18.2%",
            description: "All-time revenue",
            icon: CoinsStacked01,
            color: "brand",
        },
        {
            title: "Monthly Revenue",
            value: stats?.monthlyRevenue ? formatCurrency(stats.monthlyRevenue) : formatCurrency(0),
            change: "+12.5%",
            description: "Current month",
            icon: TrendUp01,
            color: "success",
        },
        {
            title: "Average Order Value",
            value: stats?.averageOrderValue ? formatCurrency(stats.averageOrderValue) : formatCurrency(0),
            change: "+5.3%",
            description: "Per transaction",
            icon: BarChart03,
            color: "brand",
        },
        {
            title: "Total Transactions",
            value: (stats as any)?.totalTransactions?.toLocaleString() || "0",
            change: "+23.1%",
            description: "Completed payments",
            icon: CreditCard01,
            color: "success",
        },
    ];

    const revenueByMonth = stats?.revenueByMonth || [];
    const paymentProviders = (stats as any)?.paymentProviderBreakdown || {};

    const providerData = Object.entries(paymentProviders).map(([provider, amount]) => ({
        provider,
        amount: amount as number,
        percentage: stats?.totalRevenue 
            ? ((amount as number / stats.totalRevenue) * 100).toFixed(1)
            : "0",
    }));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading revenue analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Analytics</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Revenue Analytics</h1>
                    <p className="text-sm text-tertiary">
                        Subscription payments, transaction volumes, and payment method distribution.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="secondary" iconLeading={<ArrowUpRight />} size="sm">
                        Export Report
                    </Button>
                    <Button color="primary" size="sm" href="/dashboard/transactions">
                        View Transactions
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
                                        <TrendUp01 className="w-4 h-4 text-success-primary" />
                                        <p className="text-sm text-success-primary">{card.change}</p>
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

            {/* Revenue Trends */}
            <section className="grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2">
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-primary">Revenue Trends</h2>
                            <p className="text-sm text-tertiary">Monthly revenue over time</p>
                        </div>
                        <div className="flex gap-2">
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
                            <Button
                                color={dateRange === "1y" ? "primary" : "secondary"}
                                size="sm"
                                onClick={() => setDateRange("1y")}
                            >
                                1 Year
                            </Button>
                        </div>
                    </header>

                    {stats && 'revenueTrends' in stats && stats.revenueTrends && stats.revenueTrends.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.revenueTrends}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => `₹${value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                                    />
                                    <Tooltip 
                                        formatter={(value) => [`₹${value}`, 'Revenue']}
                                        labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="revenue" 
                                        stroke="rgb(99, 102, 241)" 
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center rounded-xl border border-dashed border-secondary text-tertiary">
                            <span className="text-sm">No trend data available</span>
                        </div>
                    )}

                    <div className="grid gap-4 text-sm text-tertiary md:grid-cols-3 mt-6">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Growth Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">+18.2%</p>
                            <p className="text-success-primary">vs last month</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Success Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {(stats as any)?.successRate ? `${(stats as any).successRate.toFixed(1)}%` : "98.5%"}
                            </p>
                            <p className="text-success-primary">+0.3%</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Refund Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">1.2%</p>
                            <p className="text-error-primary">+0.1%</p>
                        </div>
                    </div>
                </article>

                {/* Payment Provider Breakdown */}
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Payment Providers</h2>
                        <p className="text-sm text-tertiary">Revenue by provider</p>
                    </header>
                    
                    <div className="space-y-4">
                        {providerData.map((provider) => (
                            <div key={provider.provider} className="rounded-xl border border-secondary bg-secondary p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-primary capitalize">{provider.provider}</span>
                                    <span className="text-sm font-semibold text-primary">
                                        ${provider.amount.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-tertiary">{provider.percentage}% of total</span>
                                </div>
                                <div className="w-full bg-tertiary rounded-full h-2">
                                    <div 
                                        className="bg-brand-primary h-2 rounded-full" 
                                        style={{ width: `${provider.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}

                        {providerData.length === 0 && (
                            <div className="text-center py-8 text-tertiary text-sm">
                                No payment provider data available
                            </div>
                        )}
                    </div>
                </article>
            </section>

            {/* Monthly Revenue Table */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">Monthly Revenue Breakdown</h2>
                        <p className="text-sm text-tertiary">Revenue details by month</p>
                    </div>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Month</th>
                                <th scope="col" className="px-4 py-3">Revenue</th>
                                <th scope="col" className="px-4 py-3">Transactions</th>
                                <th scope="col" className="px-4 py-3">Avg. Value</th>
                                <th scope="col" className="px-4 py-3">Growth</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {revenueByMonth.slice(0, 12).map((month: any, index: number) => {
                                const prevMonth = revenueByMonth[index + 1];
                                const growth = prevMonth 
                                    ? (((month.revenue - prevMonth.revenue) / prevMonth.revenue) * 100).toFixed(1)
                                    : "0";
                                
                                return (
                                    <tr key={month.month} className="transition hover:bg-secondary">
                                        <td className="px-4 py-3 font-medium">{month.month}</td>
                                        <td className="px-4 py-3">${month.revenue.toLocaleString()}</td>
                                        <td className="px-4 py-3">{month.transactions?.toLocaleString() || "N/A"}</td>
                                        <td className="px-4 py-3">
                                            {month.transactions 
                                                ? `$${(month.revenue / month.transactions).toFixed(2)}`
                                                : "N/A"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                                parseFloat(growth) >= 0
                                                    ? "bg-success-subtle text-success-primary"
                                                    : "bg-error-subtle text-error-primary"
                                            }`}>
                                                {parseFloat(growth) >= 0 ? '+' : ''}{growth}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {revenueByMonth.length === 0 && (
                    <div className="text-center py-8 text-tertiary text-sm">
                        No revenue data available
                    </div>
                )}
            </section>

            {/* Transaction Statistics */}
            <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Transaction Status</h2>
                        <p className="text-sm text-tertiary">Breakdown by status</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Completed</span>
                                <span className="text-sm font-semibold text-success-primary">
                                    {(stats as any)?.completedTransactions?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-success-primary h-2 rounded-full" style={{ width: "95%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Pending</span>
                                <span className="text-sm font-semibold text-warning-primary">
                                    {(stats as any)?.pendingTransactions?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-warning-primary h-2 rounded-full" style={{ width: "3%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Failed</span>
                                <span className="text-sm font-semibold text-error-primary">
                                    {(stats as any)?.failedTransactions?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-error-primary h-2 rounded-full" style={{ width: "1.5%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Refunded</span>
                                <span className="text-sm font-semibold text-tertiary">
                                    {(stats as any)?.refundedTransactions?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-tertiary h-2 rounded-full" style={{ width: "0.5%" }} />
                            </div>
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Quick Actions</h2>
                        <p className="text-sm text-tertiary">Revenue management tools</p>
                    </header>
                    
                    <div className="space-y-3">
                        <Button color="secondary" size="md" href="/dashboard/transactions" className="w-full">
                            View All Transactions
                        </Button>
                        <Button color="secondary" size="md" href="/dashboard/subscriptions" className="w-full">
                            Manage Subscriptions
                        </Button>
                        <Button color="secondary" size="md" className="w-full">
                            Generate Financial Report
                        </Button>
                        <Button color="secondary" size="md" className="w-full">
                            Export Revenue Data
                        </Button>
                    </div>

                    <div className="mt-6 rounded-xl border border-secondary bg-secondary p-4">
                        <p className="text-xs uppercase tracking-wide text-quaternary mb-2">Total Refunds</p>
                        <p className="text-2xl font-semibold text-primary">
                            ${(stats as any)?.totalRefunds?.toLocaleString() || "0"}
                        </p>
                        <p className="text-xs text-tertiary mt-1">
                            {(stats as any)?.refundedTransactions || 0} refunded transactions
                        </p>
                    </div>
                </article>
            </section>
        </div>
    );
}
