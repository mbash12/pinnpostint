import type { User } from '@/types/api.types';

/**
 * Formats a user's full name, handling null/undefined values properly
 * @param user - User object containing firstName and lastName
 * @param fallback - Default text to show when both names are empty/null
 * @returns Formatted full name
 */
export function formatUserName(user: User | null | undefined, fallback: string = 'User'): string {
  if (!user) return fallback;
  
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  return fullName || fallback;
}

/**
 * Formats a user's initials from their name
 * @param user - User object containing firstName and lastName
 * @param fallback - Default letter(s) to show when both names are empty/null
 * @returns User initials (1-2 characters)
 */
export function getUserInitials(user: User | null | undefined, fallback: string = 'U'): string {
  if (!user) return fallback;
  
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  
  if (!firstName && !lastName) return fallback;
  
  const firstInitial = firstName.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  
  if (firstInitial && lastInitial) {
    return firstInitial + lastInitial;
  } else if (firstInitial) {
    return firstInitial;
  } else if (lastInitial) {
    return lastInitial;
  }
  
  return fallback;
}