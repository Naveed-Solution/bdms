/**
 * API Response Type Definitions
 * 
 * TypeScript interfaces for API responses
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    token: string;
    refreshToken: string;
  };
  message: string;
}

