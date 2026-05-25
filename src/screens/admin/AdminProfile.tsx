/**
 * Admin Profile Screen
 * 
 * Admin Profile Management
 * 
 * This screen allows administrators to:
 * - View their profile information
 * - Update email address (with verification code)
 * - Change password (with verification code)
 * - Manage account settings
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';

const AdminProfile: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();

  const [showEmailSection, setShowEmailSection] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Email update states
  const [newEmail, setNewEmail] = useState('');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // Password update states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVerificationCode, setPasswordVerificationCode] = useState('');
  const [passwordCodeSent, setPasswordCodeSent] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  /**
   * Send verification code for email update
   */
  const handleSendEmailCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      showAlert({
        type: 'error',
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
      });
      return;
    }

    try {
      setEmailLoading(true);
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          purpose: 'email_update',
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setEmailCodeSent(true);
        showAlert({
          type: 'success',
          title: 'Code Sent',
          message: `Verification code sent to ${newEmail}`,
        });
      } else {
        throw new Error(data.error || 'Failed to send code');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to send verification code',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  /**
   * Update email address
   */
  const handleUpdateEmail = async () => {
    if (!emailVerificationCode) {
      showAlert({
        type: 'error',
        title: 'Verification Required',
        message: 'Please enter the verification code',
      });
      return;
    }

    try {
      setEmailLoading(true);
      
      // Verify code
      const verifyResponse = await fetch('https://bdms-production-5878.up.railway.app/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          code: emailVerificationCode,
          purpose: 'email_update',
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Invalid verification code');
      }

      // Update email
      const updateResponse = await fetch(`https://bdms-production-5878.up.railway.app/api/admin/update-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          newEmail,
        }),
      });

      if (updateResponse.ok) {
        showAlert({
          type: 'success',
          title: 'Email Updated',
          message: 'Your email has been updated successfully. Logging out...',
        });
        // Reset states
        setShowEmailSection(false);
        setNewEmail('');
        setEmailVerificationCode('');
        setEmailCodeSent(false);
        
        // Force logout after 2 seconds so user can see the success message
        setTimeout(async () => {
          await logout();
        }, 2000);
      } else {
        throw new Error('Failed to update email');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update email',
      });
    } finally {
      setEmailLoading(false);
    }
  };

  /**
   * Send verification code for password change
   */
  const handleSendPasswordCode = async () => {
    if (!currentPassword) {
      showAlert({
        type: 'error',
        title: 'Current Password Required',
        message: 'Please enter your current password',
      });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showAlert({
        type: 'error',
        title: 'Invalid Password',
        message: 'New password must be at least 6 characters',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirm password do not match',
      });
      return;
    }

    try {
      setPasswordLoading(true);
      const response = await fetch('https://bdms-production-5878.up.railway.app/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          purpose: 'password_change',
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setPasswordCodeSent(true);
        showAlert({
          type: 'success',
          title: 'Code Sent',
          message: `Verification code sent to ${user?.email}`,
        });
      } else {
        throw new Error(data.error || 'Failed to send code');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to send verification code',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  /**
   * Change password
   */
  const handleChangePassword = async () => {
    if (!passwordVerificationCode) {
      showAlert({
        type: 'error',
        title: 'Verification Required',
        message: 'Please enter the verification code',
      });
      return;
    }

    try {
      setPasswordLoading(true);
      
      // Verify code
      const verifyResponse = await fetch('https://bdms-production-5878.up.railway.app/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          code: passwordVerificationCode,
          purpose: 'password_change',
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Invalid verification code');
      }

      // Change password
      const updateResponse = await fetch('https://bdms-production-5878.up.railway.app/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          newPassword,
        }),
      });

      if (updateResponse.ok) {
        showAlert({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully.',
        });
        // Reset states
        setShowPasswordSection(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordVerificationCode('');
        setPasswordCodeSent(false);
      } else {
        throw new Error('Failed to change password');
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to change password',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Profile Info Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={40} color="#DC143C" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>ADMINISTRATOR</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#666" />
            <Text style={styles.infoText}>{user?.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color="#666" />
            <Text style={styles.infoText}>System Administrator</Text>
          </View>
        </View>

        {/* Update Email Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowEmailSection(!showEmailSection)}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="mail-outline" size={24} color="#DC143C" />
              <Text style={styles.sectionTitle}>Update Email</Text>
            </View>
            <Ionicons
              name={showEmailSection ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#999"
            />
          </TouchableOpacity>

          {showEmailSection && (
            <View style={styles.sectionContent}>
              <Text style={styles.inputLabel}>New Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new email"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!emailCodeSent}
              />

              {emailCodeSent && (
                <>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    value={emailVerificationCode}
                    onChangeText={setEmailVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </>
              )}

              {emailLoading ? (
                <ActivityIndicator size="small" color="#DC143C" style={{ marginTop: 16 }} />
              ) : emailCodeSent ? (
                <TouchableOpacity style={styles.button} onPress={handleUpdateEmail}>
                  <Text style={styles.buttonText}>Update Email</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleSendEmailCode}>
                  <Text style={styles.buttonText}>Send Verification Code</Text>
                </TouchableOpacity>
              )}

              {emailCodeSent && (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => {
                    setEmailCodeSent(false);
                    setEmailVerificationCode('');
                  }}
                >
                  <Text style={styles.linkText}>Change Email Address</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Change Password Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="lock-closed-outline" size={24} color="#DC143C" />
              <Text style={styles.sectionTitle}>Change Password</Text>
            </View>
            <Ionicons
              name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#999"
            />
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.sectionContent}>
              {!passwordCodeSent && (
                <>
                  <Text style={styles.inputLabel}>Current Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                  />

                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />

                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </>
              )}

              {passwordCodeSent && (
                <>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    value={passwordVerificationCode}
                    onChangeText={setPasswordVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </>
              )}

              {passwordLoading ? (
                <ActivityIndicator size="small" color="#DC143C" style={{ marginTop: 16 }} />
              ) : passwordCodeSent ? (
                <TouchableOpacity style={styles.button} onPress={handleChangePassword}>
                  <Text style={styles.buttonText}>Change Password</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleSendPasswordCode}>
                  <Text style={styles.buttonText}>Send Verification Code</Text>
                </TouchableOpacity>
              )}

              {passwordCodeSent && (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => {
                    setPasswordCodeSent(false);
                    setPasswordVerificationCode('');
                  }}
                >
                  <Text style={styles.linkText}>Re-enter Password</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#DC143C',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  button: {
    backgroundColor: '#DC143C',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#DC143C',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminProfile;

