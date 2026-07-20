"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const publicRoutes = [
        '/login',
        '/forgot-password',
        '/verify-otp',
        '/set-new-password',
    ];

    const isPublicRoute = pathname ? publicRoutes.some((route) => pathname.startsWith(route)) : false;

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!isAuthenticated && !isPublicRoute) {
            router.replace('/login');
        }

        if (isAuthenticated && isPublicRoute) {
            router.replace('/dashboard');
        }

        // Handle root route specifically
        if (pathname === '/') {
            if (isAuthenticated) {
                router.replace('/dashboard');
            } else {
                router.replace('/login');
            }
        }
    }, [isAuthenticated, isLoading, isPublicRoute, router, pathname]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center">
                <div className="text-primary">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
        return null; // Will redirect via useEffect
    }

    if (isAuthenticated && isPublicRoute) {
        return null; // Avoid flashing public pages for authed users
    }

    if (pathname === '/') {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
