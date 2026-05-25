import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

interface Appeal {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  appeal_message: string;
  status: string;
  deactivation_reason: string;
  deactivated_at: number;
  created_at: number;
}

/**
 * AppealsList Screen
 * Admin reviews and responds to user appeals
 */
const AppealsList: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { user: adminUser } = useAuth();
  const { showAlert } = useAlert();

  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Response Modal
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [responseDecision, setResponseDecision] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [adminResponse, setAdminResponse] = useState('');

  useEffect(() => {
    loadAppeals();
  }, []);

  const loadAppeals = async () => {
    try {
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/admin/appeals');
      const data = await response.json();

      if (data.success) {
        setAppeals(data.appeals);
        console.log(`✅ Loaded ${data.appeals.length} pending appeals`);
      } else {
        throw new Error('Failed to load appeals');
      }
    } catch (error: any) {
      console.error('❌ Error loading appeals:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load appeals',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAppeals();
  };

  const openResponseModal = (appeal: Appeal, decision: 'ACCEPTED' | 'REJECTED') => {
    setSelectedAppeal(appeal);
    setResponseDecision(decision);
    setAdminResponse('');
    setShowResponseModal(true);
  };

  const handleRespondToAppeal = async () => {
    if (!adminResponse.trim()) {
      showAlert({
        type: 'warning',
        title: 'Response Required',
        message: 'Please provide a response message',
      });
      return;
    }

    if (!selectedAppeal) return;

    setIsProcessing(true);

    try {
      const response = await fetch(
        `https://bdms-production-5878.up.railway.app/api/admin/appeals/${selectedAppeal.id}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: responseDecision,
            adminResponse: adminResponse.trim(),
            adminId: adminUser!.id,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showAlert({
          type: 'success',
          title: `Appeal ${responseDecision === 'ACCEPTED' ? 'Accepted' : 'Rejected'}`,
          message: responseDecision === 'ACCEPTED'
            ? 'User account has been activated'
            : 'Appeal has been rejected',
        });

        // Remove the appeal from the list
        setAppeals(appeals.filter(a => a.id !== selectedAppeal.id));
        setShowResponseModal(false);
        setSelectedAppeal(null);
      } else {
        throw new Error(data.error || 'Failed to respond to appeal');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to respond to appeal',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading appeals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Appeals</Text>
          <Text style={styles.headerSubtitle}>
            {appeals.length} pending appeal{appeals.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerRefreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2196F3" />
          <Text style={styles.infoText}>
            Review appeals from deactivated users requesting account reactivation.
          </Text>
        </View>

        {/* Appeals List */}
        {appeals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={64} color="#4CAF50" />
            <Text style={styles.emptyTitle}>No Pending Appeals</Text>
            <Text style={styles.emptySubtitle}>
              All appeals have been reviewed
            </Text>
          </View>
        ) : (
          <View style={styles.appealsList}>
            {appeals.map((appeal) => (
              <View key={appeal.id} style={styles.appealCard}>
                {/* User Header */}
                <View style={styles.appealHeader}>
                  <View style={styles.userIconContainer}>
                    <Ionicons
                      name={appeal.user_role === 'donor' ? 'water' : 'medkit'}
                      size={24}
                      color={appeal.user_role === 'donor' ? '#DC143C' : '#2196F3'}
                    />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{appeal.user_name}</Text>
                    <Text style={styles.userEmail}>{appeal.user_email}</Text>
                  </View>
                  <View style={[
                    styles.roleBadge,
                    appeal.user_role === 'donor' ? styles.roleBadgeDonor : styles.roleBadgeRecipient
                  ]}>
                    <Text style={styles.roleBadgeText}>
                      {appeal.user_role === 'donor' ? 'DONOR' : 'RECIPIENT'}
                    </Text>
                  </View>
                </View>

                {/* Deactivation Info */}
                <View style={styles.deactivationSection}>
                  <View style={styles.deactivationRow}>
                    <Ionicons name="ban" size={16} color="#F44336" />
                    <Text style={styles.deactivationLabel}>Deactivated:</Text>
                    <Text style={styles.deactivationValue}>
                      {new Date(appeal.deactivated_at * 1000).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.deactivationRow}>
                    <Ionicons name="document-text" size={16} color="#666" />
                    <Text style={styles.deactivationLabel}>Reason:</Text>
                  </View>
                  <Text style={styles.deactivationReason}>{appeal.deactivation_reason}</Text>
                </View>

                {/* Appeal Message */}
                <View style={styles.appealSection}>
                  <View style={styles.appealMessageHeader}>
                    <Ionicons name="chatbox-ellipses" size={18} color="#FF9800" />
                    <Text style={styles.appealLabel}>User's Appeal:</Text>
                  </View>
                  <Text style={styles.appealMessage}>{appeal.appeal_message}</Text>
                  <Text style={styles.appealDate}>
                    Submitted {new Date(appeal.created_at * 1000).toLocaleDateString()}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => openResponseModal(appeal, 'REJECTED')}
                    disabled={isProcessing}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => openResponseModal(appeal, 'ACCEPTED')}
                    disabled={isProcessing}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={responseDecision === 'ACCEPTED' ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={responseDecision === 'ACCEPTED' ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.modalTitle}>
                {responseDecision === 'ACCEPTED' ? 'Accept Appeal' : 'Reject Appeal'}
              </Text>
            </View>
            <Text style={styles.modalMessage}>
              {responseDecision === 'ACCEPTED'
                ? `This will reactivate ${selectedAppeal?.user_name}'s account.`
                : `This will keep ${selectedAppeal?.user_name}'s account deactivated.`}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Enter your response to ${selectedAppeal?.user_name}...`}
              value={adminResponse}
              onChangeText={setAdminResponse}
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
                  setShowResponseModal(false);
                  setAdminResponse('');
                }}
                disabled={isProcessing}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  responseDecision === 'ACCEPTED' ? styles.modalButtonSuccess : styles.modalButtonDanger
                ]}
                onPress={handleRespondToAppeal}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>
                    {responseDecision === 'ACCEPTED' ? 'Accept & Activate' : 'Reject Appeal'}
                  </Text>
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
  headerRefreshButton: {
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  appealsList: {
    gap: 16,
  },
  appealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeDonor: {
    backgroundColor: '#FFEBEE',
  },
  roleBadgeRecipient: {
    backgroundColor: '#E3F2FD',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  deactivationSection: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  deactivationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deactivationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  deactivationValue: {
    fontSize: 13,
    color: '#1a1a1a',
  },
  deactivationReason: {
    fontSize: 13,
    color: '#1a1a1a',
    marginTop: 4,
    marginLeft: 22,
    fontStyle: 'italic',
  },
  appealSection: {
    backgroundColor: '#FFFDE7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  appealMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  appealLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  appealMessage: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 8,
  },
  appealDate: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  modalButtonSuccess: {
    backgroundColor: '#4CAF50',
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

export default AppealsList;

