# Pin N Post Mobile App - Issues to Fix

## High Priority (Critical)

- [ ] Fix unescaped apostrophe error in `app/(pages)/my-favorites.tsx` line 100
- [ ] Fix unescaped apostrophe error in `components/ad-preview/subscription-info.tsx` line 85

## Medium Priority

- [ ] Fix React Hook missing dependencies in `app/(auth)/complete-profile.tsx` useEffect (line 54)
- [ ] Fix React Hook missing dependencies in `app/(auth)/verify-register-otp.tsx` useEffect (line 47)
- [ ] Fix React Hook missing dependencies in `app/(pages)/ad-booking-detail.tsx` useEffect (line 45)
- [ ] Fix React Hook missing dependencies in `app/(pages)/create-ad/ad-form.tsx` useEffect (line 120)
- [ ] Fix React Hook missing dependencies in `app/(pages)/create-ad/preview.tsx` useEffect (line 62)
- [ ] Fix React Hook missing dependencies in `app/(pages)/detail/[slug].tsx` useEffect (line 80)
- [ ] Fix React Hook missing dependencies in `app/(pages)/edit-ad/[slug].tsx` useEffect (line 97)
- [ ] Fix React Hook missing dependencies in `app/(pages)/notifications.tsx` useEffect (line 84)
- [ ] Fix React Hook missing dependencies in `app/(pages)/search-results.tsx` useEffect (line 26)
- [ ] Fix React Hook missing dependencies in `app/(pages)/settings.tsx` useEffect (line 44)
- [ ] Fix React Hook missing dependencies in `app/(pages)/update-profile.tsx` useEffect (multiple lines: 70, 89, 94, 103, 155, 164, 200, 239)
- [ ] Fix React Hook missing dependencies in `app/(pages)/user/[id].tsx` useEffect (line 38)
- [ ] Fix React Hook missing dependencies in `app/(tabs)/blog.tsx` useEffect (line 71)
- [ ] Fix React Hook missing dependencies in `app/(tabs)/browse.tsx` useEffect (multiple lines: 134, 141, 155, 205, 222, 267)
- [ ] Fix React Hook missing dependencies in `app/(tabs)/index.tsx` useEffect (line 73)
- [ ] Fix React Hook missing dependencies in `app/(tabs)/my-ads.tsx` useEffect (multiple lines: 50, 165)
- [ ] Fix React Hook missing dependencies in `app/(tabs)/profile.tsx` useEffect (line 30)
- [ ] Fix React Hook missing dependencies in `components/ad-form/booking-section.tsx` useEffect (line 27)
- [ ] Fix React Hook missing dependencies in `components/subcategory-modal.tsx` useEffect (line 40)
- [ ] Fix React Hook missing dependencies in `components/terms-modal.tsx` useEffect (line 27)

## Low Priority (Cleanup)

- [ ] Remove unused imports throughout the codebase (177+ warnings)
- [ ] Convert `Array<T>` to `T[]` in `app/(pages)/create-ad/ad-form.tsx` line 83 and `app/(pages)/edit-ad/[slug].tsx` line 79
- [ ] Remove unused variables throughout the codebase
- [ ] Fix useCallback missing dependencies in `app/(tabs)/browse.tsx` line 222