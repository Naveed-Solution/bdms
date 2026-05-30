import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
// @ts-ignore - expo/vector-icons types not available in this setup
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useBloodRequest } from '../../context/BloodRequestContext';
import { profileAPI, API_BASE_URL } from '../../services/api';
import { getUnreadNotificationCount } from '../../services/notificationService';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DrawerContent, { DrawerMenuItem } from '../../components/layout/DrawerContent';

type NavigationProp = StackNavigationProp<RootStackParamList, 'UserHome'>;

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
        const status = response.profile.approvalStatus || 'none';
        setProfileStatus(status.toLowerCase() as any);
        setProfileRemarks(response.profile.adminRemarks || '');
      } else {
        setProfileStatus('none');
      }
    } catch (error) {
      console.log('No profile found');
      setProfileStatus('none');
    }
  };

  const loadDonorStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      const data = await response.json();
      

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

  useEffect(() => {
    loadProfileStatus();
    updateUserRequests();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProfileStatus();
      loadDonorStats();
      loadBloodTypeCounts();
      updateUserRequests();
    }, [user?.id])
  );

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

  const viewRequestStatus = (requestId: string) => {
    navigation.navigate('RequestStatus', { requestId });
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return date;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '#4CAF50';
      case 'PENDING':
        return '#FF9800';
      case 'COMPLETED':
        return '#2196F3';
      case 'CANCELLED':
        return '#999';
      default:
        return '#DC143C';
    }
  };

  const menuItems: DrawerMenuItem[] = [
    {
      label: 'My Profile',
      icon: 'person-circle',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('RecipientProfileForm');
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
      label: 'Request History',
      icon: 'document-text',
      onPress: () => {
        setShowMenu(false);
        // @ts-ignore - RequestHistory not in RecipientStack type definition
        navigation.navigate('RequestHistory');
      },
    },
    {
      label: 'Change Password',
      icon: 'lock-closed',
      onPress: () => {
        setShowMenu(false);
        // @ts-ignore - RecipientProfile not in RecipientStack type definition
        navigation.navigate('RecipientProfile');
      },
    },
  ];

  return (
    <DashboardLayout
        role="recipient"
        title="Recipient Dashboard"
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
                role="recipient"
                userName={user?.name || 'Recipient'}
                userEmail={user?.email || ''}
                profileStatus={profileStatus as 'approved' | 'pending' | 'rejected' | 'none' | 'loading'}
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
              <Text style={styles.actionIconText}>🩸</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Blood Request</Text>
              <Text style={styles.actionDescription}>Request blood for yourself or others</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => {
              // @ts-ignore - RequestHistory not in RecipientStack type definition
              navigation.navigate('RequestHistory');
            }}
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
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
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
});
