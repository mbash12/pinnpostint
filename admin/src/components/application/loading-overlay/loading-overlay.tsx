"use client";

import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { useLoading } from "@/providers/loading-provider";
import { useEffect, useRef, useMemo } from "react";

export const LoadingOverlay = () => {
  const { isLoading } = useLoading();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Prevent scrolling when loading overlay is active
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isLoading]);

  if (!isLoading) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      ref={overlayRef}
    >
      <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-xl bg-primary shadow-xl">
        <LoadingIndicator type="line-spinner" size="lg" />
        <p className="text-lg font-medium text-primary">Processing...</p>
      </div>
    </div>
  );
};