/**
 * Notification Service
 * 
 * Notification Management Service
 * 
 * This service handles all notification-related operations including:
 * - Fetching notifications for a user
 * - Getting unread notification count
 * - Marking notifications as read
 * - Deleting notifications
 */

import { API_BASE_URL } from './api';
import { Notification } from '../types/notification.types';

/**
 * Get all notifications for a user
 */
export async function getNotifications(
  userId: string,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  try {
    const url = `${API_BASE_URL}/notifications/${userId}${unreadOnly ? '?unreadOnly=true' : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }

    const data = await response.json();
    return data.notifications || [];
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${userId}/unread-count`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch unread count');
    }

    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${userId}/mark-all-read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    return false;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    return false;
  }
}

/**
 * Format notification timestamp
 */
export function formatNotificationTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) {
    return 'Just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes}m ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  } else {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }
}

/**
 * Get notification icon name based on type
 */
export function getNotificationIcon(type: string): string {
  switch (type) {
    case 'PROFILE_APPROVAL_REQUEST':
      return 'person-add';
    case 'PROFILE_APPROVED':
      return 'checkmark-circle';
    case 'PROFILE_REJECTED':
      return 'close-circle';
    case 'ACCOUNT_DEACTIVATED':
      return 'ban';
    case 'ACCOUNT_ACTIVATED':
      return 'checkmark-done-circle';
    case 'APPEAL_SUBMITTED':
      return 'chatbubble-ellipses';
    case 'APPEAL_ACCEPTED':
      return 'thumbs-up';
    case 'APPEAL_REJECTED':
      return 'thumbs-down';
    case 'BLOOD_REQUEST_CREATED':
      return 'water';
    case 'REQUEST_ACCEPTED':
      return 'checkmark';
    case 'REQUEST_COMPLETED':
      return 'checkmark-done';
    case 'REQUEST_CANCELLED':
      return 'close';
    default:
      return 'notifications';
  }
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type: string): string {
  switch (type) {
    case 'PROFILE_APPROVAL_REQUEST':
    case 'APPEAL_SUBMITTED':
      return '#FF9800'; // Orange
    case 'PROFILE_APPROVED':
    case 'ACCOUNT_ACTIVATED':
    case 'APPEAL_ACCEPTED':
    case 'REQUEST_COMPLETED':
      return '#4CAF50'; // Green
    case 'PROFILE_REJECTED':
    case 'ACCOUNT_DEACTIVATED':
    case 'APPEAL_REJECTED':
    case 'REQUEST_CANCELLED':
      return '#F44336'; // Red
    case 'BLOOD_REQUEST_CREATED':
    case 'REQUEST_ACCEPTED':
      return '#DC143C'; // Crimson
    default:
      return '#2196F3'; // Blue
  }
}

