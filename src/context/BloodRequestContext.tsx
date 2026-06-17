import React, { createContext, useContext, useState, useEffect } from 'react';
import { bloodRequestAPI, BloodRequest as APIBloodRequest } from '../services/api';

/**
 * Blood Request Lifecycle States
 * 
 * Flow: PENDING → ACCEPTED → COMPLETED or CANCELLED
 * 
 * - PENDING: Request submitted, searching for donors
 * - ACCEPTED: One or more donors matched
 * - COMPLETED: Blood donation fulfilled
 * - CANCELLED: Request was cancelled by donor or recipient
 */
export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

/**
 * Urgency Levels for Blood Requests
 * 
 * - NORMAL: Standard request (24-48 hours)
 * - EMERGENCY: Critical request (immediate response needed)
 */
export type UrgencyLevel = 'NORMAL' | 'EMERGENCY';

/**
 * Donor Information
 * 
 * Represents a donor who has accepted a request
 */
export interface AcceptedDonor {
  donorId: string;
  donorName: string;
  acceptedAt: Date;
}

/**
 * Blood Request Data Model
 * 
 * Represents a single blood request from a recipient
 */
export interface BloodRequest {
  id: string;
  recipientId: string;
  recipientName: string;
  bloodGroup: string;
  units: number;
  acceptedUnits: number;
  urgencyLevel: UrgencyLevel;
  location: string;
  notes?: string;
  status: RequestStatus;
  recipientMobile?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedBy?: AcceptedDonor[];
  declinedBy?: string[];
  shareLocation?: boolean;
  recipientLatitude?: number;
  recipientLongitude?: number;
}

/**
 * Blood Request Context Interface
 * 
 * Provides methods for managing blood requests throughout the app
 * NOW USES BACKEND SQLite DATABASE - All data synced across devices
 */
interface BloodRequestContextType {
  requests: BloodRequest[];
  activeRequest: BloodRequest | null;
  createRequest: (request: Omit<BloodRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateRequestStatus: (requestId: string, status: RequestStatus) => Promise<void>;
  getRequestById: (requestId: string) => BloodRequest | undefined;
  getUserRequests: (userId: string) => BloodRequest[];
  getAvailableRequests: () => BloodRequest[];
  acceptRequest: (requestId: string, donorId: string, donorName: string) => Promise<void>;
  declineRequest: (requestId: string, donorId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  isLoading: boolean;
}

const BloodRequestContext = createContext<BloodRequestContextType | undefined>(undefined);

/**
 * Blood Request Provider
 * 
 * Manages blood request state with backend SQLite database
 * - All data stored on server
 * - Synced across web and mobile
 * - Real-time updates from backend
 */
export const BloodRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<BloodRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRequestCount, setLastRequestCount] = useState(0); // Track changes

  /**
   * Load requests from backend on mount and poll every 1 second
   * Fast polling for real-time updates
   */
  useEffect(() => {
    // Initial load with retry on failure
    loadRequests();
    
    // Poll for updates every 1 second for real-time status updates
    const interval = setInterval(() => {
      loadRequests();
    }, 1000); // Fast polling for real-time experience

    return () => clearInterval(interval);
  }, []);

  /**
   * Convert API response to local BloodRequest format
   */
  const convertAPIRequest = (apiRequest: any): BloodRequest => {
    // Handle both snake_case (from backend) and camelCase (from frontend)
    return {
      id: apiRequest.id,
      recipientId: apiRequest.recipient_id || apiRequest.recipientId,
      recipientName: apiRequest.recipient_name || apiRequest.recipientName,
      bloodGroup: apiRequest.blood_group || apiRequest.bloodGroup,
      units: apiRequest.units || 1,
      acceptedUnits: apiRequest.accepted_units || apiRequest.acceptedUnits || 0,
      urgencyLevel: apiRequest.urgency_level || apiRequest.urgencyLevel,
      location: apiRequest.location,
      notes: apiRequest.notes,
      status: apiRequest.status,
      recipientMobile: apiRequest.recipient_mobile || apiRequest.recipientMobile,
      createdAt: new Date(apiRequest.created_at ? apiRequest.created_at * 1000 : apiRequest.createdAt),
      updatedAt: new Date(apiRequest.updated_at ? apiRequest.updated_at * 1000 : apiRequest.updatedAt),
      acceptedBy: apiRequest.acceptedBy?.map((d: any) => ({
        donorId: d.donor_id || d.donorId,
        donorName: d.donor_name || d.donorName,
        acceptedAt: new Date(d.accepted_at ? d.accepted_at * 1000 : d.acceptedAt),
      })),
      declinedBy: apiRequest.declinedBy,
    };
  };

