// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

// Specific response types for better type safety
export interface SuccessApiResponse<T = any> {
  success: true;
  message?: string;
  data: T;
  error?: never;
}

export interface ErrorApiResponse {
  success: false;
  message?: string;
  data?: never;
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
  };
}

// Union type for more precise typing
export type TypedApiResponse<T> = SuccessApiResponse<T> | ErrorApiResponse;

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  otpId: string;
  expiresAt: string;
}

export interface VerifyResetOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyResetOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

// User Types
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  // Profile data (joined from Profile model)
  profile?: UserProfileData;
}

export interface UserProfileData {
  bio?: string;
  address?: string;
  country?: string;
  stateId?: string;
  cityId?: string;
  postalCodeId?: string;
  // Backward compatibility fields
  city?: string;
  state?: string;
  postalCode?: string;
  zipCode?: string;
  dob?: string;
  gender?: string;
  // Notification preferences
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
  bookingNotifications?: boolean;
  adStatusNotifications?: boolean;
  systemNotifications?: boolean;
  promotionNotifications?: boolean;
}

export interface UpdateUserRequest {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  // Profile data
  profile?: {
    bio?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zipCode?: string | null;
    dob?: string | null;
    gender?: string | null;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    bookingNotifications?: boolean;
    adStatusNotifications?: boolean;
    systemNotifications?: boolean;
    promotionNotifications?: boolean;
  };
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password: string;
  avatar?: string;
  role?: UserRole;
  // Profile data
  profile?: {
    bio?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    dob?: string;
    gender?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    bookingNotifications?: boolean;
    adStatusNotifications?: boolean;
    systemNotifications?: boolean;
    promotionNotifications?: boolean;
  };
}

// Ad Status
export type AdStatus = 'REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Ad {
  id: string;
  title: string;
  description: string;
  price: number | null;
  discountedPrice?: number | null;
  status: AdStatus;
  images: string[];
  isFeatured: boolean;
  attachment?: string[];
  userId: string;
  categoryId: string;
  subcategoryId?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  enableBooking?: boolean;
  bookingType?: 'SLOTS' | 'STANDARD' | string;
  slots?: Array<{
    day: string;
    startTime: string;
    endTime: string;
    maxBookings: number;
  }>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  views?: number;
  moderatedBy?: string;
  moderatedAt?: string;
  rejectionReason?: string;
  isFlagged?: boolean;
  flagReason?: string;
  user?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    avatar?: string;
    createdAt: string;
    isVerified: boolean;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
  };
  location?: {
    id: string;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
    pincode?: string;
  };
  attributes?: Array<{
    id: string;
    adId: string;
    attributeId: string;
    value: string;
    attribute?: {
      id: string;
      name: string;
      type: 'text' | 'number' | 'boolean' | 'select';
      options?: string[];
    };
  }>;
  subscriptions?: Subscription[];
  bookings?: any[];
  moderationHistory?: ModerationHistory[];
}

// Platform Ads
export type PlatformAdPosition = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | 'POPUP';

