"use client";

import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  showLoading: () => void;
  hideLoading: () => void;
  withLoading: <T,>(promise: Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Minimum time to show the loading overlay (prevents flashing)
const MIN_LOADING_DURATION = 500;
// Delay before showing the overlay (prevents flash for quick operations)
const SHOW_LOADING_DELAY = 100;

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const loadingCount = useRef<number>(0);
  const showLoadingTimeout = useRef<NodeJS.Timeout | null>(null);
  const hideLoadingTimeout = useRef<NodeJS.Timeout | null>(null);
  const loadingStartTime = useRef<number | null>(null);
  const isShowing = useRef<boolean>(false);

  const showLoading = () => {
    loadingCount.current++;
    
    // Clear any pending hide timeout
    if (hideLoadingTimeout.current) {
      clearTimeout(hideLoadingTimeout.current);
      hideLoadingTimeout.current = null;
    }
    
    // Only show if not already showing and no pending show
    if (!isShowing.current && !showLoadingTimeout.current) {
      showLoadingTimeout.current = setTimeout(() => {
        loadingStartTime.current = Date.now();
        setIsLoading(true);
        isShowing.current = true;
        showLoadingTimeout.current = null;
      }, SHOW_LOADING_DELAY);
    }
  };

  const hideLoading = () => {
    loadingCount.current = Math.max(0, loadingCount.current - 1);
    
    // Clear any pending show timeout
    if (showLoadingTimeout.current) {
      clearTimeout(showLoadingTimeout.current);
      showLoadingTimeout.current = null;
    }
    
    // Only hide if all operations are complete
    if (loadingCount.current > 0) {
      return;
    }
    
    // Ensure minimum display duration
    if (loadingStartTime.current && isShowing.current) {
      const elapsed = Date.now() - loadingStartTime.current;
      if (elapsed < MIN_LOADING_DURATION) {
        if (!hideLoadingTimeout.current) {
          hideLoadingTimeout.current = setTimeout(() => {
            setIsLoading(false);
            isShowing.current = false;
            loadingStartTime.current = null;
            hideLoadingTimeout.current = null;
          }, MIN_LOADING_DURATION - elapsed);
        }
        return;
      }
    }
    
    setIsLoading(false);
    isShowing.current = false;
    loadingStartTime.current = null;
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (showLoadingTimeout.current) {
        clearTimeout(showLoadingTimeout.current);
      }
      if (hideLoadingTimeout.current) {
        clearTimeout(hideLoadingTimeout.current);
      }
    };
  }, []);

  const withLoading = async <T,>(promise: Promise<T>): Promise<T> => {
    showLoading();
    try {
      const result = await promise;
      return result;
    } finally {
      hideLoading();
    }
  };

  const value: LoadingContextType = {
    isLoading,
    showLoading,
    hideLoading,
    withLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};