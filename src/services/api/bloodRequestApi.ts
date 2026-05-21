/**
 * Blood Request API Service
 * 
 * Handles blood request operations
 * 
 * Endpoints:
 * - POST /requests
 * - GET /requests
 * - GET /requests/:id
 * - PUT /requests/:id
 * - DELETE /requests/:id
 */

import { apiClient } from './apiClient';

export const bloodRequestApi = {
  /**
   * Create new blood request
   */
  create: async (requestData: {
    userId: string;
    bloodType: string;
    units: number;
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    notes?: string;
  }) => {
    return apiClient.post('/requests', requestData);
  },

  /**
   * Get all requests
   */
  getAll: async (filters?: any) => {
    return apiClient.get('/requests', { params: filters });
  },

  /**
   * Get request by ID
   */
  getById: async (id: string) => {
    return apiClient.get(`/requests/${id}`);
  },

  /**
   * Update request
   */
  update: async (id: string, updates: any) => {
    return apiClient.put(`/requests/${id}`, updates);
  },

  /**
   * Delete request
   */
  delete: async (id: string) => {
    return apiClient.delete(`/requests/${id}`);
  },

  /**
   * Respond to request (for donors)
   */
  respond: async (requestId: string, donorId: string, response: 'accepted' | 'declined') => {
    return apiClient.post(`/requests/${requestId}/respond`, { donorId, response });
  },
};

