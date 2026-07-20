export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [field: string]: ValidationRule;
}

export const userValidationSchema: ValidationSchema = {
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
  phone: {
    pattern: /^\+?[\d\s-()]+$/,
    minLength: 10,
    maxLength: 20,
  },
  password: {
    required: true,
    minLength: 6,
    custom: (value: string) => {
      if (!value) return null;
      const alphanumericCount = (value.match(/[a-zA-Z0-9]/g) || []).length;
      if (alphanumericCount < 6) return "Password must contain at least 6 alphanumeric characters";
      return null;
    },
  },
  bio: {
    maxLength: 500,
  },
  address: {
    maxLength: 200,
  },
  city: {
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  state: {
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  country: {
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  zipCode: {
    pattern: /^[\d\s-]+$/,
    maxLength: 20,
  },
  dob: {
    custom: (value: string) => {
      if (!value) return null;
      const date = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - date.getFullYear();
      if (age < 13 || age > 120) return "Age must be between 13 and 120 years";
      return null;
    },
  },
};

export const blogValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 200,
    pattern: /^[a-zA-Z0-9\s\-_.,!?&'()]+$/,
  },
  slug: {
    required: true,
    minLength: 5,
    maxLength: 200,
    pattern: /^[a-z0-9-]+$/,
  },
  excerpt: {
    maxLength: 500,
  },
  content: {
    required: true,
    minLength: 50,
    custom: (value: string) => {
      if (!value) return null;
      // Check if content has actual text (not just HTML tags)
      const textContent = value.replace(/<[^>]*>/g, '');
      if (textContent.length < 20) return "Content must contain at least 20 characters of text";
      return null;
    },
  },
  imageUrl: {
    pattern: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
  },
};

export const locationValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-',.()]+$/,
  },
  address: {
    maxLength: 250,
  },
  latitude: {
    custom: (value: string) => {
      if (!value || value === "0") return null;
      const lat = parseFloat(value);
      if (isNaN(lat)) return "Must be a valid number";
      if (lat < -90 || lat > 90) return "Latitude must be between -90 and 90";
      return null;
    },
  },
  longitude: {
    custom: (value: string) => {
      if (!value || value === "0") return null;
      const lng = parseFloat(value);
      if (isNaN(lng)) return "Must be a valid number";
      if (lng < -180 || lng > 180) return "Longitude must be between -180 and 180";
      return null;
    },
  },
};

export const categoryValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s\-&']+$/,
  },
  description: {
    maxLength: 500,
  },
  iconUrl: {
    pattern: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i,
  },
};

export const faqValidationSchema: ValidationSchema = {
  question: {
    required: true,
    minLength: 5,
    maxLength: 200,
  },
  answer: {
    required: true,
    minLength: 10,
    maxLength: 1000,
  },
  categoryId: {
    required: true,
  },
};

export const adValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 100,
  },
  description: {
    required: true,
    minLength: 20,
    maxLength: 1000,
  },
  price: {
    required: true,
    custom: (value: string) => {
      const price = parseFloat(value);
      if (isNaN(price) || price < 0) return "Price must be a positive number";
      if (price > 999999999999) return "Price cannot exceed 999,999,999,999";
      if (!Number.isFinite(price)) return "Price is too large";
      return null;
    },
  },
  location: {
    required: true,
    custom: (value: any) => {
      if (!value || !value.latitude || !value.longitude) {
        return "Please select a location on the map";
      }
      return null;
    },
  },
};

export const postalCodeValidationSchema: ValidationSchema = {
  code: {
    required: true,
    minLength: 3,
    maxLength: 10,
    pattern: /^[\d\s-]+$/,
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-',.()]+$/,
  },
};

export const stateValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
  code: {
    required: true,
    minLength: 2,
    maxLength: 5,
    pattern: /^[A-Z0-9-]+$/,
  },
};

export const cityValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-',.()]+$/,
  },
};

export function validateField(value: any, rule: ValidationRule): string | null {
  if (rule.required && (!value || value.toString().trim() === "")) {
    return "This field is required";
  }

  if (!value || value.toString().trim() === "") {
    return null;
  }

  const stringValue = value.toString().trim();

  if (rule.minLength && stringValue.length < rule.minLength) {
    return `Must be at least ${rule.minLength} characters`;
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    return `Must be no more than ${rule.maxLength} characters`;
  }

  if (rule.pattern && !rule.pattern.test(stringValue)) {
    return getPatternErrorMessage(rule.pattern);
  }

  if (rule.custom) {
    return rule.custom(value);
  }

  return null;
}

function getPatternErrorMessage(pattern: RegExp): string {
  const patternStr = pattern.toString();

  if (pattern.source === "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") return "Please enter a valid email address";
  if (patternStr.includes("[a-zA-Z\\s'-]")) return "Only letters, spaces, hyphens, and apostrophes allowed";
  if (patternStr.includes("[\\d\\s-()]")) return "Please enter a valid phone number";
  if (patternStr.includes("[\\d\\s-]")) return "Only numbers, spaces, and hyphens allowed";

  return "Invalid format";
}


export const roleValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s\-&']+$/,
  },
  key: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-z0-9_]+$/,
  },
  description: {
    maxLength: 500,
  },
};

export const blogCategoryValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&']+$/,
  },
  slug: {
    required: true,
    minLength: 2,
    maxLength: 200,
    pattern: /^[a-z0-9-]+$/,
  },
  description: {
    maxLength: 500,
  },
};

export const legalDocumentValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 200,
    pattern: /^[a-zA-Z0-9\s\-_,.!?&'()]+$/,
  },
  slug: {
    required: true,
    minLength: 5,
    maxLength: 200,
    pattern: /^[a-z0-9-]+$/,
  },
  content: {
    required: true,
    minLength: 50,
  },
};

export const faqCategoryValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&']+$/,
  },
  slug: {
    required: true,
    minLength: 2,
    maxLength: 200,
    pattern: /^[a-z0-9-]+$/,
  },
  description: {
    maxLength: 500,
  },
};

export const subcategoryValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&']+$/,
  },
  slug: {
    required: true,
    minLength: 2,
    maxLength: 200,
    pattern: /^[a-z0-9-]+$/,
  },
  description: {
    maxLength: 500,
  },
};

export const attributeValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_']+$/,
  },
  options: {
    custom: (value: string[]) => {
      if (!value || value.length === 0) return null;
      if (value.length > 50) return "Cannot have more than 50 options";
      for (const opt of value) {
        if (opt.length > 100) return "Each option must be less than 100 characters";
      }
      return null;
    },
  },
};

export function validateForm(data: Record<string, any>, schema: ValidationSchema): Record<string, string> {
  const errors: Record<string, string> = {};

  Object.keys(schema).forEach(field => {
    const error = validateField(data[field], schema[field]);
    if (error) {
      errors[field] = error;
    }
  });

  return errors;
}
