import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAlert } from '../../context/AlertContext';

/**
 * User Interface for Admin Panel
 * 
 * This interface represents a user in the system with their profile status
 * Used for admin-level user management operations
 */
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'donor' | 'user'; // 'user' = recipient
  account_status?: string;
  deactivation_reason?: string;
  created_at: number;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  bloodGroup?: string;
  mobile?: string;
  city?: string;
}

/**
 * ManageUsers Screen
 * 
 * Admin screen to view and manage all registered users in the system
 * 
 * ADMIN RESPONSIBILITIES:
 * - View complete list of registered donors and recipients
 * - Filter users by role (donor/recipient/all)
 * - Search users by name or email
 * - View user details including approval status
 * - Monitor user registration trends
 * 
 * ROLE-BASED ACCESS CONTROL (RBAC):
 * - Only accessible to users with role = 'admin'
 * - Enforced at navigation level
 * - Additional server-side validation recommended for production
 */
const ManageUsers: React.FC = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'donor' | 'user'>('all');
  const [pendingAppealsCount, setPendingAppealsCount] = useState(0);

  useEffect(() => {
    loadUsers();
    loadAppealsCount();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, selectedFilter]);

  /**
   * Load all registered users from backend
   * 
   * Note: Uses GET /api/users endpoint
   * In production, this should be paginated for large datasets
   */
  const loadUsers = async () => {
    try {
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/users');
      const data = await response.json();

      if (data.users) {
        // Map and enhance user data
        const enhancedUsers = data.users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          account_status: user.account_status || 'active',
          deactivation_reason: user.deactivation_reason,
          created_at: user.created_at,
        }));

        setUsers(enhancedUsers);
        console.log(`✅ [Admin] Loaded ${enhancedUsers.length} users`);
      }
    } catch (error: any) {
      console.error('❌ [Admin] Error loading users:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load users',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Load pending appeals count
   */
  const loadAppealsCount = async () => {
    try {
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/admin/appeals');
      const data = await response.json();

      if (data.success && data.appeals) {
        setPendingAppealsCount(data.appeals.length);
        console.log(`✅ [Admin] ${data.appeals.length} pending appeals`);
      }
    } catch (error: any) {
      console.error('❌ [Admin] Error loading appeals count:', error);
    }
  };

  /**
   * Apply search and filter to user list
   * 
   * Note: Client-side filtering for responsive UI
   * For large datasets, implement server-side filtering
   */
  const applyFilters = () => {
    let filtered = users;

    // Apply role filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(user => user.role === selectedFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        user =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  };

  /**
   * Refresh user list
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUsers();
  };

  /**
   * Format timestamp to readable date
   */
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Get role badge color
   */
  const getRoleBadgeStyle = (role: string) => {
    return role === 'donor' 
      ? { backgroundColor: '#FFEBEE', color: '#DC143C' }
      : { backgroundColor: '#E3F2FD', color: '#2196F3' };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading users...</Text>
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
          <Text style={styles.headerTitle}>Manage Users</Text>
          <Text style={styles.headerSubtitle}>
            {filteredUsers.length} {selectedFilter === 'all' ? 'total' : selectedFilter === 'donor' ? 'donors' : 'recipients'}
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
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Appeals Banner */}
        {pendingAppealsCount > 0 && (
          <TouchableOpacity
            style={styles.appealsBanner}
            onPress={() => navigation.navigate('AppealsList' as never)}
          >
            <View style={styles.appealsIcon}>
              <Ionicons name="document-text" size={28} color="#FF9800" />
              {pendingAppealsCount > 0 && (
                <View style={styles.appealsBadge}>
                  <Text style={styles.appealsBadgeText}>{pendingAppealsCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.appealsContent}>
              <Text style={styles.appealsTitle}>Pending Appeals</Text>
              <Text style={styles.appealsSubtitle}>
                {pendingAppealsCount} user{pendingAppealsCount !== 1 ? 's' : ''} requesting account reactivation
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FF9800" />
          </TouchableOpacity>
        )}

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
              All ({users.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'donor' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('donor')}
          >
            <Text style={[styles.filterText, selectedFilter === 'donor' && styles.filterTextActive]}>
              Donors ({users.filter(u => u.role === 'donor').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, selectedFilter === 'user' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('user')}
          >
            <Text style={[styles.filterText, selectedFilter === 'user' && styles.filterTextActive]}>
              Recipients ({users.filter(u => u.role === 'user').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={24} color="#DC143C" />
            <Text style={styles.statValue}>{users.length}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="water" size={24} color="#DC143C" />
            <Text style={styles.statValue}>{users.filter(u => u.role === 'donor').length}</Text>
            <Text style={styles.statLabel}>Donors</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="medkit" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{users.filter(u => u.role === 'user').length}</Text>
            <Text style={styles.statLabel}>Recipients</Text>
          </View>
        </View>

        {/* Users List */}
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try adjusting your search' : 'No registered users yet'}
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                onPress={() => navigation.navigate('UserProfileDetail' as never, { userId: user.id } as never)}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userIconContainer}>
                    <Ionicons
                      name={user.role === 'donor' ? 'water' : 'medkit'}
                      size={24}
                      color={user.role === 'donor' ? '#DC143C' : '#2196F3'}
                    />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                  {user.account_status === 'deactivated' && (
                    <View style={styles.deactivatedBadge}>
                      <Ionicons name="ban" size={16} color="#F44336" />
                    </View>
                  )}
                </View>

                <View style={styles.userDetails}>
                  <View style={styles.userDetailRow}>
                    <Ionicons name="calendar" size={16} color="#666" />
                    <Text style={styles.userDetailText}>
                      Registered: {formatDate(user.created_at)}
                    </Text>
                  </View>
                  <View style={[
                    styles.roleBadge,
                    getRoleBadgeStyle(user.role)
                  ]}>
                    <Text style={[styles.roleBadgeText, { color: getRoleBadgeStyle(user.role).color }]}>
                      {user.role === 'donor' ? 'DONOR' : 'RECIPIENT'}
                    </Text>
                  </View>
                </View>

                {/* Deactivation Notice */}
                {user.account_status === 'deactivated' && (
                  <View style={styles.deactivatedNotice}>
                    <Ionicons name="warning" size={14} color="#F44336" />
                    <Text style={styles.deactivatedText}>Account Deactivated</Text>
                  </View>
                )}

                {/* View Details Indicator */}
                <View style={styles.viewDetailsIndicator}>
                  <Text style={styles.viewDetailsText}>Tap to view details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Total Registered Users: {users.length}
          </Text>
        </View>
      </ScrollView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
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
  appealsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appealsIcon: {
    position: 'relative',
    marginRight: 12,
  },
  appealsBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  appealsBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  appealsContent: {
    flex: 1,
  },
  appealsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  appealsSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 20,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
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
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userDetailText: {
    fontSize: 13,
    color: '#666',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  deactivatedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deactivatedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12,
  },
  deactivatedText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
  },
  viewDetailsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});

export default ManageUsers;

