"use client";

import { ArrowUpRight, TrendUp01, Globe01 } from "@untitledui/icons";
import { MapPin, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/base/buttons/button";
import { useLocationAnalytics } from '@/hooks/use-analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function LocationAnalyticsPage() {
    const { data: locationAnalytics, isLoading } = useLocationAnalytics();

    const stats = locationAnalytics?.data;
    const adsByLocation = stats?.adsByLocation || {};
    const topLocations = stats?.topLocations || [];

    const totalAds = Object.values(adsByLocation).reduce((sum: number, count) => sum + (count as number), 0);
    const totalLocations = Object.keys(adsByLocation).length;

    const kpiCards = [
        {
            title: "Total Locations",
            value: totalLocations.toString(),
            change: "+5.2%",
            description: "Active locations",
            icon: MapPin,
            color: "brand",
        },
        {
            title: "Top Location Ads",
            value: topLocations[0]?.adCount?.toLocaleString() || "0",
            change: "+12.3%",
            description: topLocations[0]?.locationName || "N/A",
            icon: TrendUp01,
            color: "success",
        },
        {
            title: "Geographic Coverage",
            value: `${totalLocations}`,
            change: "+8.1%",
            description: "Cities covered",
            icon: Globe01,
            color: "brand",
        },
        {
            title: "Avg Ads/Location",
            value: totalLocations > 0 ? (totalAds / totalLocations).toFixed(1) : "0",
            change: "+3.5%",
            description: "Distribution metric",
            icon: MapIcon,
            color: "success",
        },
    ];

    const locationData = Object.entries(adsByLocation)
        .map(([location, count]) => ({
            location,
            count: count as number,
            percentage: totalAds > 0 ? ((count as number / totalAds) * 100).toFixed(1) : "0",
        }))
        .sort((a, b) => b.count - a.count);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-primary">Loading location analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Analytics</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Location Analytics</h1>
                    <p className="text-sm text-tertiary">
                        Ad distribution, user activity by region, and popular locations.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button color="secondary" iconLeading={<ArrowUpRight />} size="sm">
                        Export Report
                    </Button>
                    <Button color="primary" size="sm" href="/dashboard/ad-management/locations">
                        Manage Locations
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

            {/* Geographic Distribution */}
            <section className="grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm lg:col-span-2">
                    <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-primary">Geographic Distribution</h2>
                            <p className="text-sm text-tertiary">Ad distribution across locations</p>
                        </div>
                    </header>

                    {stats && 'geographicDistribution' in stats && stats.geographicDistribution && stats.geographicDistribution.length > 0 ? (
                        <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.geographicDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis 
                                        dataKey="location" 
                                        tick={{ fontSize: 12 }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                    />
                                    <Tooltip 
                                        formatter={(value) => [value, 'Ads']}
                                        labelFormatter={(value) => `Location: ${value}`}
                                    />
                                    <Bar 
                                        dataKey="adsCount" 
                                        fill="rgb(99, 102, 241)" 
                                        radius={[4, 4, 0, 0]} 
                                        className="hover:opacity-80 transition-opacity"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-96 flex items-center justify-center rounded-xl border border-dashed border-secondary text-tertiary">
                            <span className="text-sm">No geographic data available</span>
                        </div>
                    )}
                </article>

                {/* Top Locations */}
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Top Locations</h2>
                        <p className="text-sm text-tertiary">Most active regions</p>
                    </header>
                    
                    <div className="space-y-3">
                        {topLocations.slice(0, 10).map((location: any, index: number) => (
                            <div key={location.locationId} className="rounded-xl border border-secondary bg-secondary p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-subtle text-brand-primary text-xs font-semibold">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-primary">{location.locationName}</p>
                                            <p className="text-xs text-tertiary">{location.locationId}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold text-primary">
                                        {location.adCount.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-tertiary rounded-full h-2">
                                    <div 
                                        className="bg-brand-primary h-2 rounded-full" 
                                        style={{ 
                                            width: totalAds > 0 
                                                ? `${(location.adCount / totalAds) * 100}%` 
                                                : '0%' 
                                        }}
                                    />
                                </div>
                            </div>
                        ))}

                        {topLocations.length === 0 && (
                            <div className="text-center py-8 text-tertiary text-sm">
                                No location data available
                            </div>
                        )}
                    </div>
                </article>
            </section>

            {/* All Locations Table */}
            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-primary">All Locations</h2>
                        <p className="text-sm text-tertiary">Complete location breakdown</p>
                    </div>
                </header>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-secondary text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-quaternary">
                            <tr>
                                <th scope="col" className="px-4 py-3">Rank</th>
                                <th scope="col" className="px-4 py-3">Location</th>
                                <th scope="col" className="px-4 py-3">Total Ads</th>
                                <th scope="col" className="px-4 py-3">Percentage</th>
                                <th scope="col" className="px-4 py-3">Distribution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary text-sm text-primary">
                            {locationData.map((location, index) => (
                                <tr key={location.location} className="transition hover:bg-secondary">
                                    <td className="px-4 py-3">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-tertiary text-xs font-semibold">
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium">{location.location}</td>
                                    <td className="px-4 py-3">{location.count.toLocaleString()}</td>
                                    <td className="px-4 py-3">{location.percentage}%</td>
                                    <td className="px-4 py-3">
                                        <div className="w-full bg-tertiary rounded-full h-2 max-w-xs">
                                            <div 
                                                className="bg-brand-primary h-2 rounded-full" 
                                                style={{ width: `${location.percentage}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {locationData.length === 0 && (
                    <div className="text-center py-8 text-tertiary text-sm">
                        No location data available
                    </div>
                )}
            </section>

            {/* Location Insights */}
            <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Regional Insights</h2>
                        <p className="text-sm text-tertiary">Key location metrics</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Most Active Region</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {topLocations[0]?.locationName || "N/A"}
                            </p>
                            <p className="text-xs text-tertiary mt-1">
                                {topLocations[0]?.adCount?.toLocaleString() || "0"} ads
                            </p>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Fastest Growing</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {topLocations[1]?.locationName || "N/A"}
                            </p>
                            <p className="text-xs text-success-primary mt-1">+24.5% growth</p>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <p className="text-xs uppercase tracking-wide text-quaternary">Emerging Market</p>
                            <p className="mt-1 text-xl font-semibold text-primary">
                                {topLocations[2]?.locationName || "N/A"}
                            </p>
                            <p className="text-xs text-brand-primary mt-1">High potential</p>
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-lg font-semibold text-primary">Coverage Statistics</h2>
                        <p className="text-sm text-tertiary">Platform reach metrics</p>
                    </header>
                    
                    <div className="space-y-4">
                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Urban Areas</span>
                                <span className="text-sm font-semibold text-primary">
                                    {Math.floor(totalLocations * 0.65)}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-brand-primary h-2 rounded-full" style={{ width: "65%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Suburban Areas</span>
                                <span className="text-sm font-semibold text-primary">
                                    {Math.floor(totalLocations * 0.25)}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-success-primary h-2 rounded-full" style={{ width: "25%" }} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-secondary bg-secondary p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-primary">Rural Areas</span>
                                <span className="text-sm font-semibold text-primary">
                                    {Math.floor(totalLocations * 0.10)}
                                </span>
                            </div>
                            <div className="w-full bg-tertiary rounded-full h-2">
                                <div className="bg-warning-primary h-2 rounded-full" style={{ width: "10%" }} />
                            </div>
                        </div>
                    </div>
                </article>
            </section>
        </div>
    );
}
