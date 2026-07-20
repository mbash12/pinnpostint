/**
 * Currency formatting utilities for the admin panel - INR only
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
}

export const INR_CURRENCY: CurrencyInfo = {
  code: 'INR',
  symbol: '₹',
  locale: 'en-IN'
};

/**
 * Format currency amount with INR symbol and formatting
 */
export function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat(INR_CURRENCY.locale, {
      style: 'currency',
      currency: INR_CURRENCY.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // Fallback to simple symbol formatting
    return `${INR_CURRENCY.symbol}${amount.toLocaleString()}`;
  }
}

/**
 * Get INR currency symbol
 */
export function getCurrencySymbol(): string {
  return INR_CURRENCY.symbol;
}

/**
 * Parse currency string to number (removes symbols and formatting)
 */
export function parseCurrencyValue(value: string): number {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
}