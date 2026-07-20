import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Uses admin/.env + admin/.env.local only (from ./pinn env:sync).
    // Do not use .env.development / .env.production.
    turbopack: {
        root: __dirname,
    },
    experimental: {
        optimizePackageImports: ["@untitledui/icons", "lucide-react", "recharts"],
        // Enable faster CSS bundling
        optimizeCss: true,
        // Bound how long page data is considered fresh in the standalone
        // server's in-memory caches. This helps prevent slow memory growth.
        staleTimes: {
            dynamic: 30,
            static: 180,
        },
    },

    // Enable standalone output for Docker deployment
    output: 'standalone',

    // Image optimization configuration
    images: {
        domains: ['localhost', 'ui-avatars.com'],
        unoptimized: process.env.NODE_ENV === 'development',
        // Enable modern image formats
        formats: ['image/webp', 'image/avif'],
    },

    // Production optimizations
    compiler: {
        // Remove console.log in production
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin',
                    },
                ],
            },
            {
                // Ensure service worker is served with correct content type
                source: '/firebase-messaging-sw.js',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/javascript; charset=utf-8',
                    },
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ];
    },

    // API health check endpoint
    async rewrites() {
        return [
            {
                source: '/api/health',
                destination: '/api/health',
            },
        ];
    },
};

export default nextConfig;
