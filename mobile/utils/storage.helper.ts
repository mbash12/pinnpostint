/**
 * Cross-platform storage utility
 * Handles AsyncStorage for mobile and localStorage for web
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageHelper {
  /**
   * Check if running on web platform
   */
  private isWeb(): boolean {
    return Platform.OS === 'web';
  }

  /**
   * Get item from storage
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (this.isWeb()) {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      } else {
        // Use AsyncStorage for mobile
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error(`Error getting item ${key} from storage:`, error);
      return null;
    }
  }

  /**
   * Set item in storage
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isWeb()) {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } else {
        // Use AsyncStorage for mobile
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Error setting item ${key} in storage:`, error);
      throw error;
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (this.isWeb()) {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } else {
        // Use AsyncStorage for mobile
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing item ${key} from storage:`, error);
      throw error;
    }
  }

  /**
   * Clear all items from storage
   */
  async clear(): Promise<void> {
    try {
      if (this.isWeb()) {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
      } else {
        // Use AsyncStorage for mobile
        await AsyncStorage.clear();
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Get all keys from storage (mobile only)
   */
  async getAllKeys(): Promise<string[]> {
    try {
      if (this.isWeb()) {
        // For web, return keys from localStorage
        if (typeof localStorage !== 'undefined') {
          return Object.keys(localStorage);
        }
        return [];
      } else {
        // Use AsyncStorage for mobile
        return await AsyncStorage.getAllKeys();
      }
    } catch (error) {
      console.error('Error getting all keys from storage:', error);
      return [];
    }
  }
}

// Export singleton instance
export const storageHelper = new StorageHelper();
export default storageHelper;