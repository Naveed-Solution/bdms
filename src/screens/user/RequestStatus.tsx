import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useBloodRequest, RequestStatus as StatusType } from '../../context/BloodRequestContext';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { bloodRequestAPI, respectAPI } from '../../services/api';
import LiveTrackingMap from '../../components/LiveTrackingMap';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RequestStatus'>;
type RouteParams = RouteProp<RootStackParamList, 'RequestStatus'>;

interface AcceptedDonor {
  donorId: string;
  donorName: string;
  mobile: string;
  address: string;
  city: string;
  donorCurrentLocation?: string;
  profileImage?: string;
  acceptedAt: Date;
  donorCompleted: number;
  donorCompletedAt: Date | null;
  recipientCompleted: number;
  recipientCompletedAt: Date | null;
  status: string;
  // Rating data
  donorRating?: number;
  donorComment?: string;
  donorRatedAt?: Date | null;
  recipientRating?: number;
  recipientComment?: string;
  recipientRatedAt?: Date | null;
}

/**
 * Request Status Screen
 * 
 * Enhanced version with:
 * - Accepted donors list with full details
 * - Complete/Cancel buttons for both donor and recipient
 * - Respect rating system
 * - Real-time updates
 */
const RequestStatus: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { requestId } = route.params;
  const { getRequestById } = useBloodRequest();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [request, setRequest] = useState<any>(null); // Don't use cached data
  const [acceptedDonors, setAcceptedDonors] = useState<AcceptedDonor[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [loading, setLoading] = useState(true); // Start with loading=true
  const [lastStatus, setLastStatus] = useState<string>(''); // Track status changes
  const [isRedirecting, setIsRedirecting] = useState(false); // Prevent multiple redirects
  
  // Modal states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<AcceptedDonor | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  /**
   * Load request details and accepted donors
   * NOTE: Fetch directly from backend to ensure real-time updates
   * Only logs when status changes to reduce console spam
   */
  const loadRequestData = async (isInitialLoad = false) => {
    // Prevent loading if already redirecting
    if (isRedirecting) {
      console.log('⏸️ [RequestStatus] Already redirecting, skipping load');
      return;
    }

    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      
      // Fetch directly from backend instead of using context cache
      const updated = await bloodRequestAPI.getRequestByIdDirect(requestId);
      
      if (updated) {
        // Only log if status changed or this is the initial load
        const statusChanged = updated.status !== lastStatus;
        if (isInitialLoad || statusChanged) {
          console.log(`✅ [RequestStatus] Request status: ${updated.status}${statusChanged ? ` (changed from ${lastStatus})` : ' (initial load)'}`);
          setLastStatus(updated.status);
        }

        // If request is CANCELLED, show alert and redirect to home
        if (updated.status === 'CANCELLED' && statusChanged && !isInitialLoad) {
          console.log('⚠️ [RequestStatus] Request CANCELLED, redirecting to home');
          setIsRedirecting(true);
          
          // Show alert about cancellation
          showAlert({
            title: 'Request Cancelled',
            message: updated.cancellationReason 
              ? `This request has been cancelled.\n\nReason: ${updated.cancellationReason}`
              : 'This request has been cancelled.',
            type: 'warning'
          });

          // Navigate IMMEDIATELY to home
          navigation.replace('UserHome');
          return;
        }
        
        setRequest(updated);

        // Load accepted donors if status is ACCEPTED or COMPLETED
        if (updated.status === 'ACCEPTED' || updated.status === 'COMPLETED') {
          const response = await bloodRequestAPI.getAcceptedDonors(requestId);
          if (response.success) {
            if (isInitialLoad || statusChanged) {
              console.log(`📋 Loaded ${response.donors.length} accepted donor(s)`);
            }
            setAcceptedDonors(response.donors);

            // Auto-redirect to LiveTracking when status changes to ACCEPTED (IMMEDIATE - no delay)
            if (statusChanged && updated.status === 'ACCEPTED' && response.donors.length > 0 && !isRedirecting) {
              const firstDonor = response.donors[0];
              setIsRedirecting(true);
              console.log('🗺️ Redirecting to Live Tracking screen IMMEDIATELY...');
              navigation.navigate('LiveTracking', {
                requestId: requestId,
                donorId: firstDonor.donorId,
              });
            }
          }
        } else {
          if (acceptedDonors.length > 0) {
            setAcceptedDonors([]); // Clear accepted donors if status is not ACCEPTED
          }
        }
      } else {
        if (isInitialLoad) {
          console.log(`❌ [RequestStatus] Request not found`);
        }
      }
    } catch (error) {
      console.error('❌ [RequestStatus] Error loading request data:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  /**
   * Poll for updates every 2 seconds for real-time experience
   * STOPS when redirecting to prevent loops
   */
  useEffect(() => {
    if (!isRedirecting) {
      loadRequestData(true); // Initial load with logging
    }

    const interval = setInterval(() => {
      if (!isRedirecting) {
        loadRequestData(false); // Subsequent loads only log on changes
      }
    }, 2000); // 2 seconds for better performance

    return () => clearInterval(interval);
  }, [requestId, isRedirecting]);

  /**
   * Reload on screen focus
   */
  useFocusEffect(
    React.useCallback(() => {
      loadRequestData();
    }, [requestId])
  );

  /**
   * Pulse animation for PENDING status
   */
  useEffect(() => {
    if (request?.status === 'PENDING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [request?.status]);

  /**
   * Handle marking donation as complete (recipient side)
   */
  const handleComplete = async (donor: AcceptedDonor) => {
    try {
      setLoading(true);
      const response = await bloodRequestAPI.markCompleted(
        requestId,
        user!.id,
        'recipient',
        donor.donorId
      );

      if (response.success) {
        showAlert({
          title: 'Success',
          message: 'Donation completed successfully!',
          type: 'success',
        });

        if (response.bothCompleted) {
          // Show rating modal only after both sides have completed the donation
          setSelectedDonor(donor);
          setShowRatingModal(true);
        } else {
          showAlert({
            title: 'Completion Recorded',
            message: 'Your completion has been saved. Waiting for the donor to complete before rating.',
            type: 'info',
          });
        }

        loadRequestData(true); // Force reload
      }
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to complete donation',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setShowCompleteModal(false);
    }
  };

  /**
   * Handle cancelling request - IMMEDIATE REDIRECT (NO LOOPS)
   */
  const handleCancel = async () => {
    // Check if reason is required (when status is ACCEPTED)
    if (request?.status === 'ACCEPTED' && !cancellationReason.trim()) {
      showAlert({
        title: 'Reason Required',
        message: 'Please provide a reason for cancellation',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);
      setIsRedirecting(true); // STOP all polling immediately

      const response = await bloodRequestAPI.cancelRequest(
        requestId,
        user!.id,
        'recipient',
        cancellationReason.trim() || undefined
      );

      if (response.success) {
        showAlert({
          title: 'Request Cancelled',
          message: response.message,
          type: 'success',
        });

        // Navigate IMMEDIATELY to home (no setTimeout)
        navigation.replace('UserHome');
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : 'Failed to cancel request';

      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
      });
      setIsRedirecting(false); // Allow polling again on error
    } finally {
      setLoading(false);
      setShowCancelModal(false);
      setCancellationReason('');
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

    if (!selectedDonor) return;

    try {
      setLoading(true);
      await respectAPI.submitRating({
        requestId,
        donorId: selectedDonor.donorId,
        recipientId: user!.id,
        rating,
        comment: ratingComment.trim() || undefined,
        raterRole: 'recipient',
      });

      showAlert({
        title: 'Thank You!',
        message: 'Your respect rating has been submitted',
        type: 'success',
      });

      setShowRatingModal(false);
      setRating(0);
      setRatingComment('');
      setSelectedDonor(null);
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to submit rating',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!request) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Request not found</Text>
      </View>
    );
  }

  /**
   * Get status configuration
   */
  const getStatusConfig = () => {
    switch (request.status) {
      case 'PENDING':
        return {
          icon: 'search' as const,
          color: '#FF9500',
          title: 'Searching for Donors',
          message: 'We are looking for available donors in your area...',
          bgColor: '#FFF5E6',
        };
      case 'ACCEPTED':
        return {
          icon: 'checkmark-circle' as const,
          color: '#34C759',
          title: 'Donors Found!',
          message: 'Great news! Donors have been matched for your request.',
          bgColor: '#E6F9EA',
        };
      case 'COMPLETED':
        return {
          icon: 'heart' as const,
          color: '#DC143C',
          title: 'Request Completed',
          message: 'Thank you! Your blood request has been fulfilled.',
          bgColor: '#FFE6EC',
        };
      case 'CANCELLED':
        return {
          icon: 'close-circle' as const,
          color: '#999',
          title: 'Request Cancelled',
          message: 'This request has been cancelled.',
          bgColor: '#F5F5F5',
        };
      default:
        return {
          icon: 'information-circle' as const,
          color: '#666',
          title: 'Unknown Status',
          message: 'Request status unknown',
          bgColor: '#F5F5F5',
        };
    }
  };

  const statusConfig = getStatusConfig();

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleCallDonor = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Status</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: statusConfig.bgColor }]}>
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: request.status === 'PENDING' ? pulseAnim : 1 }] },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon} size={48} color="#fff" />
          </View>
        </Animated.View>

        <Text style={styles.statusTitle}>{statusConfig.title}</Text>
        <Text style={styles.statusMessage}>{statusConfig.message}</Text>

        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                styles.progressDotActive,
                { backgroundColor: statusConfig.color },
              ]}
            />
            <Text style={styles.progressLabel}>Submitted</Text>
          </View>

          <View
            style={[
              styles.progressLine,
              request.status !== 'PENDING' && {
                backgroundColor: statusConfig.color,
              },
            ]}
          />

          <View style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                request.status !== 'PENDING' && styles.progressDotActive,
                request.status !== 'PENDING' && { backgroundColor: statusConfig.color },
              ]}
            />
            <Text style={styles.progressLabel}>Matched</Text>
          </View>

          <View
            style={[
              styles.progressLine,
              request.status === 'COMPLETED' && {
                backgroundColor: statusConfig.color,
              },
            ]}
          />

          <View style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                request.status === 'COMPLETED' && styles.progressDotActive,
                request.status === 'COMPLETED' && { backgroundColor: statusConfig.color },
              ]}
            />
            <Text style={styles.progressLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* Request Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Request Details</Text>

        <View style={styles.detailRow}>
          <Ionicons name="water" size={20} color="#DC143C" />
          <Text style={styles.detailLabel}>Blood Group:</Text>
          <Text style={styles.detailValue}>{request.bloodGroup}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="water-outline" size={20} color="#DC143C" />
          <Text style={styles.detailLabel}>Units:</Text>
          <Text style={styles.detailValue}>{request.units}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time" size={20} color="#DC143C" />
          <Text style={styles.detailLabel}>Created:</Text>
          <Text style={styles.detailValue}>{formatDate(request.createdAt)}</Text>
        </View>

        {request.urgencyLevel && request.urgencyLevel.trim() && (
          <View style={styles.detailRow}>
            <Ionicons name="alert-circle" size={20} color="#DC143C" />
            <Text style={styles.detailLabel}>Urgency:</Text>
            <Text style={[styles.detailValue, { color: request.urgencyLevel === 'EMERGENCY' ? '#FF3B30' : '#FF9500' }]}>
              {request.urgencyLevel}
            </Text>
          </View>
        )}

        {request.location && request.location.trim() && (
          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color="#DC143C" />
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>{request.location}</Text>
          </View>
        )}

        {request.notes && request.notes.trim() && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text" size={20} color="#DC143C" />
            <Text style={styles.detailLabel}>Notes:</Text>
            <Text style={styles.detailValue}>{request.notes}</Text>
          </View>
        )}
      </View>

      {/* Cancellation Info */}
      {request.status === 'CANCELLED' && request.cancellationReason && (
        <View style={styles.cancellationCard}>
          <View style={styles.cancellationHeaderRow}>
            <Ionicons name="close-circle" size={24} color="#FF3B30" style={{ marginRight: 8 }} />
            <Text style={styles.cancellationCardTitle}>Request Cancelled</Text>
          </View>
          <View style={styles.cancellationInfo}>
            <Text style={styles.cancellationByText}>
              Cancelled by: {request.cancelledByRole === 'recipient' ? 'You' : 'Donor'}
            </Text>
            <Text style={styles.cancellationReasonText}>
              Reason: {request.cancellationReason}
            </Text>
            {request.cancelledAt && (
              <Text style={styles.cancellationDateText}>
                {formatDate(request.cancelledAt)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Live Location Tracking Map - Always show when accepted (donor location + target always visible) */}
      {(request.status === 'ACCEPTED' || request.status === 'COMPLETED') && 
       acceptedDonors.length > 0 && (
        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <Ionicons name="map" size={24} color="#DC143C" />
            <Text style={styles.mapTitle}>Live Location Tracking</Text>
          </View>
          <View style={styles.mapContainer}>
            <LiveTrackingMap 
              requestId={requestId}
              shareLocation={request.shareLocation || false}
            />
          </View>
          <TouchableOpacity
            style={styles.viewFullMapButton}
            onPress={() => navigation.navigate('LiveTracking', {
              requestId: requestId,
              donorId: acceptedDonors[0].donorId,
            })}
          >
            <Ionicons name="expand-outline" size={20} color="#fff" />
            <Text style={styles.viewFullMapButtonText}>View Full Screen Map</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Accepted Donors List */}
      {acceptedDonors.length > 0 && (
        <View style={styles.donorsCard}>
          <Text style={styles.donorsTitle}>
            Matched Donors ({acceptedDonors.length})
          </Text>

          {acceptedDonors.map((donor, index) => (
            <View key={donor.donorId} style={styles.donorItem}>
              {/* Profile Image */}
              <View style={styles.donorImageContainer}>
                {donor.profileImage && donor.profileImage.trim() !== '' && donor.profileImage.length > 100 ? (
                  <Image
                    source={{ 
                      uri: donor.profileImage.startsWith('data:') 
                        ? donor.profileImage 
                        : `data:image/jpeg;base64,${donor.profileImage}` 
                    }}
                    style={styles.donorImage}
                  />
                ) : (
                  <View style={[styles.donorImage, styles.donorImagePlaceholder]}>
                    <Ionicons name="person" size={30} color="#999" />
                  </View>
                )}
              </View>

              {/* Donor Info */}
              <View style={styles.donorInfo}>
                <Text style={styles.donorName}>{donor.donorName}</Text>
                <View style={styles.donorDetailRow}>
                  <Ionicons name="location-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.donorDetail}>
                    {donor.donorCurrentLocation || `${donor.address}, ${donor.city}`}
                  </Text>
                </View>
                <View style={styles.donorDetailRow}>
                  <Ionicons name="time-outline" size={14} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.donorDetail}>
                    Accepted: {formatDate(donor.acceptedAt)}
                  </Text>
                </View>

                {/* Completion Status */}
                {donor.status !== 'COMPLETED' && donor.status !== 'CANCELLED' && (
                  <View style={styles.completionStatus}>
                    <View style={styles.completionBadge}>
                      <Ionicons
                        name={donor.recipientCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={donor.recipientCompleted ? '#34C759' : '#999'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.completionText}>You</Text>
                    </View>
                    <View style={styles.completionBadge}>
                      <Ionicons
                        name={donor.donorCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={donor.donorCompleted ? '#34C759' : '#999'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.completionText}>Donor</Text>
                    </View>
                  </View>
                )}

                {/* Rating Info (Completed donations) */}
                {donor.status === 'COMPLETED' && (donor.donorRating || donor.recipientRating) && (
                  <View style={styles.donorRatingBox}>
                    {/* Donor's rating of recipient */}
                    {donor.donorRating && (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingRowLabel}>Donor's rating:</Text>
                        <View style={styles.starsDisplay}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= (donor.donorRating || 0) ? 'star' : 'star-outline'}
                              size={14}
                              color="#DC143C"
                              style={{ marginLeft: 2 }}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Recipient's rating of donor */}
                    {donor.recipientRating && (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingRowLabel}>Your rating:</Text>
                        <View style={styles.starsDisplay}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= (donor.recipientRating || 0) ? 'star' : 'star-outline'}
                              size={14}
                              color="#DC143C"
                              style={{ marginLeft: 2 }}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Status Badge */}
                {donor.status && (
                  <View style={[styles.donorStatusBadge, { 
                    backgroundColor: donor.status === 'COMPLETED' ? '#E8F5E9' : 
                                    donor.status === 'CANCELLED' ? '#FFF3F3' : '#E3F2FD' 
                  }]}>
                    <Text style={[styles.donorStatusText, {
                      color: donor.status === 'COMPLETED' ? '#2E7D32' :
                             donor.status === 'CANCELLED' ? '#C62828' : '#1976D2'
                    }]}>
                      {donor.status}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.donorActions}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCallDonor(donor.mobile)}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>

                {/* Complete Button - only show if not completed by recipient yet */}
                {!donor.recipientCompleted && request.status === 'ACCEPTED' && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => {
                      setSelectedDonor(donor);
                      setShowCompleteModal(true);
                    }}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                )}

                {/* Show rating button if completed AND recipient hasn't rated yet */}
                {donor.status === 'COMPLETED' && !donor.recipientRating && (
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={() => {
                      setSelectedDonor(donor);
                      setShowRatingModal(true);
                    }}
                  >
                    <Ionicons name="star" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      {request.status !== 'CANCELLED' && request.status !== 'COMPLETED' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => setShowCancelModal(true)}
          >
            <Ionicons name="close-circle-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Back to Home Button */}
      <TouchableOpacity
        style={[styles.button, styles.homeButton]}
        onPress={() => navigation.navigate('UserHome')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>

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
              Confirm that you have received blood from {selectedDonor?.donorName}?
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
                onPress={() => selectedDonor && handleComplete(selectedDonor)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Request Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Request?</Text>
            
            {request.status === 'ACCEPTED' && (
              <>
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
              </>
            )}

            {request.status === 'PENDING' && (
              <Text style={styles.modalMessage}>
                Are you sure you want to cancel this request?
              </Text>
            )}

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
                disabled={loading}
              >
                {loading ? (
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
            <Text style={styles.modalTitle}>Rate Donor</Text>
            <Text style={styles.modalMessage}>
              How would you rate your experience with {selectedDonor?.donorName}?
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
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusCard: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  progressDotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
  },
  detailsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  donorsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  donorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  donorItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  donorImageContainer: {
    marginRight: 12,
  },
  donorImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  donorImagePlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  donorDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  donorDetail: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  completionStatus: {
    flexDirection: 'row',
    marginTop: 8,
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  completionText: {
    fontSize: 12,
    color: '#666',
  },
  donorActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  completeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  rateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DC143C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtons: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  homeButton: {
    backgroundColor: '#5856D6',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
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
    marginBottom: 20,
    textAlignVertical: 'top',
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
  cancellationCard: {
    backgroundColor: '#FFF3F3',
    borderRadius: 15,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancellationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cancellationCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  cancellationInfo: {
    paddingLeft: 32,
  },
  cancellationByText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    fontWeight: '600',
  },
  cancellationReasonText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  cancellationDateText: {
    fontSize: 12,
    color: '#999',
  },
  donorRatingBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingRowLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  starsDisplay: {
    flexDirection: 'row',
  },
  donorStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  donorStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  mapContainer: {
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewFullMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC143C',
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  viewFullMapButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default RequestStatus;
