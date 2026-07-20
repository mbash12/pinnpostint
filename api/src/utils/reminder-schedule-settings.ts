import { prisma } from './database';

/**
 * Normalize reminder day intervals from Setting JSON (array or single number).
 * Returns a sorted unique list of positive integers, or [] if nothing valid is configured.
 */
export function normalizeReminderDays(value: unknown, mode: 'before' | 'after'): number[] {
  const toNumberList = (input: unknown): number[] => {
    if (Array.isArray(input)) {
      return input
        .map(item => Number(item))
        .filter(num => Number.isFinite(num))
        .map(num => Math.abs(Math.trunc(num)))
        .filter(num => num > 0);
    }

    if (input !== null && input !== undefined) {
      const parsed = Number(input);
      if (Number.isFinite(parsed)) {
        const normalized = Math.abs(Math.trunc(parsed));
        return normalized > 0 ? [normalized] : [];
      }
    }

    return [];
  };

  const unique = Array.from(new Set(toNumberList(value)));
  if (unique.length === 0) {
    return [];
  }

  return mode === 'before' ? unique.sort((a, b) => b - a) : unique.sort((a, b) => a - b);
}

export async function getReminderDaysBeforeExpiry(): Promise<number[]> {
  const row = await prisma.setting.findUnique({
    where: { key: 'reminder_expiration_days' },
    select: { value: true },
  });
  return normalizeReminderDays(row?.value, 'before');
}
