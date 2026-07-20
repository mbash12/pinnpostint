# Layout Refactor Design Spec

**Date:** 2026-05-30
**Goal:** Make all pages use a consistent layout pattern across mobile and desktop, without changing the UI (except fixing currently inconsistent values).

## Problem

The app has 35+ screens with no shared layout standard. Each screen manually handles:

- Header offset (5 different values: 60, 80, 85, 90, 100px)
- Responsive detection (3 different methods: inline `Dimensions`, `useResponsive()`, `useWindowDimensions()`)
- Desktop content wrapper (side-banner + max-width pattern copy-pasted in 7+ screens)
- Footer inclusion (sometimes manual, sometimes via PageLayout, sometimes missing)
- Horizontal padding (varies between 8, 16, and 20)

## Design Decisions

1. **Single responsive hook:** Standardize on `useResponsive()` everywhere. Remove all inline `Dimensions` listeners and `useWindowDimensions()` calls.
2. **Desktop breakpoint:** Use `>= 1024` (from `useResponsive()`). Tablets (768-1023px) get mobile layout consistently.
3. **New branch:** All work happens on a new branch. Single coordinated pass over all files.

## Constants

New file: `constants/layout.ts`

```ts
export const HEADER_HEIGHT = 90;
export const TAB_BAR_HEIGHT = 70;
export const STANDARD_PADDING = 16;
export const DESKTOP_MAX_WIDTH = 1000;
export const DESKTOP_SIDEBAR_BREAKPOINT = 1300;
```

All magic numbers in screens get replaced with these constants.

## Expanded PageLayout

File: `components/page-layout.tsx` (existing, expanded)

### Props

```ts
type PageLayoutProps = {
  children: ReactNode;
  scrollable?: boolean;           // default true — wraps in ScrollView
  noHeaderOffset?: boolean;       // skip automatic paddingTop on mobile (for auth, detail screens)
  noFooter?: boolean;             // opt out of auto Footer injection
  noDesktopWrapper?: boolean;     // opt out of side-banner + max-width layout (for screens using DesktopProfileLayout)
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  flatList?: boolean;             // use FlatList instead of ScrollView
  flatListProps?: Partial<FlatListProps<any>>;
  refreshing?: boolean;           // RefreshControl support
  onRefresh?: () => void;
  showsVerticalScrollIndicator?: boolean;
};
```

### Behavior

**Mobile:**
- Applies `paddingTop: HEADER_HEIGHT` (unless `noHeaderOffset`)
- Renders `ScrollView` or `FlatList` based on props
- Injects `<Footer />` at bottom (unless `noFooter`)
- If `flatList` mode, Footer goes in `ListFooterComponent`

**Desktop (≥1024px):**
- No header offset (DesktopHeader is static, not fixed)
- Wraps content in `DesktopContentWrapper` (unless `noDesktopWrapper`)
- Injects `<Footer />` at bottom

### Usage Examples

```tsx
// Simple scrollable page
<PageLayout>
  <MyContent />
</PageLayout>

// FlatList page (notifications, favorites, etc.)
<PageLayout flatList flatListProps={{ data, renderItem, keyExtractor }}
  refreshing={isRefreshing} onRefresh={handleRefresh}>
  {/* children ignored in flatList mode, uses flatListProps instead */}
</PageLayout>

// Page using DesktopProfileLayout
<PageLayout noDesktopWrapper>
  <DesktopProfileLayout>
    <MyContent />
  </DesktopProfileLayout>
</PageLayout>

// Auth screen — uses AuthScreenLayout, not PageLayout
<AuthScreenLayout title="Welcome back" subtitle="Sign in to continue">
  <LoginForm />
</AuthScreenLayout>
```

## DesktopContentWrapper

New file: `components/desktop-content-wrapper.tsx`

Extracts the pattern currently duplicated in 7+ screens:

```tsx
// Mobile: passthrough
<View>{children}</View>

// Desktop:
<View style={styles.desktopWrapper}>      // flexDirection: 'row', justifyContent: 'center'
  {screenWidth >= 1300 && <SideBanners position="LEFT" />}
  <View style={styles.desktopMainContent}> // maxWidth: 1000
    {children}
  </View>
  {screenWidth >= 1300 && <SideBanners position="RIGHT" />}
</View>
```

Used internally by PageLayout. Can also be used directly by screens that need custom scroll behavior.

## AuthScreenLayout

New file: `components/auth-screen-layout.tsx`

Extracts the shared auth screen pattern (duplicated across 7 screens):

```tsx
type AuthScreenLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
};
```

**Mobile:** Renders the background pattern + ScrollView + logo header + title/subtitle + form card structure.

**Desktop:** Delegates to existing `DesktopAuthLayout` (two-panel split).

Screens become:
```tsx
<AuthScreenLayout title="Welcome back" subtitle="Sign in to continue">
  {/* form fields */}
</AuthScreenLayout>
```

## Route Group Layout Changes

### `app/(tabs)/_layout.tsx`
- Replace inline `Dimensions` listener with `useResponsive()`
- `isDesktop` changes from `> 768` to `>= 1024`

### `app/(pages)/_layout.tsx`
- Replace inline `Dimensions` listener with `useResponsive()`
- `isDesktop` changes from `> 768` to `>= 1024`

### `app/(auth)/_layout.tsx`
- No changes needed (minimal layout, no responsive logic)

### `app/_layout.tsx`
- No changes needed (root providers, safe area handling)

## Screen Migration

