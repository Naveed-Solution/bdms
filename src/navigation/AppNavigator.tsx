import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';

// Import screens from organized folders
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import AdminDashboard from '../screens/admin/AdminDashboard';
import ProfileApprovals from '../screens/admin/ProfileApprovals';
import ManageUsers from '../screens/admin/ManageUsers';
import ViewRequests from '../screens/admin/ViewRequests';
import UserProfileDetail from '../screens/admin/UserProfileDetail';
import AppealsList from '../screens/admin/AppealsList';
import AdminAuditLogs from '../screens/admin/AdminAuditLogs';
import AdminProfile from '../screens/admin/AdminProfile';
import Notifications from '../screens/admin/Notifications';
import DonorNavigator from './DonorNavigator';
import RecipientNavigator from './RecipientNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * AppNavigator Component
 * 
 * PURPOSE:
 * - Main navigation component with Role-Based Access Control (RBAC)
 * - Controls which screens users can access based on their role
 * - Handles authentication state and automatic redirection
 * 
 * RBAC IMPLEMENTATION:
 * Navigation is determined by authentication state and user role:
 * 
 * 1. NOT AUTHENTICATED (userRole = null)
 *    → Shows: LoginScreen, RegisterScreen
 *    → User must login/register before accessing app features
 * 
 * 2. AUTHENTICATED AS DONOR (userRole = 'donor')
 *    → Shows: DonorHomeScreen + donor-specific screens
 *    → Cannot access admin or recipient features
 * 
 * 3. AUTHENTICATED AS USER (userRole = 'user' - Recipients)
 *    → Shows: UserHomeScreen + recipient-specific screens
 *    → Cannot access donor or admin features
 * 
 * HOW RBAC WORKS:
 * - AppNavigator listens to AuthContext state
 * - When user logs in, context updates → navigator re-renders
 * - Navigator shows screens based on role
 * - Logout resets role to null → shows login screen
 * 
 * Note: This is navigation-level RBAC. You can also implement
 * screen-level RBAC by checking userRole inside components.
 */
export default function AppNavigator() {
  // Get authentication state from AuthContext
  const { userRole, isLoading } = useAuth();

  /**
   * Loading Screen
   * 
   * Shown while checking if user is logged in (on app start)
   * This prevents flash of login screen if user is already authenticated
   * 
   * Note: This improves UX by preventing screen flicker
   */
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  /**
   * Navigation Stack
   * 
   * CONDITIONAL RENDERING BASED ON RBAC:
   * - If NOT authenticated → Show auth screens
   * - If authenticated → Show role-specific screens
   * 
   * This is the core of RBAC implementation at navigation level
   */
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#DC143C',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {!userRole ? (
        // ============================================
        // AUTHENTICATION STACK (Not Logged In)
        // ============================================
        // Accessible to: Everyone (no authentication)
        // Purpose: Allow users to login or register
        // ============================================
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{ 
              title: 'Create Account',
              headerShown: true,
            }}
          />
          <Stack.Screen 
            name="ForgotPassword" 
            component={ForgotPasswordScreen}
            options={{ 
              title: 'Reset Password',
              headerShown: true,
            }}
          />
        </>
      ) : (
        // ============================================
        // ROLE-BASED STACKS (Authenticated)
        // ============================================
        // Accessible to: Only authenticated users
        // Screens shown depend on user's role
        // ============================================
        <>
          {/* 
            ADMIN STACK
            Accessible to: Users with role = 'admin'
            Features: User management, system analytics, full access
          */}
          {userRole === 'admin' && (
            <>
              <Stack.Screen 
                name="AdminDashboard" 
                component={AdminDashboard}
                options={{ 
                  headerShown: false,
                  title: 'Admin Dashboard'
                }}
              />
              <Stack.Screen 
                name="ProfileApprovals" 
                component={ProfileApprovals}
                options={{ 
                  headerShown: false,
                  title: 'Profile Approvals',
                }}
              />
              <Stack.Screen 
                name="ManageUsers" 
                component={ManageUsers}
                options={{ 
                  headerShown: false,
                  title: 'Manage Users',
                }}
              />
              <Stack.Screen 
                name="UserProfileDetail" 
                component={UserProfileDetail}
                options={{ 
                  headerShown: false,
                  title: 'User Profile',
                }}
              />
              <Stack.Screen 
                name="AppealsList" 
                component={AppealsList}
                options={{ 
                  headerShown: false,
                  title: 'Appeals',
                }}
              />
              <Stack.Screen 
                name="ViewRequests" 
                component={ViewRequests}
                options={{ 
                  headerShown: false,
                  title: 'View Requests',
                }}
              />
              <Stack.Screen 
                name="AdminAuditLogs" 
                component={AdminAuditLogs}
                options={{ 
                  headerShown: false,
                  title: 'Audit Logs',
                }}
              />
              <Stack.Screen 
                name="AdminProfile" 
                component={AdminProfile}
                options={{ 
                  headerShown: false,
                  title: 'My Profile',
                }}
              />
              <Stack.Screen 
                name="Notifications" 
                component={Notifications}
                options={{ 
                  headerShown: false,
                  title: 'Notifications',
                }}
              />
            </>
          )}


          {/* 
            DONOR STACK 
            Accessible to: Users with role = 'donor'
            Features: Donation history, eligibility check, blood requests
            
            Uses DonorNavigator for internal navigation:
            - DonorHome (Dashboard)
            - AvailableRequests (Browse and accept requests)
          */}
          {userRole === 'donor' && (
            <Stack.Screen 
              name="DonorStack" 
              component={DonorNavigator}
              options={{ 
                headerShown: false,
                title: 'Donor Dashboard'
              }}
            />
          )}

          {/* 
            USER/RECIPIENT STACK
            Accessible to: Users with role = 'user'
            Features: Blood requests, search donors, blood banks
            
            Uses RecipientNavigator for internal navigation:
            - UserHome (Dashboard)
            - CreateBloodRequest (Request form)
            - RequestStatus (Real-time tracking)
          */}
          {userRole === 'user' && (
            <Stack.Screen 
              name="RecipientStack" 
              component={RecipientNavigator}
              options={{ 
                headerShown: false,
                title: 'Recipient Dashboard'
              }}
            />
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

/**
 * HOW TO ADD NEW ROLE-BASED SCREENS:
 * 
 * 1. Create new screen component in appropriate folder
 *    Example: src/screens/donor/DonationHistoryScreen.tsx
 * 
 * 2. Add screen to appropriate role stack above
 *    Example for donor:
 *    {userRole === 'donor' && (
 *      <>
 *        <Stack.Screen name="DonorHome" component={DonorHomeScreen} />
 *        <Stack.Screen name="DonationHistory" component={DonationHistoryScreen} />
 *      </>
 *    )}
 * 
 * 3. Add route to navigation types (types.ts)
 * 
 * 4. Navigate from components:
 *    navigation.navigate('DonationHistory')
 * 
 * RBAC is automatically enforced - only donors can access donor screens!
 */

/**
 * SECURITY NOTE:
 * 
 * Navigation-level RBAC prevents unauthorized access to screens,
 * but you should also:
 * 
 * 1. Implement screen-level checks:
 *    const { userRole } = useAuth();
 *    if (userRole !== 'donor') return <UnauthorizedScreen />;
 * 
 * 2. Implement API-level checks:
 *    Backend must verify user role before processing requests
 * 
 * 3. Never rely solely on frontend RBAC for security
 * 
 * Note: For demonstration, navigation-level RBAC is sufficient.
 * In production, backend validation is critical.
 */

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
