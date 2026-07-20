/**
 * Check if a price should be hidden (when it's 0, null, undefined, or not available)
 */
export const shouldHidePrice = (price: number | string | null | undefined): boolean => {
  if (!price || price === 0 || price === '0' || price === '') return true;
  
  const priceStr = String(price).toLowerCase().trim();
  const notAvailableIndicators = ['not available', 'n/a', 'na', '₹0', 'free'];
  if (notAvailableIndicators.includes(priceStr)) return true;
  
  const numericPrice = typeof price === 'string'
    ? parseFloat(price.replace(/[^0-9.]/g, ''))
    : price;
  
  if (typeof numericPrice === 'number' && (isNaN(numericPrice) || numericPrice === 0)) return true;
  
  return false;
};

export const formatPrice = (price: number | string | null | undefined): string => {
  if (!price) return '₹0';

  const numericPrice = typeof price === 'string'
    ? parseFloat(price.replace(/[^0-9.]/g, ''))
    : price;

  if (isNaN(numericPrice)) return '₹0';

  return `₹${numericPrice.toLocaleString('en-IN')}`;
};

export const formatPriceInput = (value: string): string => {
  const cleanValue = value.replace(/[^0-9]/g, '');
  return cleanValue ? parseInt(cleanValue).toLocaleString('en-IN') : '';
};
