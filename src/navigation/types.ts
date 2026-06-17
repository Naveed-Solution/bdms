/**
 * Navigation Types
 * 
 * Defines all possible routes in the application
 * Used by React Navigation for type-safe navigation
 */

export type RootStackParamList = {
  // Authentication Screens (No role required)
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  
  // Role-Based Home Screens (RBAC enforced)
  AdminDashboard: undefined;      // Only accessible to admin
  ProfileApprovals: undefined;    // Admin profile approval screen
  ManageUsers: undefined;         // Admin user management screen
  UserProfileDetail: { userId: string };  // Admin view/manage user profile
  AppealsList: undefined;         // Admin view/respond to appeals
  ViewRequests: undefined;        // Admin blood requests monitoring screen
  AdminAuditLogs: undefined;      // Admin audit logs screen
  AdminProfile: undefined;        // Admin profile management screen
  Notifications: undefined;       // Notifications screen
  DonorStack: undefined;          // Donor navigation stack
  RecipientStack: undefined;      // Recipient navigation stack
  
  // Nested Navigator Screens (accessed via parent stacks)
  // Donor screens (via DonorStack)
  DonorHome: undefined;
  DonorProfileForm: undefined;
  AvailableRequests: undefined;
  
  // Recipient screens (via RecipientStack)
  UserHome: undefined;
  RecipientProfileForm: undefined;
  CreateBloodRequest: undefined;
  RequestStatus: { requestId: string };
  
  // Shared screens
  LiveTracking: { requestId: string; donorId: string };
  RatingScreen: { requestId: string; donorId: string; donorName?: string; recipientName?: string; recipientId?: string; raterRole?: string };
};

export type DonorStackParamList = {
  DonorHome: undefined;
  DonorProfileForm: undefined;
  AvailableRequests: undefined;
  RequestHistory: undefined;
  LiveTracking: { requestId: string; donorId: string };
};

export type RecipientStackParamList = {
  UserHome: undefined;
  RecipientProfileForm: undefined;
  RecipientProfile: undefined;
  CreateBloodRequest: undefined;
  RequestStatus: { requestId: string };
  RequestHistory: undefined;
  RecipientNotifications: undefined;
  LiveTracking: { requestId: string; donorId: string };
};

/**
 * User Roles for RBAC
 * 
 * Defines all possible user roles in the system
 * null = not authenticated
 * 
 * Note: Each role has specific permissions and access levels
 * - admin: Full system access, user management, reports
 * - donor: Donation history, eligibility status, profile
 * - user: Search donors, create requests, view blood banks (recipients)
 */
export type UserRole = 'admin' | 'donor' | 'user' | null;

