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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * DonorNotifications
 *
 * Screen for donors to view their notifications.
 * Visually identical to RecipientNotifications / admin Notifications for consistency.
 * Filters OUT blood request notifications (those appear in Browse Requests).
 */
export default function DonorNotifications() {
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

      // Filter out blood request notifications — those appear in Browse Requests
      const filtered = data.filter(
        (notif: Notification) =>
          notif.type !== 'BLOOD_REQUEST_CREATED' && notif.type !== 'NEW_BLOOD_REQUEST'
      );

      setNotifications(filtered);
      console.log(`✅ Loaded ${filtered.length} donor notifications (excluded blood requests)`);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to load notifications' });
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
      showAlert({ type: 'success', title: 'Success', message: 'All notifications marked as read' });
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      showAlert({ type: 'error', title: 'Error', message: 'Failed to mark all as read' });
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
      showAlert({ type: 'error', title: 'Error', message: 'Failed to delete notification' });
    }
  };

  /**
   * Handle notification tap — navigate to relevant screen
   */
  const handleNotificationTap = (notification: Notification) => {
    if (!notification.is_read && !notification.read) {
      handleMarkAsRead(notification.id);
    }

    let parsedData: any = notification.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        parsedData = {};
      }
    }

    switch (notification.type) {
      case 'PROFILE_APPROVED':
      case 'PROFILE_REJECTED':
        navigation.navigate('DonorProfileForm' as never);
        break;

      case 'REQUEST_ACCEPTED':
        if (parsedData?.requestId) {
          navigation.navigate('LiveTracking', {
            requestId: parsedData.requestId,
            donorId: user?.id,
          } as never);
        }
        break;

      case 'ACCOUNT_ACTIVATED':
      case 'ACCOUNT_DEACTIVATED':
        // Stay on notifications screen
        break;

      default:
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
      case 'ACCOUNT_ACTIVATED':
        return { icon: 'checkmark-circle', color: '#4CAF50' };
      case 'ACCOUNT_DEACTIVATED':
        return { icon: 'ban', color: '#F44336' };
      case 'APPEAL_ACCEPTED':
        return { icon: 'thumbs-up', color: '#4CAF50' };
      case 'APPEAL_REJECTED':
        return { icon: 'thumbs-down', color: '#F44336' };
      case 'REQUEST_ACCEPTED':
        return { icon: 'water', color: '#4CAF50' };
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

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length;

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
            }}
            colors={['#DC143C']}
          />
        }
        contentContainerStyle={styles.listContainer}
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
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
