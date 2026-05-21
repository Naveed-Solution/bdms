/**
 * Audit Log Type Definitions
 * 
 * Audit Logging System
 * 
 * These types define the structure of audit logs used throughout the system.
 * Audit logs provide accountability, traceability, and security monitoring
 * by tracking all significant user actions.
 * 
 * Benefits:
 * - Accountability: Know who did what and when
 * - Security: Detect unauthorized access or suspicious patterns
 * - Compliance: Meet regulatory requirements for data governance
 * - Debugging: Troubleshoot issues by reviewing user actions
 * - Analytics: Understand system usage patterns
 */

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'CREATE_BLOOD_REQUEST'
  | 'ACCEPT_BLOOD_REQUEST'
  | 'COMPLETE_BLOOD_REQUEST'
  | 'CANCEL_BLOOD_REQUEST'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'
  | 'APPROVE_PROFILE'
  | 'REJECT_PROFILE'
  | 'SUBMIT_APPEAL'
  | 'RESPOND_APPEAL';

export type EntityType =
  | 'USER'
  | 'BLOOD_REQUEST'
  | 'PROFILE'
  | 'APPEAL';

export interface AuditLog {
  id: string;
  timestamp: number; // Unix timestamp in seconds
  actorRole: 'admin' | 'donor' | 'user';
  actorId: string;
  actorName?: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  details?: Record<string, any>; // Additional context
  ipAddress?: string;
}

export interface AuditLogFilter {
  action?: AuditAction | 'all';
  actorRole?: 'admin' | 'donor' | 'user' | 'all';
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface AuditLogResponse {
  success: boolean;
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CreateAuditLogData {
  actorRole: 'admin' | 'donor' | 'user';
  actorId: string;
  actorName: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  details?: Record<string, any>;
}

