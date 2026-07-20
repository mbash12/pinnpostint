import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { redirect } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { cx } from "@/utils/cx";
import "@/styles/globals.css";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export const metadata: Metadata = {
    title: "Pin Admin — Admin Dashboard",
    description: "Admin dashboard for Pin N Post platform",
};

export const viewport: Viewport = {
    themeColor: "#7f56d9",
    colorScheme: "light dark",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center">
                <div className="text-primary">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        redirect('/login');
    }

    return <>{children}</>;
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={cx(inter.variable, "bg-primary antialiased")}>
                <QueryClientProvider client={queryClient}>
                    <RouteProvider>
                        <AuthProvider>
                            <AuthGuard>
                                <Theme>{children}</Theme>
                            </AuthGuard>
                        </AuthProvider>
                    </RouteProvider>
                </QueryClientProvider>
            </body>
        </html>
    );
}
