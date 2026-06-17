import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, User as APIUser } from '../services/api';
import { logAction } from '../services/auditLogService';

/**
 * User Interface
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'donor' | 'user';
}

/**
 * Authentication Context Type
 */
interface AuthContextType {
  user: User | null;
  userRole: string | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AsyncStorage keys for session persistence
const USER_DATA_KEY = '@bdms_user_data';
const AUTH_TOKEN_KEY = '@bdms_auth_token';

/**
 * Authentication Provider Component
 * 
 * NOW USES BACKEND SQLite DATABASE
 * - All user data stored on server
 * - Synced across web and mobile
 * - Available on all devices
 * 
 * Authentication Flow:
 * 1. User logs in → Backend validates credentials from SQLite
 * 2. User session stored locally for offline access
 * 3. All operations sync with backend database
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Auto-logout after 20 s in background ──────────────────────────────────
  const AUTO_LOGOUT_MS = 20_000;
  const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // userRef always holds latest user so the timer callback is never stale
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Declared BEFORE the AppState useEffect so the setTimeout closure can call it
  const performLogout = async () => {
    try {
      const currentUser = userRef.current;
      if (currentUser) {
        await logAction({
          actorRole: currentUser.role,
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: 'USER_LOGOUT',
          entityType: 'USER',
          entityId: currentUser.id,
        });
      }
      setUser(null);
      await clearUserFromStorage();
      console.log('[AutoLogout] Session cleared');
    } catch (error) {
      console.error('[AutoLogout] Error:', error);
      setUser(null);
      await clearUserFromStorage();
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      appStateRef.current = nextState;
      if (nextState === 'background' || nextState === 'inactive') {
        if (!backgroundTimerRef.current) {
          backgroundTimerRef.current = setTimeout(() => {
            console.log('[AutoLogout] 20s in background - logging out');
            performLogout();
          }, AUTO_LOGOUT_MS);
        }
      } else if (nextState === 'active') {
        if (backgroundTimerRef.current) {
          clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = null;
          console.log('[AutoLogout] App resumed - logout cancelled');
        }
      }
    });
    return () => {
      subscription.remove();
      if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Load user session from local storage on mount
   */
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  /**
   * Load stored user session
   * This allows users to stay logged in after app restart
   */
  const loadUserFromStorage = async () => {
    try {
      setIsLoading(true);
      
      const storedUserData = await AsyncStorage.getItem(USER_DATA_KEY);
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      
      if (storedUserData && storedToken) {
        const userData: User = JSON.parse(storedUserData);
        setUser(userData);
        console.log('✅ Session restored for:', userData.email);
      } else {
        console.log('ℹ️ No existing session found');
      }
    } catch (error) {
      console.error('❌ Error loading user from storage:', error);
      await AsyncStorage.removeItem(USER_DATA_KEY);
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save user session to local storage
   */
  const saveUserToStorage = async (userData: User) => {
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, 'mock_token_' + userData.id);
      console.log('💾 User session saved');
    } catch (error) {
      console.error('❌ Error saving user to storage:', error);
    }
  };

  /**
   * Clear user session from local storage
   */
  const clearUserFromStorage = async () => {
    try {
      await AsyncStorage.removeItem(USER_DATA_KEY);
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      console.log('🗑️ User session cleared');
    } catch (error) {
      console.error('❌ Error clearing user from storage:', error);
    }
  };

  /**
   * Register a new user
   * 
   * @param name - User's full name
   * @param email - User's email address
   * @param password - User's password
   * @param role - User's role (donor, user/recipient, admin)
   * 
   * Flow:
   * 1. Generate unique user ID
   * 2. Send to backend API
   * 3. Backend stores in SQLite database
   * 4. Save session locally
   */
  const register = async (
    name: string,
    email: string,
    password: string,
    role: string
  ): Promise<void> => {
    try {
      console.log(`📝 Registering user: ${email} (${role})`);

      // Generate unique ID
      const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Call backend API
      const response = await authAPI.register({
        id,
        name,
        email,
        password,
        role,
      });

      if (response.success) {
        const userData: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role as User['role'],
        };

        setUser(userData);
        await saveUserToStorage(userData);
        
        console.log('✅ User registered successfully:', email);
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      throw new Error(error.message || 'Failed to register user');
    }
  };

  /**
   * Login user
   * 
   * @param email - User's email
   * @param password - User's password
   * @param role - User's role
   * 
   * Flow:
   * 1. Send credentials to backend
   * 2. Backend validates against SQLite database
   * 3. If valid, save session locally
   */
  const login = async (
    email: string,
    password: string,
    role: string
  ): Promise<void> => {
    try {
      console.log(`🔐 Logging in: ${email} (${role})`);

      // Call backend API
      const response = await authAPI.login({
        email,
        password,
        role,
      });

      if (response.success) {
        const userData: User = {
          id: response.user.id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role as User['role'],
        };

        setUser(userData);
        await saveUserToStorage(userData);
        
        console.log('✅ User logged in successfully:', email);
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw new Error(error.message || 'Invalid credentials');
    }
  };

  /**
   * Logout user
   * 
   * Clears session and user data
   * 
   * Note: Audit log is created before logout to ensure
   * user data is still available
   */
  const logout = async (): Promise<void> => {
    try {
      console.log('👋 Logging out user');
      
      // Create audit log before clearing user data
      if (user) {
        await logAction({
          actorRole: user.role,
          actorId: user.id,
          actorName: user.name,
          action: 'USER_LOGOUT',
          entityType: 'USER',
          entityId: user.id,
        });
      }
      
      setUser(null);
      await clearUserFromStorage();
      
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw new Error('Failed to logout');
    }
  };

  /**
   * Reset user password
   * 
   * @param email - User's email
   * @param newPassword - New password
   * 
   * Flow:
   * 1. Send to backend API
   * 2. Backend updates password in SQLite
   * 3. User must login again with new password
   */
  const resetPassword = async (
    email: string,
    newPassword: string
  ): Promise<void> => {
    try {
      console.log(`🔑 Resetting password for: ${email}`);

      const response = await authAPI.resetPassword(email, newPassword);

      if (response.success) {
        console.log('✅ Password reset successfully');
      }
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  };

  const value: AuthContextType = {
    user,
    userRole: user?.role || null,
    isLoading,
    login,
    register,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use Authentication Context
 * 
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
