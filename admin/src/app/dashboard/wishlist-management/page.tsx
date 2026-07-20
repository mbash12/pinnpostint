"use client";

import { useState } from "react";
import { Heart, SearchLg, TrendUp01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Avatar } from "@/components/base/avatar/avatar";
import { ImagePlaceholder } from "@/components/base/image-placeholder";
import { DataTable, type Column } from "@/components/application/data-table";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { formatCurrency } from "@/utils/currency";

type WishlistByAd = {
    adId: string;
    adTitle: string;
    adImage: string | null;
    adPrice: number;
    wishlistCount: number;
    category: string;
    addedThisWeek: number;
};

type WishlistByUser = {
    userId: string;
    userName: string;
    userAvatar: string | null;
    wishlistCount: number;
    lastActivity: string;
    joinedDate: string;
};

export default function WishlistManagementPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"by-ad" | "by-user">("by-ad");

    const wishlistsByAd: WishlistByAd[] = [
        { adId: "ad-1", adTitle: "Luxury Apartment in Downtown", adImage: null, adPrice: 2500, wishlistCount: 45, category: "Real Estate", addedThisWeek: 12 },
        { adId: "ad-2", adTitle: "Used Car - Honda Civic 2020", adImage: null, adPrice: 15000, wishlistCount: 32, category: "Vehicles", addedThisWeek: 8 },
        { adId: "ad-3", adTitle: "iPhone 13 Pro Max", adImage: null, adPrice: 899, wishlistCount: 28, category: "Electronics", addedThisWeek: 15 },
    ];

    const wishlistsByUser: WishlistByUser[] = [
        { userId: "user-1", userName: "John Doe", userAvatar: null, wishlistCount: 8, lastActivity: "2 hours ago", joinedDate: "2025-01-15" },
        { userId: "user-2", userName: "Jane Smith", userAvatar: null, wishlistCount: 12, lastActivity: "1 day ago", joinedDate: "2025-02-20" },
        { userId: "user-3", userName: "Mike Johnson", userAvatar: null, wishlistCount: 5, lastActivity: "3 days ago", joinedDate: "2025-03-10" },
    ];

    const adColumns: Column<WishlistByAd>[] = [
        {
            key: "ad",
            label: "Advertisement",
            render: (item) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                        {item.adImage ? <Avatar size="sm" src={getProxiedImageUrl(item.adImage)} alt={item.adTitle} /> : <ImagePlaceholder size="sm" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{item.adTitle}</span>
                        <span className="text-xs text-tertiary">{item.category}</span>
                    </div>
                </div>
            ),
        },
        { key: "price", label: "Price", render: (item) => <span className="font-medium">{formatCurrency(item.adPrice)}</span> },
        {
            key: "count",
            label: "Wishlists",
            render: (item) => (
                <div className="flex items-center gap-2">
                    <Heart className="size-4 text-error-primary" />
                    <span className="font-semibold">{item.wishlistCount}</span>
                </div>
            ),
        },
        {
            key: "trend",
            label: "This Week",
            render: (item) => (
                <div className="flex items-center gap-1 text-success-primary">
                    <TrendUp01 className="size-4" />
                    <span className="text-sm font-medium">+{item.addedThisWeek}</span>
                </div>
            ),
        },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (item) => <Button color="secondary" size="sm" href={`/dashboard/ad-management/ads/${item.adId}`}>View Ad</Button> },
    ];

    const userColumns: Column<WishlistByUser>[] = [
        {
            key: "user",
            label: "User",
            render: (item) => (
                <div className="flex items-center gap-3">
                    <Avatar size="sm" src={item.userAvatar ? getProxiedImageUrl(item.userAvatar) : undefined} alt={item.userName} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-primary">{item.userName}</span>
                        <span className="text-xs text-tertiary">{item.userId}</span>
                    </div>
                </div>
            ),
        },
        { key: "count", label: "Wishlist Items", render: (item) => <span className="font-semibold">{item.wishlistCount}</span> },
        { key: "activity", label: "Last Activity", render: (item) => <span className="text-tertiary">{item.lastActivity}</span> },
        { key: "joined", label: "Joined", render: (item) => <span className="text-tertiary">{new Date(item.joinedDate).toLocaleDateString()}</span> },
        { key: "actions", label: "Actions", className: "px-4 py-3 text-right", render: (item) => <Button color="secondary" size="sm" href={`/dashboard/user-management/users/${item.userId}`}>View User</Button> },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Management</p>
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Wishlist Management</h1>
                </div>
            </header>

            <section className="rounded-2xl border border-secondary bg-primary p-6 shadow-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                        <Button color={viewMode === "by-ad" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("by-ad")}>By Advertisement</Button>
                        <Button color={viewMode === "by-user" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("by-user")}>By User</Button>
                    </div>
                    <Input placeholder="Search..." icon={SearchLg} iconClassName="size-5" className="max-w-md" value={searchTerm} onChange={setSearchTerm} />
                </div>

                {viewMode === "by-ad" ? (
                    <DataTable columns={adColumns} data={wishlistsByAd} keyExtractor={(item) => item.adId} emptyTitle="No wishlist data" emptyDescription="No ads have been added to wishlists yet." itemName="ads" />
                ) : (
                    <DataTable columns={userColumns} data={wishlistsByUser} keyExtractor={(item) => item.userId} emptyTitle="No wishlist data" emptyDescription="No users have created wishlists yet." itemName="users" />
                )}
            </section>
        </div>
    );
}
