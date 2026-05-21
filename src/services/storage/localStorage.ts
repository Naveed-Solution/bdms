/**
 * Local Storage Service
 * 
 * Wrapper around AsyncStorage for non-sensitive data
 * 
 * Purpose:
 * - Cache API responses
 * - Store user preferences
 * - Offline data support
 * 
 * Installation: npx expo install @react-native-async-storage/async-storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const localStorage = {
  /**
   * Save data
   */
  setItem: async (key: string, value: any): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      console.log(`✅ Saved: ${key}`);
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  },

  /**
   * Get data
   */
  getItem: async (key: string): Promise<any> => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  },

  /**
   * Remove data
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
      console.log(`✅ Removed: ${key}`);
    } catch (error) {
      console.error('Error removing data:', error);
    }
  },

  /**
   * Clear all data
   */
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
      console.log('✅ All local storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  /**
   * Get multiple items
   */
  multiGet: async (keys: string[]): Promise<any> => {
    try {
      const values = await AsyncStorage.multiGet(keys);
      return values.reduce((acc, [key, value]) => {
        acc[key] = value ? JSON.parse(value) : null;
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('Error getting multiple items:', error);
      return {};
    }
  },
};

