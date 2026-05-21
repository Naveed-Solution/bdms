/**
 * Push Notification Service
 * 
 * Handles actual push notifications with navigation
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC143C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('❌ Failed to get push notification permissions');
    return;
  }

  console.log('✅ Push notification permissions granted');
  return true;
}

/**
 * Show local push notification
 */
export async function showPushNotification(
  title: string,
  body: string,
  data?: any
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
    
    console.log(`✅ Push notification shown: ${title}`);
  } catch (error) {
    console.error('❌ Error showing push notification:', error);
  }
}

/**
 * Get notification type details for display
 */
export function getNotificationDetails(type: string) {
  switch (type) {
    case 'PROFILE_APPROVAL_REQUEST':
      return {
        title: '📋 Profile Approval',
        icon: 'person-add',
        color: '#4ECDC4',
      };
    case 'PROFILE_APPROVED':
      return {
        title: '✅ Profile Approved',
        icon: 'checkmark-circle',
        color: '#4CAF50',
      };
    case 'PROFILE_REJECTED':
      return {
        title: '❌ Profile Rejected',
        icon: 'close-circle',
        color: '#F44336',
      };
    case 'ACCOUNT_ACTIVATED':
      return {
        title: '✅ Account Activated',
        icon: 'checkmark-circle',
        color: '#4CAF50',
      };
    case 'ACCOUNT_DEACTIVATED':
      return {
        title: '⛔ Account Deactivated',
        icon: 'ban',
        color: '#F44336',
      };
    case 'REQUEST_ACCEPTED':
      return {
        title: '🩸 Request Accepted',
        icon: 'checkmark',
        color: '#4CAF50',
      };
    case 'BLOOD_REQUEST_CREATED':
    case 'NEW_BLOOD_REQUEST':
      return {
        title: '🩸 New Blood Request',
        icon: 'water',
        color: '#DC143C',
      };
    case 'APPEAL_ACCEPTED':
      return {
        title: '✅ Appeal Accepted',
        icon: 'checkmark',
        color: '#4CAF50',
      };
    case 'APPEAL_REJECTED':
      return {
        title: '❌ Appeal Rejected',
        icon: 'close',
        color: '#F44336',
      };
    default:
      return {
        title: '🔔 Notification',
        icon: 'notifications',
        color: '#3498DB',
      };
  }
}

/**
 * Setup notification response listener (for when user taps notification)
 */
export function setupNotificationListener(
  onNotificationTap: (notification: Notifications.Notification) => void
) {
  // Listen for notification tap
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    onNotificationTap(response.notification);
  });

  return subscription;
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

