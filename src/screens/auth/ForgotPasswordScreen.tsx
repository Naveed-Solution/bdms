import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import * as EmailService from '../../services/emailService';
import { API_BASE_URL } from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

/**
 * ForgotPasswordScreen Component
 * 
 * Allows users to reset their password by email
 * 1. Check if email is registered in the database
 * 2. Send verification code to the email
 * 3. Verify the code
 * 4. Allow user to set new password
 */
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { resetPassword } = useAuth();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState((route.params as any)?.email || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>(
    (route.params as any)?.email ? 'verify' : 'email'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  /**
   * Check if email is registered in the database
   */
  const checkEmailExists = async (emailToCheck: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to check email');
      }
      
      const data = await response.json();
      // For password reset, we want emails that are NOT available (i.e., already registered)
      return !data.available;
    } catch (error) {
      console.error('Email check error:', error);
      throw new Error('Unable to verify email. Please check your internet connection and try again.');
    }
  };

  /**
   * Check if account exists and send verification code
   */
  const handleSendCode = async () => {
    // Validate email
    if (!email.trim()) {
      showAlert({
        type: 'warning',
        title: 'Email Required',
        message: 'Please enter your email address',
      });
      return;
    }

    if (!email.includes('@')) {
      showAlert({
        type: 'warning',
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
      });
      return;
    }

    try {
      setIsSendingCode(true);
      
      // Check if email is registered in the database
      const emailExists = await checkEmailExists(email.trim());
      
      if (!emailExists) {
        showAlert({
          type: 'error',
          title: 'Email Not Found',
          message: 'This email address is not registered in our system. Please check your email or create a new account.',
          buttons: [
            { text: 'Try Again', style: 'default' },
            { 
              text: 'Create Account', 
              style: 'cancel',
              onPress: () => navigation.navigate('Register')
            }
          ]
        });
        setIsSendingCode(false);
        return;
      }
      
      // Send verification code via email for password reset
      const result = await EmailService.sendVerificationCode(email.trim(), 'password-reset');
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send verification code');
      }
      
      showAlert({
        type: 'success',
        title: 'Verification Code Sent!',
        message: `A 6-digit verification code has been sent to:\n${email}\n\nPlease check your email inbox.`,
      });

      setStep('verify');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification code';
      
      showAlert({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  /**
   * Verify the code entered by user
   */
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      showAlert({
        type: 'warning',
        title: 'Code Required',
        message: 'Please enter the verification code',
      });
      return;
    }

    if (verificationCode.length !== 6) {
      showAlert({
        type: 'warning',
        title: 'Invalid Code',
        message: 'Verification code must be 6 digits',
      });
      return;
    }

    try {
      setIsVerifying(true);
      
      // Verify code with backend
      const result = await EmailService.verifyCode(email.trim(), verificationCode);
      
      if (!result.success) {
        throw new Error(result.error || 'Invalid verification code');
      }
      
      showAlert({
        type: 'success',
        title: 'Code Verified!',
        message: 'You can now reset your password',
      });
      
      setStep('reset');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      
      showAlert({
        type: 'error',
        title: 'Verification Failed',
        message: errorMessage,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Reset password with new password
   */
  const handleResetPassword = async () => {
    // Validate passwords
    if (!newPassword) {
      showAlert({
        type: 'warning',
        title: 'Password Required',
        message: 'Please enter your new password',
      });
      return;
    }

    if (newPassword.length < 6) {
      showAlert({
        type: 'warning',
        title: 'Password Too Short',
        message: 'Password must be at least 6 characters',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        type: 'warning',
        title: 'Passwords Do Not Match',
        message: 'Please make sure both passwords match',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Update password in the database
      await resetPassword(email.trim(), newPassword);

      showAlert({
        type: 'success',
        title: 'Password Reset Successful!',
        message: 'Your password has been reset successfully. You can now login with your new password.',
        buttons: [
          { 
            text: 'Go to Login',
            onPress: () => navigation.navigate('Login')
          }
        ]
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
      showAlert({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 'email' && 'Enter your registered email to receive verification code'}
            {step === 'verify' && 'Enter the 6-digit code sent to your email'}
            {step === 'reset' && 'Enter your new password'}
          </Text>
        </View>

        {/* Step 1: Email Input */}
        {step === 'email' && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your registered email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isSendingCode}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, isSendingCode && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={isSendingCode}
            >
              {isSendingCode ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: Verification Code */}
        {step === 'verify' && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isVerifying}
                autoFocus
              />
              <Text style={styles.hint}>Code sent to {email}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.button, isVerifying && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={handleSendCode}
              disabled={isSendingCode}
            >
              <Text style={styles.linkText}>Resend Code</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: New Password */}
        {step === 'reset' && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!isLoading}
                autoFocus
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Back to Login */}
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('Login')}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#DC143C',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#DC143C',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  secondaryButtonText: {
    color: '#DC143C',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    padding: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#DC143C',
    fontSize: 14,
    fontWeight: '600',
  },
});

