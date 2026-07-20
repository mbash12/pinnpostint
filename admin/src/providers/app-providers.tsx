"use client";

import { useState, useEffect } from "react";
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";
import { AuthProvider } from "@/providers/auth-provider";
import { AuthGuard } from "@/components/auth-guard";
import { LoadingProvider, useLoading } from "@/providers/loading-provider";
import { LoadingOverlay } from "@/components/application/loading-overlay/loading-overlay";
import { apiClient } from "@/lib/api-client";

// Wrapper component to connect loading context to API client
function LoadingConnector({ children }: PropsWithChildren) {
  const { showLoading, hideLoading } = useLoading();

  useEffect(() => {
    // Connect the API client to the loading context
    apiClient.setLoadingCallback((isLoading) => {
      if (isLoading) {
        showLoading();
      } else {
        hideLoading();
      }
    });
  }, [showLoading, hideLoading]);

  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
    const [queryClient] = useState<QueryClient>(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 0, // Data is always stale, fetch fresh data every time
                        gcTime: 0, // Don't cache any data in memory
                        retry: 1,
                        refetchOnWindowFocus: true, // Refetch when window regains focus
                        refetchOnMount: true, // Refetch when component mounts
                        refetchOnReconnect: true, // Refetch when reconnecting to network
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <RouteProvider>
                <AuthProvider>
                    <AuthGuard>
                        <LoadingProvider>
                            <LoadingConnector>
                                <Theme>
                                    {children}
                                    <LoadingOverlay />
                                </Theme>
                            </LoadingConnector>
                        </LoadingProvider>
                    </AuthGuard>
                </AuthProvider>
            </RouteProvider>
        </QueryClientProvider>
    );
}
