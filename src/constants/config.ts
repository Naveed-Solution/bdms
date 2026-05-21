/**
 * App Configuration Constants
 * 
 * Centralized configuration for the application
 * Environment-specific settings
 */

export const config = {
  // API Configuration
  api: {
    baseUrl: __DEV__ 
      ? 'http://localhost:3000/api/v1' 
      : 'https://api.bdms.example.com/v1',
    timeout: 30000, // 30 seconds
  },
  
  // App Information
  app: {
    name: 'BDMS',
    version: '1.0.0',
    bundleId: 'com.bdms.app',
  },
  
  // Feature Flags
  features: {
    enableNotifications: true,
    enableGeolocation: true,
    enableEmergencyRequests: true,
    enableOfflineMode: false, // Future feature
  },
  
  // Business Rules
  donation: {
    minimumAge: 18,
    minimumWeight: 50, // kg
    daysBetweenDonations: 56, // 8 weeks
    unitsPerDonation: 1,
  },
  
  // Search Configuration
  search: {
    defaultRadius: 10, // km
    maxRadius: 50, // km
    minRadius: 1, // km
  },
  
  // Pagination
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  
  // Cache Settings
  cache: {
    enabled: true,
    duration: 5 * 60 * 1000, // 5 minutes
  },
};

