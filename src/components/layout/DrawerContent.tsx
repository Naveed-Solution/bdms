import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DrawerMenuItem {
  label: string;
  icon: string;
  onPress: () => void;
  badge?: number;
}

interface DrawerContentProps {
  role: 'admin' | 'donor' | 'recipient';
  userName: string;
  userEmail: string;
  profileStatus: 'approved' | 'pending' | 'rejected' | 'none' | 'loading';
  menuItems: DrawerMenuItem[];
  onLogout: () => void;
}

/**
 * DrawerContent Component
 * 
 * Unified sidebar/drawer content for all roles.
 * Consistent structure across Admin, Donor, Recipient.
 * 
 * Layout:
 * - User Info Card (avatar, name, role, email)
 * - Divider
 * - Menu Items (dynamic based on role)
 * - Divider
 * - Logout Button
 * - Footer
 */
export default function DrawerContent({
  role,
  userName,
  userEmail,
  profileStatus,
  menuItems,
  onLogout,
}: DrawerContentProps) {
  const getRoleText = () => {
    switch (role) {
      case 'admin':
        return 'System Administrator';
      case 'donor':
        return profileStatus === 'approved'
          ? 'Approved Donor'
          : profileStatus === 'pending'
          ? 'Pending Approval'
          : profileStatus === 'rejected'
          ? 'Profile Rejected'
          : 'Donor';
      case 'recipient':
        return profileStatus === 'approved'
          ? 'Approved Recipient'
          : profileStatus === 'pending'
          ? 'Pending Approval'
          : profileStatus === 'rejected'
          ? 'Profile Rejected'
          : 'Recipient';
      default:
        return 'User';
    }
  };

  const getRoleIndicatorColor = () => {
    switch (profileStatus) {
      case 'approved':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getAvatarIcon = () => {
    switch (role) {
      case 'admin':
        return 'shield-checkmark';
      case 'donor':
        return 'water';
      case 'recipient':
        return 'person';
      default:
        return 'person-circle';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <View style={styles.menuHeader}>
          <View style={styles.profileCard}>
            <View style={styles.menuAvatar}>
              <Ionicons name={getAvatarIcon() as any} size={36} color="#DC143C" />
            </View>
            <View style={styles.menuUserInfo}>
              <Text style={styles.menuUserName}>{userName}</Text>
              <View style={styles.roleContainer}>
                <View
                  style={[
                    styles.roleIndicator,
                    { backgroundColor: getRoleIndicatorColor() },
                  ]}
                />
                <Text style={styles.menuUserRole}>{getRoleText()}</Text>
              </View>
              <View style={styles.emailContainer}>
                <Ionicons name="mail" size={12} color="#999" />
                <Text style={styles.menuUserEmail}>{userEmail}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.menuDivider} />

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemIcon}>
                <Ionicons name={item.icon as any} size={22} color="#1A1A1A" />
              </View>
              <Text style={styles.menuItemText}>{item.label}</Text>
              {item.badge && item.badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.menuDivider} />

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemDanger]}
          onPress={onLogout}
        >
          <View style={styles.menuItemIcon}>
            <Ionicons name="log-out" size={22} color="#DC143C" />
          </View>
          <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
            Logout
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={styles.menuFooter}>
        <Text style={styles.menuFooterText}>BDMS v1.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  menuHeader: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  profileCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#DC143C',
  },
  menuUserInfo: {
    marginTop: 0,
  },
  menuUserName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  roleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuUserRole: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  menuUserEmail: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 8,
  },
  menuSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
    flex: 1,
  },
  menuBadge: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  menuItemDanger: {
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  menuItemTextDanger: {
    color: '#DC143C',
  },
  menuFooter: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    alignItems: 'center',
  },
  menuFooterText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
