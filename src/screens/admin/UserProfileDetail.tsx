import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

type RouteParams = {
  UserProfileDetail: {
    userId: string;
  };
};

interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  account_status: string;
  deactivation_reason?: string;
  deactivated_at?: number;
  deactivated_by?: string;
  created_at: number;
  donor_blood_group?: string;
  donor_city?: string;
  donor_mobile?: string;
  donor_approval_status?: string;
  donor_age?: number;
  donor_weight?: number;
  donor_address?: string;
  recipient_city?: string;
  recipient_mobile?: string;
  recipient_approval_status?: string;
  recipient_cnic?: string;
  recipient_address?: string;
}

/**
 * UserProfileDetail Screen
 * Admin can view full user details and activate/deactivate accounts
 */
const UserProfileDetail: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'UserProfileDetail'>>();
  const { userId } = route.params;
  const { user: adminUser } = useAuth();
  const { showAlert } = useAlert();

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Deactivation Modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    try {
      console.log('📡 Fetching user details for:', userId);
      const response = await fetch(`https://bdms-production-5878.up.railway.app/api/admin/user/${userId}/details`);
      
      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📡 Response data:', data);

      if (data.success && data.user) {
        setUserDetails(data.user);
        console.log('✅ Loaded user details:', {
          name: data.user.name,
          role: data.user.role,
          status: data.user.account_status
        });
      } else {
        throw new Error(data.error || 'Failed to load user details');
      }
    } catch (error: any) {
      console.error('❌ Error loading user details:', error);
      console.error('❌ Error details:', error.message);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load user details',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivationReason.trim()) {
      showAlert({
        type: 'warning',
        title: 'Reason Required',
        message: 'Please provide a reason for deactivation',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(
        `https://bdms-production-5878.up.railway.app/api/admin/users/${userId}/deactivate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: deactivationReason.trim(),
            adminId: adminUser!.id,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Account Deactivated',
          message: 'User account has been deactivated successfully',
        });

        setShowDeactivateModal(false);
        setDeactivationReason('');
        loadUserDetails(); // Reload to show updated status
      } else {
        throw new Error(data.error || 'Failed to deactivate account');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to deactivate account',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivate = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch(
        `https://bdms-production-5878.up.railway.app/api/admin/users/${userId}/activate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Account Activated',
          message: 'User account has been activated successfully',
        });

        loadUserDetails(); // Reload to show updated status
      } else {
        throw new Error(data.error || 'Failed to activate account');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to activate account',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading user details...</Text>
      </View>
    );
  }

  if (!userDetails) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#F44336" />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDeactivated = userDetails.account_status === 'deactivated';
  const isDonor = userDetails.role === 'donor';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{userDetails.name}</Text>
          <Text style={styles.headerSubtitle}>{userDetails.role.toUpperCase()}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View style={[
            styles.statusBadge,
            isDeactivated ? styles.statusBadgeDeactivated : styles.statusBadgeActive
          ]}>
            <Ionicons
              name={isDeactivated ? 'ban' : 'checkmark-circle'}
              size={24}
              color="#fff"
            />
            <Text style={styles.statusBadgeText}>
              {isDeactivated ? 'DEACTIVATED' : 'ACTIVE'}
            </Text>
          </View>
        </View>

        {/* Deactivation Info (if deactivated) */}
        {isDeactivated && (
          <View style={styles.deactivationInfo}>
            <View style={styles.deactivationHeader}>
              <Ionicons name="information-circle" size={20} color="#F44336" />
              <Text style={styles.deactivationTitle}>Deactivation Details</Text>
            </View>
            <View style={styles.deactivationDetail}>
              <Text style={styles.deactivationLabel}>Reason:</Text>
              <Text style={styles.deactivationValue}>{userDetails.deactivation_reason}</Text>
            </View>
            {userDetails.deactivated_at && (
              <View style={styles.deactivationDetail}>
                <Text style={styles.deactivationLabel}>Date:</Text>
                <Text style={styles.deactivationValue}>
                  {new Date(userDetails.deactivated_at * 1000).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{userDetails.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userDetails.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role:</Text>
            <Text style={[styles.infoValue, styles.infoValueBold]}>
              {userDetails.role.toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined:</Text>
            <Text style={styles.infoValue}>
              {new Date(userDetails.created_at * 1000).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mobile:</Text>
            <Text style={styles.infoValue}>
              {(isDonor ? userDetails.donor_mobile : userDetails.recipient_mobile) || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City:</Text>
            <Text style={styles.infoValue}>
              {(isDonor ? userDetails.donor_city : userDetails.recipient_city) || 'Not provided'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>
              {(isDonor ? userDetails.donor_address : userDetails.recipient_address) || 'Not provided'}
            </Text>
          </View>
        </View>

        {/* Donor-Specific Information */}
        {isDonor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Blood Group:</Text>
              <Text style={[styles.infoValue, styles.infoValueBold, styles.bloodGroup]}>
                {userDetails.donor_blood_group || 'Not specified'}
              </Text>
            </View>
            {userDetails.donor_age && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{userDetails.donor_age} years</Text>
              </View>
            )}
            {userDetails.donor_weight && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Weight:</Text>
                <Text style={styles.infoValue}>{userDetails.donor_weight} kg</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Profile Status:</Text>
              <Text style={[
                styles.infoValue,
                userDetails.donor_approval_status === 'APPROVED' ? styles.approved : styles.pending
              ]}>
                {userDetails.donor_approval_status || 'Not Created'}
              </Text>
            </View>
          </View>
        )}

        {/* Recipient-Specific Information */}
        {!isDonor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient Information</Text>
            {userDetails.recipient_cnic && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CNIC:</Text>
                <Text style={styles.infoValue}>{userDetails.recipient_cnic}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Profile Status:</Text>
              <Text style={[
                styles.infoValue,
                userDetails.recipient_approval_status === 'APPROVED' ? styles.approved : styles.pending
              ]}>
                {userDetails.recipient_approval_status || 'Not Created'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {isDeactivated ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.activateButton]}
              onPress={handleActivate}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>Activate Account</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.deactivateButton]}
              onPress={() => setShowDeactivateModal(true)}
              disabled={isProcessing}
            >
              <Ionicons name="ban" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Deactivate Account</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Deactivation Modal */}
      <Modal
        visible={showDeactivateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeactivateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={48} color="#FF9800" />
              <Text style={styles.modalTitle}>Deactivate Account</Text>
            </View>
            <Text style={styles.modalMessage}>
              This will prevent {userDetails.name} from creating/accepting blood requests.
              They can appeal this decision.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason for deactivation..."
              value={deactivationReason}
              onChangeText={setDeactivationReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#999"
              editable={!isProcessing}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowDeactivateModal(false);
                  setDeactivationReason('');
                }}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleDeactivate}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Deactivate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeDeactivated: {
    backgroundColor: '#F44336',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deactivationInfo: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  deactivationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  deactivationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  deactivationDetail: {
    marginBottom: 8,
  },
  deactivationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  deactivationValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
    fontWeight: '500',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  infoValueBold: {
    fontWeight: 'bold',
  },
  bloodGroup: {
    color: '#DC143C',
    fontSize: 16,
  },
  approved: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  pending: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  actionSection: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonDanger: {
    backgroundColor: '#F44336',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UserProfileDetail;

