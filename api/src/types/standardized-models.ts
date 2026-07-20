/**
 * Standardized Data Models for API Alignment
 * These interfaces define the unified data structures across all applications
 */

// ========== LOCATION MODELS ==========

export interface StandardState {
  id: string;
  name: string;
  code?: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StandardCity {
  id: string;
  name: string;
  code?: string;
  stateId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  state?: StandardState;
}

export interface StandardPostalCode {
  id: string;
  code: string;
  cityId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  city?: StandardCity;
}

export interface StandardLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  cityId?: string;
  stateId?: string;
  postalCodeId?: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  city?: StandardCity;
  state?: StandardState;
  postalCode?: StandardPostalCode;
}

export interface LocationSummary {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  cityId?: string;
  stateId?: string;
  postalCodeId?: string;
  country: string;
  // Backward compatibility string fields
  city?: string;
  state?: string;
  postalCode?: string;
  // Nested objects for granular data
  stateObj?: StandardState;
  cityObj?: StandardCity;
  postalCodeObj?: StandardPostalCode;
}

export interface StandardUserSummary {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  avatar?: string;
  createdAt: string;
  isVerified: boolean;
}

// ========== CATEGORY MODELS ==========

export interface StandardCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  adPlaceholder?: string;
  isActive: boolean;
  isFeatured: boolean;
  supportsBooking: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  subcategories?: StandardSubcategory[];
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  adPlaceholder?: string | null;
}

export interface StandardSubcategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  categoryId: string;
  supportsBooking: boolean;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  attributes?: StandardAttribute[];
}

export interface SubcategorySummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

// ========== ATTRIBUTE MODELS ==========

export type AttributeType = 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'date';

export interface StandardAttribute {
  id: string;
  name: string;
  type: AttributeType;
  options?: string[];
  image?: string;
  subcategoryId: string;
  isRequired: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdAttribute {
  id: string;
  adId: string;
  attributeId: string;
  value: string;
  attribute?: {
    id: string;
    name: string;
    type: AttributeType;
    options?: string[];
  };
}

// ========== REQUEST/RESPONSE TYPES ==========

// Location Request Types
export interface CreateLocationRequest {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isActive?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isActive?: boolean;
}

// Category Request Types
export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  supportsBooking?: boolean;
  order?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  supportsBooking?: boolean;
  order?: number;
}

// Subcategory Request Types
export interface CreateSubcategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  supportsBooking?: boolean;
  isActive?: boolean;
  order?: number;
}

export interface UpdateSubcategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  supportsBooking?: boolean;
  isActive?: boolean;
  order?: number;
}

// Attribute Request Types
export interface CreateAttributeRequest {
  name: string;
  type: AttributeType;
  options?: string[];
  image?: string;
  isRequired?: boolean;
  order?: number;
}

export interface UpdateAttributeRequest {
  name?: string;
  type?: AttributeType;
  options?: string[];
  image?: string;
  isRequired?: boolean;
  order?: number;
}

// ========== TRANSFORMATION HELPERS ==========

/**
 * Transform Prisma State to StandardState
 */
export const transformState = (state: any): StandardState => {
  return {
    id: state.id,
    name: state.name,
    code: state.code || undefined,
    country: 'India', // Default to India as country is not in the State model
    isActive: state.isActive,
    createdAt: state.createdAt ? state.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: state.updatedAt ? state.updatedAt.toISOString() : new Date().toISOString()
  };
};

/**
 * Transform Prisma District to StandardDistrict
 */
/**
 * Transform Prisma City to StandardCity
 */
export const transformCity = (city: any): StandardCity => {
  return {
    id: city.id,
    name: city.name,
    code: city.code || undefined,
    stateId: city.stateId,
    isActive: city.isActive,
    createdAt: city.createdAt ? city.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: city.updatedAt ? city.updatedAt.toISOString() : new Date().toISOString(),
    state: city.state ? transformState(city.state) : undefined
  };
};

