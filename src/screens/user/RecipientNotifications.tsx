import React, { useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/notificationService';
import { Notification } from '../../types/notification.types';
import { useFocusEffect } from '@react-navigation/native';

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * RecipientNotifications
 * 
 * Screen for recipients to view ALL their notifications
 * Shows: profile approvals, account status changes, request acceptances, etc.
 */
export default function RecipientNotifications() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  /**
   * Load notifications
   */
  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      const data = await getNotifications(user.id);
      setNotifications(data);
      console.log(`✅ Loaded ${data.length} recipient notifications`);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      showAlert({ title: 'Error', message: 'Failed to load notifications', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Apply filter
   */
  React.useEffect(() => {
    if (filter === 'all') {
      setFilteredNotifications(notifications);
    } else if (filter === 'unread') {
      setFilteredNotifications(notifications.filter((n) => !n.is_read && !n.read));
    } else {
      setFilteredNotifications(notifications.filter((n) => n.is_read || n.read));
    }
  }, [notifications, filter]);

  /**
   * Refresh on focus
   */
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }, [user?.id])
  );

  /**
   * Mark notification as read
   */
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: 1, read: true } : n))
      );
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  /**
   * Mark all as read
   */
  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1, read: true })));
      showAlert({ title: 'Success', message: 'All notifications marked as read', type: 'success' });
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
    }
  };

  /**
   * Delete notification
   */
  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  };

  /**
   * Handle notification tap - navigate to relevant screen
   */
  const handleNotificationTap = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read && !notification.read) {
      handleMarkAsRead(notification.id);
    }

    // Parse data
    let parsedData = notification.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        parsedData = {};
      }
    }

    // Navigate based on type
    switch (notification.type) {
      case 'PROFILE_APPROVED':
      case 'PROFILE_REJECTED':
        navigation.navigate('RecipientProfileForm');
        break;

      case 'REQUEST_ACCEPTED':
        if (parsedData?.requestId) {
          navigation.navigate('RequestStatus', { requestId: parsedData.requestId } as never);
        }
        break;

      case 'ACCOUNT_ACTIVATED':
      case 'ACCOUNT_DEACTIVATED':
        // Stay on notifications screen
        break;

      default:
        // Default behavior
        break;
    }
  };

  /**
   * Get notification icon and color
   */
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'PROFILE_APPROVED':
        return { icon: 'checkmark-circle', color: '#4CAF50' };
      case 'PROFILE_REJECTED':
        return { icon: 'close-circle', color: '#F44336' };
      case 'REQUEST_ACCEPTED':
        return { icon: 'water', color: '#4CAF50' };
      case 'ACCOUNT_ACTIVATED':
        return { icon: 'checkmark-circle', color: '#4CAF50' };
      case 'ACCOUNT_DEACTIVATED':
        return { icon: 'ban', color: '#F44336' };
      default:
        return { icon: 'notifications', color: '#999' };
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
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

  const unreadCount = notifications.filter(n => !n.is_read && !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'read' && styles.filterTabActive]}
          onPress={() => setFilter('read')}
        >
          <Text style={[styles.filterText, filter === 'read' && styles.filterTextActive]}>
            Read ({notifications.length - unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unread' ? 'All caught up!' : 'You have no notifications yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const style = getNotificationStyle(item.type);
          const isUnread = !item.is_read && !item.read;

          return (
            <TouchableOpacity
              style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}
              onPress={() => handleNotificationTap(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.notificationIcon, { backgroundColor: `${style.color}15` }]}>
                <Ionicons name={style.icon as any} size={24} color={style.color} />
              </View>
              
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#999" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFEBEE',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#DC143C',
    fontWeight: 'bold',
  },
  notificationCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationCardUnread: {
    backgroundColor: '#FFFBF5',
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
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
  },
});

