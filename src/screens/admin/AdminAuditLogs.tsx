/**
 * Admin Audit Logs Screen
 * 
 * Audit Trail Viewing Interface
 * 
 * This screen allows administrators to view and filter system audit logs.
 * It provides visibility into all user actions for:
 * - Security monitoring: Detect unauthorized access or suspicious behavior
 * - Accountability: Know who did what and when
 * - Compliance: Meet regulatory requirements for data governance
 * - Troubleshooting: Investigate issues by reviewing action history
 * 
 * Features:
 * - Chronological display of all system actions
 * - Filter by action type, user role, and date range
 * - Pagination for large datasets
 * - Color-coded role badges for quick identification
 * - Detailed action information with timestamps
 * 
 * RBAC: This screen is only accessible to admins
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  fetchAuditLogs, 
  formatAuditTimestamp, 
  getActionDisplayName, 
  getRoleBadgeColor 
} from '../../services/auditLogService';
import { AuditLog, AuditAction } from '../../types/auditLog.types';

const AdminAuditLogs: React.FC = () => {
  const navigation = useNavigation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'donor' | 'user' | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const LIMIT = 50;

  /**
   * Load audit logs on mount
   */
  useEffect(() => {
    loadLogs();
  }, [selectedAction, selectedRole]);

  /**
   * Load logs from backend
   */
  const loadLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setOffset(0);
      } else {
        setLoading(true);
      }

      const result = await fetchAuditLogs({
        limit: LIMIT,
        offset: isRefresh ? 0 : offset,
        action: selectedAction,
        actorRole: selectedRole,
      });

      if (isRefresh) {
        setLogs(result.logs);
      } else {
        setLogs(result.logs);
      }

      setTotal(result.pagination.total);
      setHasMore(result.pagination.hasMore);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load more logs (pagination)
   */
  const loadMore = async () => {
    if (!hasMore || loading) return;

    const newOffset = offset + LIMIT;
    setOffset(newOffset);

    try {
      const result = await fetchAuditLogs({
        limit: LIMIT,
        offset: newOffset,
        action: selectedAction,
        actorRole: selectedRole,
      });

      setLogs([...logs, ...result.logs]);
      setHasMore(result.pagination.hasMore);
    } catch (error) {
      console.error('Error loading more logs:', error);
    }
  };

  /**
   * Refresh logs
   */
  const handleRefresh = () => {
    loadLogs(true);
  };

  /**
   * Render a single audit log item
   */
  const renderLogItem = ({ item }: { item: AuditLog }) => {
    const roleColor = getRoleBadgeColor(item.actorRole);

    return (
      <View style={styles.logCard}>
        {/* Header: Timestamp and Role Badge */}
        <View style={styles.logHeader}>
          <Text style={styles.timestamp}>
            {formatAuditTimestamp(item.timestamp)}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
            <Text style={styles.roleBadgeText}>
              {item.actorRole ? item.actorRole.toUpperCase() : 'UNKNOWN'}
            </Text>
          </View>
        </View>

        {/* Action Name */}
        <Text style={styles.actionName}>
          {getActionDisplayName(item.action)}
        </Text>

        {/* Actor Info */}
        <View style={styles.actorRow}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.actorText}>
            {item.actorName || 'Unknown'} ({item.actorId})
          </Text>
        </View>

        {/* Entity Info (if available) */}
        {item.entityType && (
          <View style={styles.entityRow}>
            <Ionicons name="document-text-outline" size={16} color="#666" />
            <Text style={styles.entityText}>
              {item.entityType}
              {item.entityId && `: ${item.entityId.substring(0, 20)}...`}
            </Text>
          </View>
        )}

        {/* Details (if available) */}
        {item.details && Object.keys(item.details).length > 0 && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsLabel}>Details:</Text>
            {Object.entries(item.details).slice(0, 3).map(([key, value]) => (
              <Text key={key} style={styles.detailsText}>
                • {key}: {String(value).substring(0, 40)}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  /**
   * Render filter options
   */
  const renderFilters = () => {
    if (!showFilters) return null;

    const actions: (AuditAction | 'all')[] = [
      'all',
      'USER_LOGIN',
      'USER_LOGOUT',
      'CREATE_BLOOD_REQUEST',
      'ACCEPT_BLOOD_REQUEST',
      'COMPLETE_BLOOD_REQUEST',
      'ACTIVATE_USER',
      'DEACTIVATE_USER',
    ];

    const roles: ('admin' | 'donor' | 'user' | 'all')[] = ['all', 'admin', 'donor', 'user'];

    return (
      <View style={styles.filtersContainer}>
        {/* Action Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Action:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {actions.map((action) => (
              <TouchableOpacity
                key={action}
                style={[
                  styles.filterChip,
                  selectedAction === action && styles.filterChipActive,
                ]}
                onPress={() => setSelectedAction(action)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedAction === action && styles.filterChipTextActive,
                  ]}
                >
                  {action === 'all' ? 'All Actions' : getActionDisplayName(action as AuditAction)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Role Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Role:</Text>
          <View style={styles.filterRow}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.filterChip,
                  selectedRole === role && styles.filterChipActive,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedRole === role && styles.filterChipTextActive,
                  ]}
                >
                  {role === 'all' ? 'All Roles' : (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="documents-outline" size={64} color="#CCC" />
      <Text style={styles.emptyText}>No audit logs found</Text>
      <Text style={styles.emptySubtext}>
        {selectedAction !== 'all' || selectedRole !== 'all'
          ? 'Try adjusting your filters'
          : 'Audit logs will appear here as users perform actions'}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Audit Logs</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading audit logs...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Logs</Text>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={styles.filterButton}
        >
          <Ionicons 
            name={showFilters ? "close" : "filter"} 
            size={24} 
            color="#DC143C" 
          />
        </TouchableOpacity>
      </View>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total Logs</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{logs.length}</Text>
          <Text style={styles.statLabel}>Displayed</Text>
        </View>
      </View>

      {/* Filters */}
      {renderFilters()}

      {/* Audit Logs List */}
      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color="#DC143C" />
              <Text style={styles.footerLoadingText}>Loading more...</Text>
            </View>
          ) : logs.length > 0 ? (
            <View style={styles.endMessage}>
              <Text style={styles.endMessageText}>✓ All logs loaded</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  filterButton: {
    padding: 8,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC143C',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#DC143C',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actorText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  entityText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
    marginTop: 8,
    textAlign: 'center',
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footerLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  endMessage: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endMessageText: {
    fontSize: 14,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});

export default AdminAuditLogs;

