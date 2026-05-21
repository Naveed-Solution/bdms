import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useBloodRequest } from '../../context/BloodRequestContext';
import { profileAPI, API_BASE_URL } from '../../services/api';
import { getUnreadNotificationCount } from '../../services/notificationService';

type NavigationProp = StackNavigationProp<RootStackParamList, 'UserHome'>;

/**
 * UserHomeScreen (Recipient Dashboard)
 * 
 * Complete recipient dashboard with blood request features
 * Accessible only to users with role = 'user'
 */
export default function UserHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { getUserRequests } = useBloodRequest();
  
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [nearbyDonors, setNearbyDonors] = useState(0);
  const [availableDonors, setAvailableDonors] = useState(0);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'rejected'>('loading');
  const [profileRemarks, setProfileRemarks] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  /**
   * Load recipient profile status
   */
  useEffect(() => {
    loadProfileStatus();
    loadDonorStats();
    loadBloodTypeCounts();
  }, [user]);

  const loadProfileStatus = async () => {
    if (!user) return;
    
    try {
      const response = await profileAPI.getRecipientProfile(user.id);
      if (response.success && response.profile) {
        const status = response.profile.approval_status || response.profile.approvalStatus;
        setProfileStatus(status.toLowerCase());
        setProfileRemarks(response.profile.admin_remarks || response.profile.adminRemarks || '');
      } else {
        setProfileStatus('none');
      }
    } catch (error) {
      console.log('No profile found');
      setProfileStatus('none');
    }
  };

  /**
   * Load actual donor statistics
   */
  const loadDonorStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const data = await response.json();
      
      // Count total registered donors
      const totalDonorsCount = data.users.filter((u: any) => u.role === 'donor').length;
      
      // Get donor profiles to check approval status
      const profilesResponse = await fetch(`${API_BASE_URL}/admin/pending-profiles`);
      const profilesData = await profilesResponse.json();
      
      // Count approved donors only
      const approvedDonors = profilesData.profiles?.filter((p: any) => 
        p.type === 'donor' && p.approval_status === 'APPROVED'
      ).length || 0;
      
      setAvailableDonors(approvedDonors);
      setNearbyDonors(totalDonorsCount);
      
      console.log(`✅ Loaded donor stats: ${approvedDonors} available, ${totalDonorsCount} total`);
    } catch (error) {
      console.error('❌ Error loading donor stats:', error);
      // Set to 0 if API fails
      setAvailableDonors(0);
      setNearbyDonors(0);
    }
  };

  /**
   * Load actual blood type counts
   */
  const loadBloodTypeCounts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/donors-by-blood-type`);
      const data = await response.json();
      
      // Convert API response to array format for UI
      const bloodTypeArray = [
        { type: 'A+', donors: data.bloodTypes['A+'] || 0 },
        { type: 'A-', donors: data.bloodTypes['A-'] || 0 },
        { type: 'B+', donors: data.bloodTypes['B+'] || 0 },
        { type: 'B-', donors: data.bloodTypes['B-'] || 0 },
        { type: 'O+', donors: data.bloodTypes['O+'] || 0 },
        { type: 'O-', donors: data.bloodTypes['O-'] || 0 },
        { type: 'AB+', donors: data.bloodTypes['AB+'] || 0 },
        { type: 'AB-', donors: data.bloodTypes['AB-'] || 0 },
      ];
      
      setBloodTypes(bloodTypeArray);
      console.log('✅ Loaded blood type counts:', data.bloodTypes);
    } catch (error) {
      console.error('❌ Error loading blood type counts:', error);
    }
  };

  /**
   * Update user requests
   */
  const updateUserRequests = () => {
    if (user?.id) {
      const requests = getUserRequests(user.id);
      console.log('🏠 [UserHome] Updating user requests:', requests.length);
      if (requests.length > 0) {
        console.log('📋 [UserHome] Request statuses:', requests.map(r => `${r.id.slice(-6)}: ${r.status}`).join(', '));
      }
      setUserRequests(requests);
    }
  };

  /**
   * Initial load on mount
   */
  useEffect(() => {
    loadProfileStatus();
    updateUserRequests();
  }, []);

  /**
   * Reload data when screen comes into focus
   * Ensures real-time updates after creating requests or updating profile
   */
  useFocusEffect(
    React.useCallback(() => {
      loadProfileStatus();
      loadDonorStats();
      loadBloodTypeCounts();
      updateUserRequests();
    }, [user?.id])
  );

  /**
   * SINGLE polling effect for real-time updates (2 seconds)
   * Consolidated to prevent duplicate API calls
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadProfileStatus();
        loadDonorStats();
        loadBloodTypeCounts();
        updateUserRequests();
      }
    }, 2000); // 2 seconds for optimal performance

    return () => clearInterval(interval);
  }, [user?.id]);

  const [bloodTypes, setBloodTypes] = useState([
    { type: 'A+', donors: 0 },
    { type: 'A-', donors: 0 },
    { type: 'B+', donors: 0 },
    { type: 'B-', donors: 0 },
    { type: 'O+', donors: 0 },
    { type: 'O-', donors: 0 },
    { type: 'AB+', donors: 0 },
    { type: 'AB-', donors: 0 },
  ]);

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

  const showFeature = (feature: string) => {
    showAlert({
      type: 'info',
      title: feature,
      message: `${feature} feature will be implemented here. This is a placeholder for the full implementation.`,
    });
  };

  /**
   * Navigate to Create Blood Request screen (only if profile approved)
   */
  const createRequest = () => {
    if (profileStatus !== 'approved') {
      showAlert({
        type: 'warning',
        title: 'Profile Required',
        message: profileStatus === 'none' 
          ? 'Please complete your profile first'
          : profileStatus === 'pending'
          ? 'Your profile is pending admin approval'
          : 'Your profile was rejected. Please update it.',
      });
      return;
    }
    navigation.navigate('CreateBloodRequest');
  };

  /**
   * View request details and navigate to status screen
   */
  const viewRequestStatus = (requestId: string) => {
    navigation.navigate('RequestStatus', { requestId });
  };

  /**
   * Get color for request status badge
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50';
      case 'ACCEPTED': return '#34C759';
      case 'PENDING': return '#FF9800';
      default: return '#999';
    }
  };
  
  /**
   * Format date for display
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  /**
   * Load unread notification count
   */
  const loadUnreadCount = async () => {
    if (user?.id) {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    }
  };

  /**
   * Reload unread count on focus
   */
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadUnreadCount();
      }
    }, [user])
  );

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
            <Text style={styles.roleBadgeText}>RECIPIENT</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name || 'Recipient'}</Text>
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

      {/* Professional Sidebar Menu */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop}
            onPress={() => setShowMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.sidebarMenu}>
            {/* User Profile Header */}
            <View style={styles.menuHeader}>
              <View style={styles.menuProfileCard}>
                <View style={styles.menuAvatar}>
                  <Ionicons name="person" size={36} color="#DC143C" />
                </View>
                <View style={styles.menuUserInfo}>
                  <Text style={styles.menuUserName}>{user?.name}</Text>
                  <View style={styles.roleContainer}>
                    <View style={[styles.roleIndicator, { 
                      backgroundColor: profileStatus === 'approved' ? '#4CAF50' : 
                                      profileStatus === 'pending' ? '#FF9800' :
                                      profileStatus === 'rejected' ? '#F44336' : '#999'
                    }]} />
                    <Text style={styles.menuUserRole}>
                      {profileStatus === 'approved' ? 'Approved Recipient' :
                       profileStatus === 'pending' ? 'Pending Approval' :
                       profileStatus === 'rejected' ? 'Profile Rejected' :
                       'Recipient'}
                    </Text>
                  </View>
                  {user?.email && (
                    <View style={styles.emailContainer}>
                      <Ionicons name="mail" size={12} color="#999" />
                      <Text style={styles.menuUserEmail}>{user.email}</Text>
                    </View>
                  )}
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
                  navigation.navigate('RecipientProfileForm');
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
                  navigation.navigate('RequestHistory');
                }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="document-text" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.menuItemText}>Request History</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('RecipientProfile');
                }}
              >
                <View style={styles.menuItemIcon}>
                  <Ionicons name="lock-closed" size={22} color="#1A1A1A" />
                </View>
                <Text style={styles.menuItemText}>Change Password</Text>
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
        {/* Profile Status Card */}
        {profileStatus === 'loading' ? (
          <View style={styles.profileStatusCard}>
            <ActivityIndicator size="small" color="#DC143C" />
            <Text style={styles.profileStatusText}>Loading profile...</Text>
          </View>
        ) : profileStatus === 'none' ? (
          <TouchableOpacity 
            style={[styles.profileStatusCard, styles.profileIncompleteCard]}
            onPress={() => navigation.navigate('RecipientProfileForm')}
            activeOpacity={0.7}
          >
            <Ionicons name="alert-circle" size={24} color="#FF9800" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Complete Your Profile</Text>
              <Text style={styles.profileStatusSubtitle}>
                Complete your profile to create blood requests
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FF9800" />
          </TouchableOpacity>
        ) : profileStatus === 'pending' ? (
          <View style={[styles.profileStatusCard, styles.profilePendingCard]}>
            <Ionicons name="time" size={24} color="#2196F3" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Under Review</Text>
              <Text style={styles.profileStatusSubtitle}>
                Your profile is pending admin approval
              </Text>
            </View>
          </View>
        ) : profileStatus === 'rejected' ? (
          <TouchableOpacity 
            style={[styles.profileStatusCard, styles.profileRejectedCard]}
            onPress={() => navigation.navigate('RecipientProfileForm')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={24} color="#F44336" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Rejected</Text>
              <Text style={styles.profileStatusSubtitle}>
                {profileRemarks || 'Please update your profile'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#F44336" />
          </TouchableOpacity>
        ) : profileStatus === 'approved' ? (
          <View style={[styles.profileStatusCard, styles.profileApprovedCard]}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Approved ✓</Text>
              <Text style={styles.profileStatusSubtitle}>
                You can now create blood requests
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('RecipientProfileForm')}>
              <Ionicons name="create-outline" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {userRequests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length}
            </Text>
            <Text style={styles.summaryLabel}>Active Requests</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{availableDonors}</Text>
            <Text style={styles.summaryLabel}>Available Donors</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#666' }]}>{nearbyDonors}</Text>
            <Text style={styles.summaryLabel}>Total Donors</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={createRequest}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.actionIconText}>➕</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Blood Request</Text>
              <Text style={styles.actionDescription}>Request blood for yourself or others</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('RequestHistory')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Request History</Text>
              <Text style={styles.actionDescription}>View your past requests</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('RecipientProfileForm')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E1F5FE' }]}>
              <Text style={styles.actionIconText}>✏️</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Update Profile</Text>
              <Text style={styles.actionDescription}>Edit your profile information</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* My Blood Requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Blood Requests</Text>
          {userRequests.filter(r => r.status !== 'CANCELLED').length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active blood requests</Text>
              <Text style={styles.emptyStateSubtext}>
                Create your first request to get started
              </Text>
            </View>
          ) : (
            userRequests
              .filter(request => request.status !== 'CANCELLED')
              .map((request) => (
                <TouchableOpacity 
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() => viewRequestStatus(request.id)}
                >
                  <View style={styles.requestBloodType}>
                    <Text style={styles.requestBloodTypeText}>{request.bloodGroup}</Text>
                  </View>
                  <View style={styles.requestContent}>
                    <Text style={styles.requestTitle}>
                      {request.urgencyLevel === 'EMERGENCY' && '🚨 '}
                      {request.location}
                    </Text>
                    <Text style={styles.requestDetails}>{formatDate(request.createdAt)}</Text>
                  </View>
                  <View style={[styles.requestStatus, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.requestStatusText}>{request.status}</Text>
                  </View>
                </TouchableOpacity>
              ))
          )}
        </View>

        {/* Available Donors by Blood Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Donors</Text>
          <View style={styles.bloodTypeGrid}>
            {bloodTypes.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.bloodTypeCard}
                onPress={() => showAlert({
                  type: 'info',
                  title: `Blood Type ${item.type}`,
                  message: `${item.donors} donors available in your area`,
                })}
              >
                <Text style={styles.bloodTypeLabel}>{item.type}</Text>
                <Text style={styles.bloodTypeDonors}>{item.donors} donors</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Blood Donation Management System{'\n'}
            Recipient Portal v1.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#C81E1E',
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF5722',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
  },
  profileStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIncompleteCard: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  profilePendingCard: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  profileRejectedCard: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  profileApprovedCard: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  profileStatusContent: {
    flex: 1,
  },
  profileStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  profileStatusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  profileStatusSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666',
  },
  actionArrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 10,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  requestBloodType: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestBloodTypeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
  },
  requestContent: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  requestDetails: {
    fontSize: 13,
    color: '#666',
  },
  requestStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  requestStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bloodTypeCard: {
    width: '23%',
    minWidth: 70,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bloodTypeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 5,
  },
  bloodTypeDonors: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarMenu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '75%',
    maxWidth: 320,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  menuHeader: {
    backgroundColor: '#F8F9FA',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuUserInfo: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  menuUserRole: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuUserEmail: {
    fontSize: 11,
    color: '#999',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  menuSection: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  menuBadge: {
    backgroundColor: '#DC143C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  menuItemDanger: {
    marginTop: 'auto',
  },
  menuItemTextDanger: {
    color: '#DC143C',
  },
  menuFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 'auto',
  },
  menuFooterText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
});
