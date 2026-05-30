import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppHeaderProps {
  role: 'admin' | 'donor' | 'recipient';
  title: string;
  unreadCount?: number;
  onMenuPress: () => void;
  onNotificationPress: () => void;
}

export default function AppHeader({
  role,
  title,
  unreadCount = 0,
  onMenuPress,
  onNotificationPress,
}: AppHeaderProps) {
  const getRoleBadgeText = () => {
    switch (role) {
      case 'admin':
        return 'ADMINISTRATOR';
      case 'donor':
        return 'DONOR';
      case 'recipient':
        return 'RECIPIENT';
      default:
        return 'USER';
    }
  };

  return (
    <View style={styles.header}>
      {/* Left: Menu Icon */}
      <TouchableOpacity
        style={styles.headerIcon}
        onPress={onMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons name="menu" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Center: Role Badge + Title (LEFT-ALIGNED) */}
      <View style={styles.headerContent}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{getRoleBadgeText()}</Text>
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {/* Right: Notification Bell */}
      <TouchableOpacity
        style={styles.headerIcon}
        onPress={onNotificationPress}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications" size={24} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#C81E1E',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 8,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerIcon: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF5722',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#C81E1E',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