export interface PlatformAd {
  id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  position: PlatformAdPosition;
  type: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformAdRequest {
  title?: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  position?: PlatformAdPosition;
  type?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdatePlatformAdRequest {
  title?: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  position?: PlatformAdPosition;
  type?: string;
  isActive?: boolean;
  order?: number;
}

export interface ModerationHistory {
  id: string;
  action: string;
  reason?: string;
  createdAt: string;
  moderator: {
    id: string;
    firstName: string;
    lastName?: string;
  };
}

export interface Subscription {
  id: string;
  userId: string;
  adId: string;
  startDate: string;
  endDate: string;
  isRenewed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    isVerified: boolean;
    createdAt: string;
  };
  ad?: {
    id: string;
    title: string;
    description: string;
    price: number;
    status: AdStatus;
    images: string[];
    createdAt: string;
  };
  transactions?: Transaction[];
}

export interface Transaction {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentProvider: 'RAZORPAY';
  paymentMethod?: string;
  paymentIntentId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  subscription?: Subscription;
}

export interface ExtendSubscriptionRequest {
  id: string;
  days: number;
}

export interface UpdateAdRequest {
  title?: string;
  description?: string;
  price?: number | null;
  discountedPrice?: number | null;
  status?: AdStatus;
  images?: string[];
  attachment?: string[] | null;
  categoryId?: string;
  subcategoryId?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  enableBooking?: boolean;
  isFeatured?: boolean;
  attributes?: Array<{
    attributeId: string;
    value: string;
  }>;
}

export interface CreateAdRequest {
  title: string;
  description: string;
  price: number | null;
  discountedPrice?: number | null;
  status?: AdStatus;
  images: string[];
  attachment?: string[] | null;
  categoryId: string;
  subcategoryId?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  locationRoad?: string;
  locationHouseNumber?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  locationPostalCode?: string;
  locationFormatted?: string;
  isFeatured?: boolean;
  enableBooking?: boolean;
  attributes?: Array<{
    attributeId: string;
    value: string;
  }>;
}

// Analytics Types
export interface DashboardStats {
  totalUsers: number;
  totalAds: number;
  approvedAds: number;
  pendingAds: number;
  totalBookings: number;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyRevenue: number;
  recentUsers: number;
  recentAds: number;
  recentActivity: {
    newUsers: number;
    newAds: number;
    newBookings: number;
    recentRevenue: number;
    approvedAds: number;
    period: string;
  };
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
}

export interface AdAnalytics {
  totalAds: number;
  activeAds: number;
  pendingAds: number;
  rejectedAds: number;
  expiredAds: number;
  featuredAds: number;
  adsByCategory: Record<string, number>;
  adCreationTrends: Array<{
    date: string;
    adsCreated: number;
  }>;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  averageOrderValue: number;
  revenueTrends: Array<{
    date: string;
    revenue: number;
  }>;
}

export interface LocationAnalytics {
  adsByLocation: Record<string, number>;
  topLocations: Array<{
    locationId: string;
    locationName: string;
    adCount: number;
  }>;
  geographicDistribution: Array<{
    location: string;
    adsCount: number;
  }>;
}

export interface WishlistAnalytics {
  totalWishlists: number;
  activeWishlistUsers: number;
  powerUsers: number;
  newWishlistUsers: number;
  averageWishlistSize: number;
  conversionRate: number;
  contactRate: number;
  topCategories: Array<{
    categoryName: string;
    count: number;
  }>;
  mostWishlistedAds: Array<{
    adId: string;
    adTitle: string;
    wishlistCount: number;
  }>;
  wishlistTrends: Array<{
    date: string;
    additions: number;
  }>;
}

// Attribute Types
export type AttributeType = 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'date';

export interface Attribute {
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

export interface CreateAttributeRequest {
  name: string;
  type: AttributeType;
  isRequired?: boolean;
  options?: string[];
  order?: number;
  image?: string;
}

export interface UpdateAttributeRequest {
  name?: string;
  type?: AttributeType;
  isRequired?: boolean;
  options?: string[] | null;
  order?: number;
  image?: string | null;
}

// Category Types
export interface Category {
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
  subcategories?: Subcategory[];
  adCount?: number;
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  adPlaceholder?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  order?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string;
  adPlaceholder?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  order?: number;
}

export interface Subcategory {
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
  attributes?: Attribute[];
  adCount?: number;
}

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
  description?: string | null;
  image?: string;
  supportsBooking?: boolean;
  isActive?: boolean;
  order?: number;
}

// Location Types
export interface State {
  id: string;
  name: string;
  code?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStateRequest {
  name: string;
  code?: string;
  isActive?: boolean;
}

export interface UpdateStateRequest {
  name?: string;
  code?: string;
  isActive?: boolean;
}


export interface City {
  id: string;
  name: string;
  code?: string;
  stateId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  state?: State;
  _count?: {
    postalCodes?: number;
    locations?: number;
  };
}

export interface CreateCityRequest {
  name: string;
  code?: string;
  stateId: string;
  isActive?: boolean;
}

export interface UpdateCityRequest {
  name?: string;
  code?: string;
  stateId?: string;
  isActive?: boolean;
}

export interface PostalCode {
  id: string;
  code: string;
  cityId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  city?: City;
  _count?: {
    locations?: number;
  };
}

export interface CreatePostalCodeRequest {
  code: string;
  cityId: string;
  isActive?: boolean;
}

export interface UpdatePostalCodeRequest {
  code?: string;
  cityId?: string;
  isActive?: boolean;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  country: string;
  stateId?: string;
  cityId?: string;
  postalCodeId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  city?: City;
  state?: State;
  postalCode?: PostalCode;
}

export interface CreateLocationRequest {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  country?: string;
  stateId?: string;
  cityId?: string;
  postalCodeId?: string;
  isActive?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country?: string;
  stateId?: string | null;
  cityId?: string | null;
  postalCodeId?: string | null;
  isActive?: boolean;
}

// Setting Types
export type SettingType = 'string' | 'number' | 'boolean' | 'json';

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: SettingType;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettingRequest {
  key: string;
  value: string;
  type: SettingType;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateSettingRequest {
  key?: string;
  value?: string;
  type?: SettingType;
  description?: string;
  isPublic?: boolean;
}

// Blog Types
export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  imageUrl?: string;
  isActive: boolean;
  isFeatured?: boolean;
  publishedAt?: string;
  authorId: string;
  categoryId?: string;
  category?: BlogCategory;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogRequest {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  imageUrl?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  categoryId?: string;
}

export interface UpdateBlogRequest {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  categoryId?: string | null;
}

// Blog Category Types
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    blogs: number;
  };
}

export interface CreateBlogCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

export interface UpdateBlogCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
  order?: number;
}

