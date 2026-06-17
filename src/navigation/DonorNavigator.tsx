import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Donor Screens
import DonorHomeScreen from '../screens/donor/DonorHomeScreen';
import DonorProfileForm from '../screens/donor/DonorProfileForm';
import DonorProfile from '../screens/donor/DonorProfile';
import AvailableRequests from '../screens/donor/AvailableRequests';
import RequestHistory from '../screens/donor/RequestHistory';
import LiveTrackingScreen from '../screens/shared/LiveTrackingScreen';
import RatingScreen from '../screens/shared/RatingScreen';
import DonorNotifications from '../screens/donor/DonorNotifications';

/**
 * Donor Stack Navigator
 * 
 * Internal navigation for Donor role users.
 * 
 * Screens:
 * 1. DonorHome - Main dashboard with donation history and stats
 * 2. DonorProfileForm - Complete profile for admin approval
 * 3. AvailableRequests - Browse and accept blood requests from recipients
 * 
 * Navigation Flow:
 * DonorHome → DonorProfileForm / AvailableRequests → DonorHome
 * 
 * This navigator is only accessible to authenticated users with 'donor' role
 * 
 * Note: Donor Request Matching Module
 * This implements the donor-side of the blood request matching algorithm:
 * - Donors view available requests
 * - Donors can accept/decline requests
 * - Multiple donors can accept the same request (pool of donors)
 * - Recipient will choose from accepted donors (future feature)
 */

export type DonorStackParamList = {
  DonorHome: undefined;
  DonorProfileForm: undefined;
  DonorProfile: undefined;
  AvailableRequests: undefined;
  RequestHistory: undefined;
  LiveTracking: { requestId: string; donorId: string };
  RatingScreen: { requestId: string; donorId: string; donorName?: string; recipientName?: string; recipientId?: string; raterRole?: string };
  Notifications: undefined;
};

const Stack = createStackNavigator<DonorStackParamList>();

/**
 * DonorNavigator Component
 * 
 * Provides internal navigation structure for Donor users.
 * Includes custom header styling and back button configuration.
 */
const DonorNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="DonorHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#DC143C',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerBackTitleVisible: false,
        headerLeftContainerStyle: {
          paddingLeft: 10,
        },
      }}
    >
      {/* Donor Home Dashboard */}
      <Stack.Screen
        name="DonorHome"
        component={DonorHomeScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Donor Profile Form */}
      <Stack.Screen
        name="DonorProfileForm"
        component={DonorProfileForm}
        options={{
          headerTitle: 'Complete Profile',
          headerBackImage: ({ tintColor }) => (
            <Ionicons name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 10 }} />
          ),
        }}
      />

      {/* Donor Profile Settings */}
      <Stack.Screen
        name="DonorProfile"
        component={DonorProfile}
        options={{
          headerShown: false, // Custom header in component
        }}
      />

      {/* Available Requests Screen */}
      <Stack.Screen
        name="AvailableRequests"
        component={AvailableRequests}
        options={{
          headerTitle: 'Available Requests',
          headerBackImage: ({ tintColor }) => (
            <Ionicons name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 10 }} />
          ),
        }}
      />

      {/* Request History */}
      <Stack.Screen
        name="RequestHistory"
        component={RequestHistory}
        options={{
          headerShown: false, // Custom header in component
        }}
      />

      {/* Live Tracking Screen */}
      <Stack.Screen
        name="LiveTracking"
        component={LiveTrackingScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />

      {/* Rating Screen */}
      <Stack.Screen
        name="RatingScreen"
        component={RatingScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />

      {/* Notifications Screen */}
      <Stack.Screen
        name="Notifications"
        component={DonorNotifications}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
    </Stack.Navigator>
  );
};

export default DonorNavigator;

