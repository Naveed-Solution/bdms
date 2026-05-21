import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { getUnreadNotificationCount } from '../../services/notificationService';

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * AdminDashboard Screen
 * 
 * Complete admin dashboard with system management features
 * Accessible only to users with role = 'admin'
 */
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

  /**
   * Load real statistics from backend
   */
  useEffect(() => {
    loadStats();
    loadActivities();
  }, []);

  /**
   * Load unread notification count when screen comes into focus
   */
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
      const usersResponse = await fetch('http://192.168.0.120:3000/api/users');
      const usersData = await usersResponse.json();

      // Fetch blood requests
      const requestsResponse = await fetch('http://192.168.0.120:3000/api/blood-requests');
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
      const response = await fetch('http://192.168.0.120:3000/api/admin/recent-activities?limit=5');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Menu Icon (Left) */}
        <TouchableOpacity 
          style={styles.headerIcon}
          onPress={() => setShowMenu(!showMenu)}
        >
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>ADMINISTRATOR</Text>
          </View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>

        {/* Notification Bell Icon (Right) */}
        <TouchableOpacity 
          style={styles.headerIcon}
          onPress={() => navigation.navigate('Notifications' as never)}
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

      {/* Dropdown Menu */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop}
            onPress={() => setShowMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.sidebarMenu}>
            {/* Enhanced User Profile Header */}
            <View style={styles.menuHeader}>
              <View style={styles.profileCard}>
                <View style={styles.menuAvatar}>
                  <Ionicons name="shield-checkmark" size={36} color="#DC143C" />
                </View>
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName}>{user?.name}</Text>
                  <View style={styles.roleContainer}>
                    <View style={styles.roleIndicator} />
                    <Text style={styles.menuUserRole}>System Administrator</Text>
                  </View>
                  <View style={styles.emailContainer}>
                    <Ionicons name="mail" size={12} color="#999" />
                    <Text style={styles.menuUserEmail}>{user?.email}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Menu Items */}
            <View style={styles.menuSection}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('AdminProfile' as never);
                }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="person-circle" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.menuItemText}>My Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Notifications' as never);
                }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="notifications" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.menuItemText}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('AdminAuditLogs' as never);
                }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="document-text" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.menuItemText}>Audit Logs</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            {/* Logout Section */}
            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => {
                setShowMenu(false);
                handleLogout();
              }}
            >
              <View style={styles.menuItemIcon}>
                <Ionicons name="log-out" size={22} color="#DC143C" />
              </View>
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Logout</Text>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterText}>BDMS v1.0</Text>
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
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
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.95,
    fontWeight: '500',
  },
  headerLogout: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerLogoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  menuHeader: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  profileCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#DC143C',
  },
  menuUserInfo: {
    marginTop: 0,
  },
  menuUserName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  roleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  menuUserRole: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  menuUserEmail: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  menuSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'center',
  },
  menuFooterText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuBadge: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
    marginHorizontal: 12,
  },
  menuItemDanger: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  menuItemTextDanger: {
    color: '#DC143C',
    fontWeight: '700',
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
  actionIconText: {
    fontSize: 26,
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
  actionArrow: {
    fontSize: 28,
    color: '#D0D0D0',
    marginLeft: 10,
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
