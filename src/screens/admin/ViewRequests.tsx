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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';

/**
 * Blood Request Interface for Admin View
 * 
 * Complete blood request data structure for administrative oversight
 */
interface AdminBloodRequest {
  id: string;
  recipientId: string;
  recipientName: string;
  bloodGroup: string;
  units: number;
  acceptedUnits: number;
  urgencyLevel: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY' | string;
  location?: string;
  notes?: string;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
}

/**
 * ViewRequests Screen
 * 
 * Admin screen to monitor all blood requests in the system
 * 
 * ADMIN RESPONSIBILITIES:
 * - Monitor all blood donation requests system-wide
 * - Track request statuses (Pending/Accepted/Completed/Cancelled)
 * - Identify urgent requests requiring immediate attention
 * - Analyze request patterns and fulfillment rates
 * - Generate insights for blood bank management
 * 
 * SYSTEM METRICS:
 * - Total requests created
 * - Active/pending requests
 * - Completed donations
 * - Cancelled requests
 * - Request fulfillment rate
 * 
 * ROLE-BASED ACCESS CONTROL (RBAC):
 * - Only accessible to users with role = 'admin'
 * - Read-only view for monitoring purposes
 * - No direct modification of requests (audit trail preservation)
 */
const ViewRequests: React.FC = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  const [requests, setRequests] = useState<AdminBloodRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<AdminBloodRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'>('all');
  const [selectedRequest, setSelectedRequest] = useState<AdminBloodRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [requests, selectedFilter]);

  /**
   * Load all blood requests from backend
   * 
   * Note: Uses GET /api/blood-requests endpoint
   * Fetches complete request history for administrative analysis
   */
  const loadRequests = async () => {
    try {
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/blood-requests');
      const data = await response.json();

      if (data.requests) {
        // Map backend data to frontend format
        const mappedRequests: AdminBloodRequest[] = data.requests.map((req: any) => ({
          id: req.id,
          recipientId: req.recipient_id,
          recipientName: req.recipient_name,
          bloodGroup: req.blood_group,
          units: req.units,
          acceptedUnits: req.accepted_units || 0,
          urgencyLevel: req.urgency_level || 'normal',
          location: req.location,
          notes: req.notes,
          status: req.status,
          createdAt: req.created_at * 1000, // Convert to milliseconds
          updatedAt: req.updated_at * 1000,
        }));

        setRequests(mappedRequests);
        console.log(`✅ [Admin] Loaded ${mappedRequests.length} blood requests`);
      }
    } catch (error: any) {
      console.error('❌ [Admin] Error loading requests:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load blood requests',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Apply status filter to request list
   * 
   * Note: Client-side filtering for responsive admin dashboard
   */
  const applyFilters = () => {
    if (selectedFilter === 'all') {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter(req => req.status === selectedFilter));
    }
  };

  /**
   * Refresh request list
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadRequests();
  };

  /**
   * Open request details modal
   */
  const handleViewDetails = (request: AdminBloodRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  /**
   * Close request details modal
   */
  const handleCloseDetails = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  /**
   * Format timestamp to readable date
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get status badge color and icon
   */
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { backgroundColor: '#FFF9C4', color: '#F57C00', icon: 'time' };
      case 'ACCEPTED':
        return { backgroundColor: '#C8E6C9', color: '#388E3C', icon: 'checkmark-circle' };
      case 'COMPLETED':
        return { backgroundColor: '#BBDEFB', color: '#1976D2', icon: 'checkmark-done-circle' };
      case 'CANCELLED':
        return { backgroundColor: '#FFCDD2', color: '#D32F2F', icon: 'close-circle' };
      default:
        return { backgroundColor: '#E0E0E0', color: '#666', icon: 'help-circle' };
    }
  };

  /**
   * Get urgency badge style
   */
  const getUrgencyStyle = (urgency: string) => {
    const normalizedUrgency = urgency?.toLowerCase();
    switch (normalizedUrgency) {
      case 'emergency':
      case 'urgent':
        return { backgroundColor: '#DC143C', color: '#fff', label: 'URGENT' };
      case 'high':
        return { backgroundColor: '#FF6B6B', color: '#fff', label: 'HIGH' };
      case 'normal':
      case 'medium':
        return { backgroundColor: '#4ECDC4', color: '#fff', label: 'NORMAL' };
      case 'low':
        return { backgroundColor: '#95E1D3', color: '#333', label: 'LOW' };
      default:
        return { backgroundColor: '#E0E0E0', color: '#666', label: 'UNKNOWN' };
    }
  };

  /**
   * Calculate system statistics
   */
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'PENDING').length,
    active: requests.filter(r => r.status === 'ACCEPTED').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
    cancelled: requests.filter(r => r.status === 'CANCELLED').length,
    urgent: requests.filter(r => 
      (r.urgencyLevel?.toLowerCase() === 'urgent' || r.urgencyLevel?.toLowerCase() === 'emergency') 
      && r.status !== 'COMPLETED' 
      && r.status !== 'CANCELLED'
    ).length,
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Blood Requests</Text>
          <Text style={styles.headerSubtitle}>
            {filteredRequests.length} {selectedFilter === 'all' ? 'total' : selectedFilter.toLowerCase()} requests
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardTotal]}>
            <Ionicons name="document-text" size={24} color="#DC143C" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Requests</Text>
          </View>
          <View style={[styles.statCard, styles.statCardPending]}>
            <Ionicons name="time" size={24} color="#F57C00" />
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, styles.statCardActive]}>
            <Ionicons name="flash" size={24} color="#388E3C" />
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, styles.statCardUrgent]}>
            <Ionicons name="warning" size={24} color="#DC143C" />
            <Text style={styles.statValue}>{stats.urgent}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
              All ({requests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'PENDING' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('PENDING')}
          >
            <Text style={[styles.filterText, selectedFilter === 'PENDING' && styles.filterTextActive]}>
              Pending ({stats.pending})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'ACCEPTED' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('ACCEPTED')}
          >
            <Text style={[styles.filterText, selectedFilter === 'ACCEPTED' && styles.filterTextActive]}>
              Accepted ({stats.active})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'COMPLETED' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('COMPLETED')}
          >
            <Text style={[styles.filterText, selectedFilter === 'COMPLETED' && styles.filterTextActive]}>
              Completed ({stats.completed})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'CANCELLED' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('CANCELLED')}
          >
            <Text style={[styles.filterText, selectedFilter === 'CANCELLED' && styles.filterTextActive]}>
              Cancelled ({stats.cancelled})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Requests Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'all' 
                ? 'No blood requests have been created yet' 
                : `No ${selectedFilter.toLowerCase()} requests`}
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {filteredRequests.map((request) => {
              const statusStyle = getStatusStyle(request.status);
              const urgencyStyle = getUrgencyStyle(request.urgencyLevel);

              return (
                <TouchableOpacity 
                  key={request.id} 
                  style={styles.requestCard}
                  onPress={() => handleViewDetails(request)}
                  activeOpacity={0.7}
                >
                  {/* Request Header */}
                  <View style={styles.requestHeader}>
                    <View style={styles.bloodGroupBadge}>
                      <Ionicons name="water" size={20} color="#DC143C" />
                      <Text style={styles.bloodGroupText}>{request.bloodGroup}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
                      <Ionicons name={statusStyle.icon as any} size={14} color={statusStyle.color} />
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  {/* Request Details */}
                  <Text style={styles.recipientName}>{request.recipientName}</Text>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="water" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {request.acceptedUnits}/{request.units} units
                      </Text>
                    </View>
                    
                    {request.location && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location" size={16} color="#666" />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {request.location}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {formatDate(request.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Urgency Badge */}
                  <View style={[styles.urgencyBadge, { backgroundColor: urgencyStyle.backgroundColor }]}>
                    <Ionicons name="alert-circle" size={14} color={urgencyStyle.color} />
                    <Text style={[styles.urgencyText, { color: urgencyStyle.color }]}>
                      {urgencyStyle.label}
                    </Text>
                  </View>

                  {/* Notes Preview */}
                  {request.notes && (
                    <View style={styles.notesContainer}>
                      <Ionicons name="information-circle" size={14} color="#666" />
                      <Text style={styles.notesText} numberOfLines={2}>
                        {request.notes}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Showing {filteredRequests.length} of {requests.length} requests
          </Text>
          <Text style={styles.footerSubtext}>
            Completion Rate: {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </Text>
        </View>
      </ScrollView>

      {/* Request Details Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Details</Text>
              <TouchableOpacity onPress={handleCloseDetails} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedRequest ? (
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Status and Blood Group */}
                <View style={styles.modalRow}>
                  <View style={styles.modalBloodBadge}>
                    <Ionicons name="water" size={24} color="#DC143C" />
                    <Text style={styles.modalBloodText}>{selectedRequest.bloodGroup}</Text>
                  </View>
                  <View style={[
                    styles.modalStatusBadge,
                    { backgroundColor: getStatusStyle(selectedRequest.status).backgroundColor }
                  ]}>
                    <Text style={[
                      styles.modalStatusText,
                      { color: getStatusStyle(selectedRequest.status).color }
                    ]}>
                      {selectedRequest.status}
                    </Text>
                  </View>
                </View>

                {/* Urgency */}
                <View style={[
                  styles.modalUrgencyBadge,
                  { backgroundColor: getUrgencyStyle(selectedRequest.urgencyLevel).backgroundColor }
                ]}>
                  <Ionicons name="alert-circle" size={18} color={getUrgencyStyle(selectedRequest.urgencyLevel).color} />
                  <Text style={[
                    styles.modalUrgencyText,
                    { color: getUrgencyStyle(selectedRequest.urgencyLevel).color }
                  ]}>
                    {getUrgencyStyle(selectedRequest.urgencyLevel).label}
                  </Text>
                </View>

                {/* Recipient Information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Recipient Information</Text>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="person" size={20} color="#666" />
                    <View style={styles.modalDetailContent}>
                      <Text style={styles.modalDetailLabel}>Name</Text>
                      <Text style={styles.modalDetailValue}>{selectedRequest.recipientName}</Text>
                    </View>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="finger-print" size={20} color="#666" />
                    <View style={styles.modalDetailContent}>
                      <Text style={styles.modalDetailLabel}>Recipient ID</Text>
                      <Text style={styles.modalDetailValue}>{selectedRequest.recipientId}</Text>
                    </View>
                  </View>
                </View>

                {/* Request Details */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Request Details</Text>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="water" size={20} color="#666" />
                    <View style={styles.modalDetailContent}>
                      <Text style={styles.modalDetailLabel}>Units Requested</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedRequest.acceptedUnits} / {selectedRequest.units} units
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="calendar" size={20} color="#666" />
                    <View style={styles.modalDetailContent}>
                      <Text style={styles.modalDetailLabel}>Created At</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatDate(selectedRequest.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Ionicons name="time" size={20} color="#666" />
                    <View style={styles.modalDetailContent}>
                      <Text style={styles.modalDetailLabel}>Last Updated</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatDate(selectedRequest.updatedAt)}
                      </Text>
                    </View>
                  </View>
                  {selectedRequest.location && (
                    <View style={styles.modalDetailRow}>
                      <Ionicons name="location" size={20} color="#666" />
                      <View style={styles.modalDetailContent}>
                        <Text style={styles.modalDetailLabel}>Location</Text>
                        <Text style={styles.modalDetailValue}>
                          {selectedRequest.location}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Notes */}
                {selectedRequest.notes && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Additional Notes</Text>
                    <View style={styles.modalNotesBox}>
                      <Text style={styles.modalNotesText}>{selectedRequest.notes}</Text>
                    </View>
                  </View>
                )}

                {/* Request ID */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Request ID</Text>
                  <Text style={styles.modalRequestId}>{selectedRequest.id}</Text>
                </View>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#DC143C" />
                <Text style={styles.loadingText}>Loading request details...</Text>
              </View>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={handleCloseDetails}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
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
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardTotal: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC143C',
  },
  statCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
  },
  statCardActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#388E3C',
  },
  statCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC143C',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filterScrollView: {
    marginBottom: 15,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  requestsList: {
    gap: 12,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    gap: 6,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bloodGroupText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC143C',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  requestDetails: {
    gap: 6,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalBloodText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC143C',
  },
  modalStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modalStatusText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalUrgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  modalUrgencyText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  modalDetailContent: {
    flex: 1,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  modalDetailValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  modalNotesBox: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#DC143C',
  },
  modalNotesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  modalRequestId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  closeModalButton: {
    backgroundColor: '#DC143C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ViewRequests;

