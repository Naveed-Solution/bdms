import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, SafeAreaView, StatusBar
} from 'react-native';
// @ts-ignore
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
  const [bloodTypes, setBloodTypes] = useState([
    { type: 'A+', donors: 0 }, { type: 'A-', donors: 0 },
    { type: 'B+', donors: 0 }, { type: 'B-', donors: 0 },
    { type: 'O+', donors: 0 }, { type: 'O-', donors: 0 },
    { type: 'AB+', donors: 0 }, { type: 'AB-', donors: 0 },
  ]);

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
      const profilesResponse = await fetch(`${API_BASE_URL}/admin/pending-profiles`);
      const profilesData = await profilesResponse.json();
      const approvedDonors = profilesData.profiles?.filter((p: any) =>
        p.type === 'donor' && p.approval_status === 'APPROVED'
      ).length || 0;
      setAvailableDonors(approvedDonors);
      setNearbyDonors(totalDonorsCount);
    } catch (error) {
      console.error('Failed to load donor stats:', error);
    }
  };

  const loadBloodTypeCounts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/pending-profiles`);
      const data = await response.json();
      const approved = data.profiles?.filter((p: any) =>
        p.type === 'donor' && p.approval_status === 'APPROVED'
      ) || [];
      setBloodTypes(prev => prev.map(bt => ({
        ...bt,
        donors: approved.filter((p: any) => p.blood_group === bt.type).length,
      })));
    } catch (error) {
      console.error('Failed to load blood type counts:', error);
    }
  };

  const updateUserRequests = async () => {
    try {
      const requests = await getUserRequests();
      console.log('[UserHome] Updating user requests:', requests.length);
      setUserRequests(requests);
    } catch (error) {
      console.error('Failed to update requests:', error);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;
    try {
      const count = await getUnreadNotificationCount(user.id);
      setUnreadCount(count);
    } catch {}
  };

  useEffect(() => {
    loadProfileStatus();
    loadDonorStats();
    loadBloodTypeCounts();
    updateUserRequests();
    loadUnreadCount();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfileStatus();
      loadDonorStats();
      loadBloodTypeCounts();
      updateUserRequests();
      loadUnreadCount();
    }, [user?.id])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadProfileStatus();
        loadDonorStats();
        loadBloodTypeCounts();
        updateUserRequests();
        loadUnreadCount();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleLogout = () => {
    showAlert({
      type: 'warning',
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => await logout() },
      ],
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
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (e) { return date; }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4CAF50';
      case 'PENDING': return '#FF9800';
      case 'COMPLETED': return '#2196F3';
      case 'CANCELLED': return '#999';
      default: return '#DC143C';
    }
  };

  const menuItems = [
    { label: 'My Profile', icon: 'person-circle', onPress: () => { setShowMenu(false); navigation.navigate('RecipientProfileForm'); } },
    { label: 'Notifications', icon: 'notifications', badge: unreadCount > 0 ? unreadCount : undefined, onPress: () => { setShowMenu(false); navigation.navigate('Notifications' as never); } },
    { label: 'Request History', icon: 'document-text', onPress: () => { setShowMenu(false); (navigation as any).navigate('RequestHistory'); } },
    { label: 'Change Password', icon: 'lock-closed', onPress: () => { setShowMenu(false); (navigation as any).navigate('RecipientProfile'); } },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#DC143C" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.headerButton}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipient Dashboard</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications' as never)} style={styles.headerButton}>
          <View>
            <Ionicons name="notifications" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Drawer Menu Overlay */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity style={styles.menuBackdrop} onPress={() => setShowMenu(false)} activeOpacity={1} />
          <View style={styles.sidebarMenu}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <Text style={styles.drawerName}>{user?.name || 'Recipient'}</Text>
              <Text style={styles.drawerEmail}>{user?.email || ''}</Text>
            </View>
            {/* Menu Items */}
            <ScrollView>
              {menuItems.map((item, index) => (
                <TouchableOpacity key={index} style={styles.drawerItem} onPress={item.onPress}>
                  <Ionicons name={item.icon as any} size={22} color="#DC143C" style={styles.drawerItemIcon} />
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                  {item.badge ? (
                    <View style={styles.drawerBadge}>
                      <Text style={styles.drawerBadgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.drawerItem, { marginTop: 16 }]} onPress={() => { setShowMenu(false); handleLogout(); }}>
                <Ionicons name="log-out" size={22} color="#999" style={styles.drawerItemIcon} />
                <Text style={[styles.drawerItemLabel, { color: '#999' }]}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Profile Status Card */}
        {profileStatus === 'loading' ? (
          <View style={styles.profileStatusCard}>
            <ActivityIndicator size="small" color="#DC143C" />
            <Text style={styles.profileStatusText}>Loading profile...</Text>
          </View>
        ) : profileStatus === 'none' ? (
          <TouchableOpacity style={[styles.profileStatusCard, styles.profileIncompleteCard]} onPress={() => navigation.navigate('RecipientProfileForm')} activeOpacity={0.7}>
            <Ionicons name="alert-circle" size={24} color="#FF9800" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Complete Your Profile</Text>
              <Text style={styles.profileStatusSubtitle}>Complete your profile to create blood requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FF9800" />
          </TouchableOpacity>
        ) : profileStatus === 'pending' ? (
          <View style={[styles.profileStatusCard, styles.profilePendingCard]}>
            <Ionicons name="time" size={24} color="#2196F3" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Under Review</Text>
              <Text style={styles.profileStatusSubtitle}>Your profile is pending admin approval</Text>
            </View>
          </View>
        ) : profileStatus === 'rejected' ? (
          <TouchableOpacity style={[styles.profileStatusCard, styles.profileRejectedCard]} onPress={() => navigation.navigate('RecipientProfileForm')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={24} color="#F44336" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Rejected</Text>
              <Text style={styles.profileStatusSubtitle}>{profileRemarks || 'Please update your profile'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#F44336" />
          </TouchableOpacity>
        ) : profileStatus === 'approved' ? (
          <View style={[styles.profileStatusCard, styles.profileApprovedCard]}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Profile Approved ✓</Text>
              <Text style={styles.profileStatusSubtitle}>You can now create blood requests</Text>
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
          <TouchableOpacity style={styles.actionCard} onPress={createRequest}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.actionIconText}>🩸</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Blood Request</Text>
              <Text style={styles.actionDescription}>Request blood for yourself or others</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => (navigation as any).navigate('RequestHistory')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Request History</Text>
              <Text style={styles.actionDescription}>View your past requests</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('RecipientProfileForm')}>
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
              <Text style={styles.emptyStateSubtext}>Create your first request to get started</Text>
            </View>
          ) : (
            userRequests.filter(r => r.status !== 'CANCELLED').map((request) => (
              <TouchableOpacity key={request.id} style={styles.requestCard} onPress={() => viewRequestStatus(request.id)}>
                <View style={styles.requestBloodType}>
                  <Text style={styles.requestBloodTypeText}>{request.bloodGroup}</Text>
                </View>
                <View style={styles.requestContent}>
                  <Text style={styles.requestTitle}>
                    {request.urgencyLevel === 'EMERGENCY' && '🚨 '}{request.location}
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
              <TouchableOpacity key={index} style={styles.bloodTypeCard}
                onPress={() => showAlert({ type: 'info', title: `Blood Type ${item.type}`, message: `${item.donors} donors available in your area` })}>
                <Text style={styles.bloodTypeLabel}>{item.type}</Text>
                <Text style={styles.bloodTypeDonors}>{item.donors} donors</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Blood Donation Management System{'\n'}Recipient Portal v1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#DC143C' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#DC143C', paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerButton: { padding: 4 },
  badge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: '#FF9800',
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, flexDirection: 'row' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sidebarMenu: { width: 280, backgroundColor: '#fff', elevation: 8 },
  drawerHeader: { backgroundColor: '#DC143C', padding: 20, paddingTop: 40 },
  drawerAvatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  drawerName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  drawerEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  drawerItemIcon: { marginRight: 14 },
  drawerItemLabel: { fontSize: 15, color: '#333', flex: 1 },
  drawerBadge: { backgroundColor: '#DC143C', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  drawerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scrollView: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 32 },
  profileStatusCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16,
    backgroundColor: '#fff', borderRadius: 12, elevation: 2,
  },
  profileStatusText: { marginLeft: 12, fontSize: 14, color: '#666' },
  profileStatusContent: { flex: 1, marginLeft: 12 },
  profileStatusTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  profileStatusSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  profileIncompleteCard: { borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  profilePendingCard: { borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  profileRejectedCard: { borderLeftWidth: 4, borderLeftColor: '#F44336' },
  profileApprovedCard: { borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  summaryCard: {
    flexDirection: 'row', backgroundColor: '#fff', margin: 16, marginTop: 0,
    borderRadius: 12, elevation: 2, padding: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#DC143C' },
  summaryLabel: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#eee' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 12 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionIconText: { fontSize: 20 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  actionDescription: { fontSize: 12, color: '#999', marginTop: 2 },
  actionArrow: { fontSize: 24, color: '#ccc' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyStateText: { fontSize: 15, color: '#666' },
  emptyStateSubtext: { fontSize: 13, color: '#999', marginTop: 4 },
  requestCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1,
  },
  requestBloodType: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFEBEE',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  requestBloodTypeText: { fontSize: 13, fontWeight: '700', color: '#DC143C' },
  requestContent: { flex: 1 },
  requestTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  requestDetails: { fontSize: 12, color: '#999', marginTop: 2 },
  requestStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  requestStatusText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  bloodTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bloodTypeCard: {
    width: '22%', backgroundColor: '#fff', borderRadius: 10, padding: 10,
    alignItems: 'center', elevation: 1,
  },
  bloodTypeLabel: { fontSize: 16, fontWeight: '700', color: '#DC143C' },
  bloodTypeDonors: { fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: 8, paddingBottom: 8 },
  footerText: { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18 },
});