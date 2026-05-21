/**
 * useAuth Hook
 * 
 * Custom hook for authentication operations
 * Provides login, logout, and auth state management
 * 
 * @example
 * const { user, login, logout, isLoading } = useAuth();
 */

import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

