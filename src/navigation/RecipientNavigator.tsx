import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Recipient Screens
import UserHomeScreen from '../screens/user/UserHomeScreen';
import RecipientProfileForm from '../screens/user/RecipientProfileForm';
import CreateBloodRequest from '../screens/user/CreateBloodRequest';
import RequestStatus from '../screens/user/RequestStatus';
import RequestHistory from '../screens/user/RequestHistory';
import RecipientNotifications from '../screens/user/RecipientNotifications';
import RecipientProfile from '../screens/user/RecipientProfile';
import LiveTrackingScreen from '../screens/shared/LiveTrackingScreen';
import RatingScreen from '../screens/shared/RatingScreen';

/**
 * Recipient Stack Navigator
 * 
 * Internal navigation for Recipient role users.
 * 
 * Screens:
 * 1. UserHome - Main dashboard (renamed to RecipientHome in context)
 * 2. RecipientProfileForm - Complete profile for admin approval
 * 3. CreateBloodRequest - Form to create new blood request
 * 4. RequestStatus - Real-time status tracking of requests
 * 
 * Navigation Flow:
 * UserHome → RecipientProfileForm / CreateBloodRequest → RequestStatus → UserHome
 * 
 * This navigator is only accessible to authenticated users with 'user' role
 * (Recipient in the context of blood requests)
 */

export type RecipientStackParamList = {
  UserHome: undefined;
  RecipientProfileForm: undefined;
  RecipientProfile: undefined;
  CreateBloodRequest: undefined;
  RequestStatus: { requestId: string };
  RequestHistory: undefined;
  Notifications: undefined;
  LiveTracking: { requestId: string; donorId: string };
  RatingScreen: { requestId: string; donorId: string; donorName?: string; recipientName?: string; recipientId?: string; raterRole?: string };
};

const Stack = createStackNavigator<RecipientStackParamList>();

/**
 * RecipientNavigator Component
 * 
 * Provides internal navigation structure for Recipient users.
 * Includes custom header styling and back button configuration.
 */
const RecipientNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="UserHome"
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
      {/* Recipient Home Dashboard */}
      <Stack.Screen
        name="UserHome"
        component={UserHomeScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Recipient Profile Form */}
      <Stack.Screen
        name="RecipientProfileForm"
        component={RecipientProfileForm}
        options={{
          headerTitle: 'Complete Profile',
          headerBackImage: ({ tintColor }) => (
            <Ionicons name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 10 }} />
          ),
        }}
      />

      {/* Create Blood Request Form */}
      <Stack.Screen
        name="CreateBloodRequest"
        component={CreateBloodRequest}
        options={{
          headerTitle: 'New Request',
          headerBackImage: ({ tintColor }) => (
            <Ionicons name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 10 }} />
          ),
        }}
      />

      {/* Request Status Tracking */}
      <Stack.Screen
        name="RequestStatus"
        component={RequestStatus}
        options={{
          headerTitle: 'Request Status',
          headerBackImage: ({ tintColor }) => (
            <Ionicons name="arrow-back" size={24} color={tintColor} style={{ marginLeft: 10 }} />
          ),
          // Prevent going back from status screen (force user to use home button)
          gestureEnabled: false,
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

      {/* Notifications Screen */}
      <Stack.Screen
        name="Notifications"
        component={RecipientNotifications}
        options={{
          headerShown: false, // Custom header in component
        }}
      />

      {/* Recipient Profile Settings */}
      <Stack.Screen
        name="RecipientProfile"
        component={RecipientProfile}
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
    </Stack.Navigator>
  );
};

export default RecipientNavigator;

