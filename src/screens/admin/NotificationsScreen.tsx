/**
 * Notifications Screen
 * 
 * Real-time Notification System
 * 
 * This screen displays all system notifications for the user.
 * Notifications provide real-time updates about important events like:
 * - Profile approval requests (for admins)
 * - Profile status updates (approved/rejected)
 * - Account status changes
 * - Appeal updates
 * - Blood request activities
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  formatNotificationTime,
  getNotificationIcon,
  getNotificationColor,
} from '../../services/notificationService';
import { Notification } from '../../types/notification.types';

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [user])
  );

  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, is_read: 1 } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    if (notification.is_read === 0) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    try {
      const data = notification.data ? JSON.parse(notification.data) : {};
      
      switch (notification.type) {
        case 'PROFILE_APPROVAL_REQUEST':
          navigation.navigate('ProfileApprovals' as never);
          break;
        case 'APPEAL_SUBMITTED':
          navigation.navigate('AppealsList' as never);
          break;
        default:
          // Just mark as read, no navigation
          break;
      }
    } catch (error) {
      console.error('Error handling notification:', error);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconName = getNotificationIcon(item.type);
    const iconColor = getNotificationColor(item.type);
    const isUnread = item.is_read === 0;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationIcon, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName as any} size={24} color={iconColor} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          
          <Text style={styles.notificationTime}>
            {formatNotificationTime(item.created_at)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No notifications</Text>
          <Text style={styles.emptySubtext}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationUnread: {
    backgroundColor: '#FFF9F5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
});

export default NotificationsScreen;

