/**
 * Route Constants
 * 
 * Centralized route names for navigation
 * Prevents typos and makes navigation changes easier
 */

export const ROUTES = {
  // Auth Routes
  AUTH: {
    LOGIN: 'Login',
    REGISTER: 'Register',
    FORGOT_PASSWORD: 'ForgotPassword',
  },
  
  // Donor Routes
  DONOR: {
    HOME: 'DonorHome',
    HISTORY: 'DonationHistory',
    REQUEST: 'DonationRequest',
    PROFILE: 'DonorProfile',
    ELIGIBILITY: 'EligibilityCheck',
  },
  
  // User Routes (Recipients)
  USER: {
    HOME: 'UserHome',
    SEARCH: 'SearchDonors',
    EMERGENCY: 'EmergencyRequest',
    BLOOD_BANKS: 'BloodBanks',
    PROFILE: 'UserProfile',
  },
  
  // Shared Routes
  SHARED: {
    NOTIFICATIONS: 'Notifications',
    SETTINGS: 'Settings',
  },
} as const;

