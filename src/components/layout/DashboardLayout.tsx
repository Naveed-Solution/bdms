import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';

interface DashboardLayoutProps {
  role: 'admin' | 'donor' | 'recipient';
  title: string;
  unreadCount?: number;
  onMenuPress: () => void;
  onNotificationPress: () => void;
  children: React.ReactNode;
}

export default function DashboardLayout({
  role,
  title,
  unreadCount = 0,
  onMenuPress,
  onNotificationPress,
  children,
}: DashboardLayoutProps) {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <AppHeader
        role={role}
        title={title}
        unreadCount={unreadCount}
        onMenuPress={onMenuPress}
        onNotificationPress={onNotificationPress}
      />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
});
