import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdLocation } from '@/types/location.types';

const AD_DATA_KEY = 'temp_ad_data';

export interface AdData {
  formData: {
    title: string;
    description: string;
    price: string;
    useDiscountedPrice: boolean;
    discountedPrice: string;
    brand?: string;
    year?: string;
    mileage?: string;
    fuelType?: string;
    color?: string;
    enableBooking: boolean;
    bookingType?: 'DEFAULT' | 'SLOTS';
    slots?: any[];
    bookingStartDate?: string;
    bookingEndDate?: string;
    location?: AdLocation;
  };
  images: string[];
  uploadedFiles?: any[];
  categoryName: string;
  subcategoryName: string;
  categoryPlaceholder?: string;
  categoryId?: string;
  subcategoryId?: string;
  attributeValues?: Record<string, string>;
}

export const adDataStorage = {
  async store(data: AdData): Promise<void> {
    try {
      await AsyncStorage.setItem(AD_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      throw error;
    }
  },

  async retrieve(): Promise<AdData | null> {
    try {
      const data = await AsyncStorage.getItem(AD_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AD_DATA_KEY);
    } catch (error) {
    }
  }
};
