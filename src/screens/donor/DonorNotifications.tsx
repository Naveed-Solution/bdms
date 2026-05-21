import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

/**
 * DonorNotifications
 * 
 * Screen for donors to view their notifications
 * Filters OUT blood request notifications (those appear in Browse Requests)
 * Shows: profile approvals, account status changes, appeals, request acceptances
 */
export default function DonorNotifications() {
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
      
      // Filter out blood request notifications - those should appear in Browse Requests
      const filtered = data.filter((notif: Notification) => 
        notif.type !== 'BLOOD_REQUEST_CREATED' &&
        notif.type !== 'NEW_BLOOD_REQUEST'
      );
      
      setNotifications(filtered);
      console.log(`✅ Loaded ${filtered.length} donor notifications (excluded blood requests)`);
    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      showAlert('Error', 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Apply filter
   */
  useEffect(() => {
    if (filter === 'all') {
      setFilteredNotifications(notifications);
    } else if (filter === 'unread') {
      setFilteredNotifications(notifications.filter((n) => !n.read));
    } else {
      setFilteredNotifications(notifications.filter((n) => n.read));
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
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
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
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showAlert('Success', 'All notifications marked as read', 'success');
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      showAlert('Error', 'Failed to mark all as read', 'error');
    }
  };

  /**
   * Delete notification
   */
  const handleDelete = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notificationId);
              setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
              showAlert('Success', 'Notification deleted', 'success');
            } catch (error) {
              console.error('❌ Error deleting notification:', error);
              showAlert('Error', 'Failed to delete notification', 'error');
            }
          },
        },
      ]
    );
  };

  /**
   * Get icon and color for notification type
   */
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'PROFILE_APPROVED':
        return { icon: 'checkmark-circle', color: '#4CAF50' };
      case 'PROFILE_REJECTED':
        return { icon: 'close-circle', color: '#F44336' };
      case 'ACCOUNT_ACTIVATED':
        return { icon: 'shield-checkmark', color: '#4CAF50' };
      case 'ACCOUNT_DEACTIVATED':
        return { icon: 'shield-outline', color: '#F44336' };
      case 'APPEAL_ACCEPTED':
        return { icon: 'thumbs-up', color: '#4CAF50' };
      case 'APPEAL_REJECTED':
        return { icon: 'thumbs-down', color: '#F44336' };
      case 'REQUEST_ACCEPTED':
        return { icon: 'heart', color: '#DC143C' };
      default:
        return { icon: 'notifications', color: '#666' };
    }
  };

  /**
   * Render notification item
   */
  const renderNotification = ({ item }: { item: Notification }) => {
    const { icon, color } = getNotificationStyle(item.type);
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.unreadCard]}
        onPress={() => !item.read && handleMarkAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color="#999" />
        </TouchableOpacity>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>Stay updated on your account</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.activeFilterTab]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.activeFilterText]}>
            Unread ({notifications.filter((n) => !n.read).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'read' && styles.activeFilterTab]}
          onPress={() => setFilter('read')}
        >
          <Text style={[styles.filterText, filter === 'read' && styles.activeFilterText]}>
            Read ({notifications.filter((n) => n.read).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mark All as Read Button */}
      {notifications.some((n) => !n.read) && (
        <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
          <Ionicons name="checkmark-done" size={18} color="#DC143C" />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified about profile status, account changes, and accepted requests
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeFilterTab: {
    backgroundColor: '#FFEBEE',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeFilterText: {
    color: '#DC143C',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC143C',
    marginLeft: 8,
  },
  listContainer: {
    padding: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  unreadCard: {
    borderColor: '#DC143C',
    borderWidth: 1.5,
    backgroundColor: '#FFFBFB',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC143C',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});

