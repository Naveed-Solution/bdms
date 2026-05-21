/**
 * Donor API Service
 * 
 * Handles donor-related API calls
 * 
 * Endpoints:
 * - GET /donors
 * - GET /donors/:id
 * - GET /donors/search
 * - POST /donors/donations
 * - GET /donors/donations/history
 */

import { apiClient } from './apiClient';

export const donorApi = {
  /**
   * Get all donors
   */
  getAll: async (filters?: any) => {
    return apiClient.get('/donors', { params: filters });
  },

  /**
   * Get donor by ID
   */
  getById: async (id: string) => {
    return apiClient.get(`/donors/${id}`);
  },

  /**
   * Search donors by blood type and location
   */
  searchDonors: async (bloodType: string, latitude: number, longitude: number, radius: number = 10) => {
    return apiClient.get('/donors/search', {
      params: { bloodType, latitude, longitude, radius }
    });
  },

  /**
   * Record new donation
   */
  recordDonation: async (donationData: {
    donorId: string;
    bloodType: string;
    units: number;
    date: string;
  }) => {
    return apiClient.post('/donors/donations', donationData);
  },

  /**
   * Get donation history
   */
  getDonationHistory: async (donorId: string) => {
    return apiClient.get(`/donors/${donorId}/donations/history`);
  },

  /**
   * Check eligibility
   */
  checkEligibility: async (donorId: string) => {
    return apiClient.get(`/donors/${donorId}/eligibility`);
  },
};

