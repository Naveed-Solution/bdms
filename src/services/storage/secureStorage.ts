/**
 * Secure Storage Service
 * 
 * Handles secure storage of sensitive data (tokens, passwords)
 * Uses expo-secure-store for encrypted storage
 * 
 * Purpose:
 * - Store authentication tokens securely
 * - Encrypted storage for sensitive data
 * - Auto-logout on token expiry
 * 
 * Installation: npx expo install expo-secure-store
 */

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_ID_KEY = 'user_id';

export const secureStorage = {
  /**
   * Save authentication token
   */
  saveToken: async (token: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      console.log('✅ Token saved securely');
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  },

  /**
   * Get authentication token
   */
  getToken: async (): Promise<string | null> => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  /**
   * Delete authentication token
   */
  deleteToken: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      console.log('✅ Token deleted');
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  },

  /**
   * Save user ID
   */
  saveUserId: async (userId: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(USER_ID_KEY, userId);
      console.log('✅ User ID saved');
    } catch (error) {
      console.error('Error saving user ID:', error);
    }
  },

  /**
   * Get user ID
   */
  getUserId: async (): Promise<string | null> => {
    try {
      const userId = await SecureStore.getItemAsync(USER_ID_KEY);
      return userId;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  },

  /**
   * Clear all secure data
   */
  clearAll: async (): Promise<void> => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_ID_KEY),
      ]);
      console.log('✅ All secure data cleared');
    } catch (error) {
      console.error('Error clearing secure data:', error);
    }
  },
};