  /**
   * Load all blood requests from backend
   */
  const loadRequests = async () => {
    try {
      const response = await bloodRequestAPI.getAll();
      const convertedRequests = response.requests.map(convertAPIRequest);
      setRequests(convertedRequests);
      
      // Only log when count changes or on initial load
      if (isLoading || convertedRequests.length !== lastRequestCount) {
        console.log('✅ Loaded', convertedRequests.length, 'blood requests from backend');
        const cancelledCount = convertedRequests.filter(r => r.status === 'CANCELLED').length;
        if (cancelledCount > 0) {
          console.log(`   - ${cancelledCount} CANCELLED requests`);
        }
        setLastRequestCount(convertedRequests.length);
      }
    } catch (error: any) {
      // Only log error once, not on every poll
      if (isLoading) {
        console.error('❌ Error loading blood requests:', error.message || error);
        console.log('ℹ️ Backend might not be reachable. Running in offline mode.');
      }
      // Set empty array to avoid undefined errors
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh requests manually
   */
  const refreshRequests = async (): Promise<void> => {
    await loadRequests();
  };

  /**
   * Create a new blood request
   * 
   * @param request - Request data without id, status, and timestamps
   * @returns requestId - The newly created request ID
   * 
   * Flow:
   * 1. Generate unique ID
   * 2. Send to backend API
   * 3. Backend stores in SQLite
   * 4. Reload requests from backend
   */
  const createRequest = async (
    request: Omit<BloodRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('✅ Creating blood request:', requestId);

      const response = await bloodRequestAPI.create({
        id: requestId,
        recipientId: request.recipientId,
        recipientName: request.recipientName,
        bloodGroup: request.bloodGroup,
        units: request.units || 1,
        urgencyLevel: request.urgencyLevel,
        location: request.location,
        notes: request.notes,
        shareLocation: request.shareLocation,
        recipientLatitude: request.recipientLatitude,
        recipientLongitude: request.recipientLongitude,
      });

      if (response.success) {
        const newRequest = convertAPIRequest(response.request);
        setActiveRequest(newRequest);
        
        // Reload all requests
        await loadRequests();
        
        console.log('✅ Blood request created successfully');
        return requestId;
      }

      throw new Error('Failed to create request');
    } catch (error) {
      console.error('❌ Error creating blood request:', error);
      throw error;
    }
  };

  /**
   * Update the status of a blood request
   * 
   * @param requestId - ID of the request to update
   * @param status - New status (PENDING, ACCEPTED, COMPLETED)
   * 
   * Flow:
   * 1. Send to backend API
   * 2. Backend updates in SQLite
   * 3. Reload requests from backend
   */
  const updateRequestStatus = async (requestId: string, status: RequestStatus): Promise<void> => {
    try {
      console.log(`🔄 Updating request ${requestId} to status: ${status}`);

      await bloodRequestAPI.updateStatus(requestId, status);

      // Reload requests
      await loadRequests();

      console.log('✅ Request status updated successfully');
    } catch (error) {
      console.error('❌ Error updating request status:', error);
      throw error;
    }
  };

  /**
   * Get a specific request by ID
   */
  const getRequestById = (requestId: string): BloodRequest | undefined => {
    return requests.find(req => req.id === requestId);
  };

  /**
   * Get all requests for a specific user
   */
  const getUserRequests = (userId: string): BloodRequest[] => {
    return requests
      .filter(req => req.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  /**
   * Get all available requests for donors
   * 
   * Returns requests that are not completed or cancelled and can be accepted by donors
   * Sorted by urgency (Emergency first) then by creation date
   * 
   * Note: This simulates the donor matching algorithm
   * In production, this would filter by:
   * - Blood group compatibility
   * - Geographic proximity
   * - Donor eligibility status
   */
  const getAvailableRequests = (): BloodRequest[] => {
    return requests
      .filter(req => req.status !== 'COMPLETED' && req.status !== 'CANCELLED')
      .sort((a, b) => {
        // Emergency requests first
        if (a.urgencyLevel === 'EMERGENCY' && b.urgencyLevel !== 'EMERGENCY') return -1;
        if (a.urgencyLevel !== 'EMERGENCY' && b.urgencyLevel === 'EMERGENCY') return 1;
        // Then sort by creation date (newest first)
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  };

  /**
   * Accept a blood request as a donor
   * 
   * @param requestId - ID of the request to accept
   * @param donorId - ID of the donor accepting the request
   * @param donorName - Name of the donor accepting the request
   * 
   * Flow:
   * 1. Send to backend API
   * 2. Backend adds donor to accepted_donors table
   * 3. Backend updates request status if needed
   * 4. Reload requests from backend
   * 
   * Note: Multiple donors can accept the same request
   * This simulates a pool of available donors for each request
   */
  const acceptRequest = async (
    requestId: string,
    donorId: string,
    donorName: string
  ): Promise<void> => {
    try {
      console.log(`🩸 Donor ${donorName} accepting request ${requestId}`);

      await bloodRequestAPI.accept(requestId, donorId, donorName);

      // Reload requests
      await loadRequests();

      console.log('✅ Request accepted successfully');
    } catch (error) {
      console.error('❌ Error accepting request:', error);
      throw error;
    }
  };

  /**
   * Decline a blood request as a donor
   * 
   * @param requestId - ID of the request to decline
   * @param donorId - ID of the donor declining the request
   * 
   * Flow:
   * 1. Send to backend API
   * 2. Backend adds to declined_donors table
   * 3. Request hidden from donor's view
   * 4. Reload requests from backend
   * 
   * Note: Declined requests are hidden from that donor's view
   * but remain available for other donors
   */
  const declineRequest = async (
    requestId: string,
    donorId: string
  ): Promise<void> => {
    try {
      console.log(`❌ Donor ${donorId} declining request ${requestId}`);

      await bloodRequestAPI.decline(requestId, donorId);

      // Reload requests
      await loadRequests();

      console.log('✅ Request declined successfully');
    } catch (error) {
      console.error('❌ Error declining request:', error);
      throw error;
    }
  };

  const value: BloodRequestContextType = {
    requests,
    activeRequest,
    createRequest,
    updateRequestStatus,
    getRequestById,
    getUserRequests,
    getAvailableRequests,
    acceptRequest,
    declineRequest,
    refreshRequests,
    isLoading,
  };

  return (
    <BloodRequestContext.Provider value={value}>
      {children}
    </BloodRequestContext.Provider>
  );
};

/**
 * Hook to use Blood Request Context
 * 
 * @throws Error if used outside of BloodRequestProvider
 */
export const useBloodRequest = (): BloodRequestContextType => {
  const context = useContext(BloodRequestContext);
  if (!context) {
    throw new Error('useBloodRequest must be used within BloodRequestProvider');
  }
  return context;
};
