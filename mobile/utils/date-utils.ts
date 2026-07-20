/**
 * Calculate days remaining until expiration, using India Standard Time (IST)
 *
 * IMPORTANT: We compare only calendar dates (not time).
 * If today is Feb 24 and expiry is Feb 26, it shows "2 days left".
 * If today is Feb 26 and expiry is Feb 26, it shows "0 days left" (expired today).
 *
 * @param expiresAt - The expiration date string (ISO format)
 * @returns Number of days remaining (0 or negative if expired)
 */
export function getDaysRemaining(expiresAt: string): number {
    const expiryDate = new Date(expiresAt);
    const now = new Date();

    // Convert to IST by adding 5.5 hours offset
    const istOffset = 5.5 * 60 * 60 * 1000;
    const expiryIST = new Date(expiryDate.getTime() + istOffset);
    const nowIST = new Date(now.getTime() + istOffset);

    // Get calendar dates (year, month, day) in IST
    const expiryYear = expiryIST.getUTCFullYear();
    const expiryMonth = expiryIST.getUTCMonth();
    const expiryDay = expiryIST.getUTCDate();

    const nowYear = nowIST.getUTCFullYear();
    const nowMonth = nowIST.getUTCMonth();
    const nowDay = nowIST.getUTCDate();

    // Create midnight UTC dates for comparison
    const expiryMidnight = Date.UTC(expiryYear, expiryMonth, expiryDay);
    const nowMidnight = Date.UTC(nowYear, nowMonth, nowDay);

    // Calculate difference in calendar days
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysDifference = (expiryMidnight - nowMidnight) / msPerDay;

    // Return the difference (expiry at midnight means that's the last day)
    return Math.floor(daysDifference);
}

/**
 * Format a date string to India date format (dd/mm/yyyy)
 * @param dateString - The date string to format
 * @returns Formatted date string in Indian format
 */
export function formatLocalDate(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Get a human-readable "days left" string
 * @param expiresAt - The expiration date string (ISO format)
 * @returns Formatted string like "2 days left" or "Expired"
 */
export function getDaysLeftString(expiresAt: string): string {
    const daysLeft = getDaysRemaining(expiresAt);
    const isExpired = daysLeft <= 0;

    if (isExpired) {
        return 'Expired';
    }

    return `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
}
