import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
// @ts-ignore - expo/vector-icons types not available in this setup
import { Ionicons } from '@expo/vector-icons';
import { getUnreadNotificationCount } from '../../services/notificationService';
import { API_BASE_URL } from '../../services/api';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DrawerContent, { DrawerMenuItem } from '../../components/layout/DrawerContent';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function AdminDashboard() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDonors: 0,
    totalRecipients: 0,
    activeRequests: 0,
    totalRequests: 0,
    completedRequests: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [activities, setActivities] = useState<Array<{
    title: string;
    timeAgo: string;
    color: string;
  }>>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    loadStats();
    loadActivities();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadUnreadCount();
      }
    }, [user])
  );

  const loadUnreadCount = async () => {
    if (user?.id) {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    }
  };

  const loadStats = async () => {
    try {
      setIsLoading(true);

      // Fetch users
  const usersResponse = await fetch(`${API_BASE_URL}/users`);
      const usersData = await usersResponse.json();

      // Fetch blood requests
  const requestsResponse = await fetch(`${API_BASE_URL}/blood-requests`);
      const requestsData = await requestsResponse.json();

      if (usersData.users && requestsData.requests) {
        const users = usersData.users;
        const requests = requestsData.requests;

        // Count users by role
        const donors = users.filter((u: any) => u.role === 'donor').length;
        const recipients = users.filter((u: any) => u.role === 'user').length;

        // Count requests by status
        const activeReqs = requests.filter((r: any) => 
          r.status === 'PENDING' || r.status === 'ACCEPTED'
        ).length;
        const completedReqs = requests.filter((r: any) => r.status === 'COMPLETED').length;

        setStats({
          totalUsers: users.length,
          totalDonors: donors,
          totalRecipients: recipients,
          activeRequests: activeReqs,
          totalRequests: requests.length,
          completedRequests: completedReqs,
        });

        console.log('✅ [Admin] Dashboard stats loaded:', {
          users: users.length,
          donors,
          recipients,
          requests: requests.length,
        });
      }
    } catch (error) {
      console.error('❌ [Admin] Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      setLoadingActivities(true);
  const response = await fetch(`${API_BASE_URL}/admin/recent-activities?limit=5`);
      const data = await response.json();

      if (data.success && data.activities) {
        setActivities(data.activities);
        console.log('✅ [Admin] Recent activities loaded:', data.activities.length);
      }
    } catch (error) {
      console.error('❌ [Admin] Error loading activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      type: 'warning',
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => await logout()
        },
      ]
    });
  };

  const menuItems: DrawerMenuItem[] = [
    {
      label: 'My Profile',
      icon: 'person-circle',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('AdminProfile' as never);
      },
    },
    {
      label: 'Notifications',
      icon: 'notifications',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('Notifications' as never);
      },
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Audit Logs',
      icon: 'document-text',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('AdminAuditLogs' as never);
      },
    },
  ];

  return (
    <DashboardLayout
      role="admin"
      title="Admin Dashboard"
      unreadCount={unreadCount}
      onMenuPress={() => setShowMenu(!showMenu)}
      onNotificationPress={() => navigation.navigate('Notifications' as never)}
    >
      {/* Drawer Menu Overlay */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop}
            onPress={() => setShowMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.sidebarMenu}>
            <DrawerContent
              role="admin"
              userName={user?.name || 'Admin'}
              userEmail={user?.email || ''}
              profileStatus="approved"
              menuItems={menuItems}
              onLogout={() => {
                setShowMenu(false);
                handleLogout();
              }}
            />
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Statistics Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC143C" />
            <Text style={styles.loadingText}>Loading statistics...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPurple]}>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={[styles.statCard, styles.statCardRed]}>
              <Text style={styles.statValue}>{stats.totalDonors}</Text>
              <Text style={styles.statLabel}>Donors</Text>
            </View>
            <View style={[styles.statCard, styles.statCardBlue]}>
              <Text style={styles.statValue}>{stats.totalRecipients}</Text>
              <Text style={styles.statLabel}>Recipients</Text>
            </View>
            <View style={[styles.statCard, styles.statCardOrange]}>
              <Text style={styles.statValue}>{stats.activeRequests}</Text>
              <Text style={styles.statLabel}>Active Requests</Text>
            </View>
            <View style={[styles.statCard, styles.statCardGreen]}>
              <Text style={styles.statValue}>{stats.totalRequests}</Text>
              <Text style={styles.statLabel}>Total Requests</Text>
            </View>
            <View style={[styles.statCard, styles.statCardTeal]}>
              <Text style={styles.statValue}>{stats.completedRequests}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('ProfileApprovals')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="people" size={26} color="#9C27B0" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>User Management</Text>
              <Text style={styles.actionDescription}>Approve and manage user profiles</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#D0D0D0" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('ManageUsers' as never)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="person-circle" size={26} color="#4CAF50" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Manage Users</Text>
              <Text style={styles.actionDescription}>View all registered donors and recipients</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#D0D0D0" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('ViewRequests' as never)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="document-text" size={26} color="#2196F3" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Requests</Text>
              <Text style={styles.actionDescription}>Monitor all blood donation requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#D0D0D0" />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {loadingActivities ? (
            <View style={styles.activityCard}>
              <ActivityIndicator size="small" color="#DC143C" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : activities.length > 0 ? (
            <View style={styles.activityCard}>
              {activities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: activity.color }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.timeAgo}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.activityCard}>
              <Text style={styles.emptyText}>No recent activities</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Blood Donation Management System{'\n'}
            Admin Panel v1.0
          </Text>
        </View>
      </ScrollView>
      </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebarMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    minWidth: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statCardPurple: {
    borderTopWidth: 3,
    borderTopColor: '#9C27B0',
    backgroundColor: '#FAFAFA',
  },
  statCardRed: {
    borderTopWidth: 3,
    borderTopColor: '#DC143C',
    backgroundColor: '#FAFAFA',
  },
  statCardBlue: {
    borderTopWidth: 3,
    borderTopColor: '#2196F3',
    backgroundColor: '#FAFAFA',
  },
  statCardOrange: {
    borderTopWidth: 3,
    borderTopColor: '#FF9800',
    backgroundColor: '#FAFAFA',
  },
  statCardGreen: {
    borderTopWidth: 3,
    borderTopColor: '#4CAF50',
    backgroundColor: '#FAFAFA',
  },
  statCardTeal: {
    borderTopWidth: 3,
    borderTopColor: '#00BCD4',
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    lineHeight: 18,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});
