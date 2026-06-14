import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { bloodRequestAPI, respectAPI } from '../../services/api';
import LiveTrackingMap from '../../components/LiveTrackingMap';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RequestHistory'>;

interface Donation {
  requestId: string;
  recipientId: string;
  recipientName: string;
  recipientMobile: string;
  bloodGroup: string;
  units: number;
  location: string;
  notes: string;
  status: string;
  acceptedAt: Date;
  donorCompleted: number;
  donorCompletedAt: Date | null;
  recipientCompleted: number;
  recipientCompletedAt: Date | null;
  shareLocation?: boolean;
  // Cancellation data
  cancelledBy?: string;
  cancelledByRole?: string;
  cancellationReason?: string;
  cancelledAt?: Date | null;
  // Rating data
  donorRating?: number;
  donorComment?: string;
  donorRatedAt?: Date | null;
  recipientRating?: number;
  recipientComment?: string;
  recipientRatedAt?: Date | null;
}

/**
 * Donor Request History Screen
 * 
 * Enhanced with:
 * - Complete/Cancel functionality
 * - Respect rating system
 * - Real-time updates
 */
export default function RequestHistory() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [donations, setDonations] = useState<Donation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  /**
   * Load accepted donations
   */
  const loadDonations = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await bloodRequestAPI.getDonorAcceptedDonations(user.id);
      console.log(`📋 [Donor] Loaded ${response.donations?.length || 0} donations`);
      if (response.donations && response.donations.length > 0) {
        console.log('Sample donation data:', {
          requestId: response.donations[0].requestId || 'MISSING',
          recipientId: response.donations[0].recipientId || 'MISSING',
          recipientName: response.donations[0].recipientName || 'MISSING',
          status: response.donations[0].status,
        });
      }
      setDonations(response.donations || []);
    } catch (error) {
      console.error('❌ Error loading donations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Poll for updates every 1 second
   */
  useEffect(() => {
    loadDonations();

    const interval = setInterval(() => {
      loadDonations();
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  /**
   * Reload on screen focus
   */
  useFocusEffect(
    React.useCallback(() => {
      loadDonations();
    }, [user?.id])
  );

  /**
   * Handle marking donation as complete (donor side)
   */
  const handleComplete = async () => {
    if (!selectedDonation) return;

    try {
      setProcessingAction(true);
      const response = await bloodRequestAPI.markCompleted(
        selectedDonation.requestId,
        user!.id,
        'donor'
      );

      if (response.success) {
        showAlert({
          title: 'Success',
          message: 'Donation completed successfully!',
          type: 'success',
        });

        setShowCompleteModal(false);
        if (response.bothCompleted) {
          // Show rating modal only after both sides have completed the donation
          setShowRatingModal(true);
        } else {
          showAlert({
            title: 'Completion Recorded',
            message: 'Your completion has been saved. Waiting for the recipient to complete before rating.',
            type: 'info',
          });
        }

        loadDonations();
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to complete donation',
        type: 'error',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  /**
   * Handle cancelling donation
   */
  const handleCancel = async () => {
    if (!selectedDonation) return;

    if (!cancellationReason.trim()) {
      showAlert({
        title: 'Reason Required',
        message: 'Please provide a reason for cancellation',
        type: 'error',
      });
      return;
    }

    try {
      setProcessingAction(true);
      const response = await bloodRequestAPI.cancelRequest(
        selectedDonation.requestId,
        user!.id,
        'donor',
        cancellationReason.trim(),
        user!.id // donorId
      );

      if (response.success) {
        showAlert({
          title: 'Donation Cancelled',
          message: 'Request has been reopened for other donors',
          type: 'success',
        });

        setShowCancelModal(false);
        setCancellationReason('');
        setSelectedDonation(null);
        loadDonations();
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to cancel donation',
        type: 'error',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  /**
   * Handle submitting rating
   */
  const handleSubmitRating = async () => {
    if (rating === 0) {
      showAlert({
        title: 'Rating Required',
        message: 'Please select a rating',
        type: 'error',
      });
      return;
    }

    if (!selectedDonation) return;

    try {
      setProcessingAction(true);
      
      const ratingData = {
        requestId: selectedDonation.requestId,
        donorId: user!.id,
        recipientId: selectedDonation.recipientId,
        rating,
        comment: ratingComment.trim() || undefined,
        raterRole: 'donor' as const,
      };
      
      console.log('📝 [Donor] Submitting rating:', {
        requestId: ratingData.requestId || 'MISSING',
        donorId: ratingData.donorId || 'MISSING',
        recipientId: ratingData.recipientId || 'MISSING',
        rating: ratingData.rating,
        raterRole: ratingData.raterRole,
      });

      await respectAPI.submitRating(ratingData);

      showAlert({
        title: 'Thank You!',
        message: 'Your respect rating has been submitted',
        type: 'success',
      });

      setShowRatingModal(false);
      setRating(0);
      setRatingComment('');
      setSelectedDonation(null);
    } catch (error: any) {
      console.error('❌ [Donor] Rating submission error:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to submit rating',
        type: 'error',
      });
    } finally {
      setProcessingAction(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDonations();
  };

  const handleCallRecipient = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return '#34C759';
      case 'COMPLETED':
        return '#DC143C';
      case 'CANCELLED':
        return '#999';
      default:
        return '#999';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donation History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats Summary */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{donations.length}</Text>
          <Text style={styles.statLabel}>Total Accepted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{donations.reduce((sum, d) => sum + (d.units || 1), 0)}</Text>
          <Text style={styles.statLabel}>Total Units</Text>
        </View>
      </View>

      {/* Donations List */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC143C']} />
        }
      >
        {loading && donations.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC143C" />
            <Text style={styles.loadingText}>Loading donations...</Text>
          </View>
        ) : donations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Donations Yet</Text>
            <Text style={styles.emptyText}>
              When you accept blood requests, they will appear here.
            </Text>
          </View>
        ) : (
          donations.map((donation, index) => (
            <View key={`${donation.requestId}-${index}`} style={styles.donationCard}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>{donation.recipientName}</Text>
                  <Text style={styles.bloodGroup}>{donation.bloodGroup} • {donation.units} Unit(s)</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(donation.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(donation.status) }]}>
                    {donation.status}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.cardContent}>
                {donation.recipientMobile && donation.recipientMobile.trim() && (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                    <TouchableOpacity onPress={() => handleCallRecipient(donation.recipientMobile)}>
                      <Text style={[styles.detailText, { color: '#007AFF', textDecorationLine: 'underline' }]}>
                        {donation.recipientMobile}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {donation.location && donation.location.trim() && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                    <Text style={styles.detailText}>{donation.location}</Text>
                  </View>
                )}

                {donation.notes && donation.notes.trim() && (
                  <View style={styles.detailRow}>
                    <Ionicons name="document-text-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                    <Text style={styles.detailText}>{donation.notes}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                  <Text style={styles.detailText}>
                    Accepted: {formatDate(donation.acceptedAt)}
                  </Text>
                </View>

                {/* Completion Status */}
                {donation.status === 'ACCEPTED' && (
                  <View style={styles.completionContainer}>
                    <View style={styles.completionItem}>
                      <Ionicons
                        name={donation.donorCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={donation.donorCompleted ? '#34C759' : '#999'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.completionLabel}>You Completed</Text>
                    </View>
                    <View style={styles.completionItem}>
                      <Ionicons
                        name={donation.recipientCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={donation.recipientCompleted ? '#34C759' : '#999'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.completionLabel}>Recipient Confirmed</Text>
                    </View>
                  </View>
                )}

                {/* Cancellation Info */}
                {donation.status === 'CANCELLED' && donation.cancellationReason && (
                  <View style={styles.cancellationInfoBox}>
                    <View style={styles.cancellationHeader}>
                      <Ionicons name="close-circle" size={18} color="#FF3B30" style={{ marginRight: 6 }} />
                      <Text style={styles.cancellationTitle}>
                        Cancelled by {donation.cancelledByRole === 'recipient' ? 'Recipient' : 'Donor'}
                      </Text>
                    </View>
                    <Text style={styles.cancellationReason}>{donation.cancellationReason}</Text>
                    {donation.cancelledAt && (
                      <Text style={styles.cancellationDate}>
                        {formatDate(donation.cancelledAt)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Rating Info (Completed donations) */}
                {donation.status === 'COMPLETED' && (
                  <View style={styles.ratingInfoBox}>
                    {/* Recipient's rating */}
                    {donation.recipientRating && (
                      <View style={styles.ratingSection}>
                        <View style={styles.ratingHeader}>
                          <Text style={styles.ratingLabel}>Your Rating:</Text>
                          <View style={styles.starsDisplay}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= (donation.recipientRating || 0) ? 'star' : 'star-outline'}
                                size={16}
                                color="#DC143C"
                                style={{ marginLeft: 2 }}
                              />
                            ))}
                          </View>
                        </View>
                        {donation.recipientComment && (
                          <Text style={styles.ratingComment}>"{donation.recipientComment}"</Text>
                        )}
                      </View>
                    )}

                    {/* Donor's rating (what they gave to recipient) */}
                    {donation.donorRating && (
                      <View style={styles.ratingSection}>
                        <View style={styles.ratingHeader}>
                          <Text style={styles.ratingLabel}>Recipient's Rating:</Text>
                          <View style={styles.starsDisplay}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= (donation.donorRating || 0) ? 'star' : 'star-outline'}
                                size={16}
                                color="#DC143C"
                                style={{ marginLeft: 2 }}
                              />
                            ))}
                          </View>
                        </View>
                        {donation.donorComment && (
                          <Text style={styles.ratingComment}>"{donation.donorComment}"</Text>
                        )}
                      </View>
                    )}

                    {/* Completion info */}
                    <Text style={styles.completionInfo}>
                      Completed by {donation.donorCompleted && donation.recipientCompleted ? 'both parties' : 
                        donation.donorCompleted ? 'you' : 'recipient'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Live Location Tracking Map */}
              {donation.shareLocation && 
               (donation.status === 'ACCEPTED' || donation.status === 'COMPLETED') && (
                <View style={styles.mapSection}>
                  <View style={styles.mapSectionHeader}>
                    <Ionicons name="map" size={20} color="#DC143C" style={{ marginRight: 6 }} />
                    <Text style={styles.mapSectionTitle}>Live Location Tracking</Text>
                  </View>
                  <View style={styles.mapContainerSmall}>
                    <LiveTrackingMap 
                      requestId={donation.requestId}
                      shareLocation={true}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.viewFullMapButton}
                    onPress={() => navigation.navigate('LiveTracking', {
                      requestId: donation.requestId,
                      donorId: user!.id,
                    })}
                  >
                    <Ionicons name="expand-outline" size={18} color="#fff" />
                    <Text style={styles.viewFullMapButtonText}>View Full Screen Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Buttons */}
              {donation.status === 'ACCEPTED' && (
                <View style={styles.actionButtons}>
                  {!donation.donorCompleted && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => {
                        setSelectedDonation(donation);
                        setShowCompleteModal(true);
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.actionButtonText}>Complete</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={() => {
                      setSelectedDonation(donation);
                      setShowCancelModal(true);
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Rating Button - Only show if donation is completed AND donor hasn't rated yet */}
              {donation.status === 'COMPLETED' && !donation.donorRating && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.rateButton, { width: '100%' }]}
                  onPress={() => {
                    setSelectedDonation(donation);
                    setShowRatingModal(true);
                  }}
                >
                  <Ionicons name="star-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.actionButtonText}>Rate Recipient</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Complete Confirmation Modal */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark as Completed?</Text>
            <Text style={styles.modalMessage}>
              Confirm that you have donated blood to {selectedDonation?.recipientName}?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowCompleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleComplete}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Donation Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Donation?</Text>
            <Text style={styles.modalMessage}>
              Please provide a reason for cancellation (required):
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Enter cancellation reason..."
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.warningText}>
              The request will be reopened for other donors.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
              >
                <Text style={styles.modalCancelText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleCancel}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Yes, Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Recipient</Text>
            <Text style={styles.modalMessage}>
              How would you rate your experience with {selectedDonation?.recipientName}?
            </Text>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={{ marginHorizontal: 4 }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color="#DC143C"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Add a comment (optional)..."
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowRatingModal(false);
                  setRating(0);
                  setRatingComment('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleSubmitRating}
                disabled={processingAction}
              >
                {processingAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    ...Platform.select({
      ios: {
        paddingTop: 50,
      },
      android: {
        paddingTop: 16,
      },
    }),
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  donationCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bloodGroup: {
    fontSize: 14,
    color: '#DC143C',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  completionContainer: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  completionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  completionLabel: {
    fontSize: 13,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  rateButton: {
    backgroundColor: '#DC143C',
    marginTop: 8,
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
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  warningText: {
    fontSize: 13,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  modalCancelButton: {
    backgroundColor: '#F0F0F0',
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancellationInfoBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3F3',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cancellationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  cancellationReason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  cancellationDate: {
    fontSize: 12,
    color: '#999',
  },
  ratingInfoBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
  ratingSection: {
    marginBottom: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  starsDisplay: {
    flexDirection: 'row',
  },
  ratingComment: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 18,
  },
  completionInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  mapSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mapContainerSmall: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewFullMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC143C',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  viewFullMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
