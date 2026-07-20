/**
 * Validation utilities for mobile app
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any, formData?: Record<string, any>) => string | null;
  min?: number;
  max?: number;
  numeric?: boolean;
  email?: boolean;
  url?: boolean;
  date?: boolean;
  phone?: boolean;
  label?: string; // Human-readable field name for error messages
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

// Profile Validation Schema
export const profileValidationSchema: ValidationSchema = {
  firstName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  lastName: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 6,
    maxLength: 128,
  },
  confirmPassword: {
    required: true,
    minLength: 6,
    maxLength: 128,
  },
  phone: {
    pattern: /^[0-9]{10}$/,
    minLength: 10,
    maxLength: 10,
  },
  bio: {
    maxLength: 500,
  },
  address: {
    maxLength: 200,
  },
  cityId: {
    maxLength: 36,
  },
  stateId: {
    maxLength: 36,
  },
  postalCodeId: {
    maxLength: 36,
  },
};

// Ad Form Validation Schema
export const adValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 70,
    label: 'Title',
  },
  description: {
    required: true,
    minLength: 20,
    maxLength: 4096,
    label: 'Description',
  },
  price: {
    required: true,
    numeric: true,
    min: 1,
    custom: (value: any) => {
      const num = parseFloat(value);
      if (isNaN(num)) return 'Please enter a valid price';
      if (num <= 0) return 'Price must be greater than 0';
      if (num > 999999999) return 'Price is too high';
      return null;
    },
  },
  discountedPrice: {
    custom: (value: any, formData?: Record<string, any>) => {
      // Check if discounted price is required (useDiscountedPrice is true)
      if (formData && formData.useDiscountedPrice) {
        if (!value || value.toString().trim() === '') {
          return 'Discounted price is required when discount option is enabled';
        }
      }

      // Skip further validation if empty and not required
      if (!value || value.toString().trim() === '') return null;

      const num = parseFloat(value);
      if (isNaN(num)) return 'Please enter a valid price';
      if (num <= 0) return 'Discounted price must be greater than 0';
      if (formData && formData.price) {
        const originalPrice = parseFloat(formData.price);
        if (num >= originalPrice) return 'Discounted price must be less than original price';
      }
      if (num > 999999999) return 'Price is too high';
      return null;
    },
  },
  location: {
    custom: (value: any) => {
      // Location is required - check if it has valid coordinates
      if (!value) {
        return 'Location is required';
      }
      // Check if location has latitude and longitude
      if (!value.latitude || !value.longitude) {
        return 'Please select a valid location';
      }
      // Ensure coordinates are valid numbers
      const lat = parseFloat(value.latitude);
      const lng = parseFloat(value.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return 'Invalid location coordinates';
      }
      // Valid latitude range: -90 to 90
      if (lat < -90 || lat > 90) {
        return 'Invalid location coordinates';
      }
      // Valid longitude range: -180 to 180
      if (lng < -180 || lng > 180) {
        return 'Invalid location coordinates';
      }
      return null;
    },
  },
  categoryId: {
    required: true,
  },
};

// Attribute validation based on type
export function validateAttribute(value: string, attr: {
  id: string;
  name: string;
  type: string;
  isRequired: boolean;
  options?: string[];
}): string | null {
  // Required check
  if (attr.isRequired && (!value || value.toString().trim() === '')) {
    return `${attr.name} is required`;
  }

  // Skip further validation if empty and not required
  if (!value || value.toString().trim() === '') {
    return null;
  }

  const trimmedValue = value.toString().trim();

  // Type-specific validation
  switch (attr.type) {
    case 'number':
      if (!/^\d+(\.\d{1,2})?$/.test(trimmedValue)) {
        return `${attr.name} must be a valid number`;
      }
      const num = parseFloat(trimmedValue);
      if (num < 0) return `${attr.name} must be positive`;
      if (num > 999999999) return `${attr.name} value is too high`;
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        return `${attr.name} must be a valid email address`;
      }
      break;

    case 'url':
    case 'website':
      try {
        new URL(trimmedValue.startsWith('http') ? trimmedValue : `https://${trimmedValue}`);
      } catch {
        return `${attr.name} must be a valid URL (e.g., https://example.com)`;
      }
      break;

    case 'tel':
    case 'phone':
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(trimmedValue)) {
        return `${attr.name} must be exactly 10 digits`;
      }
      break;

    case 'date':
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(trimmedValue)) {
        return `${attr.name} must be in YYYY-MM-DD format`;
      }
      const date = new Date(trimmedValue);
      if (isNaN(date.getTime())) {
        return `${attr.name} must be a valid date`;
      }
      if (date < new Date('1900-01-01')) {
        return `${attr.name} cannot be before 1900`;
      }
      if (date > new Date('2100-12-31')) {
        return `${attr.name} cannot be after 2100`;
      }
      break;

    case 'select':
      if (attr.options && attr.options.length > 0) {
        if (!attr.options.includes(trimmedValue)) {
          return `Please select a valid ${attr.name.toLowerCase()}`;
        }
      }
      break;

    case 'textarea':
      if (trimmedValue.length > 1000) {
        return `${attr.name} must be less than 1000 characters`;
      }
      break;

    case 'text':
      if (trimmedValue.length > 255) {
        return `${attr.name} must be less than 255 characters`;
      }
      break;
  }

  return null;
}

// Validate all attributes
export function validateAttributes(
  attributeValues: Record<string, string>,
  attributes: Array<{ id: string; name: string; type: string; isRequired: boolean; options?: string[] }>
): Record<string, string> {
  const errors: Record<string, string> = {};

  attributes.forEach(attr => {
    const error = validateAttribute(attributeValues[attr.id] || '', attr);
    if (error) {
      errors[`attr_${attr.id}`] = error;
    }
  });

  return errors;
}

export function validateField(value: any, rule: ValidationRule, formData?: Record<string, any>): string | null {
  // Safety check - if rule is undefined, return null
  if (!rule) {
    return null;
  }

  // Run custom validation first - it may handle conditional/empty value logic
  if (rule.custom) {
    const customError = rule.custom(value, formData);
    if (customError) return customError;
  }

  // Check for required fields - handle both primitive values and objects
  if (rule.required) {
    // Use custom label if provided, otherwise use generic message
    const fieldLabel = rule.label || 'This field';
    const requiredMessage = `${fieldLabel} is required`;

    // For objects (like location), check if value exists and is not null/undefined
    if (typeof value === 'object' && value !== null) {
      // Object is present, check if it's empty
      if (Object.keys(value).length === 0) {
        return requiredMessage;
      }
    } else if (typeof value !== 'object') {
      // For primitive values (string, number), check if empty after trimming
      if (!value || value.toString().trim() === "") {
        return requiredMessage;
      }
    } else {
      // value is null or undefined object
      return requiredMessage;
    }
  }

  // Skip further validation if empty (for non-required fields)
  if (!value) {
    return null;
  }

  // For objects, skip further validation (they have custom validation)
  if (typeof value === 'object') {
    return null;
  }

  // For primitive values, convert to string for further validation
  const stringValue = value.toString().trim();

  if (rule.minLength && stringValue.length < rule.minLength) {
    const fieldLabel = rule.label || 'This field';
    return `${fieldLabel} must be at least ${rule.minLength} characters`;
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    const fieldLabel = rule.label || 'This field';
    return `${fieldLabel} must be no more than ${rule.maxLength} characters`;
  }

  if (rule.numeric) {
    if (!/^\d+(\.\d{1,2})?$/.test(stringValue)) {
      return "Please enter a valid number";
    }
    const num = parseFloat(stringValue);
    if (rule.min !== undefined && num < rule.min) {
      return `Must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && num > rule.max) {
      return `Must be no more than ${rule.max}`;
    }
  }

  if (rule.min && parseFloat(stringValue) < rule.min) {
    return `Must be at least ${rule.min}`;
  }

  if (rule.max && parseFloat(stringValue) > rule.max) {
    return `Must be no more than ${rule.max}`;
  }

  if (rule.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(stringValue)) {
      return "Please enter a valid email address";
    }
  }

  if (rule.url) {
    try {
      new URL(stringValue.startsWith('http') ? stringValue : `https://${stringValue}`);
    } catch {
      return "Please enter a valid URL";
    }
  }

  if (rule.date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(stringValue)) {
      return "Please use YYYY-MM-DD format";
    }
    const date = new Date(stringValue);
    if (isNaN(date.getTime())) {
      return "Please enter a valid date";
    }
  }

  if (rule.phone) {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(stringValue)) {
      return "Please enter a valid 10-digit phone number";
    }
  }

  if (rule.pattern && !rule.pattern.test(stringValue)) {
    return getPatternErrorMessage(rule.pattern);
  }

  return null;
}

function getPatternErrorMessage(pattern: RegExp): string {
  const patternStr = pattern.toString();

  if (patternStr.includes("@")) return "Please enter a valid email address";
  if (patternStr.includes("[a-zA-Z\\s'-]")) return "Only letters, spaces, hyphens, and apostrophes allowed";
  if (patternStr.includes("\\d") && !patternStr.includes("\\s")) return "Please enter a valid number";
  if (patternStr.includes("(?=.*[a-z])")) return "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character";
  if (patternStr.includes("[\\d\\s-]")) return "Only numbers, spaces, and hyphens allowed";

  return "Invalid format";
}

export function validateForm(
  data: Record<string, any>,
  schema: ValidationSchema,
  additionalData?: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};

  Object.keys(schema).forEach(field => {
    const error = validateField(data[field], schema[field], additionalData || data);
    if (error) {
      errors[field] = error;
    }
  });

  return errors;
}

// Real-time validation for single field (used on change)
export function validateFormField(
  field: string,
  value: any,
  schema: ValidationSchema,
  formData?: Record<string, any>
): string | null {
  const rule = schema[field];
  if (!rule) return null;
  return validateField(value, rule, formData);
}

// Check if value is approaching character limit (for warning display)
export function getCharacterLimitStatus(
  currentLength: number,
  maxLength: number
): 'ok' | 'warning' | 'error' {
  if (currentLength > maxLength) return 'error';
  if (currentLength >= maxLength * 0.9) return 'warning'; // 90% of limit
  return 'ok';
}