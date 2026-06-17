import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { respectAPI } from '../../services/api';

type NavigationProp = StackNavigationProp<RootStackParamList, 'RatingScreen'>;
type RouteParams = RouteProp<RootStackParamList, 'RatingScreen'>;

/**
 * Rating Screen
 * 
 * Allows users to rate each other after completing a donation
 * Shown after marking request as complete
 */
const RatingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const { requestId, donorId, donorName, recipientName, recipientId, raterRole } = route.params;
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDonor = (raterRole || user?.role) === 'donor';
  const otherPersonName = isDonor ? (recipientName || 'Recipient') : (donorName || 'Donor');
  // recipientId comes from LiveTrackingScreen's raterRole flow
  const resolvedRecipientId = recipientId || route.params.recipientId || '';

  /**
   * Handle star rating selection
   */
  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
  };

  /**
   * Handle skip rating
   */
  const handleSkip = async () => {
    setIsSubmitting(true);

    try {
      // Mark rating as skipped in database
      await respectAPI.skipRating({
        requestId,
        donorId,
        recipientId: route.params.recipientId,
        raterRole: user?.role === 'donor' ? 'donor' : 'recipient',
      });

      console.log('⏭️ [Rating] Rating skipped successfully');

      showAlert({
        type: 'info',
        title: 'Rating Skipped',
        message: 'You can rate this donation from your history later.',
      });
      
      // Navigate to history
      setTimeout(() => {
        navigation.replace(isDonor ? 'RequestHistory' : 'RequestHistory' as never);
      }, 500);
    } catch (error: any) {
      console.error('❌ [Rating] Error skipping rating:', error);
      // Even if skip fails, allow navigation
      navigation.replace(isDonor ? 'RequestHistory' : 'RequestHistory' as never);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle submit rating
   */
  const handleSubmit = async () => {
    if (rating === 0) {
      showAlert({
        type: 'warning',
        title: 'Rating Required',
        message: 'Please select a rating before submitting.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('⭐ [Rating] Submitting rating:', {
        requestId,
        donorId,
        rating,
        comment: comment.trim(),
        role: user?.role,
      });

      await respectAPI.submitRating({
        requestId,
        donorId,
        recipientId: route.params.recipientId,
        rating,
        comment: comment.trim() || undefined,
        raterRole: user?.role === 'donor' ? 'donor' : 'recipient',
      });

      showAlert({
        type: 'success',
        title: 'Thank You!',
        message: 'Your rating has been submitted successfully.',
      });

      // Navigate to history
      setTimeout(() => {
        navigation.replace(isDonor ? 'RequestHistory' : 'RequestHistory' as never);
      }, 1000);
    } catch (error: any) {
      console.error('❌ [Rating] Error submitting rating:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to submit rating. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Rate Your Experience</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Donation Completed!</Text>
        <Text style={styles.subtitle}>
          How was your experience with {otherPersonName}?
        </Text>

        {/* Star Rating */}
        <View style={styles.starContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => handleStarPress(star)}
              style={styles.starButton}
              disabled={isSubmitting}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={50}
                color={star <= rating ? '#DC143C' : '#DDD'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating Labels */}
        <View style={styles.ratingLabelContainer}>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          )}
        </View>

        {/* Comment Section */}
        <View style={styles.commentSection}>
          <Text style={styles.commentLabel}>
            Add a comment (Optional)
          </Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#999"
            editable={!isSubmitting}
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#2196F3" />
          <Text style={styles.infoText}>
            Your feedback helps us improve the blood donation experience for everyone.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={handleSkip}
            disabled={isSubmitting}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Rating</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DC143C',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  starButton: {
    padding: 5,
  },
  ratingLabelContainer: {
    height: 30,
    justifyContent: 'center',
    marginBottom: 30,
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC143C',
    textAlign: 'center',
  },
  commentSection: {
    width: '100%',
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  commentInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: '#333',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#1976D2',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  skipButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
  },
  submitButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RatingScreen;

