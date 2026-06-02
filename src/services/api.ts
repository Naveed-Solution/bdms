/**
 * API Service
 * 
 * Centralized API communication with backend SQLite database
 * All data is now stored on the server and synced across devices
 * 
 * IMPORTANT: Update API_BASE_URL to match your backend server:
 * - Local: http://localhost:3000/api
 * - LAN Web: http://192.168.1.13:3000/api
 * - LAN Android: http://192.168.1.13:3000/api
 * - Android Emulator: http://10.0.2.2:3000/api (special IP for emulator)
 */

// API Base URL - Update this to match your backend IP
// Current IP: 192.168.1.26 (verified: Dec 26, 2025)
export const API_BASE_URL = 'https://bdms-production-5878.up.railway.app/api';

/**
 * Generic API request handler with improved error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
  console.log('❌ SERVER ERROR:', data);
  throw new Error(data.error || `HTTP error! status: ${response.status}`);
}

    return data;
  } catch (error: any) {
    // Network errors - provide helpful message
    if (error.message === 'Network request failed') {
      console.error(`Cannot connect to ${url}`);
      throw new Error('Backend not reachable. Check if backend is running on port 3000.');
    }
    
    throw error;
  }
}

// ============================================
// AUTHENTICATION API
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface RegisterData {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface LoginData {
  email: string;
  password: string;
  role: string;
}

export const authAPI = {
  /**
   * Register a new user
   */
  register: async (data: RegisterData): Promise<{ success: boolean; user: User }> => {
    return apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Login user
   */
  login: async (data: LoginData): Promise<{ success: boolean; user: User }> => {
    return apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get user's role by email (for intelligent login)
   */
  getUserRole: async (email: string): Promise<{ role: string }> => {
    return apiRequest('/get-user-role', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Reset password
   */
  resetPassword: async (email: string, newPassword: string): Promise<{ success: boolean }> => {
    return apiRequest('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword }),
    });
  },

  /**
   * Get all users (for debugging)
   */
  getUsers: async (): Promise<{ users: User[] }> => {
    return apiRequest('/users', {
      method: 'GET',
    });
  },
};

// ============================================
// BLOOD REQUEST API
// ============================================

export interface BloodRequest {
  id: string;
  recipientId: string;
  recipientName: string;
  bloodGroup: string;
  units: number;
  acceptedUnits: number;
  urgencyLevel: 'NORMAL' | 'EMERGENCY';
  location: string;
  notes?: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED';
  recipientMobile?: string;
  createdAt: number;
  updatedAt: number;
  shareLocation?: boolean;
  recipientLatitude?: number;
  recipientLongitude?: number;
  recipientLocationUpdatedAt?: number;
  acceptedBy?: Array<{
    donorId: string;
    donorName: string;
    acceptedAt: number;
  }>;
  declinedBy?: string[];
}

export interface CreateRequestData {
  id: string;
  recipientId: string;
  recipientName: string;
  bloodGroup: string;
  units: number;
  urgencyLevel: 'NORMAL' | 'EMERGENCY';
  location: string;
  notes?: string;
  shareLocation?: boolean;
  recipientLatitude?: number;
  recipientLongitude?: number;
}

export const bloodRequestAPI = {
  /**
   * Create a new blood request
   */
  create: async (data: CreateRequestData): Promise<{ success: boolean; requestId: string; request: BloodRequest }> => {
    return apiRequest('/blood-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get all blood requests
   */
  getAll: async (): Promise<{ requests: BloodRequest[] }> => {
    return apiRequest('/blood-requests', {
      method: 'GET',
    });
  },

  /**
   * Get a specific blood request by ID
   */
  getById: async (id: string): Promise<{ request: BloodRequest }> => {
    return apiRequest(`/blood-requests/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Update request status
   */
  updateStatus: async (id: string, status: string): Promise<{ success: boolean }> => {
    return apiRequest(`/blood-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Donor accepts a request
   */
  accept: async (requestId: string, donorId: string, donorName: string, currentLocation?: string): Promise<{ success: boolean }> => {
    return apiRequest(`/blood-requests/${requestId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ donorId, donorName, currentLocation }),
    });
  },

  /**
   * Donor declines a request
   */
  decline: async (requestId: string, donorId: string): Promise<{ success: boolean }> => {
    return apiRequest(`/blood-requests/${requestId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ donorId }),
    });
  },

  /**
   * Get available requests for a donor (with eligibility checks)
   */
  getAvailableForDonor: async (donorId: string): Promise<{ requests: BloodRequest[]; message?: string }> => {
    const response = await apiRequest<{ requests: any[]; message?: string }>(`/blood-requests/available/${donorId}`, {
      method: 'GET',
    });
    
    // Convert snake_case to camelCase and timestamps to Date objects
    const requests = (response.requests || []).map(req => ({
      id: req.id,
      recipientId: req.recipient_id || req.recipientId,
      recipientName: req.recipient_name || req.recipientName || '',
      bloodGroup: req.blood_group || req.bloodGroup || '',
      units: req.units || 1,
      acceptedUnits: req.accepted_units || req.acceptedUnits || 0,
      urgencyLevel: req.urgency_level || req.urgencyLevel || 'ROUTINE',
      location: req.location || '',
      notes: req.notes || '',
      status: req.status || 'PENDING',
      recipientMobile: req.recipient_mobile || req.recipientMobile,
      createdAt: req.createdAt ? new Date(req.createdAt) : new Date(),
      updatedAt: req.updatedAt ? new Date(req.updatedAt) : new Date(),
      acceptedBy: req.acceptedBy?.map((d: any) => ({
        donorId: d.donor_id || d.donorId,
        donorName: d.donor_name || d.donorName,
        acceptedAt: d.accepted_at ? new Date(d.accepted_at) : (d.acceptedAt ? new Date(d.acceptedAt) : new Date()),
      })),
      declinedBy: req.declinedBy || [],
    }));
    
    return {
      requests,
      message: response.message,
    };
  },

  /**
   * Get donor statistics (accepted and declined counts)
   */
  getDonorStats: async (donorId: string): Promise<{ donatedCount: number }> => {
    return apiRequest(`/donor-stats/${donorId}`, {
      method: 'GET',
    });
  },

  /**
   * Get all accepted donations for a donor with full details
   */
  getDonorAcceptedDonations: async (donorId: string): Promise<{ donations: any[] }> => {
    const response = await apiRequest<{ donations: any[] }>(`/donor-accepted/${donorId}`, {
      method: 'GET',
    });
    
    // Convert timestamps to Date objects and map fields explicitly
    const donations = (response.donations || []).map(d => ({
      requestId: d.id, // blood request ID
      recipientId: d.recipientId || d.recipient_id, // IMPORTANT for rating
      recipientName: d.recipientName || d.recipient_name || '',
      recipientMobile: d.recipientMobile || d.recipient_mobile || '',
      bloodGroup: d.bloodGroup || d.blood_group || '',
      units: d.units || 0,
      urgencyLevel: d.urgencyLevel || d.urgency_level || 'NORMAL',
      location: d.location || '',
      notes: d.notes || '',
      status: d.status || 'ACCEPTED',
      acceptedUnits: d.acceptedUnits || d.accepted_units || 0,
      shareLocation: d.shareLocation || d.share_location || false,
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
      acceptedAt: d.acceptedAt ? new Date(d.acceptedAt) : new Date(),
      donorCompleted: d.donorCompleted || d.donor_completed || 0,
      donorCompletedAt: d.donorCompletedAt ? new Date(d.donorCompletedAt) : null,
      recipientCompleted: d.recipientCompleted || d.recipient_completed || 0,
      recipientCompletedAt: d.recipientCompletedAt ? new Date(d.recipientCompletedAt) : null,
      // Cancellation data
      cancelledBy: d.cancelledBy || d.cancelled_by,
      cancelledByRole: d.cancelledByRole || d.cancelled_by_role,
      cancellationReason: d.cancellationReason || d.cancellation_reason,
      cancelledAt: d.cancelledAt ? new Date(d.cancelledAt) : null,
      // Rating data
      donorRating: d.donorRating || d.donor_rating,
      donorComment: d.donorComment || d.donor_comment,
      donorRatedAt: d.donorRatedAt ? new Date(d.donorRatedAt) : null,
      recipientRating: d.recipientRating || d.recipient_rating,
      recipientComment: d.recipientComment || d.recipient_comment,
      recipientRatedAt: d.recipientRatedAt ? new Date(d.recipientRatedAt) : null,
    }));
    
    return { donations };
  },

  /**
   * Get list of accepted donors for a request
   */
  getAcceptedDonors: async (requestId: string): Promise<{ success: boolean; donors: any[] }> => {
    const response = await apiRequest<{ success: boolean; donors: any[] }>(`/blood-requests/${requestId}/accepted-donors`, {
      method: 'GET',
    });
    
    // Convert snake_case to camelCase
    const donors = (response.donors || []).map(d => ({
      donorId: d.donor_id || d.donorId,
      donorName: d.donor_name || d.donorName,
      mobile: d.mobile,
      address: d.address,
      city: d.city,
      donorCurrentLocation: d.donor_current_location || d.donorCurrentLocation,
      profileImage: d.profile_image || d.profileImage || undefined,
      acceptedAt: d.accepted_at ? new Date(d.accepted_at * 1000) : new Date(),
      donorCompleted: d.donor_completed || d.donorCompleted || 0,
      donorCompletedAt: d.donor_completed_at ? new Date(d.donor_completed_at * 1000) : null,
      recipientCompleted: d.recipient_completed || d.recipientCompleted || 0,
      recipientCompletedAt: d.recipient_completed_at ? new Date(d.recipient_completed_at * 1000) : null,
      status: d.status || 'ACCEPTED',
      // Rating data
      donorRating: d.donor_rating || d.donorRating,
      donorComment: d.donor_comment || d.donorComment,
      donorRatedAt: d.donor_rated_at ? new Date(d.donor_rated_at * 1000) : null,
      recipientRating: d.recipient_rating || d.recipientRating,
      recipientComment: d.recipient_comment || d.recipientComment,
      recipientRatedAt: d.recipient_rated_at ? new Date(d.recipient_rated_at * 1000) : null,
    }));
    
    return { success: response.success, donors };
  },

  /**
   * Mark donation as completed
   */
  markCompleted: async (requestId: string, userId: string, role: 'donor' | 'recipient', donorId?: string): Promise<{ success: boolean; status: string; bothCompleted: boolean }> => {
    return apiRequest(`/blood-requests/${requestId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ userId, role, donorId }),
    });
  },

  /**
   * Cancel a blood request
   */
  cancelRequest: async (requestId: string, userId: string, role: 'donor' | 'recipient', reason?: string, donorId?: string): Promise<{ success: boolean; message: string }> => {
    return apiRequest(`/blood-requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ userId, role, reason, donorId }),
    });
  },

  /**
   * Complete a blood request (alias for markCompleted)
   */
  complete: async (requestId: string, data: { userId: string; userRole: 'donor' | 'recipient' | 'user'; donorId?: string }): Promise<{ success: boolean; status: string; bothCompleted: boolean }> => {
    return apiRequest(`/blood-requests/${requestId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId: data.userId, 
        role: data.userRole === 'user' ? 'recipient' : data.userRole, 
        donorId: data.donorId 
      }),
    });
  },

  /**
   * Cancel a blood request (alias for cancelRequest)
   */
  cancel: async (requestId: string, data: { userId: string; userRole: 'donor' | 'recipient' | 'user'; reason: string; donorId?: string }): Promise<{ success: boolean; message: string }> => {
    return apiRequest(`/blood-requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId: data.userId, 
        role: data.userRole === 'user' ? 'recipient' : data.userRole, 
        reason: data.reason, 
        donorId: data.donorId 
      }),
    });
  },

  /**
   * Get single request by ID (direct from backend, bypasses context cache)
   */
  getRequestByIdDirect: async (requestId: string) => {
    const response = await apiRequest(`/blood-requests/${requestId}`, {
      method: 'GET',
    });
    
    if (response.request) {
      // Convert snake_case to camelCase and handle timestamps
      const req = response.request;
      return {
        id: req.id,
        recipientId: req.recipient_id,
        recipientName: req.recipient_name,
        bloodGroup: req.blood_group,
        units: req.units,
        acceptedUnits: req.accepted_units,
        urgencyLevel: req.urgency_level,
        location: req.location,
        notes: req.notes,
        status: req.status,
        recipientMobile: req.recipient_mobile,
        shareLocation: req.share_location || false,
        recipientLatitude: req.recipient_latitude,
        recipientLongitude: req.recipient_longitude,
        createdAt: new Date(req.created_at),
        updatedAt: new Date(req.updated_at),
        acceptedBy: req.acceptedBy?.map((d: any) => ({
          donorId: d.donorId,
          donorName: d.donorName,
          acceptedAt: new Date(d.acceptedAt),
        })),
        declinedBy: req.declinedBy,
        // Cancellation data
        cancelledBy: req.cancelledBy || req.cancelled_by,
        cancelledByRole: req.cancelledByRole || req.cancelled_by_role,
        cancellationReason: req.cancellationReason || req.cancellation_reason,
        cancelledAt: req.cancelledAt ? new Date(req.cancelledAt) : (req.cancelled_at ? new Date(req.cancelled_at) : null),
      };
    }
    
    return null;
  },
};

