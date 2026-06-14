import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { bloodRequestAPI } from '../../services/api';
import LiveTrackingMap from '../../components/LiveTrackingMap';

type NavigationProp = StackNavigationProp<RootStackParamList, 'LiveTracking'>;
type RouteParams = RouteProp<RootStackParamList, 'LiveTracking'>;

/**
 * Live Tracking Screen - PROFESSIONAL VERSION
 * 
 * Fixed Issues:
 * - Live location toggle now persists to backend
 * - No unnecessary polling during operations
 * - Smooth cancel/complete without multiple redirects
 * - Redirects to rating screen after completion
 * - All logic moved to backend
 */
const LiveTrackingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { requestId, donorId } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [donorInfo, setDonorInfo] = useState<{ name: string; mobile: string; photo?: string } | null>(null);
  const [recipientInfo, setRecipientInfo] = useState<{ name: string; mobile: string; photo?: string } | null>(null);
  const [isShareLocationEnabled, setIsShareLocationEnabled] = useState(false);
  const [isPollingPaused, setIsPollingPaused] = useState(false); // Pause polling during operations

  const isDonor = user?.role === 'donor';

  console.log('🗺️ [LiveTracking] Screen loaded - requestId:', requestId, 'donorId:', donorId, 'user:', user?.id, 'isDonor:', isDonor);

  /**
   * Load request data - NO REDIRECT LOGIC HERE
   */
  const loadRequestData = async () => {
    try {
      const requestData = await bloodRequestAPI.getRequestByIdDirect(requestId);
      
      if (!requestData) {
        console.error('❌ [LiveTrackingScreen] No request data received for requestId:', requestId);
        setLoading(false);
        return;
      }

      console.log('✅ [LiveTracking] Loaded request:', requestData.id, 'Status:', requestData.status);
      setRequest(requestData);
      
      // Initialize share location state
      if (!isDonor) {
        const shareValue = requestData.shareLocation || false;
        console.log('🔧 [LiveTracking] Setting recipient shareLocation:', shareValue);
        setIsShareLocationEnabled(shareValue);
      } else {
        console.log('🔧 [LiveTracking] Setting donor shareLocation: true (always)');
        setIsShareLocationEnabled(true);
      }
      
      const API_BASE_URL = 'https://bdms-production-5878.up.railway.app/api';
      
      // Fetch recipient info
      if (requestData.recipientId) {
        try {
          const recipientResponse = await fetch(`${API_BASE_URL}/recipient-profile/${requestData.recipientId}`);
          
          if (recipientResponse.ok) {
            const recipientData = await recipientResponse.json();
            
            if (recipientData.profile) {
              setRecipientInfo({
                name: recipientData.profile.name || requestData.recipientName || 'Recipient',
                mobile: recipientData.profile.mobile || requestData.recipientMobile || '',
                photo: recipientData.profile.photo || null,
              });
            }
          }
        } catch (error) {
          console.error('❌ [LiveTracking] Error fetching recipient info:', error);
          setRecipientInfo({
            name: requestData.recipientName || 'Recipient',
            mobile: requestData.recipientMobile || '',
            photo: null,
          });
        }
      }
      
      // Fetch donor info
      if (donorId) {
        try {
          const donorResponse = await fetch(`${API_BASE_URL}/donor-profile/${donorId}`);
          
          if (donorResponse.ok) {
            const donorData = await donorResponse.json();
            
            if (donorData.profile) {
              setDonorInfo({
                name: donorData.profile.name || 'Donor',
                mobile: donorData.profile.mobile || '',
                photo: donorData.profile.photo || null,
              });
            }
          }
        } catch (error) {
          console.error('❌ [LiveTracking] Error fetching donor info:', error);
        }
      }
    } catch (error) {
      console.error('Error loading request:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load request data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadRequestData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRequestData();
    }, [requestId])
  );

  /**
   * Poll for updates - PAUSED during operations
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPollingPaused && !isSubmitting) {
        loadRequestData();
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [requestId, isPollingPaused, isSubmitting]);

  /**
   * Toggle live location sharing (PERSISTS TO BACKEND)
   */
  const handleToggleLocationSharing = async () => {
    if (isDonor) return; // Donors can't toggle

    const newValue = !isShareLocationEnabled;
    console.log('🔄 [LiveTracking] Toggling location sharing to:', newValue);

    // Optimistic update
    setIsShareLocationEnabled(newValue);

    try {
      const response = await fetch(`https://bdms-production-5878.up.railway.app/api/blood-requests/${requestId}/share-location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareLocation: newValue })
      });

      if (!response.ok) {
        throw new Error('Failed to update location sharing');
      }

      console.log('✅ [LiveTracking] Location sharing updated successfully');
      
      showAlert({
        title: newValue ? 'Location Sharing Enabled' : 'Location Sharing Disabled',
        message: newValue 
          ? 'Your live location is now being shared with the donor.' 
          : 'Your live location sharing has been turned off.',
        type: 'success'
      });
    } catch (error) {
      console.error('❌ [LiveTracking] Error updating location sharing:', error);
      
      // Revert on error
      setIsShareLocationEnabled(!newValue);
      
      showAlert({
        title: 'Error',
        message: 'Failed to update location sharing preference',
        type: 'error'
      });
    }
  };

  /**
   * Handle Complete - SMOOTH WITHOUT REDIRECTS
   */
  const handleComplete = async () => {
    setShowCompleteModal(false);
    setIsSubmitting(true);
    setIsPollingPaused(true); // Pause polling

    const completionData = {
      userId: user!.id,
      userRole: user!.role,
      donorId: isDonor ? user!.id : donorId,
    };

    console.log('✅ [LiveTracking] Completing request:', requestId, completionData);

    try {
      const result = await bloodRequestAPI.complete(requestId, completionData);
      console.log('✅ [LiveTracking] Request completed successfully:', result);

      if (!result.bothCompleted) {
        showAlert({
          title: 'Completion Recorded',
          message: 'Your completion has been saved. Waiting for the other party to complete before rating.',
          type: 'info'
        });

        setIsPollingPaused(false);
        return;
      }

      showAlert({
        title: 'Request Completed',
        message: 'Thank you for completing the donation!',
        type: 'success'
      });

      // Navigate to rating screen after short delay
      setTimeout(() => {
        navigation.navigate('RatingScreen' as never, {
          requestId,
          donorId: isDonor ? user!.id : donorId,
          donorName: donorInfo?.name || 'Donor',
          recipientName: recipientInfo?.name || 'Recipient',
        } as never);
      }, 1000);
    } catch (error: any) {
      console.error('❌ [LiveTracking] Error completing request:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to complete request',
        type: 'error'
      });
      setIsPollingPaused(false); // Resume polling on error
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle Cancel - SMOOTH WITHOUT REDIRECTS
   */
  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      showAlert({
        title: 'Reason Required',
        message: 'Please provide a reason for cancellation',
        type: 'warning'
      });
      return;
    }

    setShowCancelModal(false);
    setIsSubmitting(true);
    setIsPollingPaused(true); // Pause polling

    const cancellationData = {
      userId: user!.id,
      userRole: user!.role,
      reason: cancellationReason.trim(),
      donorId: isDonor ? user!.id : donorId,
    };

    console.log('❌ [LiveTracking] Cancelling request:', requestId, cancellationData);

    try {
      const result = await bloodRequestAPI.cancel(requestId, cancellationData);
      console.log('❌ [LiveTracking] Request cancelled successfully:', result);

      showAlert({
        title: 'Request Cancelled',
        message: 'The request has been cancelled successfully.',
        type: 'warning'
      });

      setCancellationReason('');

      // Navigate to home after cancellation
      setTimeout(() => {
        navigation.navigate(isDonor ? 'DonorHome' : 'UserHome' as never);
      }, 1000);
    } catch (error: any) {
      console.error('❌ [LiveTracking] Error cancelling request:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to cancel request',
        type: 'error'
      });
      setIsPollingPaused(false); // Resume polling on error
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle route update from map
   */
  const handleRouteUpdate = (distance: string, duration: string) => {
    setRouteDistance(distance);
    setRouteDuration(duration);
  };

  /**
   * Handle phone call
   */
  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) {
      showAlert({
        title: 'Phone Number Not Available',
        message: 'The phone number is not available for this user.',
        type: 'warning'
      });
      return;
    }
    
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          showAlert({
            title: 'Call Error',
            message: 'Unable to make phone calls on this device.',
            type: 'error'
          });
        }
      })
      .catch((err) => {
        console.error('Error making call:', err);
        showAlert({
          title: 'Call Error',
          message: 'Failed to initiate call. Please try again.',
          type: 'error'
        });
      });
  };

  /**
   * Start Turn-by-Turn Navigation
   */
  const handleStartNavigation = async () => {
    if (!request.recipientLatitude || !request.recipientLongitude) {
      showAlert({
        title: 'Location Not Available',
        message: 'Target location coordinates are not available',
        type: 'warning'
      });
      return;
    }

    const latitude = request.recipientLatitude;
    const longitude = request.recipientLongitude;

    console.log('🧭 [Navigation] Starting navigation to:', latitude, longitude);

    try {
      let url: string;
      
      if (Platform.OS === 'ios') {
        url = `maps://app?daddr=${latitude},${longitude}&dirflg=d`;
        
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
        }
      } else {
        url = `google.navigation:q=${latitude},${longitude}&mode=d`;
        
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
        }
      }

      console.log('🧭 [Navigation] Opening URL:', url);
      
      await Linking.openURL(url);
      
      showAlert({
        title: 'Navigation Started',
        message: 'Follow turn-by-turn directions in your maps app',
        type: 'success'
      });
    } catch (error) {
      console.error('❌ [Navigation] Error opening maps:', error);
      
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      
      try {
        await Linking.openURL(fallbackUrl);
      } catch (fallbackError) {
        showAlert({
          title: 'Navigation Error',
          message: 'Unable to open maps app. Please check your device settings.',
          type: 'error'
        });
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading tracking...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#999" />
        <Text style={styles.errorText}>Request not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <Text style={styles.headerSubtitle}>
            {request.bloodGroup} • {request.units} Unit(s)
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.fullScrollView} bounces={false}>
        {/* Map */}
        <View style={styles.fullMapContainer}>
          <LiveTrackingMap 
            requestId={requestId}
            shareLocation={isShareLocationEnabled}
            donorId={isDonor ? user?.id : donorId}
            onRouteUpdate={handleRouteUpdate}
          />
          
          {/* Location Sharing Toggle (Recipient Only) */}
          {!isDonor && (
            <View style={styles.locationToggleContainer}>
              <TouchableOpacity 
                style={[
                  styles.locationToggleButton,
                  isShareLocationEnabled ? styles.locationToggleActive : styles.locationToggleInactive
                ]}
                onPress={handleToggleLocationSharing}
                disabled={isSubmitting}
              >
                <Ionicons 
                  name={isShareLocationEnabled ? "location" : "location-outline"} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.locationToggleText}>
                  {isShareLocationEnabled ? 'Sharing My Location' : 'Share My Location'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Information Section */}
        <View style={styles.infoSection}>
          {/* Route Info */}
          {routeDistance && routeDuration && (
            <View style={styles.routeInfoBar}>
              <View style={styles.routeIconContainer}>
                <Ionicons name="navigate" size={24} color="#fff" />
              </View>
              <View style={styles.routeDetailsContainer}>
                <Text style={styles.routeDistance}>{routeDistance}</Text>
                <Text style={styles.routeSeparator}>•</Text>
                <Text style={styles.routeDuration}>{routeDuration}</Text>
              </View>
              <View style={styles.routeLabel}>
                <Text style={styles.routeLabelText}>Route Distance</Text>
              </View>
            </View>
          )}

          {/* Map Legend */}
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>Map Guide</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendMarker, { backgroundColor: '#DC143C' }]}>
                  <Text style={styles.legendMarkerEmoji}>🩸</Text>
                </View>
                <Text style={styles.legendText}>Donor{'\n'}(Live)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendMarker, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.legendMarkerEmoji}>🏥</Text>
                </View>
                <Text style={styles.legendText}>Target{'\n'}Location</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendMarker, { backgroundColor: '#2196F3' }]}>
                  <Text style={styles.legendMarkerEmoji}>📍</Text>
                </View>
                <Text style={styles.legendText}>Recipient{'\n'}(Optional)</Text>
              </View>
            </View>
            <Text style={styles.legendNote}>
              Note: Donor location and target are always visible. Recipient location is optional.
            </Text>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItemFull}>
                <View style={styles.infoHeader}>
                  <Ionicons name="person-outline" size={22} color="#DC143C" />
                  <Text style={styles.infoLabel}>
                    {isDonor ? 'Recipient' : 'Donor'}
                  </Text>
                </View>
                
                {/* Profile Section */}
                <View style={styles.profileSection}>
                  {/* Profile Photo */}
                  <View style={styles.profilePhotoContainer}>
                    {(() => {
                      const photoUri = isDonor ? recipientInfo?.photo : donorInfo?.photo;
                      
                      if (photoUri) {
                        return (
                          <Image 
                            source={{ uri: photoUri }} 
                            style={styles.profilePhoto}
                            resizeMode="cover"
                          />
                        );
                      } else {
                        return (
                          <View style={styles.profilePhotoPlaceholder}>
                            <Ionicons name="person" size={40} color="#999" />
                          </View>
                        );
                      }
                    })()}
                  </View>
                  
                  {/* Name and Phone */}
                  <View style={styles.profileDetails}>
                    <Text style={styles.infoValueLarge}>
                      {isDonor 
                        ? (recipientInfo?.name || request.recipientName || 'Recipient')
                        : (donorInfo?.name || 'Donor')}
                    </Text>
                    
                    {/* Call Button */}
                    {((isDonor && recipientInfo?.mobile) || (!isDonor && donorInfo?.mobile)) && (
                      <TouchableOpacity 
                        style={styles.callButton}
                        onPress={() => handleCall(isDonor ? (recipientInfo?.mobile || '') : (donorInfo?.mobile || ''))}
                      >
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.callButtonText}>
                          {isDonor ? recipientInfo?.mobile : donorInfo?.mobile}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoItemFull}>
                <View style={styles.infoHeader}>
                  <Ionicons name="location-outline" size={22} color="#DC143C" />
                  <Text style={styles.infoLabel}>Location</Text>
                </View>
                <Text style={styles.infoValueLarge} numberOfLines={3}>
                  {request.location}
                </Text>
              </View>
            </View>
          </View>

          {/* Start Navigation Button (Donor Only) */}
          {isDonor && (
            <View style={styles.navigationContainer}>
              <TouchableOpacity
                style={styles.navigationButton}
                onPress={handleStartNavigation}
                disabled={isSubmitting}
              >
                <View style={styles.navigationButtonContent}>
                  <View style={styles.navigationIconContainer}>
                    <Ionicons name="navigate" size={28} color="#fff" />
                  </View>
                  <View style={styles.navigationTextContainer}>
                    <Text style={styles.navigationButtonTitle}>Start Navigation</Text>
                    <Text style={styles.navigationButtonSubtitle}>
                      Get turn-by-turn directions to destination
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setShowCancelModal(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => setShowCompleteModal(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                  <Text style={styles.actionButtonText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Complete Modal */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.modalTitle}>Mark as Complete?</Text>
            <Text style={styles.modalMessage}>
              {isDonor 
                ? 'Have you successfully donated blood to the recipient?'
                : 'Have you successfully received blood from the donor?'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowCompleteModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalButtonSecondaryText}>Not Yet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleComplete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Yes, Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="close-circle" size={64} color="#FF3B30" />
            <Text style={styles.modalTitle}>Cancel Request?</Text>
            <Text style={styles.modalMessage}>
              Please provide a reason for cancelling this request:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter cancellation reason..."
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor="#999"
              editable={!isSubmitting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalButtonSecondaryText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Cancel Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles remain the same as original
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#DC143C',
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
    justifyContent: 'space-between',
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  fullScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  fullMapContainer: {
    height: 500,
    width: '100%',
    position: 'relative',
  },
  locationToggleContainer: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -90 }],
    zIndex: 10,
  },
  locationToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationToggleActive: {
    backgroundColor: '#4CAF50',
  },
  locationToggleInactive: {
    backgroundColor: '#757575',
  },
  locationToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoSection: {
    backgroundColor: '#F8F9FA',
    paddingBottom: 20,
  },
  routeInfoBar: {
    backgroundColor: '#DC143C',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  routeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeDetailsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  routeDistance: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeSeparator: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginHorizontal: 8,
  },
  routeDuration: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeLabel: {
    alignItems: 'flex-end',
  },
  routeLabelText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  legendCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  legendItem: {
    alignItems: 'center',
    flex: 1,
  },
  legendMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendMarkerEmoji: {
    fontSize: 20,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  legendNote: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoItemFull: {
    flex: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profilePhotoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  profilePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDetails: {
    flex: 1,
  },
  infoValueLarge: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  navigationContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  navigationButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  navigationIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationTextContainer: {
    flex: 1,
  },
  navigationButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  navigationButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: '#DC143C',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F5F5F5',
  },
  modalButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  modalButtonDanger: {
    backgroundColor: '#DC143C',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LiveTrackingScreen;

