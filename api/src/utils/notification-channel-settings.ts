import { prisma } from './database';

/** User-facing broadcasts: push + email (+ in-app). SMS is not used for bulk announcements. */
export const USER_ANNOUNCEMENT_CHANNELS: ('push' | 'email')[] = ['push', 'email'];

/** Admin alerts: push + email (+ in-app DB rows). SMS is never used for admins. */
export const ADMIN_NOTIFICATION_CHANNELS: ('push' | 'email')[] = ['push', 'email'];

const VALID_CHANNELS = new Set(['push', 'email', 'sms']);

function parseBool(value: unknown, defaultValue: boolean): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return defaultValue;
}

function parseChannelList(value: unknown): ('push' | 'email' | 'sms')[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const mapped = value
    .map(v => String(v).toLowerCase())
    .filter((c): c is 'push' | 'email' | 'sms' => VALID_CHANNELS.has(c));
  const unique = [...new Set(mapped)];
  return unique.length > 0 ? unique : null;
}

/**
 * Channels allowed for transactional / automated notifications (from DB settings).
 * Order: optional custom list `notification_default_channels`, else push+email plus SMS if `sms_notifications_enabled`.
 */
export async function getConfiguredNotificationChannels(): Promise<('push' | 'email' | 'sms')[]> {
  const customRow = await prisma.setting.findUnique({
    where: { key: 'notification_default_channels' },
    select: { value: true },
  });

  const custom = parseChannelList(customRow?.value);
  if (custom) {
    return custom;
  }

  const smsRow = await prisma.setting.findUnique({
    where: { key: 'sms_notifications_enabled' },
    select: { value: true },
  });
  const smsOn = parseBool(smsRow?.value, true);

  return smsOn ? ['push', 'email', 'sms'] : ['push', 'email'];
}

/**
 * Resolve channels for a send: use explicit list from job/API when provided,
 * otherwise use configured defaults. When SMS is disabled in settings, strip `sms` unless `forceChannels` is true.
 */
export async function resolveNotificationChannels(
  explicit: ('push' | 'email' | 'sms')[] | undefined,
  forceChannels: boolean | undefined
): Promise<('push' | 'email' | 'sms')[]> {
  const configured = await getConfiguredNotificationChannels();
  const base =
    explicit && explicit.length > 0
      ? explicit.filter((c): c is 'push' | 'email' | 'sms' => VALID_CHANNELS.has(c))
      : configured;

  let channels = [...new Set(base)] as ('push' | 'email' | 'sms')[];

  if (!forceChannels && !configured.includes('sms')) {
    channels = channels.filter(c => c !== 'sms');
  }

  return channels;
}
