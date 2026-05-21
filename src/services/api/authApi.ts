/**
 * Authentication API Service
 * 
 * Handles all authentication-related API calls
 * 
 * Endpoints:
 * - POST /auth/login
 * - POST /auth/register
 * - POST /auth/logout
 * - POST /auth/forgot-password
 * - POST /auth/verify-otp
 */

import { apiClient } from './apiClient';

export const authApi = {
  /**
   * Login user
   * @param email - User email
   * @param password - User password
   * @returns User data and authentication token
   */
  login: async (email: string, password: string) => {
    return apiClient.post('/auth/login', { email, password });
  },

  /**
   * Register new user
   * @param userData - User registration data
   * @returns Created user and token
   */
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    bloodType?: string;
  }) => {
    return apiClient.post('/auth/register', userData);
  },

  /**
   * Logout user
   */
  logout: async () => {
    return apiClient.post('/auth/logout', {});
  },

  /**
   * Request password reset
   * @param email - User email
   */
  forgotPassword: async (email: string) => {
    return apiClient.post('/auth/forgot-password', { email });
  },

  /**
   * Verify OTP
   * @param email - User email
   * @param otp - One-time password
   */
  verifyOTP: async (email: string, otp: string) => {
    return apiClient.post('/auth/verify-otp', { email, otp });
  },
};

