/**
 * Notification Type Definitions
 * 
 * Push Notification System
 * 
 * This system provides real-time notifications to users about important events.
 * Notifications help keep users informed and improve engagement.
 */

export type NotificationType =
  | 'PROFILE_APPROVAL_REQUEST'
  | 'PROFILE_APPROVED'
  | 'PROFILE_REJECTED'
  | 'ACCOUNT_DEACTIVATED'
  | 'ACCOUNT_ACTIVATED'
  | 'APPEAL_SUBMITTED'
  | 'APPEAL_ACCEPTED'
  | 'APPEAL_REJECTED'
  | 'BLOOD_REQUEST_CREATED'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_COMPLETED'
  | 'REQUEST_CANCELLED';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: string; // JSON string
  is_read: number; // 0 or 1
  created_at: number; // Unix timestamp in seconds
}

export interface NotificationData {
  userId?: string;
  userType?: 'donor' | 'recipient';
  userName?: string;
  requestId?: string;
  remarks?: string;
  [key: string]: any;
}