/**
 * Transform Prisma PostalCode to StandardPostalCode
 */
export const transformPostalCode = (postalCode: any): StandardPostalCode => {
  return {
    id: postalCode.id,
    code: postalCode.code,
    cityId: postalCode.cityId,
    isActive: postalCode.isActive,
    createdAt: postalCode.createdAt ? postalCode.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: postalCode.updatedAt ? postalCode.updatedAt.toISOString() : new Date().toISOString(),
    city: postalCode.city ? transformCity(postalCode.city) : undefined
  };
};

/**
 * Transform Prisma Location to StandardLocation
 */
export const transformLocation = (location: any): StandardLocation => {
  return {
    id: location.id,
    name: location.name,
    address: location.address || undefined,
    latitude: location.latitude,
    longitude: location.longitude,
    cityId: location.cityId || undefined,
    stateId: location.stateId || undefined,
    postalCodeId: location.postalCodeId || undefined,
    country: location.country || 'India',
    isActive: location.isActive,
    createdAt: location.createdAt ? location.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: location.updatedAt ? location.updatedAt.toISOString() : new Date().toISOString(),
    city: location.city ? transformCity(location.city) : undefined,
    state: location.state ? transformState(location.state) : undefined,
    postalCode: location.postalCode ? transformPostalCode(location.postalCode) : undefined
  };
};

/**
 * Transform Prisma Category to StandardCategory
 */
export const transformCategory = (category: any): StandardCategory => {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || undefined,
    image: category.image || undefined,
    adPlaceholder: category.adPlaceholder || undefined,
    isActive: category.isActive,
    isFeatured: category.isFeatured,
    supportsBooking: category.supportsBooking || false,
    order: category.order || 0,
    createdAt: category.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: category.updatedAt?.toISOString() || new Date().toISOString(),
    subcategories: category.subcategories?.map(transformSubcategory) || []
  };
};

/**
 * Transform Prisma Subcategory to StandardSubcategory
 */
export const transformSubcategory = (subcategory: any): StandardSubcategory => {
  return {
    id: subcategory.id,
    name: subcategory.name,
    slug: subcategory.slug,
    description: subcategory.description || undefined,
    image: subcategory.image || undefined,
    categoryId: subcategory.categoryId,
    supportsBooking: subcategory.supportsBooking || false,
    isActive: subcategory.isActive,
    order: subcategory.order || 0,
    createdAt: subcategory.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: subcategory.updatedAt?.toISOString() || new Date().toISOString(),
    attributes: subcategory.attributes?.map(transformAttribute) || []
  };
};

/**
 * Transform Prisma Attribute to StandardAttribute
 */
export const transformAttribute = (attribute: any): StandardAttribute => {
  return {
    id: attribute.id,
    name: attribute.name,
    type: attribute.type as AttributeType,
    options: attribute.options ? (Array.isArray(attribute.options) ? attribute.options : JSON.parse(attribute.options)) : undefined,
    image: attribute.image || undefined,
    subcategoryId: attribute.subcategoryId,
    isRequired: attribute.isRequired,
    order: attribute.order || 0,
    createdAt: attribute.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: attribute.updatedAt?.toISOString() || new Date().toISOString()
  };
};

/**
 * Transform Location to LocationSummary
 */
export const transformLocationSummary = (location: any): LocationSummary => {
  return {
    id: location.id,
    name: location.name,
    address: location.address || undefined,
    latitude: location.latitude,
    longitude: location.longitude,
    cityId: location.cityId || undefined,
    stateId: location.stateId || undefined,
    postalCodeId: location.postalCodeId || undefined,
    country: location.country || 'India',
    // Backward compatibility string fields
    city: location.city ? location.city.name : undefined,
    state: location.state ? location.state.name : undefined,
    postalCode: location.postalCode ? location.postalCode.code : undefined,
    // Nested objects for granular data
    stateObj: location.state ? transformState(location.state) : undefined,
    cityObj: location.city ? transformCity(location.city) : undefined,
    postalCodeObj: location.postalCode ? transformPostalCode(location.postalCode) : undefined
  };
};

