# Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all pages use a consistent layout pattern via an expanded PageLayout, shared constants, and standardized responsive detection — without changing the UI.

**Architecture:** Expand the existing `PageLayout` component to handle header offset, desktop side-banner layout, footer injection, and scroll behavior. Create `DesktopContentWrapper` and `AuthScreenLayout` as supporting components. Migrate all 35+ screens to use these shared components. Standardize on `useResponsive()` hook everywhere.

**Tech Stack:** React Native, Expo Router, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-30-layout-refactor-design.md`

---

## File Structure

### New Files
- `constants/layout.ts` — Shared layout constants (HEADER_HEIGHT, STANDARD_PADDING, etc.)
- `components/desktop-content-wrapper.tsx` — Desktop side-banner + max-width wrapper
- `components/auth-screen-layout.tsx` — Shared auth screen layout (mobile + desktop)

### Modified Files
- `components/page-layout.tsx` — Expanded with header offset, desktop wrapper, FlatList support
- `app/(tabs)/_layout.tsx` — Switch to useResponsive()
- `app/(pages)/_layout.tsx` — Switch to useResponsive()
- `app/(tabs)/index.tsx` — Migrate to PageLayout
- `app/(tabs)/browse.tsx` — Migrate to PageLayout
- `app/(tabs)/my-ads.tsx` — Migrate to PageLayout
- `app/(tabs)/blog.tsx` — Migrate to PageLayout
- `app/(tabs)/profile.tsx` — Migrate to PageLayout (noDesktopWrapper)
- `app/(pages)/notifications.tsx` — Migrate to PageLayout (flatList)
- `app/(pages)/my-favorites.tsx` — Migrate to PageLayout (flatList)
- `app/(pages)/my-bookings.tsx` — Migrate to PageLayout (flatList)
- `app/(pages)/search-results.tsx` — Migrate to PageLayout (flatList), fix paddingTop
- `app/(pages)/all-categories.tsx` — Migrate to PageLayout, fix paddingTop
- `app/(pages)/settings.tsx` — Migrate to PageLayout (noDesktopWrapper)
- `app/(pages)/update-profile.tsx` — Migrate to PageLayout (noDesktopWrapper)
- `app/(pages)/help-support.tsx` — Migrate to PageLayout (noDesktopWrapper)
- `app/(pages)/change-password.tsx` — Migrate to PageLayout (noDesktopWrapper)
- `app/(pages)/booking.tsx` — Migrate to PageLayout
- `app/(pages)/booking-detail.tsx` — Migrate to PageLayout
- `app/(pages)/payment.tsx` — Migrate to PageLayout
- `app/(pages)/chat.tsx` — Migrate to PageLayout (noHeaderOffset, noFooter)
- `app/(pages)/detail/[slug].tsx` — Migrate to PageLayout (noHeaderOffset)
- `app/(pages)/blog/[slug].tsx` — Migrate to PageLayout
- `app/(pages)/user/[id].tsx` — Migrate to PageLayout
- `app/(pages)/ad-bookings.tsx` — Migrate to PageLayout
- `app/(pages)/ad-stats/[slug].tsx` — Migrate to PageLayout
- `app/(pages)/ad-booking-detail.tsx` — Migrate to PageLayout
- `app/(pages)/edit-ad/[slug].tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/index.tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/select-category.tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/select-subcategory.tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/ad-form.tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/preview.tsx` — Migrate to PageLayout
- `app/(pages)/create-ad/payment-success.tsx` — Migrate to PageLayout
- `app/(auth)/login.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/register.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/forgot-password.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/verify-otp.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/verify-register-otp.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/set-new-password.tsx` — Migrate to AuthScreenLayout
- `app/(auth)/complete-profile.tsx` — Migrate to AuthScreenLayout

---

## Task 1: Create Layout Constants

**Files:**
- Create: `constants/layout.ts`

- [ ] **Step 1: Create the constants file**

```ts
// constants/layout.ts
export const HEADER_HEIGHT = 90;
export const TAB_BAR_HEIGHT = 70;
export const STANDARD_PADDING = 16;
export const DESKTOP_MAX_WIDTH = 1000;
export const DESKTOP_SIDEBAR_BREAKPOINT = 1300;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit constants/layout.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add constants/layout.ts
git commit -m "feat: add shared layout constants"
```

---

## Task 2: Create DesktopContentWrapper

**Files:**
- Create: `components/desktop-content-wrapper.tsx`

- [ ] **Step 1: Create the component**

This extracts the desktop side-banner + max-width pattern that's currently duplicated in 7+ screens.

```tsx
// components/desktop-content-wrapper.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

