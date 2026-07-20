/**
 * Light-only theme with red gradient colors
 */

import { Platform } from 'react-native';

// Red gradient theme colors
const primaryStart = '#660B0A';
const primaryEnd = '#CC1614';
const primaryColor = '#CC1614';
const lightAccent = '#FF6B6B';
const darkAccent = '#660B0A';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    card: '#FFFFFF',  // Added missing card property
    cardBackground: '#FFFFFF',
    tint: primaryColor,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryColor,
    // Gradient colors
    gradientStart: primaryStart,
    gradientEnd: primaryEnd,
    primary: primaryColor,
    accent: lightAccent,
    darkAccent: darkAccent,
    // Additional colors
    border: '#E5E5E5',
    backgroundSecondary: 'rgba(204, 22, 20, 0.1)',
    textSecondary: '#687076',
    primaryLight: 'rgba(204, 22, 20, 0.15)',
    // Status colors
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    // Additional properties that may be needed
    error: '#EF4444',
    errorBackground: 'rgba(239, 68, 68, 0.1)',
    successBackground: 'rgba(16, 185, 129, 0.1)',
    warningBackground: 'rgba(245, 158, 11, 0.1)',
    info: '#3B82F6',
    infoBackground: 'rgba(59, 130, 246, 0.1)',
    gray: '#6B7280',
    lightGray: '#F3F4F6',
    darkGray: '#374151',
    placeholder: '#9CA3AF',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Courier',
  },
  android: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

// Soft shadow system for consistent, gentle shadows
// Android elevation values are kept low (1-2) to avoid harsh shadows
export const Shadows = {
  // React Native shadows
  subtle: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  soft: {
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  medium: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  prominent: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  // Colored shadows for primary elements
  primary: {
    shadowColor: 'rgba(204, 22, 20, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
};

// Web shadow utilities for CSS boxShadow
export const WebShadows = {
  subtle: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  soft: '0px 2px 6px rgba(0, 0, 0, 0.08)',
  medium: '0px 4px 8px rgba(0, 0, 0, 0.08)',
  prominent: '0px 6px 12px rgba(0, 0, 0, 0.1)',
  primary: '0px 2px 6px rgba(204, 22, 20, 0.08)',
};

// Tab bar spacing - content padding for pages with tab bar
// The tab bar is 70px tall, positioned 20px from bottom on iOS, 10px on Android/web
export const TabBar = {
  paddingBottom: Platform.OS === 'ios' ? 90 : 80,  // 70 (bar height) + spacing (20 iOS, 10 Android/web)
};
