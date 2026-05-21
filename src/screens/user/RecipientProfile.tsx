import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { RootStackParamList } from '../../navigation/types';
import { API_BASE_URL } from '../../services/api';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RecipientProfile'>;

/**
 * RecipientProfile
 * 
 * Screen for recipient to manage their profile and change password
 */
export default function RecipientProfile() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /**
   * Send verification code to email
   */
  const handleSendCode = async () => {
    if (!user?.email) {
      showAlert({ title: 'Error', message: 'Email not found', type: 'error' });
      return;
    }

    if (!currentPassword) {
      showAlert({ title: 'Error', message: 'Please enter your current password', type: 'error' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showAlert({ title: 'Error', message: 'New password must be at least 6 characters', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({ title: 'Error', message: 'Passwords do not match', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          purpose: 'password_change',
        }),
      });

      const data = await response.json();
      console.log('✅ Send verification response:', data);

      if (data.success) {
        setCodeSent(true);
        showAlert({ title: 'Success', message: data.message || 'Verification code sent to your email', type: 'success' });
      } else {
        showAlert({ title: 'Error', message: data.error || 'Failed to send verification code', type: 'error' });
      }
    } catch (error) {
      console.error('❌ Error sending verification code:', error);
      showAlert({ title: 'Error', message: 'Failed to send verification code. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verify code and update password
   */
  const handleUpdatePassword = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showAlert({ title: 'Error', message: 'Please enter the 6-digit verification code', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // First, verify the code
      const verifyResponse = await fetch(`${API_BASE_URL}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          code: verificationCode,
          purpose: 'password_change',
        }),
      });

      const verifyData = await verifyResponse.json();
      console.log('✅ Verify code response:', verifyData);

      if (!verifyData.success) {
        showAlert({ title: 'Error', message: verifyData.error || 'Invalid verification code', type: 'error' });
        setLoading(false);
        return;
      }

      // Verify current password and update to new password
      const updateResponse = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          currentPassword,
          newPassword,
        }),
      });

      const updateData = await updateResponse.json();
      console.log('✅ Update password response:', updateData);

      if (updateData.success) {
        showAlert({ title: 'Success', message: updateData.message || 'Password updated successfully', type: 'success' });
        
        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCodeSent(false);
        
        // Navigate back after a short delay
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      } else {
        showAlert({ title: 'Error', message: updateData.error || 'Failed to update password', type: 'error' });
      }
    } catch (error: any) {
      console.error('❌ Error updating password:', error);
      showAlert({ title: 'Error', message: error.message || 'Failed to update password. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* User Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#DC143C" />
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>RECIPIENT</Text>
          </View>
        </View>

        {/* Change Password Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed" size={24} color="#DC143C" />
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#999"
                secureTextEntry={!showCurrentPassword}
                editable={!codeSent}
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 6 characters)"
                placeholderTextColor="#999"
                secureTextEntry={!showNewPassword}
                editable={!codeSent}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirmPassword}
                editable={!codeSent}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Send Verification Code Button */}
          {!codeSent && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="mail" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Send Verification Code</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Verification Code Input */}
          {codeSent && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.helperText}>
                  Check your email for the verification code
                </Text>
              </View>

              {/* Update Password Button */}
              <TouchableOpacity
                style={[styles.button, styles.successButton]}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setCodeSent(false);
                  setVerificationCode('');
                  handleSendCode();
                }}
                disabled={loading}
              >
                <Text style={styles.linkButtonText}>Resend Code</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#DC143C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2196F3',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  eyeIcon: {
    padding: 14,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#DC143C',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC143C',
  },
});