// Extended Blog interface for frontend use with additional computed properties
export interface BlogArticle extends Omit<Blog, 'category' | 'author'> {
  excerpt?: string;
  author?: string;
  category?: string;
  tags?: string[];
  featured?: boolean;
  readTime?: number;
  viewCount?: number;
  status?: 'draft' | 'published' | 'archived';
}

// Legal Document Types
export interface LegalDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLegalDocumentRequest {
  title: string;
  slug: string;
  content: string;
  isActive?: boolean;
}

export interface UpdateLegalDocumentRequest {
  title?: string;
  slug?: string;
  content?: string;
  isActive?: boolean;
}

// Booking Types
export type BookingStatus = 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED' | 'COMPLETED' | 'CANCELLATION_REQUESTED';

export interface Booking {
  id: string;
  adId: string;
  userId: string;
  startDate?: string;
  endDate?: string;
  slotId?: string;
  bookingDate?: string;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  ad?: {
    id: string;
    title: string;
    description: string;
    price: number;
    status: AdStatus;
    images: string[];
    createdAt: string;
    slots?: Array<{
      id?: string;
      day: string;
      startTime: string;
      endTime: string;
      maxBookings: number;
    }>;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar?: string;
  };
}

// Complaint Types
export type ComplaintStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';

export interface Complaint {
  id: string;
  bookingId: string;
  reporterId: string;
  respondentId: string;
  description: string;
  status: ComplaintStatus;
  resolutionNote?: string;
  _count?: {
    messages: number;
  };
  adminResolver?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    ad: {
      id: string;
      title: string;
    };
  };
  reporter: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
  respondent: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
  };
}

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderId: string;
  senderType: 'REPORTER' | 'RESPONDENT' | 'ADMIN';
  message: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface UpdateComplaintStatusRequest {
  status: ComplaintStatus;
  resolutionNote?: string;
}

// Transfer Types
export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type TransferType =
  | 'BOOKING_REFUND'
  | 'BOOKING_PAYMENT_TO_SELLER'
  | 'SUBSCRIPTION_REFUND'
  | 'SUBSCRIPTION_PAYOUT'
  | 'AD_PAYMENT'
  | 'OTHER';

export interface Transfer {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  transactionId: string | null;
  bookingId: string | null;
  subscriptionId: string | null;
  adId: string | null;
  amount: number;
  currency: string;
  status: TransferStatus;
  transferType: TransferType;
  description: string | null;
  notes: string | null;
  processedAt: string | null;
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
  fromUser?: UserBasic;
  toUser?: UserBasic;
  booking?: BookingBasic;
  subscription?: SubscriptionBasic;
  ad?: AdBasic;
  processedByUser?: UserBasic;
}

export interface UserBasic {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  avatar?: string;
}

export interface BookingBasic {
  id: string;
  status: BookingStatus;
  startDate?: string;
  endDate?: string;
  ad?: {
    id: string;
    title: string;
  };
}

export interface SubscriptionBasic {
  id: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  ad?: {
    id: string;
    title: string;
  };
}

export interface AdBasic {
  id: string;
  title: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateTransferRequest {
  fromUserId?: string;
  toUserId?: string;
  transactionId?: string;
  bookingId?: string;
  subscriptionId?: string;
  adId?: string;
  amount: number;
  currency?: string;
  transferType: TransferType;
  description?: string;
  notes?: string;
}

export interface UpdateTransferStatusRequest {
  status: 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

