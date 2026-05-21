/**
 * Notification Polling Service
 * 
 * Polls backend for new notifications and shows push notifications
 */

import { getNotifications, getUnreadNotificationCount } from './notificationService';
import { showPushNotification, getNotificationDetails } from './pushNotificationService';
import { Notification } from '../types/notification.types';

let lastNotificationCount = 0;
let lastCheckedNotifications: string[] = [];
let pollingInterval: NodeJS.Timeout | null = null;

/**
 * Start polling for notifications
 */
export function startNotificationPolling(userId: string) {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Initial check
  checkForNewNotifications(userId);

  // Poll every 10 seconds
  pollingInterval = setInterval(() => {
    checkForNewNotifications(userId);
  }, 10000);

  console.log('✅ Notification polling started for user:', userId);
}

/**
 * Stop polling
 */
export function stopNotificationPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('✅ Notification polling stopped');
  }
}

/**
 * Check for new notifications and show push notifications
 */
async function checkForNewNotifications(userId: string) {
  try {
    // Get all notifications
    const notifications = await getNotifications(userId);
    const unreadNotifications = notifications.filter(n => !n.is_read && !n.read);

    // Check if there are new notifications
    const newNotifications = unreadNotifications.filter(
      n => !lastCheckedNotifications.includes(n.id)
    );

    if (newNotifications.length > 0) {
      console.log(`🔔 Found ${newNotifications.length} new notifications`);

      // Show push notification for each new notification
      for (const notification of newNotifications) {
        const details = getNotificationDetails(notification.type);
        
        await showPushNotification(
          details.title,
          notification.message,
          {
            notificationId: notification.id,
            type: notification.type,
            data: notification.data,
          }
        );
      }

      // Update tracked notifications
      lastCheckedNotifications = unreadNotifications.map(n => n.id);
    }

    lastNotificationCount = unreadNotifications.length;
  } catch (error) {
    console.error('❌ Error checking for new notifications:', error);
  }
}

/**
 * Reset notification tracking (e.g., after marking as read)
 */
export function resetNotificationTracking() {
  lastCheckedNotifications = [];
  lastNotificationCount = 0;
}

