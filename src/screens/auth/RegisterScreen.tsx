import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  ActivityIndicator,
  Modal
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, UserRole } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import * as EmailService from '../../services/emailService';
import { API_BASE_URL } from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const { showAlert } = useAlert();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  
  // Email verification states
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    verification: '',
  });

  const roleOptions: { value: UserRole; label: string; description: string }[] = [
    { 
      value: 'donor', 
      label: 'Donor', 
      description: 'I want to donate blood' 
    },
    { 
      value: 'user', 
      label: 'Recipient', 
      description: 'I need blood or want to search donors' 
    },
  ];

  const selectRole = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setErrors({ ...errors, role: '' });
    setShowRolePicker(false);
  };

  /**
   * Check if email is already registered
   */
  const checkEmailAvailability = async (emailToCheck: string): Promise<boolean> => {
    try {
      // This calls the backend to check if email exists
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to check email availability');
      }
      
      const data = await response.json();
      return data.available;
    } catch (error) {
      console.error('Email check error:', error);
      throw new Error('Unable to verify email availability. Please check your internet connection and try again.');
    }
  };

  /**
   * Send verification code to email
   */
  const handleSendVerificationCode = async () => {
    // Validate name, role, and email before sending code
    const newErrors = { ...errors };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
      showAlert({
        type: 'warning',
        title: 'Name Required',
        message: 'Please enter your name first',
      });
    }

    if (!role) {
      newErrors.role = 'Role is required';
      isValid = false;
      showAlert({
        type: 'warning',
        title: 'Role Required',
        message: 'Please select your role first',
      });
      setErrors(newErrors);
      return;
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) {
      return;
    }

    try {
      setIsSendingCode(true);
      setErrors({ ...errors, email: '', verification: '' });

      // Check if email is already registered BEFORE sending verification code
      const isAvailable = await checkEmailAvailability(email.trim());
      
      if (!isAvailable) {
        setIsSendingCode(false);
        showAlert({
          type: 'error',
          title: 'Email Already Registered',
          message: 'This email address is already registered in our system. Please use a different email or go back to login.',
          buttons: [
            { text: 'Use Different Email', style: 'default' },
            { 
              text: 'Go to Login', 
              style: 'cancel',
              onPress: () => navigation.goBack()
            }
          ]
        });
        setErrors({ ...errors, email: 'This email is already registered' });
        return;
      }

      // Send email via backend
      const result = await EmailService.sendVerificationCode(email.trim(), 'registration');

      if (!result.success) {
        throw new Error(result.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      showAlert({
        type: 'success',
        title: 'Verification Code Sent!',
        message: `A 6-digit code has been sent to:\n${email}\n\nPlease check your email inbox.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send code';
      setErrors({ ...errors, email: errorMessage });
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
      setErrors({ ...errors, verification: 'Please enter the verification code' });
      return;
    }

    if (verificationCode.length !== 6) {
      setErrors({ ...errors, verification: 'Code must be 6 digits' });
      return;
    }

    try {
      setIsVerifying(true);
      setErrors({ ...errors, verification: '' });

      const result = await EmailService.verifyCode(email.trim(), verificationCode);

      if (!result.success) {
        throw new Error(result.error || 'Invalid verification code');
      }

      setEmailVerified(true);
      showAlert({
        type: 'success',
        title: 'Email Verified!',
        message: 'You can now complete your registration',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setErrors({ ...errors, verification: errorMessage });
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Handle registration submission (only enabled after email verification)
   */
  const handleRegister = async () => {
    if (!emailVerified) {
      showAlert({
        type: 'warning',
        title: 'Email Not Verified',
        message: 'Please verify your email first',
      });
      return;
    }

    // Validate other fields
    const newErrors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
      verification: '',
    };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (!role) {
      newErrors.role = 'Please select your role';
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) {
      return;
    }

    try {
      setIsRegistering(true);
      
      // Register user (email already verified)
      await register(name.trim(), email.trim(), password, role);

      // Show success message
      showAlert({
        type: 'success',
        title: 'Registration Successful!',
        message: `Welcome ${name.trim()}! Your account has been created and you are now logged in.`,
      });

      // Auto-login successful, navigation happens via AuthContext
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      showAlert({
        type: 'error',
        title: 'Registration Error',
        message: errorMessage,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join our blood donation community</Text>
      </View>

      {/* Name Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Enter your full name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setErrors({ ...errors, name: '' });
          }}
          autoComplete="name"
          editable={!isRegistering && !emailVerified && !codeSent}
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
      </View>

      {/* Role Selection */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Select Your Role *</Text>
        <TouchableOpacity
          style={[styles.input, styles.roleSelector, errors.role && styles.inputError]}
          onPress={() => setShowRolePicker(true)}
          disabled={isRegistering || emailVerified || codeSent}
        >
          <Text style={role ? styles.roleText : styles.placeholderText}>
            {role ? roleOptions.find(r => r.value === role)?.label : 'Select your role'}
          </Text>
        </TouchableOpacity>
        {errors.role ? <Text style={styles.errorText}>{errors.role}</Text> : null}
        {emailVerified && (
          <Text style={styles.successText}>✓ Role selected</Text>
        )}
      </View>

      {/* Email Input with Verify Button */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Email Address {emailVerified && <Text style={styles.successText}>✓ Verified</Text>}
        </Text>
        <View style={styles.emailRow}>
          <TextInput
            style={[
              styles.input, 
              styles.emailInput, 
              errors.email && styles.inputError,
              emailVerified && styles.inputSuccess
            ]}
            placeholder="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors({ ...errors, email: '' });
              setCodeSent(false);
              setEmailVerified(false);
              setVerificationCode('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!emailVerified && !isSendingCode}
          />
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (emailVerified || isSendingCode) && styles.verifyButtonDisabled
            ]}
            onPress={handleSendVerificationCode}
            disabled={emailVerified || isSendingCode}
          >
            {isSendingCode ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>
                {emailVerified ? '✓ Verified' : codeSent ? 'Resend' : 'Verify'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      </View>

      {/* Verification Code Input (shown after code is sent) */}
      {codeSent && !emailVerified && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Enter Verification Code</Text>
          <TextInput
            style={[styles.input, errors.verification && styles.inputError]}
            placeholder="Enter 6-digit code from email"
            value={verificationCode}
            onChangeText={(text) => {
              setVerificationCode(text.replace(/[^0-9]/g, ''));
              setErrors({ ...errors, verification: '' });
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!isVerifying}
            autoFocus
          />
          {errors.verification ? <Text style={styles.errorText}>{errors.verification}</Text> : null}
          <Text style={styles.infoText}>
            Check your email inbox for the 6-digit verification code
          </Text>
          
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
        </View>
      )}

      {/* Password Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Enter password (min 6 characters)"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors({ ...errors, password: '' });
          }}
          secureTextEntry
          autoCapitalize="none"
          editable={!isRegistering}
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            setErrors({ ...errors, confirmPassword: '' });
          }}
          secureTextEntry
          autoCapitalize="none"
          editable={!isRegistering}
        />
        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
      </View>

      {/* Register Button (only shown after email is verified) */}
      {emailVerified && (
        <TouchableOpacity 
          style={[styles.button, isRegistering && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isRegistering}
        >
          {isRegistering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Complete Registration</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Back to Login */}
      {!codeSent && (
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.goBack()}
          disabled={isRegistering}
        >
          <Text style={styles.secondaryButtonText}>Already have an account? Login</Text>
        </TouchableOpacity>
      )}

      {/* Role Selection Modal */}
      <Modal
        visible={showRolePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRolePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Role</Text>
            <Text style={styles.modalSubtitle}>This determines your access level</Text>
            
            {roleOptions.map((option) => (
              <TouchableOpacity
                key={option.value || 'null'}
                style={[
                  styles.roleOption,
                  role === option.value && styles.roleOptionSelected
                ]}
                onPress={() => selectRole(option.value)}
              >
                <View style={styles.roleOptionContent}>
                  <Text style={[
                    styles.roleOptionLabel,
                    role === option.value && styles.roleOptionLabelSelected
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.roleOptionDescription}>
                    {option.description}
                  </Text>
                </View>
                {role === option.value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowRolePicker(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
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
  inputError: {
    borderColor: '#f44336',
  },
  inputSuccess: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 5,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 5,
  },
  infoText: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emailInput: {
    flex: 1,
  },
  verifyButton: {
    height: 50,
    backgroundColor: '#DC143C',
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#999',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  roleSelector: {
    justifyContent: 'center',
  },
  roleText: {
    color: '#333',
    fontSize: 16,
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
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
    opacity: 0.5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  roleOption: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: '#ffebee',
    borderColor: '#DC143C',
  },
  roleOptionContent: {
    flex: 1,
  },
  checkmark: {
    fontSize: 24,
    color: '#DC143C',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  roleOptionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  roleOptionLabelSelected: {
    color: '#DC143C',
  },
  roleOptionDescription: {
    fontSize: 14,
    color: '#666',
  },
  modalCloseButton: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});
