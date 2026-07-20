import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface PublicSettings {
  siteName?: string;
  siteDescription?: string;
  contactEmail?: string;
  customerCareEmail?: string;
  contactPhone?: string;
  socialLinks?: any;
  maintenanceMode?: boolean;
  allowRegistration?: boolean;
  termsOfService?: string;
  privacyPolicy?: string;
  supportHours?: string;
  currency?: string;
  timezone?: string;
}

export interface SystemSettings {
  subscriptionPrice: number;
  subscriptionDuration: number;
  freeAdDuration: number;
  reminderExpirationDays: number;
  bookingPrice: number;
  autoRefundDays: number;
  autoCompleteBookingDays: number;
  autoCancelBookingDays: number;
  serviceFeeFixed: number;
  customerCareEmail?: string;
  termsOfService?: string;
  privacyPolicy?: string;
  siteName?: string;
  razorpayKeyId?: string;
}

export interface HeroSettings {
  title: string;
  subtitle: string;
  image: string;
}

export interface SettingsResponse {
  system: SystemSettings;
}

class SettingsService {
  /**
   * Get system settings (admin endpoint)
   */
  async getSystemSettings(): Promise<ApiResponse<SettingsResponse>> {
    return apiService.get('/admin/settings');
  }

  /**
   * Get public system settings (includes subscription pricing)
   */
  async getPublicSystemSettings(): Promise<ApiResponse<SystemSettings>> {
    return apiService.get(API_ENDPOINTS.SETTINGS.SYSTEM);
  }

  /**
   * Get public settings (general settings)
   */
  async getPublicSettings(): Promise<ApiResponse<PublicSettings>> {
    return apiService.get(API_ENDPOINTS.SETTINGS.PUBLIC);
  }

  /**
   * Get customer care email with fallback to environment config
   */
  async getCustomerCareEmail(): Promise<string> {
    try {
      // Try system settings first (includes customer care email)
      const response = await this.getPublicSystemSettings();
      if (response.success && response.data?.customerCareEmail) {
        return response.data.customerCareEmail;
      }
    } catch (error) {
      console.error('Error fetching customer care email:', error);
    }

    // Fallback to environment config
    const { config } = await import('@/config/environment');
    return config.contact.customerCareEmail;
  }

  /**
   * Get hero settings for home page
   */
  async getHeroSettings(): Promise<ApiResponse<HeroSettings>> {
    return apiService.get('/public/hero-settings');
  }

  /**
   * Get subscription settings with fallback
   */
  async getSubscriptionSettings(): Promise<{
    subscriptionPrice: number;
    subscriptionDuration: number;
    freeAdDuration: number;
    reminderExpirationDays: number;
    subscriptionCurrency: string;
  }> {
    const defaults = {
      subscriptionPrice: 99,
      subscriptionDuration: 7,
      freeAdDuration: 3,
      reminderExpirationDays: 3,
      subscriptionCurrency: 'INR'
    };

    try {
      // Use public system settings endpoint first (includes subscription pricing)
      const response = await this.getPublicSystemSettings();
      if (response.success && response.data) {
        const settings = response.data;
        return {
          subscriptionPrice: settings.subscriptionPrice || defaults.subscriptionPrice,
          subscriptionDuration: settings.subscriptionDuration || defaults.subscriptionDuration,
          freeAdDuration: settings.freeAdDuration || defaults.freeAdDuration,
          reminderExpirationDays: settings.reminderExpirationDays || defaults.reminderExpirationDays,
          subscriptionCurrency: defaults.subscriptionCurrency
        };
      }
    } catch (publicError) {
      console.error('Error fetching public system settings:', publicError);

      try {
        // Fallback to admin settings
        const response = await this.getSystemSettings();
        if (response.success && response.data?.system) {
          const systemSettings = response.data.system;
          return {
            subscriptionPrice: systemSettings.subscriptionPrice || defaults.subscriptionPrice,
            subscriptionDuration: systemSettings.subscriptionDuration || defaults.subscriptionDuration,
            freeAdDuration: systemSettings.freeAdDuration || defaults.freeAdDuration,
            reminderExpirationDays: systemSettings.reminderExpirationDays || defaults.reminderExpirationDays,
            subscriptionCurrency: defaults.subscriptionCurrency
          };
        }
      } catch (adminError) {
        console.error('Error fetching admin system settings fallback:', adminError);
      }
    }

    return defaults;
  }
}

export const settingsService = new SettingsService();
export default settingsService;
