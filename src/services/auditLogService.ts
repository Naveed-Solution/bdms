/**
 * Audit Log Service
 * 
 * Centralized Audit Logging Service
 * 
 * This service provides a single point for creating and managing audit logs.
 * It ensures consistent log formatting and handles both backend API calls
 * and local storage for offline capability.
 * 
 * Design Principles:
 * - Centralized: All logging goes through this service
 * - Async: Non-blocking operations don't interfere with user experience
 * - Persistent: Logs stored in backend database
 * - Fail-safe: Logging failures don't crash the app
 * 
 * Usage:
 * ```typescript
 * import { logAction } from './services/auditLogService';
 * 
 * await logAction({
 *   actorRole: 'donor',
 *   actorId: user.id,
 *   actorName: user.name,
 *   action: 'ACCEPT_BLOOD_REQUEST',
 *   entityType: 'BLOOD_REQUEST',
 *   entityId: requestId,
 *   details: { bloodGroup: 'A+' }
 * });
 * ```
 */

import { API_BASE_URL } from './api';
import { CreateAuditLogData, AuditLogFilter, AuditLogResponse, AuditAction } from '../types/auditLog.types';

/**
 * Log an action to the audit trail
 * 
 * Note: This function is called automatically throughout the app
 * to track important user actions. It runs asynchronously and silently
 * to avoid impacting user experience.
 * 
 * @param logData - The audit log data
 * @returns Promise<boolean> - True if logged successfully
 */
export async function logAction(logData: CreateAuditLogData): Promise<boolean> {
  try {
    console.log(`📝 Logging action: ${logData.action} by ${logData.actorRole} ${logData.actorName}`);
    
    const response = await fetch(`${API_BASE_URL}/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create audit log: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Audit log created: ${result.logId}`);
    return true;
  } catch (error) {
    // Fail silently - logging should never break the app
    console.error('❌ Error creating audit log:', error);
    return false;
  }
}

/**
 * Admin: Fetch audit logs with optional filtering
 * 
 * Note: Only admins can view audit logs. This provides
 * system oversight and accountability.
 * 
 * @param filter - Optional filters for the logs
 * @returns Promise<AuditLogResponse> - Filtered logs with pagination
 */
export async function fetchAuditLogs(filter?: AuditLogFilter): Promise<AuditLogResponse> {
  try {
    const params = new URLSearchParams();
    
    if (filter?.limit) params.append('limit', filter.limit.toString());
    if (filter?.offset) params.append('offset', filter.offset.toString());
    if (filter?.action && filter.action !== 'all') params.append('action', filter.action);
    if (filter?.actorRole && filter.actorRole !== 'all') params.append('actorRole', filter.actorRole);
    if (filter?.startDate) params.append('startDate', filter.startDate.toString());
    if (filter?.endDate) params.append('endDate', filter.endDate.toString());

    const url = `${API_BASE_URL}/admin/audit-logs${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit logs: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    throw error;
  }
}

/**
 * Admin: Fetch list of all unique actions for filtering
 * 
 * @returns Promise<string[]> - List of action types
 */
export async function fetchAuditActions(): Promise<AuditAction[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/audit-logs/actions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit actions: ${response.status}`);
    }

    const result = await response.json();
    return result.actions || [];
  } catch (error) {
    console.error('❌ Error fetching audit actions:', error);
    return [];
  }
}

/**
 * Format timestamp for display
 * 
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatAuditTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get friendly action name for display
 * 
 * @param action - Action type
 * @returns User-friendly action name
 */
export function getActionDisplayName(action: AuditAction): string {
  const displayNames: Record<AuditAction, string> = {
    USER_LOGIN: 'User Login',
    USER_LOGOUT: 'User Logout',
    CREATE_BLOOD_REQUEST: 'Created Blood Request',
    ACCEPT_BLOOD_REQUEST: 'Accepted Blood Request',
    COMPLETE_BLOOD_REQUEST: 'Completed Blood Request',
    CANCEL_BLOOD_REQUEST: 'Cancelled Blood Request',
    ACTIVATE_USER: 'Activated User Account',
    DEACTIVATE_USER: 'Deactivated User Account',
    APPROVE_PROFILE: 'Approved Profile',
    REJECT_PROFILE: 'Rejected Profile',
    SUBMIT_APPEAL: 'Submitted Appeal',
    RESPOND_APPEAL: 'Responded to Appeal',
  };

  return displayNames[action] || action;
}

/**
 * Get role badge color
 * 
 * @param role - User role
 * @returns Color code for the role
 */
export function getRoleBadgeColor(role: 'admin' | 'donor' | 'user'): string {
  const colors = {
    admin: '#9C27B0', // Purple
    donor: '#DC143C', // Crimson
    user: '#2196F3',  // Blue
  };

  return colors[role] || '#757575';
}