// ============================================
// RESPECT RATINGS API
// ============================================

export const respectAPI = {
  /**
   * Submit a respect rating
   */
  submitRating: async (data: {
    requestId: string;
    donorId: string;
    recipientId: string;
    rating: number;
    comment?: string;
    raterRole: 'donor' | 'recipient';
  }): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/respect-ratings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Check if user has already rated or skipped
   */
  checkRatingStatus: async (
    requestId: string, 
    donorId: string, 
    recipientId: string, 
    userRole: 'donor' | 'recipient'
  ): Promise<{ 
    success: boolean; 
    hasRated: boolean; 
    hasSkipped: boolean;
    shouldShowRating: boolean;
  }> => {
    return apiRequest(`/respect-ratings/check/${requestId}/${donorId}/${recipientId}/${userRole}`, {
      method: 'GET',
    });
  },

  /**
   * Skip rating
   */
  skipRating: async (data: {
    requestId: string;
    donorId: string;
    recipientId: string;
    raterRole: 'donor' | 'recipient';
  }): Promise<{ success: boolean; message: string }> => {
    return apiRequest('/respect-ratings/skip', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get average respect rating for a user
   */
  getUserRating: async (userId: string): Promise<{ success: boolean; averageRating: number; totalRatings: number }> => {
    return apiRequest(`/respect-ratings/${userId}`, {
      method: 'GET',
    });
  },
};

// ============================================
// MOBILE VERIFICATION API
// ============================================

export const mobileAPI = {
  /**
   * Send verification code to mobile
   */
  sendCode: async (mobile: string): Promise<{ success: boolean; devCode?: string }> => {
    return apiRequest('/send-mobile-verification', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  },

  /**
   * Verify mobile code
   */
  verifyCode: async (mobile: string, code: string): Promise<{ success: boolean }> => {
    return apiRequest('/verify-mobile-code', {
      method: 'POST',
      body: JSON.stringify({ mobile, code }),
    });
  },
};

// ============================================
// PROFILE API
// ============================================

export interface DonorProfile {
  userId: string;
  profileImage?: string;
  mobile: string;
  mobileVerified: boolean;
  address: string;
  city: string;
  zipcode: string;
  bloodGroup: string;
  age: number;
  weight: number;
  lastDonated?: string;
  disease?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminRemarks?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecipientProfile {
  userId: string;
  profileImage?: string;
  mobile: string;
  mobileVerified: boolean;
  cnic?: string;
  address: string;
  city: string;
  zipcode: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminRemarks?: string;
  createdAt: number;
  updatedAt: number;
}

export const profileAPI = {
  /**
   * Create/Update donor profile
   */
  saveDonorProfile: async (profile: Omit<DonorProfile, 'approvalStatus' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; profile: any }> => {
    return apiRequest('/donor-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  /**
   * Get donor profile
   */
  getDonorProfile: async (userId: string): Promise<{ success: boolean; profile: DonorProfile }> => {
    // Add cache-busting timestamp to prevent stale data
    const timestamp = Date.now();
    return apiRequest(`/donor-profile/${userId}?_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  },

  /**
   * Create/Update recipient profile
   */
  saveRecipientProfile: async (profile: Omit<RecipientProfile, 'approvalStatus' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; profile: any }> => {
    return apiRequest('/recipient-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  /**
   * Get recipient profile
   */
  getRecipientProfile: async (userId: string): Promise<{ success: boolean; profile: RecipientProfile }> => {
    return apiRequest(`/recipient-profile/${userId}`, {
      method: 'GET',
    });
  },
};

// ============================================
// ADMIN API
// ============================================

export interface PendingProfile {
  user_id: string;
  name: string;
  email: string;
  type: 'donor' | 'recipient';
  approval_status: string;
  // ... other profile fields
}

export const adminAPI = {
  /**
   * Get all pending profiles
   */
  getPendingProfiles: async (): Promise<{ success: boolean; profiles: PendingProfile[] }> => {
    return apiRequest('/admin/pending-profiles', {
      method: 'GET',
    });
  },

  /**
   * Approve a profile
   */
  approveProfile: async (userId: string, userType: 'donor' | 'recipient'): Promise<{ success: boolean }> => {
    return apiRequest('/admin/approve-profile', {
      method: 'POST',
      body: JSON.stringify({ userId, userType }),
    });
  },

  /**
   * Reject a profile with remarks
   */
  rejectProfile: async (userId: string, userType: 'donor' | 'recipient', remarks: string): Promise<{ success: boolean }> => {
    return apiRequest('/admin/reject-profile', {
      method: 'POST',
      body: JSON.stringify({ userId, userType, remarks }),
    });
  },
};
