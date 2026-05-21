/**
 * Notification Context
 * 
 * Manages push notifications and navigation
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import {
  registerForPushNotificationsAsync,
  setupNotificationListener,
} from '../services/pushNotificationService';
import {
  startNotificationPolling,
  stopNotificationPolling,
} from '../services/notificationPollingService';

interface NotificationContextType {
  notificationsEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);

  /**
   * Request permissions and set up listeners on mount
   */
  useEffect(() => {
    async function setup() {
      const granted = await registerForPushNotificationsAsync();
      setNotificationsEnabled(!!granted);

      // Set up notification tap handler
      notificationListener.current = setupNotificationListener((notification) => {
        handleNotificationTap(notification);
      });
    }

    setup();

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, []);

  /**
   * Start/stop polling based on user login status
   */
  useEffect(() => {
    if (user?.id && notificationsEnabled) {
      console.log('✅ Starting notification polling for user:', user.id);
      startNotificationPolling(user.id);
    } else {
      console.log('⏹️ Stopping notification polling');
      stopNotificationPolling();
    }

    return () => {
      stopNotificationPolling();
    };
  }, [user?.id, notificationsEnabled]);

  /**
   * Handle notification tap - navigate to relevant screen
   */
  const handleNotificationTap = (notification: Notifications.Notification) => {
    try {
      const data = notification.request.content.data;
      const type = data?.type as string;

      console.log('📱 Notification tapped:', type, data);

      // Parse additional data if it exists
      let parsedData = data?.data;
      if (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // Navigate based on notification type
      switch (type) {
        case 'PROFILE_APPROVAL_REQUEST':
          // Admin: Navigate to profile approvals
          navigation.navigate('ProfileApprovals' as never);
          break;

        case 'PROFILE_APPROVED':
        case 'PROFILE_REJECTED':
          // Donor: Navigate to profile form
          if (user?.role === 'donor') {
            navigation.navigate('DonorProfileForm' as never);
          }
          break;

        case 'ACCOUNT_ACTIVATED':
        case 'ACCOUNT_DEACTIVATED':
          // Navigate to notifications screen
          navigation.navigate('Notifications' as never);
          break;

        case 'REQUEST_ACCEPTED':
          // User: Navigate to request status
          if (parsedData?.requestId) {
            navigation.navigate('RequestStatus' as never, { requestId: parsedData.requestId } as never);
          }
          break;

        case 'BLOOD_REQUEST_CREATED':
        case 'NEW_BLOOD_REQUEST':
          // Donor: Navigate to available requests
          if (user?.role === 'donor') {
            navigation.navigate('AvailableRequests' as never);
          }
          break;

        case 'APPEAL_ACCEPTED':
        case 'APPEAL_REJECTED':
          // Navigate to appeals list
          if (user?.role === 'admin') {
            navigation.navigate('AppealsList' as never);
          } else {
            navigation.navigate('Notifications' as never);
          }
          break;

        default:
          // Default: Navigate to notifications screen
          navigation.navigate('Notifications' as never);
      }
    } catch (error) {
      console.error('❌ Error handling notification tap:', error);
      // Fallback: Navigate to notifications screen
      navigation.navigate('Notifications' as never);
    }
  };

  return (
    <NotificationContext.Provider value={{ notificationsEnabled }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

