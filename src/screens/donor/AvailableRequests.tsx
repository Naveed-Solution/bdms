import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useBloodRequest, BloodRequest } from '../../context/BloodRequestContext';
import { useAlert } from '../../context/AlertContext';
import { bloodRequestAPI } from '../../services/api';

type NavigationProp = StackNavigationProp<RootStackParamList, 'AvailableRequests'>;

/**
 * Available Requests Screen
 * 
 * Displays blood requests compatible with the donor's blood group
 * 
 * Features:
 * - Uses backend blood compatibility matching
 * - Filters by blood group compatibility (medically accurate)
 * - Checks donor eligibility (3-month rule, profile approval)
 * - Shows blood group, urgency, location, and status
 * - Allows donors to accept or decline requests
 * - Pull-to-refresh functionality
 * 
 * Blood Compatibility Rules:
 * - O- can donate to: Everyone (Universal Donor)
 * - O+ can donate to: O+, A+, B+, AB+
 * - A- can donate to: A-, A+, AB-, AB+
 * - A+ can donate to: A+, AB+
 * - B- can donate to: B-, B+, AB-, AB+
 * - B+ can donate to: B+, AB+
 * - AB- can donate to: AB-, AB+
 * - AB+ can donate to: AB+ only
 */
const AvailableRequests: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { acceptRequest, declineRequest } = useBloodRequest();
  const { showAlert } = useAlert();

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);

  /**
   * Load available requests from backend with blood compatibility matching
   * Backend filters based on:
   * - Blood group compatibility
   * - Donor profile approval status
   * - 3-month donation interval
   * - Request units availability
   */
  const loadRequests = async () => {
    if (!user?.id) return;
    
    try {
      const response = await bloodRequestAPI.getAvailableForDonor(user.id);
      setRequests(response.requests || []);
      setEligibilityMessage(response.message || null);
      console.log('📋 Loaded', response.requests?.length || 0, 'compatible blood requests');
      
      // DEBUG: Log request details
      if (response.requests && response.requests.length > 0) {
        console.log('🔍 First request details:', {
          recipientName: response.requests[0].recipientName,
          bloodGroup: response.requests[0].bloodGroup,
          urgencyLevel: response.requests[0].urgencyLevel,
          units: response.requests[0].units,
        });
      }
      
      if (response.message) {
        console.log('ℹ️ Eligibility message:', response.message);
      }
    } catch (error) {
      console.error('Error loading available requests:', error);
      setRequests([]);
    }
  };


  /**
   * Load requests on mount and set up polling
   */
  useEffect(() => {
    loadRequests();

    // Poll for updates every 1 second for real-time experience
    const interval = setInterval(() => {
      loadRequests();
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  /**
   * Reload data when screen comes into focus
   * Ensures real-time updates after accepting/declining
   */
  useFocusEffect(
    React.useCallback(() => {
      loadRequests();
    }, [user?.id])
  );

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  /**
   * Handle accepting a request
   * 
   * Flow:
   * 1. Confirm with donor
   * 2. Call acceptRequest in context
   * 3. Update local state
   * 4. Show success message
   * 
   * Note: Multiple donors can accept the same request
   * This creates a pool of available donors for the recipient
   */
  const handleAcceptRequest = async (request: BloodRequest) => {
    if (!user) return;

    // Prevent double-click
    if (acceptingId === request.id) return;

    // Check if already accepted
    const alreadyAccepted = request.acceptedBy?.some(d => d.donorId === user.id);
    if (alreadyAccepted) {
      showAlert({
        type: 'info',
        title: 'Already Accepted',
        message: 'You have already accepted this request.',
      });
      return;
    }

    try {
      setAcceptingId(request.id);

      // Get current location
      let currentLocation = 'Location unavailable';
      try {
        console.log('📍 Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log(`📍 Permission status: ${status}`);
        
        if (status === 'granted') {
          console.log('📍 Getting current position...');
          const location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]) as any;
          
          if (location && typeof location === 'object' && 'coords' in location) {
            const { latitude, longitude } = location.coords;
            console.log(`📍 GPS coordinates: ${latitude}, ${longitude}`);
            
            // Get address from coordinates
            try {
              console.log('📍 Reverse geocoding...');
              const addresses = await Promise.race([
                Location.reverseGeocodeAsync({ latitude, longitude }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
              ]) as any;
              
              if (Array.isArray(addresses) && addresses.length > 0) {
                const addr = addresses[0];
                console.log('📍 Address found:', addr);
                currentLocation = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''} ${addr.country || ''}`.trim().replace(/\s+/g, ' ');
                console.log(`📍 Final location: ${currentLocation}`);
              }
            } catch (geoErr) {
              console.log('📍 Geocoding failed, using coordinates:', geoErr);
              currentLocation = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }
          }
        } else {
          console.log('📍 Location permission denied');
        }
      } catch (locErr) {
        console.log('📍 Location error:', locErr);
        // Continue with acceptance even if location fails
      }
      
      console.log(`📍 Saving location: ${currentLocation}`);

      await acceptRequest(request.id, user.id, user.name, currentLocation);

      // Navigate to Live Tracking immediately — don't wait, the list re-polls every second
      // and would remove this request from view before the timeout fires
      navigation.navigate('LiveTracking', {
        requestId: request.id,
        donorId: user.id,
      });

      showAlert({
        type: 'success',
        title: 'Request Accepted! 🩸',
        message: `Thank you for helping ${request.recipientName}. They will be notified of your acceptance.`,
      });
    } catch (error) {
      console.error('Error accepting request:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Unable to accept request. Please try again.',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  /**
   * Handle declining a request
   * 
   * Flow:
   * 1. Confirm with donor
   * 2. Call declineRequest in context
   * 3. Remove from local view
   * 
   * Note: Declined requests are hidden from donor's view
   * but remain available for other donors
   */
  const handleDeclineRequest = (request: BloodRequest) => {
    if (!user) return;

    showAlert({
      type: 'warning',
      title: 'Decline Request',
      message: 'Are you sure you want to decline this request? It will be removed from your list.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineRequest(request.id, user.id);
              
              showAlert({
                type: 'info',
                title: 'Request Declined',
                message: 'The request has been removed from your list.',
              });
              
              // Reload requests after short delay
              setTimeout(() => {
                loadRequests();
              }, 500);
            } catch (error) {
              console.error('Error declining request:', error);
              showAlert({
                type: 'error',
                title: 'Error',
                message: 'Unable to decline request. Please try again.',
              });
            }
          },
        },
      ],
    });
  };

  /**
   * Get urgency color
   */
  const getUrgencyColor = (urgency: string) => {
    return urgency === 'EMERGENCY' ? '#F44336' : '#FF9800';
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#FF9800';
      case 'ACCEPTED': return '#4CAF50';
      case 'COMPLETED': return '#DC143C';
      default: return '#999';
    }
  };

  /**
   * Format date
   */
  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Recently';
    
    try {
      const now = new Date();
      const dateObj = date instanceof Date ? date : new Date(date);
      const diff = now.getTime() - dateObj.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch (error) {
      return 'Recently';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{requests.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
            {requests.filter(r => r.urgencyLevel === 'EMERGENCY').length}
          </Text>
          <Text style={styles.statLabel}>Emergency</Text>
        </View>
      </View>

      {/* Request List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC143C']} />
        }
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name={eligibilityMessage ? "information-circle-outline" : "water-outline"} 
              size={64} 
              color={eligibilityMessage ? "#FF9800" : "#ccc"} 
            />
            <Text style={styles.emptyTitle}>
              {eligibilityMessage ? "Not Eligible" : "No Requests Available"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {eligibilityMessage || "Check back later for new blood donation requests"}
            </Text>
          </View>
        ) : (
          requests.map((request) => {
            const hasAccepted = request.acceptedBy?.some(d => d.donorId === user?.id);
            const donorCount = request.acceptedBy?.length || 0;

            return (
              <View key={request.id} style={styles.requestCard}>
                {/* Header */}
                <View style={styles.requestHeader}>
                  <View style={styles.bloodGroupBadge}>
                    <Ionicons name="water" size={20} color="#DC143C" />
                    <Text style={styles.bloodGroupText}>{request.bloodGroup}</Text>
                  </View>
                  
                  {request.urgencyLevel === 'EMERGENCY' && (
                    <View style={styles.emergencyBadge}>
                      <Ionicons name="alert-circle" size={16} color="#fff" />
                      <Text style={styles.emergencyText}>EMERGENCY</Text>
                    </View>
                  )}
                </View>

                {/* Recipient Info */}
                <View style={styles.requestContent}>
                  <Text style={styles.recipientName}>
                    <Ionicons name="person" size={16} color="#666" />{' '}
                    {request.recipientName}
                  </Text>
                  
                  {request.location && request.location.trim() && (
                    <View style={styles.requestDetail}>
                      <Ionicons name="location" size={16} color="#666" />
                      <Text style={styles.detailText}>{request.location}</Text>
                    </View>
                  )}

                  <View style={styles.requestDetail}>
                    <Ionicons name="time" size={16} color="#666" />
                    <Text style={styles.detailText}>{formatDate(request.createdAt)}</Text>
                  </View>

                  {request.notes && request.notes.trim() && (
                    <View style={styles.notesContainer}>
                      <Ionicons name="document-text-outline" size={16} color="#666" />
                      <Text style={styles.notesText} numberOfLines={2}>
                        {request.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Status & Units Progress */}
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{request.status}</Text>
                  </View>
                  
                  <View style={styles.unitsInfo}>
                    <Ionicons name="water-outline" size={14} color="#666" />
                    <Text style={styles.unitsText}>
                      {request.acceptedUnits || 0}/{request.units || 1} {request.units === 1 ? 'unit' : 'units'}
                    </Text>
                  </View>
                </View>

                {/* Recipient Contact (shown after acceptance) */}
                {hasAccepted && request.recipientMobile && (
                  <View style={styles.contactCard}>
                    <Ionicons name="call" size={16} color="#4CAF50" />
                    <Text style={styles.contactText}>
                      Contact Recipient: {request.recipientMobile}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                {hasAccepted ? (
                  <View style={styles.acceptedContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.acceptedText}>You have accepted this request</Text>
                  </View>
                ) : (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineRequest(request)}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#666" />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.acceptButton,
                        acceptingId === request.id && styles.acceptButtonDisabled,
                      ]}
                      onPress={() => handleAcceptRequest(request)}
                      disabled={acceptingId === request.id}
                    >
                      <Ionicons name="heart" size={20} color="#fff" />
                      <Text style={styles.acceptButtonText}>
                        {acceptingId === request.id ? 'Accepting...' : 'Accept Request'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  statsCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bloodGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bloodGroupText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC143C',
    marginLeft: 6,
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  requestContent: {
    marginBottom: 12,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  requestDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  donorCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donorCountText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  unitsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unitsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  contactText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC143C',
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 6,
  },
  acceptedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
  },
  acceptedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default AvailableRequests;

