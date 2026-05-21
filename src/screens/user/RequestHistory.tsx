import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useBloodRequest, BloodRequest } from '../../context/BloodRequestContext';

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * Request History Screen
 * 
 * Shows all past and current blood requests for recipients
 */
const RequestHistory: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { getUserRequests } = useBloodRequest();

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  /**
   * Load user's blood requests
   */
  const loadRequests = () => {
    if (user) {
      const userRequests = getUserRequests(user.id);
      setRequests(userRequests);
    }
  };

  useEffect(() => {
    loadRequests();

    // Poll for updates every 1 second
    const interval = setInterval(loadRequests, 1000);
    return () => clearInterval(interval);
  }, [user]);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
    setTimeout(() => setRefreshing(false), 1000);
  };

  /**
   * Filter requests based on selected filter
   */
  const getFilteredRequests = () => {
    switch (filter) {
      case 'pending':
        return requests.filter(r => r.status === 'PENDING' || r.status === 'ACCEPTED');
      case 'completed':
        return requests.filter(r => r.status === 'COMPLETED');
      default:
        return requests;
    }
  };

  const filteredRequests = getFilteredRequests();

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#4CAF50';
      case 'ACCEPTED': return '#34C759';
      case 'PENDING': return '#FF9800';
      default: return '#999';
    }
  };

  /**
   * Format date
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  /**
   * View request details
   */
  const viewRequest = (requestId: string) => {
    navigation.navigate('RequestStatus', { requestId });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request History</Text>
        <View style={styles.backButton} />
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{requests.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FF9800' }]}>
            {requests.filter(r => r.status === 'PENDING' || r.status === 'ACCEPTED').length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {requests.filter(r => r.status === 'COMPLETED').length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC143C']} />
        }
      >
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Requests Found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'You haven\'t created any requests yet'
                : `No ${filter} requests found`}
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => viewRequest(request.id)}
              activeOpacity={0.7}
            >
              {/* Header */}
              <View style={styles.requestHeader}>
                <View style={styles.bloodGroupBadge}>
                  <Ionicons name="water" size={16} color="#DC143C" />
                  <Text style={styles.bloodGroupText}>{request.bloodGroup}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                  <Text style={styles.statusText}>{request.status}</Text>
                </View>
              </View>

              {/* Content */}
              <View style={styles.requestContent}>
                <Text style={styles.requestTitle}>
                  {request.urgencyLevel === 'EMERGENCY' && '🚨 '}
                  {request.location}
                </Text>
                
                <View style={styles.requestDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={14} color="#666" />
                    <Text style={styles.detailText}>{request.recipientName}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="water-outline" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      {request.acceptedUnits || 0}/{request.units || 1} units
                    </Text>
                  </View>
                </View>

                {request.notes && (
                  <Text style={styles.requestNotes} numberOfLines={2}>
                    {request.notes}
                  </Text>
                )}

                <Text style={styles.requestDate}>{formatDate(request.createdAt)}</Text>
              </View>

              {/* Footer */}
              {(request.acceptedBy && request.acceptedBy.length > 0) && (
                <View style={styles.requestFooter}>
                  <Ionicons name="people" size={16} color="#4CAF50" />
                  <Text style={styles.footerText}>
                    {request.acceptedBy.length} donor{request.acceptedBy.length !== 1 ? 's' : ''} accepted
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
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
  header: {
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#DC143C',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
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
    gap: 4,
  },
  bloodGroupText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC143C',
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
  requestContent: {
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  requestDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  requestNotes: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
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

export default RequestHistory;

