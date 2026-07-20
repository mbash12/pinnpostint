"use client";

import { ArrowUpRight, Heart, TrendUp01, Users01, Star03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { useWishlistAnalytics } from '@/hooks/use-analytics';
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function WishlistAnalyticsPage() {
    const { data: wishlistAnalytics, isLoading } = useWishlistAnalytics();

    const stats = wishlistAnalytics?.data;
    const mostWishlistedAds = stats?.mostWishlistedAds || [];

    const kpiCards = [
        {
            title: "Total Wishlists",
            value: stats?.totalWishlists?.toLocaleString() || "0",
            change: "+15.3%",
            description: "All wishlist items",
            icon: Heart,
            color: "error",
        },
        {
            title: "Avg Wishlist Size",
            value: stats?.averageWishlistSize?.toFixed(1) || "0",
            change: "+8.2%",
            description: "Items per user",
            icon: Star03,
            color: "brand",
        },
        {
            title: "Active Users",
            value: (stats as any)?.activeWishlistUsers?.toLocaleString() || "0",
            change: "+12.5%",
            description: "Users with wishlists",
            icon: Users01,
            color: "success",
        },
        {
            title: "Conversion Rate",
            value: (stats as any)?.conversionRate ? `${(stats as any).conversionRate.toFixed(1)}%` : "0%",
            change: "+3.8%",
            description: "Wishlist to booking",
            icon: TrendUp01,
            color: "success",
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading wishlist analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Analytics</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Wishlist Analytics</h1>
                    <p className="text-sm text-tertiary">
                        Most wishlisted ads, conversion rates, and user engagement patterns.
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

            {/* Wishlist Trends */}
            <section className="grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2">
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-primary">Wishlist Activity Trends</h2>
                            <p className="text-sm text-tertiary">Wishlist additions over time</p>
                        </div>
                    </header>

                    {stats && 'wishlistTrends' in stats && stats.wishlistTrends && stats.wishlistTrends.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.wishlistTrends}>
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
                                        formatter={(value) => [value, 'Wishlist Additions']}
                                        labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
                                    />
                                    <Bar 
                                        dataKey="additions" 
                                        fill="rgb(239, 68, 68)" 
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
                            <p className="text-xs uppercase tracking-wide text-quaternary">Daily Additions</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {(stats as any)?.dailyWishlistAdditions?.toLocaleString() || "0"}
                            </p>
                            <p className="text-success-primary">+12.3%</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Engagement Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {(stats as any)?.engagementRate ? `${(stats as any).engagementRate.toFixed(1)}%` : "0%"}
                            </p>
                            <p className="text-success-primary">+5.2%</p>
                        </div>
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Removal Rate</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {(stats as any)?.removalRate ? `${(stats as any).removalRate.toFixed(1)}%` : "0%"}
                            </p>
                            <p className="text-error-primary">+2.1%</p>
                        </div>
                    </div>
                </article>

                {/* User Engagement */}
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">User Engagement</h2>
                        <p className="text-sm text-tertiary">Wishlist usage patterns</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Active Users</span>
                                <span className="text-sm font-semibold text-primary">
                                    {stats?.activeWishlistUsers?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-success-primary h-2 rounded-full" style={{ width: "75%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Power Users</span>
                                <span className="text-sm font-semibold text-primary">
                                    {stats?.powerUsers?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-brand-primary h-2 rounded-full" style={{ width: "45%" }} />
                            </div>
                            <p className="text-xs text-tertiary mt-1">10+ items wishlisted</p>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">New Users</span>
                                <span className="text-sm font-semibold text-primary">
                                    {stats?.newWishlistUsers?.toLocaleString() || "0"}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-warning-primary h-2 rounded-full" style={{ width: "25%" }} />
                            </div>
                            <p className="text-xs text-tertiary mt-1">This week</p>
                        </div>
                    </div>
                </article>
            </section>

            {/* Most Wishlisted Ads */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">Most Wishlisted Ads</h2>
                        <p className="text-sm text-tertiary">Top ads saved by users</p>
                    </div>
                    <Button color="secondary" size="sm" href="/dashboard/ad-management/ads">
                        View All Ads
                    </Button>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Rank</th>
                                <th scope="col" className="px-4 py-3">Ad</th>
                                <th scope="col" className="px-4 py-3">Wishlist Count</th>
                                <th scope="col" className="px-4 py-3">Price</th>
                                <th scope="col" className="px-4 py-3">Category</th>
                                <th scope="col" className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {mostWishlistedAds.map((ad: any, index: number) => (
                                <tr key={ad.adId} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-subtle">
                                            <span className="text-sm font-semibold text-brand-primary">
                                                {index + 1}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                                {ad.adImage ? (
                                                    <Avatar size="sm" src={getProxiedImageUrl(ad.adImage)} alt={ad.adTitle} />
                                                ) : (
                                                    <ImagePlaceholder size="sm" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{ad.adTitle}</span>
                                                <span className="text-xs text-tertiary">{ad.adId}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Heart className="w-4 h-4 text-error-primary" />
                                            <span className="font-semibold">{ad.wishlistCount.toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        ${ad.adPrice?.toLocaleString() || "N/A"}
                                    </td>
                                    <td className="px-4 py-3 text-tertiary">{ad.category || "N/A"}</td>
                                    <td className="px-4 py-3">
                                        <Button 
                                            color="secondary" 
                                            size="sm" 
                                            href={`/dashboard/ad-management/ads/${ad.adId}`}
                                        >
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {mostWishlistedAds.length === 0 && (
                    <div className="text-center py-8 text-tertiary text-sm">
                        No wishlist data available
                    </div>
                )}
            </section>

            {/* Conversion & Insights */}
            <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Conversion Metrics</h2>
                        <p className="text-sm text-tertiary">Wishlist to action conversion</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Wishlist to Booking</p>
                            <p className="mt-1 text-2xl font-semibold text-primary">
                                {stats?.conversionRate ? `${stats.conversionRate.toFixed(1)}%` : "0%"}
                            </p>
                            <p className="text-xs text-success-primary mt-1">+3.8% from last month</p>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Wishlist to Contact</p>
                            <p className="mt-1 text-2xl font-semibold text-primary">
                                {stats?.contactRate ? `${stats.contactRate.toFixed(1)}%` : "12.5%"}
                            </p>
                            <p className="text-xs text-success-primary mt-1">+2.1% from last month</p>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Average Time to Action</p>
                            <p className="mt-1 text-2xl font-semibold text-primary">4.2 days</p>
                            <p className="text-xs text-tertiary mt-1">From wishlist to booking</p>
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Category Preferences</h2>
                        <p className="text-sm text-tertiary">Most wishlisted categories</p>
                    </header>
                    
                    <div className="space-y-3">
                        {stats?.topCategories?.slice(0, 5).map((category: any, index: number) => (
                            <div key={category.categoryName} className="rounded-xl border border-secondary bg-secondary p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-primary">{category.categoryName}</span>
                                    <span className="text-sm font-semibold text-primary">
                                        {category.count.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-tertiary rounded-full h-2">
                                    <div 
                                        className="bg-brand-primary h-2 rounded-full" 
                                        style={{ 
                                            width: stats?.totalWishlists 
                                                ? `${(category.count / stats.totalWishlists) * 100}%` 
                                                : '0%' 
                                        }}
                                    />
                                </div>
                            </div>
                        )) || (
                            <>
                                <div className="rounded-xl border border-secondary bg-secondary p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-primary">Real Estate</span>
                                        <span className="text-sm font-semibold text-primary">1,245</span>
                                    </div>
                                    <div className="w-full bg-tertiary rounded-full h-2">
                                        <div className="bg-brand-primary h-2 rounded-full" style={{ width: "45%" }} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-secondary bg-secondary p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-primary">Vehicles</span>
                                        <span className="text-sm font-semibold text-primary">892</span>
                                    </div>
                                    <div className="w-full bg-tertiary rounded-full h-2">
                                        <div className="bg-brand-primary h-2 rounded-full" style={{ width: "32%" }} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-secondary bg-secondary p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-primary">Electronics</span>
                                        <span className="text-sm font-semibold text-primary">654</span>
                                    </div>
                                    <div className="w-full bg-tertiary rounded-full h-2">
                                        <div className="bg-brand-primary h-2 rounded-full" style={{ width: "24%" }} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </article>
            </section>
        </div>
    );
}
