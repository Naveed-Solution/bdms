import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { profileAPI, mobileAPI } from '../../services/api';

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * Recipient Profile Form Screen
 * 
 * Comprehensive form for recipients to complete their profile
 * Required fields for admin approval:
 * - Profile Image
 * - Mobile Number (verified)
 * - Address, City, Zipcode
 * - CNIC (Optional)
 */
const RecipientProfileForm: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Profile Image
  const [profileImage, setProfileImage] = useState<string>('');

  // Personal Information
  const [mobile, setMobile] = useState<string>('');
  const [cnic, setCnic] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [zipcode, setZipcode] = useState<string>('');

  // Mobile field (verification removed as per user request)
  const [isMobileVerified] = useState(true); // Auto-verified for simplicity

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Existing Profile
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load existing profile on mount
   */
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      console.log('📥 Loading recipient profile for user:', user.id);
      const response = await profileAPI.getRecipientProfile(user.id);
      console.log('📦 Profile response:', response);
      
      if (response.success && response.profile) {
        const profile = response.profile;
        console.log('✅ Profile data received:', {
          mobile: profile.mobile,
          address: profile.address,
          city: profile.city,
          zipcode: profile.zipcode
        });
        
        setExistingProfile(profile);
        setProfileImage(profile.profile_image || profile.profileImage || '');
        setMobile(profile.mobile || '');
        // Mobile verification removed - no need to set isMobileVerified
        setCnic(profile.cnic || '');
        setAddress(profile.address || '');
        setCity(profile.city || '');
        setZipcode(profile.zipcode || '');
        
        console.log('✅ State updated with profile data');
      }
    } catch (error: any) {
      console.log('❌ Error loading profile:', error);
      console.log('No existing profile found or error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request camera/gallery permissions and pick image
   */
  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert({
          type: 'warning',
          title: 'Permission Required',
          message: 'Please grant permission to access your photos',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, // Enable base64 encoding
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // ALWAYS use base64 to ensure persistence across app restarts
        if (asset.base64) {
          const base64Image = `data:image/jpeg;base64,${asset.base64}`;
          setProfileImage(base64Image);
          console.log(`✅ [Profile Image] Base64 saved: ${base64Image.length} characters`);
        } else {
          // This should not happen since base64: true, but just in case
          console.error('❌ [Profile Image] Base64 not available! Using URI as fallback (will not persist)');
          showAlert({
            type: 'warning',
            title: 'Image Warning',
            message: 'Image may not persist after app restart. Please try selecting again.',
          });
          setProfileImage(asset.uri);
        }
        
        setErrors({ ...errors, profileImage: '' });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to select image',
      });
    }
  };

  /**
   * Send verification code to mobile
   */
  // Mobile verification functions removed - simplified mobile input

  /**
   * Validate form
   */
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!profileImage) newErrors.profileImage = 'Profile image is required';
    if (!mobile) newErrors.mobile = 'Mobile number is required';
    else if (!mobile.match(/^92\d{10}$/)) newErrors.mobile = 'Invalid format (92xxxxxxxxxx)';
    // Mobile verification removed as per user request
    if (!address.trim()) newErrors.address = 'Address is required';
    if (!city.trim()) newErrors.city = 'City is required';
    if (!zipcode.trim()) newErrors.zipcode = 'Zipcode is required';
    if (cnic && !cnic.match(/^\d{13}$/)) {
      newErrors.cnic = 'CNIC must be 13 digits (without dashes)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Submit profile
   */
  const handleSubmit = async () => {
    if (!validateForm() || !user) return;

    try {
      setIsSubmitting(true);

      const profileData = {
        userId: user.id,
        profileImage,
        mobile,
        mobileVerified: true,
        cnic: cnic.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        zipcode: zipcode.trim(),
      };

      const response = await profileAPI.saveRecipientProfile(profileData);

      if (response.success) {
        showAlert({
          type: 'success',
          title: 'Profile Submitted',
          message: 'Your profile has been submitted for admin approval. You will be notified once approved.',
        });
        navigation.goBack();
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Submission Failed',
        message: error.message || 'Failed to save profile. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="person-circle" size={48} color="#DC143C" />
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <Text style={styles.headerSubtitle}>
            Fill in all required details for admin approval
          </Text>
          {existingProfile?.approval_status === 'REJECTED' && (
            <View style={styles.rejectionCard}>
              <Ionicons name="alert-circle" size={20} color="#F44336" />
              <Text style={styles.rejectionText}>
                Profile Rejected: {existingProfile.admin_remarks || 'Please update your information'}
              </Text>
            </View>
          )}
        </View>

        {/* Full Name (Read-Only) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Name</Text>
          <View style={[styles.input, styles.inputReadOnly]}>
            <Text style={styles.inputReadOnlyText}>{user?.name || 'N/A'}</Text>
          </View>
          <Text style={styles.helperText}>From your account</Text>
        </View>

        {/* Email (Read-Only) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Address</Text>
          <View style={[styles.input, styles.inputReadOnly]}>
            <Ionicons name="mail" size={16} color="#999" style={{ marginRight: 8 }} />
            <Text style={styles.inputReadOnlyText}>{user?.email || 'N/A'}</Text>
          </View>
          <Text style={styles.helperText}>Email cannot be changed</Text>
        </View>

        {/* Profile Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Profile Photo <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity 
            style={styles.imagePickerButton} 
            onPress={handleImagePicker}
            activeOpacity={0.7}
          >
            {profileImage && profileImage.trim() !== '' ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={40} color="#999" />
                <Text style={styles.imagePlaceholderText}>Tap to upload photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {errors.profileImage && (
            <Text style={styles.errorText}>{errors.profileImage}</Text>
          )}
        </View>

        {/* Mobile Number */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Mobile Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.mobile && styles.inputError]}
            placeholder="92xxxxxxxxxx (Pakistan)"
            value={mobile}
            onChangeText={(text) => {
              setMobile(text);
              setErrors({ ...errors, mobile: '' });
            }}
            keyboardType="phone-pad"
            maxLength={12}
          />
          {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}
          <Text style={styles.helperText}>
            Format: 92xxxxxxxxxx (e.g., 923001234567)
          </Text>
        </View>

        {/* CNIC (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CNIC (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="13 digits without dashes"
            value={cnic}
            onChangeText={(text) => {
              setCnic(text.replace(/[^0-9]/g, ''));
              setErrors({ ...errors, cnic: '' });
            }}
            keyboardType="numeric"
            maxLength={13}
          />
          {errors.cnic && <Text style={styles.errorText}>{errors.cnic}</Text>}
          <Text style={styles.helperText}>
            Example: 3520212345678
          </Text>
        </View>

        {/* Complete Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Complete Address <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="House #, Street, Area"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setErrors({ ...errors, address: '' });
            }}
            multiline
            numberOfLines={3}
          />
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>

        {/* City & Zipcode */}
        <View style={styles.row}>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.sectionTitle}>
              City <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Lahore"
              value={city}
              onChangeText={(text) => {
                setCity(text);
                setErrors({ ...errors, city: '' });
              }}
            />
            {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
          </View>

          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.sectionTitle}>
              Zipcode <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="54000"
              value={zipcode}
              onChangeText={(text) => {
                setZipcode(text);
                setErrors({ ...errors, zipcode: '' });
              }}
              keyboardType="numeric"
              maxLength={6}
            />
            {errors.zipcode && <Text style={styles.errorText}>{errors.zipcode}</Text>}
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>
                {existingProfile ? 'Update Profile' : 'Submit for Approval'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#DC143C" />
          <Text style={styles.infoText}>
            Your profile will be reviewed by admin. Once approved, you can create blood requests.
          </Text>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  rejectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: '#F44336',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  inputReadOnly: {
    backgroundColor: '#f5f5f5',
    borderColor: '#d0d0d0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputReadOnlyText: {
    fontSize: 16,
    color: '#666',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  imagePickerButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#DC143C',
    borderStyle: 'dashed',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  mobileContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  mobileInput: {
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  verifiedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#DC143C',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  devCodeBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  devCodeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  devCodeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    letterSpacing: 4,
  },
  codeInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#DC143C',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RecipientProfileForm;