import { SideBanners } from '@/components/home/side-banners';
import { platformAdsService } from '@/services';
import { DESKTOP_MAX_WIDTH, DESKTOP_SIDEBAR_BREAKPOINT } from '@/constants/layout';
import type { PlatformAd, PlatformAdPosition } from '@/types/api.types';

interface DesktopContentWrapperProps {
  children: React.ReactNode;
}

export function DesktopContentWrapper({ children }: DesktopContentWrapperProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    const handler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;
    return () => handler?.remove();
  }, []);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch {}
    };
    fetchAds();
  }, []);

  const isDesktop = Platform.OS === 'web' && screenWidth >= 1024;

  if (!isDesktop) {
    return <>{children}</>;
  }

  const showSideBanners = screenWidth >= DESKTOP_SIDEBAR_BREAKPOINT;
  const leftAds = platformAds.filter(ad => ad.position === 'LEFT');
  const rightAds = platformAds.filter(ad => ad.position === 'RIGHT');

  return (
    <View style={styles.desktopWrapper}>
      {showSideBanners && (
        <SideBanners ads={leftAds} position={'LEFT' as any} />
      )}
      <View style={styles.desktopMainContent}>
        {children}
      </View>
      {showSideBanners && (
        <SideBanners ads={rightAds} position={'RIGHT' as any} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit components/desktop-content-wrapper.tsx`
Expected: No errors (may have type warnings about PlatformAdPosition, adjust imports as needed)

- [ ] **Step 3: Commit**

```bash
git add components/desktop-content-wrapper.tsx
git commit -m "feat: extract DesktopContentWrapper from duplicated pattern"
```

---

## Task 3: Expand PageLayout

**Files:**
- Modify: `components/page-layout.tsx`

- [ ] **Step 1: Read current PageLayout and understand its API**

Current props: `children`, `scrollable`, `style`, `contentContainerStyle`, `showsVerticalScrollIndicator`, plus ScrollView passthrough props.

Current behavior: Wraps in ScrollView or View, auto-injects Footer.

- [ ] **Step 2: Rewrite PageLayout with expanded API**

```tsx
// components/page-layout.tsx
import React, { ReactNode } from 'react';
import {
  ScrollView,
  FlatList,
  StyleSheet,
  View,
  ViewStyle,
  ScrollViewProps,
} from 'react-native';

import { Footer } from '@/components/footer';
import { ThemedView } from '@/components/themed-view';
import { DesktopContentWrapper } from '@/components/desktop-content-wrapper';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

type PageLayoutProps = {
  children: ReactNode;
  scrollable?: boolean;
  noHeaderOffset?: boolean;
  noFooter?: boolean;
  noDesktopWrapper?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
  // FlatList mode
  flatList?: boolean;
  flatListProps?: any;
  // RefreshControl
  refreshing?: boolean;
  onRefresh?: () => void;
} & Omit<ScrollViewProps, 'children' | 'style' | 'contentContainerStyle'>;

export function PageLayout({
  children,
  scrollable = true,
  noHeaderOffset = false,
  noFooter = false,
  noDesktopWrapper = false,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  flatList = false,
  flatListProps,
  refreshing,
  onRefresh,
  ...scrollViewProps
}: PageLayoutProps) {
  const { isDesktop } = useResponsive();

  const headerOffset = !isDesktop && !noHeaderOffset ? HEADER_HEIGHT : 0;

  const content = noDesktopWrapper ? (
    <View style={styles.content}>
      {children}
    </View>
  ) : (
    <DesktopContentWrapper>
      <View style={styles.content}>
        {children}
      </View>
    </DesktopContentWrapper>
  );

  const footer = !noFooter ? <Footer /> : null;

  // FlatList mode
  if (flatList && flatListProps) {
    return (
      <ThemedView style={[styles.container, style]}>
        <FlatList
          {...flatListProps}
          contentContainerStyle={[
            { paddingTop: headerOffset },
            flatListProps.contentContainerStyle,
          ]}
          ListFooterComponent={
            <>
              {flatListProps.ListFooterComponent}
              {footer}
            </>
          }
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </ThemedView>
    );
  }

  // Scrollable mode
  if (scrollable) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={[
            { paddingTop: headerOffset },
            contentContainerStyle,
          ]}
          refreshControl={
            refreshing !== undefined && onRefresh
              ? undefined // Let screens provide their own RefreshControl
              : undefined
          }
          {...scrollViewProps}
        >
          {content}
          {footer}
        </ScrollView>
      </ThemedView>
    );
  }

  // Non-scrollable mode
  return (
    <ThemedView style={[styles.container, style, { paddingTop: headerOffset }]}>
      {content}
      {footer}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit components/page-layout.tsx`
Expected: No errors

- [ ] **Step 4: Verify existing legal pages still work**

The legal pages (terms, privacy, account-deletion) already use PageLayout. Verify they still compile:
Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/page-layout.tsx
git commit -m "feat: expand PageLayout with header offset, desktop wrapper, FlatList support"
```

---

## Task 4: Create AuthScreenLayout

**Files:**
- Create: `components/auth-screen-layout.tsx`

- [ ] **Step 1: Create the component**

Extracts the shared auth screen pattern. On mobile: background pattern + ScrollView + logo header + title/subtitle + form card. On desktop: delegates to DesktopAuthLayout.

```tsx
// components/auth-screen-layout.tsx
import React from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DesktopAuthLayout } from '@/components/desktop-auth-layout';
import { useResponsive } from '@/hooks/use-responsive';
import { Colors, WebShadows } from '@/constants/theme';

interface AuthScreenLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  footerContent?: React.ReactNode;
}

export function AuthScreenLayout({
  children,
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  footerContent,
}: AuthScreenLayoutProps) {
  const router = useRouter();
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return (
      <DesktopAuthLayout
        title={title}
        subtitle={subtitle}
        showBackButton={showBackButton}
        onBackPress={onBackPress}
        footerContent={footerContent}
      >
        {children}
      </DesktopAuthLayout>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.backgroundPattern} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
        </View>
        <View style={styles.formCard}>
          {children}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: WebShadows.subtle,
    elevation: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    boxShadow: WebShadows.subtle,
    elevation: 2,
  },
  logo: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    fontWeight: '400',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    boxShadow: WebShadows.medium,
    elevation: 2,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit components/auth-screen-layout.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/auth-screen-layout.tsx
git commit -m "feat: create AuthScreenLayout for shared auth screen pattern"
```

---

## Task 5: Update Route Group Layouts to useResponsive()

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(pages)/_layout.tsx`

- [ ] **Step 1: Update (tabs)/_layout.tsx**

Replace the inline `Dimensions` listener with `useResponsive()`. Change `isDesktop` from `> 768` to the hook's value (≥1024).

In `app/(tabs)/_layout.tsx`:
- Remove: `const [screenWidth, setScreenWidth] = React.useState(Dimensions.get('window').width);`
- Remove the `useEffect` with `Dimensions.addEventListener`
- Remove: `const isDesktop = Platform.OS === 'web' && screenWidth > 768;`
- Add import: `import { useResponsive } from '@/hooks/use-responsive';`
- Add: `const { isDesktop, screenWidth } = useResponsive();`
- Keep all other logic unchanged

- [ ] **Step 2: Update (pages)/_layout.tsx**

Same changes as above:
- Remove: `const [screenWidth, setScreenWidth] = React.useState(Dimensions.get('window').width);`
- Remove the `useEffect` with `Dimensions.addEventListener`
- Remove: `const isDesktop = Platform.OS === 'web' && screenWidth > 768;`
- Add import: `import { useResponsive } from '@/hooks/use-responsive';`
- Add: `const { isDesktop, screenWidth } = useResponsive();`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/\(pages\)/_layout.tsx
git commit -m "refactor: route group layouts use useResponsive() hook"
```

---

## Task 6: Migrate Tabs Screens

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/browse.tsx`
- Modify: `app/(tabs)/my-ads.tsx`
- Modify: `app/(tabs)/blog.tsx`
- Modify: `app/(tabs)/profile.tsx`

### Migration Pattern for Tabs Screens

Each tabs screen follows the same migration pattern:

1. **Remove** inline `Dimensions` listener (if present) and `useWindowDimensions` import
2. **Ensure** `useResponsive` is imported
3. **Remove** manual `paddingTop` / header spacer views
4. **Remove** manual `<Footer />` import and usage
5. **Remove** manual desktop wrapper (desktopHomeWrapper + SideBanners pattern)
6. **Remove** `ResponsiveWrapper` import (if present)
7. **Wrap** content in `<PageLayout>` with appropriate props
8. **Replace** magic numbers with constants from `constants/layout.ts`

- [ ] **Step 1: Migrate index.tsx (Home)**

Current: Manual ScrollView, paddingTop:80 (mobileTopPadding), manual Footer, inline desktop wrapper with SideBanners.

Changes:
- Add import: `import { PageLayout } from '@/components/page-layout';`
- Remove import: `Footer`, `SideBanners`, `Dimensions` (if only used for screenWidth)
- Remove: `mobileTopPadding` style and the View that applies it
- Remove: `desktopHomeWrapper` / `desktopMainContent` styles and wrapping Views
- Remove: Manual Footer at bottom of ScrollView
- Wrap entire return content in `<PageLayout>...</PageLayout>`
- Keep: `useResponsive()` (already imported), RefreshControl, all business logic

The return becomes:
```tsx
<PageLayout refreshing={isRefreshing} onRefresh={handleRefresh}>
  {/* all existing content, minus the mobile padding View, desktop wrapper, and Footer */}
</PageLayout>
```

- [ ] **Step 2: Migrate browse.tsx**

Current: Manual ScrollView, height:85 spacer (mobileHeaderSpacer), manual Footer, inline desktop wrapper.

Same pattern as index.tsx — wrap in `<PageLayout>`, remove manual spacing and Footer.

- [ ] **Step 3: Migrate my-ads.tsx**

Current: Manual Dimensions listener, inline desktop wrapper, manual Footer.

Changes:
- Remove Dimensions listener and `isDesktop` inline calculation
- Add/keep `useResponsive` import
- Remove desktop wrapper pattern
- Remove manual Footer
- Wrap in `<PageLayout>`

- [ ] **Step 4: Migrate blog.tsx**

Current: Manual ScrollView, paddingTop:90, manual Footer, inline desktop wrapper.

Same pattern — wrap in `<PageLayout>`, remove manual padding and Footer.

- [ ] **Step 5: Migrate profile.tsx**

Current: Manual ScrollView, paddingTop:90, manual Footer, maxWidth:1200 on desktop.

This screen uses `DesktopProfileLayout` on desktop, so:
```tsx
<PageLayout noDesktopWrapper>
  <DesktopProfileLayout>
    {/* existing content */}
  </DesktopProfileLayout>
</PageLayout>
```

Remove manual paddingTop and Footer. Fix desktop maxWidth from 1200 to 1000 (via PageLayout default).

- [ ] **Step 6: Verify all tabs screens compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/
git commit -m "refactor: migrate tabs screens to use PageLayout"
```

---

## Task 7: Migrate Pages Screens (ScrollView Pattern)

**Files:**
- Modify: `app/(pages)/all-categories.tsx`
- Modify: `app/(pages)/settings.tsx`
- Modify: `app/(pages)/update-profile.tsx`
- Modify: `app/(pages)/help-support.tsx`
- Modify: `app/(pages)/change-password.tsx`
- Modify: `app/(pages)/booking.tsx`
- Modify: `app/(pages)/booking-detail.tsx`
- Modify: `app/(pages)/payment.tsx`
- Modify: `app/(pages)/chat.tsx`
- Modify: `app/(pages)/blog/[slug].tsx`
- Modify: `app/(pages)/user/[id].tsx`
- Modify: `app/(pages)/ad-bookings.tsx`
- Modify: `app/(pages)/ad-stats/[slug].tsx`
- Modify: `app/(pages)/ad-booking-detail.tsx`
- Modify: `app/(pages)/edit-ad/[slug].tsx`
- Modify: `app/(pages)/create-ad/index.tsx`
- Modify: `app/(pages)/create-ad/select-category.tsx`
- Modify: `app/(pages)/create-ad/select-subcategory.tsx`
- Modify: `app/(pages)/create-ad/ad-form.tsx`
- Modify: `app/(pages)/create-ad/preview.tsx`
- Modify: `app/(pages)/create-ad/payment-success.tsx`

### Screen-by-Screen Notes

**all-categories.tsx:** Currently paddingTop:100 (fix to HEADER_HEIGHT via PageLayout). Has inline desktop wrapper — remove it, use PageLayout's built-in wrapper.

**settings.tsx, update-profile.tsx, help-support.tsx, change-password.tsx:** These use `DesktopProfileLayout`. Wrap in `<PageLayout noDesktopWrapper>` + keep `<DesktopProfileLayout>` inside.

**booking.tsx, booking-detail.tsx, payment.tsx:** Have inline Dimensions listener + desktop wrapper + ResponsiveWrapper. Remove all of that, wrap in `<PageLayout>`.

**chat.tsx:** Custom layout, likely no footer needed. `<PageLayout noHeaderOffset noFooter>`.

**detail/[slug].tsx:** Custom layout per ad type, manages own header offset. `<PageLayout noHeaderOffset>`.

**blog/[slug].tsx:** Standard scrollable page. `<PageLayout>`.

**create-ad/* pages:** Investigate each one's current pattern during implementation. Most should be `<PageLayout>`.

**All screens:** Remove `ResponsiveWrapper` import if present. Remove `Dimensions` listener if present. Remove `useWindowDimensions` import if present. Remove manual Footer. Remove manual paddingTop/offset.

- [ ] **Step 1: Migrate all-categories.tsx**

Read the file, remove inline desktop wrapper and manual paddingTop, wrap in `<PageLayout>`.

- [ ] **Step 2: Migrate settings.tsx, update-profile.tsx, help-support.tsx, change-password.tsx**

For each: Read file, remove useWindowDimensions, remove manual paddingTop, remove manual Footer (for mobile), wrap in `<PageLayout noDesktopWrapper>`.

These screens currently render `{!isDesktop && <Footer />}` inside DesktopProfileLayout's mobile passthrough. With PageLayout handling Footer, remove the inline one. But DesktopProfileLayout already provides Footer on desktop. So use `noFooter` on PageLayout and keep DesktopProfileLayout's Footer behavior? 

**Decision:** Use `<PageLayout noDesktopWrapper noFooter>` for these screens. DesktopProfileLayout already handles Footer on desktop. On mobile, DesktopProfileLayout returns a plain View — so we need PageLayout to provide Footer on mobile. But DesktopProfileLayout doesn't provide Footer on mobile...

**Resolution:** Don't use `noFooter`. Let PageLayout provide Footer on both mobile and desktop. DesktopProfileLayout will provide a second Footer on desktop — but that's fine because PageLayout's Footer will be outside DesktopProfileLayout's ScrollView, so only DesktopProfileLayout's Footer (inside its scroll) will be visible on desktop.

Actually, this is getting complicated. Let me re-think.

**Better approach:** For screens using DesktopProfileLayout:
```tsx
<PageLayout noDesktopWrapper noFooter>
  <DesktopProfileLayout>
    {content}
  </DesktopProfileLayout>
</PageLayout>
```

DesktopProfileLayout already provides Footer on desktop (inside its ScrollView). On mobile, DesktopProfileLayout returns a plain View with no Footer. So we need PageLayout to provide Footer on mobile only.

**Updated approach:** Create a new prop or handle this in PageLayout. Actually, the simplest approach: let PageLayout provide Footer always, and remove Footer from DesktopProfileLayout. But that changes DesktopProfileLayout's behavior for all consumers.

**Simplest approach that works:** For screens using DesktopProfileLayout, don't wrap in PageLayout at all for the Footer. Just use PageLayout for the header offset and let DesktopProfileLayout handle everything else. But then we're not using PageLayout consistently...

**Final approach:** Wrap in `<PageLayout noDesktopWrapper>`. On mobile, PageLayout provides paddingTop + Footer. On desktop, PageLayout provides Footer. DesktopProfileLayout also provides Footer on desktop — double Footer. To fix: remove Footer from DesktopProfileLayout and let PageLayout handle it always.

This means we also modify `components/desktop-profile-layout.tsx` to remove its Footer, and the screens wrapped in it use `<PageLayout noDesktopWrapper>`.

- [ ] **Step 2 (revised): Modify DesktopProfileLayout to remove Footer**

Remove the `<Footer />` import and usage from `components/desktop-profile-layout.tsx`. PageLayout will handle Footer for all screens.

- [ ] **Step 3: Migrate settings.tsx, update-profile.tsx, help-support.tsx, change-password.tsx**

Wrap in `<PageLayout noDesktopWrapper>`. Remove manual Footer, paddingTop, useWindowDimensions.

- [ ] **Step 4: Migrate booking.tsx, booking-detail.tsx, payment.tsx**

Remove Dimensions listener, ResponsiveWrapper, desktop wrapper, manual Footer. Wrap in `<PageLayout>`.

- [ ] **Step 5: Migrate chat.tsx**

Wrap in `<PageLayout noHeaderOffset noFooter>`. Remove useWindowDimensions.

- [ ] **Step 6: Migrate detail/[slug].tsx**

Read file to understand current pattern. Wrap in `<PageLayout noHeaderOffset>`.

- [ ] **Step 7: Migrate blog/[slug].tsx**

Wrap in `<PageLayout>`. Remove useWindowDimensions.

- [ ] **Step 8: Migrate remaining pages screens**

For each of: user/[id].tsx, ad-bookings.tsx, ad-stats/[slug].tsx, ad-booking-detail.tsx, edit-ad/[slug].tsx, create-ad/index.tsx, create-ad/select-category.tsx, create-ad/select-subcategory.tsx, create-ad/ad-form.tsx, create-ad/preview.tsx, create-ad/payment-success.tsx

Read each file, identify current pattern, wrap in `<PageLayout>` with appropriate props, remove manual layout code.

- [ ] **Step 9: Verify all pages screens compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add app/\(pages\)/
git commit -m "refactor: migrate pages screens to use PageLayout"
```

---

## Task 8: Migrate Pages Screens (FlatList Pattern)

**Files:**
- Modify: `app/(pages)/notifications.tsx`
- Modify: `app/(pages)/my-favorites.tsx`
- Modify: `app/(pages)/my-bookings.tsx`
- Modify: `app/(pages)/search-results.tsx`

### FlatList Migration Pattern

These screens use FlatList. They need the `flatList` prop on PageLayout.

- [ ] **Step 1: Migrate notifications.tsx**

Current: useWindowDimensions, paddingTop:90, FlatList, manual Footer.

Read the file to find the FlatList props (data, renderItem, keyExtractor, etc.).

Wrap in:
```tsx
<PageLayout
  flatList
  flatListProps={{
    data: notifications,
    renderItem: renderNotification,
    keyExtractor: (item) => item.id.toString(),
    // ... other FlatList props
  }}
  refreshing={isRefreshing}
  onRefresh={handleRefresh}
/>
```

Remove: useWindowDimensions, manual paddingTop, manual Footer.

- [ ] **Step 2: Migrate my-favorites.tsx**

Current: useResponsive, paddingTop:90, FlatList, paddingHorizontal:8.

Wrap in `<PageLayout flatList flatListProps={{...}}>`. Fix paddingHorizontal from 8 to STANDARD_PADDING (16) via contentContainerStyle.

- [ ] **Step 3: Migrate my-bookings.tsx**

Current: useResponsive, paddingTop:90, FlatList.

Wrap in `<PageLayout flatList flatListProps={{...}}>`.

- [ ] **Step 4: Migrate search-results.tsx**

Current: paddingTop:60 (WRONG — should be 90), FlatList, manual desktop wrapper.

Wrap in `<PageLayout flatList flatListProps={{...}}>`. Fix paddingTop via PageLayout's HEADER_HEIGHT. Remove desktop wrapper. Fix padding from 20 to STANDARD_PADDING.

- [ ] **Step 5: Verify all FlatList screens compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/\(pages\)/
git commit -m "refactor: migrate FlatList pages screens to use PageLayout"
```

---

## Task 9: Migrate Auth Screens

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/register.tsx`
- Modify: `app/(auth)/forgot-password.tsx`
- Modify: `app/(auth)/verify-otp.tsx`
- Modify: `app/(auth)/verify-register-otp.tsx`
- Modify: `app/(auth)/set-new-password.tsx`
- Modify: `app/(auth)/complete-profile.tsx`

### Auth Screen Migration Pattern

- [ ] **Step 1: Migrate login.tsx**

Current: Already uses useResponsive() + DesktopAuthLayout. Has separate mobileView and desktopView JSX.

Replace with:
```tsx
export default function LoginScreen() {
  const router = useRouter();

  const handleLoginSuccess = () => {
    router.replace('/(tabs)' as any);
  };

  return (
    <AuthScreenLayout
      title="Welcome Back"
      subtitle="Sign in with your phone number and password"
    >
      <LoginForm onSuccess={handleLoginSuccess} />
    </AuthScreenLayout>
  );
}
```

Remove: All mobile-specific styles (container, backgroundPattern, scrollView, header, logoContainer, logo, title, subtitle, formCard). Remove separate mobileView/desktopView variables. Remove useResponsive import. Remove DesktopAuthLayout import.

- [ ] **Step 2: Migrate register.tsx**

Current: Uses inline Dimensions listener. Has mobile-specific layout code.

Replace with `<AuthScreenLayout title="Create Account" subtitle="...">`. Remove Dimensions listener, mobile styles, DesktopAuthLayout usage.

- [ ] **Step 3: Migrate forgot-password.tsx**

Same pattern as register.

- [ ] **Step 4: Migrate verify-otp.tsx**

Same pattern. May have `showBackButton` and `onBackPress` props.

- [ ] **Step 5: Migrate verify-register-otp.tsx**

Same pattern.

- [ ] **Step 6: Migrate set-new-password.tsx**

Same pattern.

- [ ] **Step 7: Migrate complete-profile.tsx**

Same pattern.

- [ ] **Step 8: Verify all auth screens compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add app/\(auth\)/
git commit -m "refactor: migrate auth screens to use AuthScreenLayout"
```

---

## Task 10: Cleanup and Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Remove unused imports across all migrated files**

Search for leftover imports of:
- `Dimensions` (where only used for screenWidth)
- `Platform` (where only used for isDesktop check)
- `Footer` (in screens that now use PageLayout)
- `SideBanners` (in screens that now use DesktopContentWrapper via PageLayout)
- `ResponsiveWrapper` (in screens that had it)
- `useWindowDimensions` (replaced by useResponsive)
- `DesktopAuthLayout` (in auth screens that now use AuthScreenLayout)

Run: `grep -r "useWindowDimensions" app/ --include="*.tsx" -l`
Expected: No results (all migrated)

Run: `grep -r "ResponsiveWrapper" app/ --include="*.tsx" -l`
Expected: Only `app/_layout.tsx` (root level, which stays)

- [ ] **Step 2: Verify no magic numbers remain for layout**

Run: `grep -rn "paddingTop: [0-9]" app/ --include="*.tsx"`
Expected: No results for 60, 80, 85, 90, 100 in screen files (only in components like Header itself)

Run: `grep -rn "paddingHorizontal: [0-9]" app/ --include="*.tsx"`
Expected: All results should be 16 (STANDARD_PADDING) or contextual values in components

- [ ] **Step 3: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run tests if available**

Run: `npm test` or `npx jest`
Expected: All tests pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup unused imports and verify layout consistency"
```
