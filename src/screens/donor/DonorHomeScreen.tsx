import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
// @ts-ignore - expo/vector-icons types not available in this setup
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { profileAPI, bloodRequestAPI, API_BASE_URL } from '../../services/api';
import { getUnreadNotificationCount } from '../../services/notificationService';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DrawerContent, { DrawerMenuItem } from '../../components/layout/DrawerContent';

type NavigationProp = StackNavigationProp<RootStackParamList, 'DonorHome'>;

export default function DonorHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  
  const [availableRequestsCount, setAvailableRequestsCount] = useState(0);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'rejected'>('loading');
  const [profileRemarks, setProfileRemarks] = useState<string>('');
  const [donatedCount, setDonatedCount] = useState(0);
  
  const [donorInfo, setDonorInfo] = useState({
    bloodType: null as string | null,
    lastDonation: null as string | null,
    nextEligible: null as string | null,
    daysUntilEligible: null as number | null,
    isEligible: false,
  });
  
  const [recentDonations, setRecentDonations] = useState<Array<{
    date: string;
    location: string;
    units: number;
    bloodGroup?: string;
  }>>([]);
  const [loadingDonations, setLoadingDonations] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  useEffect(() => {
    loadProfileStatus();
    loadDonorStats();
    loadDonorDetails();
    loadRecentDonations();
  }, [user]);

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

  const loadProfileStatus = async () => {
    if (!user) return;
    
    try {
      const response = await profileAPI.getDonorProfile(user.id);
      console.log('📋 [Profile Status] Response:', response);
      
      if (response.success && response.profile) {
        const status = response.profile.approvalStatus || 'none';
        setProfileStatus(status.toLowerCase() as any);
        setProfileRemarks(response.profile.adminRemarks || '');
      } else {
        console.log('⚠️ [Profile Status] No profile found');
        setProfileStatus('none');
      }
    } catch (error) {
      console.log('❌ [Profile Status] Error:', error);
      setProfileStatus('none');
    }
  };

  const loadDonorStats = async () => {
    if (!user?.id) return;
    
    try {
      const stats = await bloodRequestAPI.getDonorStats(user.id);
      setDonatedCount(stats.donatedCount);
    } catch (error) {
      console.error('Error loading donor stats:', error);
    }
  };

  const loadDonorDetails = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/donor/${user.id}/details`);
      const data = await response.json();
      
      if (data.success) {
        setDonorInfo({
          bloodType: data.bloodGroup,
          lastDonation: data.lastDonation,
          nextEligible: data.nextEligible,
          daysUntilEligible: data.daysUntilEligible,
          isEligible: data.isEligible,
        });
        console.log('✅ [Donor] Details loaded:', data);
      }
    } catch (error) {
      console.error('❌ [Donor] Error loading details:', error);
    }
  };


  const loadRecentDonations = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingDonations(true);
  const response = await fetch(`${API_BASE_URL}/donor/${user.id}/recent-donations?limit=5`);
      const data = await response.json();
      
      if (data.success) {
        setRecentDonations(data.donations);
        console.log('✅ [Donor] Recent donations loaded:', data.donations.length);
      }
    } catch (error) {
      console.error('❌ [Donor] Error loading recent donations:', error);
    } finally {
      setLoadingDonations(false);
    }
  };


  const updateAvailableCount = async () => {
    if (!user?.id) return;
    
    try {
      const response = await bloodRequestAPI.getAvailableForDonor(user.id);
      setAvailableRequestsCount(response.requests?.length || 0);
    } catch (error) {
      console.error('Error loading available requests count:', error);
      setAvailableRequestsCount(0);
    }
  };


  useEffect(() => {
    updateAvailableCount();
    
    const interval = setInterval(() => {
      updateAvailableCount();
      loadDonorStats();
      loadDonorDetails();
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);


  useFocusEffect(
    React.useCallback(() => {
      updateAvailableCount();
      loadDonorStats();
      loadProfileStatus();
      loadDonorDetails();
      loadRecentDonations();
    }, [user?.id])
  );

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

  const isEligible = donorInfo.isEligible;

  const menuItems: DrawerMenuItem[] = [
    {
      label: 'My Profile',
      icon: 'person-circle',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('DonorProfileForm');
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
      label: 'Donation History',
      icon: 'document-text',
      onPress: () => {
        setShowMenu(false);
        // @ts-ignore - RequestHistory not in DonorStack type definition
        navigation.navigate('RequestHistory');
      },
    },
    {
      label: 'Change Password',
      icon: 'lock-closed',
      onPress: () => {
        setShowMenu(false);
        navigation.navigate('DonorProfile' as never);
      },
    },
  ];

  return (
    <DashboardLayout
        role="donor"
        title="Donor Dashboard"
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
                role="donor"
                userName={user?.name || 'Donor'}
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
            onPress={() => navigation.navigate('DonorProfileForm')}
            activeOpacity={0.7}
          >
            <Ionicons name="alert-circle" size={24} color="#FF9800" />
            <View style={styles.profileStatusContent}>
              <Text style={styles.profileStatusTitle}>Complete Your Profile</Text>
              <Text style={styles.profileStatusSubtitle}>
                Complete your profile to start accepting blood requests
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
            onPress={() => navigation.navigate('DonorProfileForm')}
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
                You can now accept blood requests
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('DonorProfileForm')}>
              <Ionicons name="create-outline" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Donor Profile Card - Modern Design */}
        {donorInfo.bloodType && (
          <View style={styles.profileCard}>
            <View style={styles.profileCardHeader}>
              <View style={styles.bloodTypeContainer}>
                <View style={styles.bloodTypeCircle}>
                  <Text style={styles.bloodTypeText}>{donorInfo.bloodType}</Text>
                </View>
                <Text style={styles.bloodTypeLabel}>Blood Type</Text>
              </View>
              <View style={styles.profileStatsContainer}>
                <Text style={styles.profileStatValue}>{donatedCount}</Text>
                <Text style={styles.profileStatLabel}>Donations</Text>
              </View>
            </View>
          </View>
        )}

        {/* Eligibility Status - Improved UI */}
        {donorInfo.bloodType && (
          <View style={[styles.eligibilityCard, isEligible ? styles.eligibleCard : styles.notEligibleCard]}>
            <View style={styles.eligibilityHeader}>
              <View style={[styles.eligibilityIconContainer, {
                backgroundColor: isEligible ? '#E8F5E9' : '#FFF3E0'
              }]}>
                <Ionicons 
                  name={isEligible ? 'checkmark-circle' : 'time'} 
                  size={32} 
                  color={isEligible ? '#4CAF50' : '#FF9800'} 
                />
              </View>
              <View style={styles.eligibilityContent}>
                <Text style={styles.eligibilityTitle}>
                  {isEligible ? 'Eligible to Donate!' : 'Not Eligible Yet'}
                </Text>
                <Text style={styles.eligibilitySubtitle}>
                  {isEligible 
                    ? 'You can donate blood today' 
                    : donorInfo.lastDonation && donorInfo.nextEligible
                      ? `Last donated on ${donorInfo.lastDonation}`
                      : 'Complete your profile to start donating'
                  }
                </Text>
              </View>
            </View>
            {!isEligible && donorInfo.daysUntilEligible !== null && donorInfo.daysUntilEligible > 0 && donorInfo.nextEligible && (
              <View style={styles.eligibilityFooter}>
                <View style={styles.eligibilityInfoRow}>
                  <Ionicons name="calendar" size={16} color="#666" />
                  <Text style={styles.eligibilityInfoLabel}>Next Eligible:</Text>
                  <Text style={styles.eligibilityInfoValue}>{donorInfo.nextEligible}</Text>
                </View>
                <View style={styles.countdownBadge}>
                  <Text style={styles.countdownText}>{donorInfo.daysUntilEligible} days remaining</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {/* Browse Available Requests - Primary Action */}
          <TouchableOpacity 
            style={[styles.actionCard, styles.primaryActionCard]}
            onPress={() => navigation.navigate('AvailableRequests')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.actionIconText}>🩸</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Browse Blood Requests</Text>
              <Text style={styles.actionDescription}>
                {availableRequestsCount > 0 
                  ? `${availableRequestsCount} request${availableRequestsCount !== 1 ? 's' : ''} need your help`
                  : 'No active requests available'
                }
              </Text>
            </View>
            {availableRequestsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{availableRequestsCount}</Text>
              </View>
            )}
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => {
              // @ts-ignore - RequestHistory not in DonorStack type definition
              navigation.navigate('RequestHistory');
            }}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Donation History</Text>
              <Text style={styles.actionDescription}>View your accepted donations</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('DonorProfileForm')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E0F2F1' }]}>
              <Text style={styles.actionIconText}>👤</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Update Profile</Text>
              <Text style={styles.actionDescription}>Manage your personal information</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Donations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Donations</Text>
          {loadingDonations ? (
            <View style={styles.historyCard}>
              <ActivityIndicator size="small" color="#DC143C" />
              <Text style={styles.emptyText}>Loading donations...</Text>
            </View>
          ) : recentDonations.length > 0 ? (
            <View style={styles.historyCard}>
              {recentDonations.map((donation, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyIconContainer}>
                    <Text style={styles.historyIcon}>🩸</Text>
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyLocation}>{donation.location}</Text>
                    <Text style={styles.historyDate}>{donation.date}</Text>
                  </View>
                  <View style={styles.historyUnits}>
                    <Text style={styles.historyUnitsText}>{donation.units} unit</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.historyCard}>
              <Text style={styles.emptyText}>No donations yet</Text>
              <Text style={styles.emptySubtext}>Complete your first donation to see it here</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Blood Donation Management System{'\n'}
            Donor Portal v1.0
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
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bloodTypeContainer: {
    alignItems: 'center',
    flex: 1,
  },
  bloodTypeCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFEBEE',
    borderWidth: 4,
    borderColor: '#DC143C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bloodTypeText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#DC143C',
    letterSpacing: -1,
  },
  bloodTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
  },
  profileStatsContainer: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  profileStatValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#DC143C',
    marginBottom: 4,
    letterSpacing: -1,
  },
  profileStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.3,
  },
  eligibilityCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
  },
  eligibleCard: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
  },
  notEligibleCard: {
    backgroundColor: '#fff',
    borderColor: '#FF9800',
  },
  eligibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eligibilityIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  eligibilityContent: {
    flex: 1,
  },
  eligibilityTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  eligibilitySubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  eligibilityFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  eligibilityInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eligibilityInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
  },
  eligibilityInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  countdownBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F57C00',
    letterSpacing: 0.3,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
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
    letterSpacing: -0.2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  actionArrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 12,
  },
  primaryActionCard: {
    borderWidth: 2,
    borderColor: '#DC143C',
    backgroundColor: '#FFEBEE',
  },
  notificationBadge: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  historyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  historyIcon: {
    fontSize: 24,
  },
  historyContent: {
    flex: 1,
  },
  historyLocation: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  historyDate: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  historyUnits: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 20, 60, 0.2)',
  },
  historyUnitsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC143C',
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#BBB',
    textAlign: 'center',
    paddingBottom: 10,
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
