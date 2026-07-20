import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PHONE_NUMBER: 'register_phone_number',
  TEMP_TOKEN: 'temp_token',
};

export const storage = {
  // Phone number operations
  async setPhoneNumber(phone: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PHONE_NUMBER, phone);
    } catch (error) {
    }
  },

  async getPhoneNumber(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PHONE_NUMBER);
    } catch (error) {
      return null;
    }
  },

  async clearPhoneNumber(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PHONE_NUMBER);
    } catch (error) {
    }
  },

  // Temp token operations
  async setTempToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEMP_TOKEN, token);
    } catch (error) {
    }
  },

  async getTempToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TEMP_TOKEN);
    } catch (error) {
      return null;
    }
  },

  async clearTempToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TEMP_TOKEN);
    } catch (error) {
    }
  },

  // Clear all registration data
  async clearRegistrationData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.PHONE_NUMBER, STORAGE_KEYS.TEMP_TOKEN]);
    } catch (error) {
    }
  },
};