/**
 * Transform Category to CategorySummary
 */
export const transformCategorySummary = (category: any): CategorySummary => {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || undefined,
    adPlaceholder: category.adPlaceholder || undefined
  };
};

/**
 * Transform Subcategory to SubcategorySummary
 */
export const transformSubcategorySummary = (subcategory: any): SubcategorySummary => {
  return {
    id: subcategory.id,
    name: subcategory.name,
    slug: subcategory.slug,
    description: subcategory.description || undefined
  };
};

// ========== FILE UPLOAD MODELS ==========

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
}

export interface MultipleFileUploadResponse {
  files: FileUploadResponse[];
  totalFiles: number;
  totalSize: number;
}

export interface FileValidationError {
  filename: string;
  error: string;
  code: 'INVALID_TYPE' | 'SIZE_EXCEEDED' | 'UPLOAD_FAILED';
}

export interface FileUploadConfig {
  maxSize: number;
  allowedTypes: string[];
  maxFiles?: number;
}

export type FileUploadType = 'image' | 'document' | 'any';

export interface FileUploadLimits {
  image: {
    maxSize: number; // 5MB
    allowedTypes: string[];
    maxFiles: number;
  };
  document: {
    maxSize: number; // 10MB
    allowedTypes: string[];
    maxFiles: number;
  };
  any: {
    maxSize: number; // 10MB
    allowedTypes: string[];
    maxFiles: number;
  };
}

// ========== NOTIFICATION MODELS ==========

export type NotificationType = 
  | 'SUBSCRIPTION_EXPIRY'
  | 'AD_APPROVED'
  | 'AD_REJECTED'
  | 'GENERAL'
  | 'BOOKING_UPDATE'
  | 'SYSTEM'
  | 'BOOKING'
  | 'PROMOTION';

export interface StandardNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  data?: Record<string, unknown>;
  sentAt: string;
  scheduledAt?: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  sentAt: string;
  data?: any;
}

export interface StandardNotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
}

// Notification Request Types
export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: NotificationType;
  userId?: string;
  userIds?: string[];
  sendToAll?: boolean;
  data?: Record<string, unknown>;
  scheduledAt?: string;
}

export interface UpdateNotificationPreferencesRequest {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface NotificationFilters {
  type?: NotificationType;
  isRead?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Transform uploaded file to FileUploadResponse
 */
export const transformFileUpload = (file: Express.Multer.File, baseUrl: string): FileUploadResponse => {
  const relativePath = file.path.replace(process.cwd(), '');
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    path: relativePath,
    url: `${baseUrl}${relativePath}`,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString()
  };
};

/**
 * Transform Prisma Notification to StandardNotification
 */
export const transformNotification = (notification: any): StandardNotification => {
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type as NotificationType,
    isRead: notification.isRead,
    data: notification.data || undefined,
    sentAt: notification.sentAt ? notification.sentAt.toISOString() : new Date().toISOString(),
    scheduledAt: notification.scheduledAt ? notification.scheduledAt.toISOString() : undefined
  };
};

/**
 * Transform Notification to NotificationSummary
 */
export const transformNotificationSummary = (notification: any): NotificationSummary => {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type as NotificationType,
    isRead: notification.isRead,
    sentAt: notification.sentAt ? notification.sentAt.toISOString() : new Date().toISOString(),
    data: notification.data
  };
};

/**
 * Transform Prisma Profile to StandardNotificationPreferences
 */
export const transformNotificationPreferences = (profile: any): StandardNotificationPreferences => {
  return {
    emailNotifications: profile.emailNotifications,
    pushNotifications: profile.pushNotifications
  };
};