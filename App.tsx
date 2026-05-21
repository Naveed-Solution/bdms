import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import { BloodRequestProvider } from './src/context/BloodRequestContext';
import { NotificationProvider } from './src/context/NotificationContext';

/**
 * App Component - Application Entry Point
 * 
 * STRUCTURE:
 * 1. AlertProvider - Provides custom alert system across the app
 * 2. AuthProvider - Wraps entire app to provide authentication context
 * 3. BloodRequestProvider - Manages blood request state and persistence
 * 4. NavigationContainer - React Navigation wrapper
 * 5. NotificationProvider - Manages push notifications and navigation
 * 6. AppNavigator - Main navigation logic with RBAC
 * 
 * Note: NotificationProvider must be inside NavigationContainer to access navigation
 */
export default function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <BloodRequestProvider>
          <NavigationContainer>
            <NotificationProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </NotificationProvider>
          </NavigationContainer>
        </BloodRequestProvider>
      </AuthProvider>
    </AlertProvider>
  );
}