### Tabs screens (5 screens)
| Screen | Current Pattern | Migration |
|--------|----------------|-----------|
| `index.tsx` (Home) | Manual ScrollView, paddingTop:80, manual Footer, inline desktop wrapper | `<PageLayout>` |
| `browse.tsx` | Manual ScrollView, height:85 spacer, manual Footer, inline desktop wrapper | `<PageLayout>` |
| `my-ads.tsx` | Manual Dimensions listener, inline desktop wrapper, manual Footer | `<PageLayout>` |
| `blog.tsx` | Manual ScrollView, paddingTop:90, manual Footer, inline desktop wrapper | `<PageLayout>` |
| `profile.tsx` | Manual ScrollView, paddingTop:90, manual Footer, maxWidth:1200 | `<PageLayout noDesktopWrapper>` (uses DesktopProfileLayout) |

### Pages screens (24 screens)
| Screen | Current Pattern | Migration |
|--------|----------------|-----------|
| `notifications.tsx` | useWindowDimensions, paddingTop:90, FlatList, manual Footer | `<PageLayout flatList>` |
| `my-favorites.tsx` | useResponsive, paddingTop:90, FlatList, paddingHorizontal:8 | `<PageLayout flatList>` |
| `my-bookings.tsx` | useResponsive, paddingTop:90, FlatList | `<PageLayout flatList>` |
| `search-results.tsx` | paddingTop:60 (WRONG), FlatList, manual desktop wrapper | `<PageLayout flatList>` |
| `all-categories.tsx` | paddingTop:100 (WRONG), manual desktop wrapper | `<PageLayout>` |
| `settings.tsx` | useWindowDimensions, paddingTop:90 | `<PageLayout noDesktopWrapper>` (uses DesktopProfileLayout) |
| `update-profile.tsx` | useWindowDimensions, paddingTop:90 | `<PageLayout noDesktopWrapper>` |
| `help-support.tsx` | useWindowDimensions, paddingTop:90 | `<PageLayout noDesktopWrapper>` |
| `change-password.tsx` | useWindowDimensions, paddingTop:90 | `<PageLayout noDesktopWrapper>` |
| `detail/[slug].tsx` | Custom layout per ad type | `<PageLayout noHeaderOffset>` (manages own offset) |
| `blog/[slug].tsx` | useWindowDimensions, custom layout | `<PageLayout>` |
| `booking.tsx` | Manual Dimensions listener | `<PageLayout>` |
| `booking-detail.tsx` | Manual Dimensions listener | `<PageLayout>` |
| `payment.tsx` | Manual Dimensions listener | `<PageLayout>` |
| `chat.tsx` | useWindowDimensions, custom layout | `<PageLayout noFooter noHeaderOffset>` |
| `user/[id].tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `ad-bookings.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `ad-stats/[slug].tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `ad-booking-detail.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `edit-ad/[slug].tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/index.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/select-category.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/select-subcategory.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/ad-form.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/preview.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `create-ad/payment-success.tsx` | Unknown pattern | Migrate to `<PageLayout>` |
| `legal/terms.tsx` | Uses PageLayout already | Keep as-is (already consistent) |

> **Note:** Screens marked "Unknown pattern" need their current layout investigated during implementation. They will be migrated to `<PageLayout>` with appropriate props once their current pattern is understood.
| `legal/privacy.tsx` | Uses PageLayout already | Keep as-is |
| `legal/account-deletion.tsx` | Uses PageLayout already | Keep as-is |

### Auth screens (7 screens)
| Screen | Migration |
|--------|-----------|
| `login.tsx` | `<AuthScreenLayout title="Welcome back" subtitle="...">` |
| `register.tsx` | `<AuthScreenLayout title="Create Account" subtitle="...">` |
| `forgot-password.tsx` | `<AuthScreenLayout title="Forgot Password" subtitle="...">` |
| `verify-otp.tsx` | `<AuthScreenLayout title="Verify OTP" subtitle="...">` |
| `verify-register-otp.tsx` | `<AuthScreenLayout title="Verify Email" subtitle="...">` |
| `set-new-password.tsx` | `<AuthScreenLayout title="New Password" subtitle="...">` |
| `complete-profile.tsx` | `<AuthScreenLayout title="Complete Profile" subtitle="...">` |

## Cleanup

- Remove `ResponsiveWrapper` import from individual pages (keep it in root `_layout.tsx` only)
- Fix `search-results` paddingTop: 60 → HEADER_HEIGHT (90)
- Fix `all-categories` paddingTop: 100 → HEADER_HEIGHT (90)
- Fix `profile` desktop maxWidth: 1200 → DESKTOP_MAX_WIDTH (1000)
- Standardize `my-favorites` paddingHorizontal: 8 → STANDARD_PADDING (16)
- Standardize `search-results` padding: 20 → STANDARD_PADDING (16)
- Standardize `all-categories` paddingHorizontal: 20 → STANDARD_PADDING (16)
- Replace all magic numbers with constants from `constants/layout.ts`

## What Does NOT Change

- Visual appearance of any page (except fixing the inconsistent values listed above)
- Header component itself (mobile Header and DesktopHeader stay as-is)
- Footer component itself
- Tab bar behavior
- DesktopSidebar behavior
- Auth protection logic
- Any API calls or data fetching
- Any navigation/routing behavior

## Implementation Order

1. Create `constants/layout.ts`
2. Create `components/desktop-content-wrapper.tsx`
3. Expand `components/page-layout.tsx`
4. Create `components/auth-screen-layout.tsx`
5. Update `app/(tabs)/_layout.tsx` and `app/(pages)/_layout.tsx` to use `useResponsive()`
6. Migrate tabs screens (5 files)
7. Migrate pages screens (24 files)
8. Migrate auth screens (7 files)
9. Run tests and verify no visual regressions
