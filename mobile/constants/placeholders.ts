export const DEFAULT_AD_PLACEHOLDER = 'https://placehold.co/600x400/F8F9FA/6B7280?text=No+Image+Available';
export const JOB_SERVICE_PLACEHOLDER = 'https://placehold.co/600x400/F8F9FA/00B894?text=PinNPost+Jobs';

export const isJobOrServiceCategory = (category?: string, subcategory?: string) => {
  const jobServiceKeywords = ['job', 'service', 'work', 'hiring', 'vacancy', 'professional'];
  const cat = (category || '').toLowerCase();
  const sub = (subcategory || '').toLowerCase();
  
  return jobServiceKeywords.some(keyword => cat.includes(keyword) || sub.includes(keyword));
};

export const getAdPlaceholder = (category?: string, subcategory?: string, customPlaceholder?: string) => {
  // 1. Prefer custom placeholder set by admin on the category
  if (customPlaceholder) {
    return customPlaceholder;
  }

  // 2. Fallback to hardcoded job/service placeholder for known keywords
  if (isJobOrServiceCategory(category, subcategory)) {
    return JOB_SERVICE_PLACEHOLDER;
  }

  // 3. Global generic fallback
  return DEFAULT_AD_PLACEHOLDER;
};
