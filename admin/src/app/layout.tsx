import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cx } from "@/utils/cx";
import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

// The admin dashboard always needs fresh data. Make fetch() default to
// no-store so Next.js does not keep responses in an unbounded in-memory
// cache in the long-running standalone server.
export const fetchCache = "default-no-store";

export const metadata: Metadata = {
    title: "Pin N Post — Admin Dashboard",
    description: "Admin dashboard for Pin N Post platform",
};

export const viewport: Viewport = {
    themeColor: "#7f56d9",
    colorScheme: "light dark",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link 
                    rel="stylesheet" 
                    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
                    integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
                    crossOrigin=""
                />
            </head>
            <body className={cx(inter.variable, "bg-primary antialiased")}>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
