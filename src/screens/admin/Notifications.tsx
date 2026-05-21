/**
 * Notifications Screen
 * 
 * Push Notifications for Admin
 * 
 * This screen displays all notifications for the admin:
 * - New profile approval requests
 * - New blood requests
 * - User appeals
 * - System alerts
 * 
 * Features:
 * - Real-time notification updates
 * - Mark as read functionality
 * - Delete notifications
 * - Filter by read/unread status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import * as notificationService from '../../services/notificationService';
import { Notification } from '../../types/notification.types';

const Notifications: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  /**
   * Load notifications from backend
   */
  const loadNotifications = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      if (!user?.id) {
        throw new Error('User not found');
      }

      const data = await notificationService.getNotifications(user.id);
      setNotifications(data);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load notifications',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Mark notification as read
   */
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      
      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: 1 } : notif
        )
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to mark notification as read',
      });
    }
  };

  /**
   * Delete notification
   */
  const handleDelete = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      
      // Update local state
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      
      showAlert({
        type: 'success',
        title: 'Deleted',
        message: 'Notification deleted',
      });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete notification',
      });
    }
  };

  /**
   * Mark all as read
   */
  const handleMarkAllAsRead = async () => {
    try {
      if (!user?.id) return;
      
      await notificationService.markAllNotificationsAsRead(user.id);
      
      // Update local state
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: 1 }))
      );

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to mark all as read',
      });
    }
  };

  /**
   * Handle notification tap
   */
  const handleNotificationTap = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'PROFILE_APPROVAL') {
      navigation.navigate('ProfileApprovals' as never);
    } else if (notification.type === 'BLOOD_REQUEST') {
      navigation.navigate('ViewRequests' as never);
    } else if (notification.type === 'APPEAL') {
      navigation.navigate('AppealsList' as never);
    }
  };

  /**
   * Get icon and color based on notification type
   */
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'PROFILE_APPROVAL':
        return { icon: 'person-add', color: '#4ECDC4' };
      case 'BLOOD_REQUEST':
        return { icon: 'water', color: '#DC143C' };
      case 'APPEAL':
        return { icon: 'alert-circle', color: '#FFA500' };
      case 'SYSTEM':
        return { icon: 'information-circle', color: '#3498DB' };
      default:
        return { icon: 'notifications', color: '#999' };
    }
  };

  /**
   * Get filtered notifications
   */
  const getFilteredNotifications = () => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.is_read);
    } else if (filter === 'read') {
      return notifications.filter(n => n.is_read);
    }
    return notifications;
  };

  useEffect(() => {
    loadNotifications();

    // Set up polling for new notifications (every 30 seconds)
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.is_read).length;

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
        <View style={styles.centerContainer}>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'read' && styles.filterTabActive]}
          onPress={() => setFilter('read')}
        >
          <Text style={[styles.filterTabText, filter === 'read' && styles.filterTabTextActive]}>
            Read ({notifications.length - unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNotifications(true)}
            colors={['#DC143C']}
          />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unread' ? 'All caught up!' : 'No notifications to display'}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const { icon, color } = getNotificationStyle(notification.type);
            
            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationCard, !notification.is_read && styles.notificationUnread]}
                onPress={() => handleNotificationTap(notification)}
              >
                <View style={[styles.notificationIcon, { backgroundColor: color + '20' }]}>
                  <Ionicons name={icon as any} size={24} color={color} />
                </View>
                
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {!notification.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationMessage} numberOfLines={2}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {new Date(notification.created_at).toLocaleDateString()} at{' '}
                    {new Date(notification.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(notification.id);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#999" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerAction: {
    padding: 8,
  },
  headerActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#DC143C',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  filterTabTextActive: {
    color: '#DC143C',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationUnread: {
    backgroundColor: '#FFFAF0',
    borderLeftWidth: 4,
    borderLeftColor: '#DC143C',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC143C',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 4,
  },
});

export default Notifications;

