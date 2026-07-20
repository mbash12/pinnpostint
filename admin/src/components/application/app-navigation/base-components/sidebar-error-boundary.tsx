'use client';

import React from 'react';
import { AlertTriangle } from '@untitledui/icons';

interface SidebarErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SidebarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  SidebarErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SidebarErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Sidebar navigation error: error, errorInfo
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <AlertTriangle className="size-12 text-red-500 mb-2" />
          <h3 className="text-lg font-semibold text-secondary mb-1">Navigation Error</h3>
          <p className="text-sm text-tertiary mb-3">
            Something went wrong with the sidebar navigation.
          </p>
          <button
            className="px-4 py-2 bg-primary_hover rounded-md text-sm font-medium"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            Reload Navigation
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SidebarErrorBoundary;