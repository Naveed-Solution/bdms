import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { profileAPI, bloodRequestAPI } from '../../services/api';
import { getUnreadNotificationCount } from '../../services/notificationService';

type NavigationProp = StackNavigationProp<RootStackParamList, 'DonorHome'>;

/**
 * DonorHomeScreen
 * 
 * Complete donor dashboard with donation tracking
 * Accessible only to users with role = 'donor'
 */
export default function DonorHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  
  const [availableRequestsCount, setAvailableRequestsCount] = useState(0);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'rejected'>('loading');
  const [profileRemarks, setProfileRemarks] = useState<string>('');

  const [recentDonations, setRecentDonations] = useState<Array<{
    date: string;
    location: string;
    units: number;
    bloodGroup?: string;
  }>>([]);
  const [loadingDonations, setLoadingDonations] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  /**
   * Load donor profile status
   */
  useEffect(() => {
    loadProfileStatus();
    loadRecentDonations();
  }, [user]);

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

  const loadProfileStatus = async () => {
    if (!user) return;
    
    try {
      const response = await profileAPI.getDonorProfile(user.id);
      console.log('📋 [Profile Status] Response:', response);
      
      if (response.success && response.profile) {
        const status = response.profile.approval_status || response.profile.approvalStatus;
        console.log('✅ [Profile Status] Current status:', status);
        
        setProfileStatus(status.toLowerCase());
        setProfileRemarks(response.profile.admin_remarks || response.profile.adminRemarks || '');
      } else {
        console.log('⚠️ [Profile Status] No profile found');
        setProfileStatus('none');
      }
    } catch (error) {
      console.log('❌ [Profile Status] Error:', error);
      setProfileStatus('none');
    }
  };

  /**
   * Load donor statistics
   */
  /**
   * Load recent donations
   */
  const loadRecentDonations = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingDonations(true);
      const response = await fetch(`https://bdms-production-5878.up.railway.app/api/donor/${user.id}/recent-donations?limit=5`);
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

  /**
   * Load available requests count
   */
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

  /**
   * Polling effect for real-time updates (1 second)
   */
  useEffect(() => {
    updateAvailableCount();

    // Poll for updates every 1 second
    const interval = setInterval(() => {
      updateAvailableCount();
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  /**
   * Reload data when screen comes into focus
   * Ensures real-time updates after accepting/declining or creating requests
   */
  useFocusEffect(
    React.useCallback(() => {
      updateAvailableCount();
      loadProfileStatus();
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
            <Text style={styles.roleBadgeText}>DONOR</Text>
          </View>
          <Text style={styles.headerTitle}>{user?.name || 'Donor'}</Text>
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
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* User Profile Header */}
            <View style={styles.menuHeader}>
              <View style={styles.menuProfileCard}>
                <View style={styles.menuAvatar}>
                  <Ionicons name="water" size={36} color="#DC143C" />
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
                      {profileStatus === 'approved' ? 'Approved Donor' :
                       profileStatus === 'pending' ? 'Pending Approval' :
                       profileStatus === 'rejected' ? 'Profile Rejected' :
                       'Donor'}
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
                  navigation.navigate('DonorProfileForm');
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
                <Text style={styles.menuItemText}>Donation History</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('DonorProfile' as never);
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
            </ScrollView>
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
            onPress={() => navigation.navigate('RequestHistory')}
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
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
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
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  profileStatItem: {
    alignItems: 'center',
    paddingHorizontal: 30,
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
  profileStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
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
  eligibilityIcon: {
    fontSize: 32,
    marginRight: 15,
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
  menuProfileCard: {
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
});
