import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Switch,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useBloodRequest, UrgencyLevel } from '../../context/BloodRequestContext';
import { useAlert } from '../../context/AlertContext';
import { shadow } from '../../utils/shadowStyles';
import LocationMapPicker from '../../components/LocationMapPicker';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateBloodRequest'>;

/**
 * Create Blood Request Screen
 * 
 * ✅ MIGRATED FROM GOOGLE MAPS TO OPENSTREETMAP
 * 
 * Allows recipients to create a new blood request with:
 * - Blood group selection
 * - Urgency level (Normal/Emergency)
 * - Location with OSM-based autocomplete (Photon API)
 * - Reverse geocoding (Nominatim)
 * - Additional notes
 * 
 * Flow:
 * 1. Request location permission on mount
 * 2. Auto-fill user's current location via Nominatim reverse geocoding
 * 3. User types to get autocomplete suggestions from Photon API
 * 4. Validates required fields with inline errors
 * 5. Creates request via BloodRequestContext
 * 6. Navigates to RequestStatus screen
 * 
 * FREE SERVICES USED:
 * - Photon API: Location search/autocomplete (photon.komoot.io)
 * - Nominatim: Reverse geocoding (nominatim.openstreetmap.org)
 * - expo-location: GPS coordinates (device native)
 */
const CreateBloodRequest: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { createRequest } = useBloodRequest();
  const { showAlert } = useAlert();

  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('NORMAL');
  const [location, setLocation] = useState<string>('');
  const [locationCoordinates, setLocationCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [shareLocation, setShareLocation] = useState<boolean>(true); // Default to true
  const [currentCoordinates, setCurrentCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Error states for inline validation
  const [bloodGroupError, setBloodGroupError] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');

  // Animation for errors
  const bloodGroupShake = useRef(new Animated.Value(0)).current;
  const locationShake = useRef(new Animated.Value(0)).current;

  // Available blood groups
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  /**
   * Request location permission and get current location on mount
   */
  useEffect(() => {
    requestLocationPermission();

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  /**
   * Get current live location for sharing
   */
  const getCurrentLiveLocation = async () => {
    if (!shareLocation) return;
    
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCurrentCoordinates({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting live location:', error);
    }
  };

  /**
   * Update live location when shareLocation changes
   */
  useEffect(() => {
    if (shareLocation) {
      getCurrentLiveLocation();
    }
  }, [shareLocation]);

  /**
   * Request location permission and auto-fill if granted
   */
  const requestLocationPermission = async () => {
    try {
      setIsLoadingLocation(true);
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is required to auto-detect your location. You can still enter it manually.',
          [{ text: 'OK' }]
        );
        setIsLoadingLocation(false);
        return;
      }

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Location request timeout')), 10000)
      );
      
      const currentLocation = await Promise.race([locationPromise, timeoutPromise]) as any;

      // Store coordinates for target location
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocationCoordinates(coords);
      setCurrentCoordinates(coords);

      // Reverse geocoding using Nominatim (OpenStreetMap)
      // ✅ FREE - No API key required
      try {
        const { latitude, longitude } = currentLocation.coords;
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
        
        console.log('🔍 [OSM] Reverse geocoding:', latitude, longitude);
        
        const geocodePromise = fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'BDMS-App/1.0' // Nominatim requires User-Agent
          }
        });
        
        const geocodeTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Geocode timeout')), 3000)
        );
        
        const response = await Promise.race([geocodePromise, geocodeTimeout]) as Response;
        const data = await response.json();

        if (data && data.address) {
          const addr = data.address;
          const formattedAddress = [
            addr.amenity || addr.building,
            addr.road || addr.street,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
            'Pakistan'
          ]
            .filter(Boolean)
            .join(', ');
          
          setLocation(formattedAddress || data.display_name);
          console.log('✅ [OSM] Reverse geocoded:', formattedAddress);
        } else {
          // Fallback: use coordinates
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      } catch (geocodeError) {
        console.log('[OSM] Geocoding failed, using coordinates:', geocodeError);
        // Silent fallback: use coordinates
        setLocation(`${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`);
      }
    } catch (error: any) {
      console.error('Error getting location:', error);
      
      // Only show error if it's not a timeout
      if (!error.message?.includes('timeout')) {
        Alert.alert(
          'Location Error',
          'Unable to get your current location. Please enter it manually.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('Location service timeout - user can enter manually');
      }
    } finally {
      setIsLoadingLocation(false);
    }
  };

  /**
   * Shake animation for error fields
   */
  const shakeAnimation = (animValue: Animated.Value) => {
    Animated.sequence([
      Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(animValue, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  /**
   * Handle blood group selection
   */
  const handleSelectBloodGroup = (group: string) => {
    setBloodGroup(group);
    setBloodGroupError(''); // Clear error on selection
  };

  /**
   * Handle urgency level selection
   */
  const handleSelectUrgency = (level: UrgencyLevel) => {
    setUrgencyLevel(level);
  };

  /**
   * Search for location suggestions using Nominatim (OpenStreetMap)
   * ✅ FREE - No API key, Rate limit: 1 req/second
   * Prioritizes Pakistan locations and sorts by nearest
   */
  const searchLocationSuggestions = async (query: string) => {
    console.log('🔍 [Nominatim] Search called with query:', query);
    
    if (query.length < 3) {
      console.log('❌ [Nominatim] Query too short:', query.length);
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    console.log('⏳ [Nominatim] Starting search');
    setIsSearching(true);
    
    try {
      // Get current location for proximity sorting
      const userLat = currentCoordinates?.latitude || locationCoordinates?.latitude || 30.3753; // Default: Pakistan center
      const userLon = currentCoordinates?.longitude || locationCoordinates?.longitude || 69.3451;

      // Nominatim Search API with Pakistan country filter and proximity bias
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&` +
        `format=json&` +
        `addressdetails=1&` +
        `limit=8&` +
        `countrycodes=pk&` + // PAKISTAN ONLY
        `viewbox=${userLon - 5},${userLat + 5},${userLon + 5},${userLat - 5}&` + // Prioritize nearby
        `bounded=0`; // Still allow results outside viewbox but prioritize inside
      
      console.log('🌐 [Nominatim] Fetching URL:', url);
      console.log('📍 [Nominatim] User position for proximity:', userLat, userLon);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BDMS-BloodDonationApp/1.0', // Required by Nominatim
        },
      });
      console.log('📡 [Nominatim] Response status:', response.status);
      
      const data = await response.json();
      console.log('📦 [Nominatim] Results found:', data.length);

      if (data && data.length > 0) {
        // Calculate distance and sort by nearest
        const suggestionsWithDistance = data.map((item: any) => {
          const addr = item.address || {};
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          
          // Calculate distance from user (Haversine formula)
          const R = 6371; // Earth's radius in km
          const dLat = (lat - userLat) * Math.PI / 180;
          const dLon = (lon - userLon) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c; // Distance in km
          
          // Build readable address
          const addressParts = [
            addr.amenity || addr.building || addr.house_number,
            addr.road || addr.street,
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village,
            addr.state,
          ].filter(Boolean);
          
          return {
            description: addressParts.join(', ') || item.display_name,
            placeId: item.place_id || `osm_${lat}_${lon}`,
            latitude: lat,
            longitude: lon,
            displayName: item.display_name,
            osmType: item.osm_type,
            address: addr,
            distance: distance, // Store distance for sorting
          };
        });

        // Sort by distance (nearest first)
        const sortedSuggestions = suggestionsWithDistance
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5); // Top 5 nearest

        sortedSuggestions.forEach((s, i) => {
          console.log(`  [${i}] ${s.description} (${s.distance.toFixed(1)}km away)`);
        });

        console.log('✅ [Nominatim] Setting', sortedSuggestions.length, 'suggestions (sorted by nearest)');
        setLocationSuggestions(sortedSuggestions);
        setShowSuggestions(true);
      } else {
        console.log('⚠️ [Nominatim] No results');
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('❌ [Nominatim] Error:', error);
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } finally {
      console.log('✅ [Nominatim] Search complete');
      setIsSearching(false);
    }
  };

  /**
   * Handle location change with debounced search
   */
  const handleLocationChange = (text: string) => {
    console.log('🔤 [Location] Input changed:', text, 'Length:', text.length);
    setLocation(text);
    setLocationError(''); // Clear error on input

    // Clear previous timeout
    if (searchTimeout.current) {
      console.log('⏱️ [Location] Clearing previous search timeout');
      clearTimeout(searchTimeout.current);
    }

    // Debounce search
    if (text.trim().length >= 3) {
      console.log('⏱️ [Location] Setting search timeout for:', text.trim());
      searchTimeout.current = setTimeout(() => {
        console.log('🚀 [Location] Timeout triggered, calling search for:', text.trim());
        searchLocationSuggestions(text.trim());
      }, 500); // Wait 500ms after user stops typing
    } else {
      console.log('❌ [Location] Text too short, clearing suggestions');
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  /**
   * Handle selecting a suggestion
   */
  const handleSelectSuggestion = (suggestion: any) => {
    console.log('👆 [Location] Suggestion selected:', suggestion);
    setLocation(suggestion.description);
    setLocationCoordinates({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setLocationError('');
    console.log('✅ [Location] Location set to:', suggestion.description);
    console.log('✅ [Location] Coordinates set to:', suggestion.latitude, suggestion.longitude);
  };

  /**
   * Handle location selected from map picker
   */
  const handleMapLocationSelected = (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    console.log('🗺️ [Map Picker] Location selected:', location);
    setLocation(location.address);
    setLocationCoordinates({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setLocationError('');
    setShowMapPicker(false);
  };

  /**
   * Open map picker
   */
  const handleOpenMapPicker = () => {
    console.log('🗺️ [Map Picker] Opening map picker');
    // Use current coordinates if available, otherwise use default
    setShowMapPicker(true);
  };

  /**
   * Validate form before submission with inline errors
   */
  const validateForm = (): boolean => {
    let isValid = true;

    // Validate blood group
    if (!bloodGroup) {
      setBloodGroupError('Please select a blood group');
      shakeAnimation(bloodGroupShake);
      isValid = false;
    } else {
      setBloodGroupError('');
    }

    // Validate location
    if (!location.trim()) {
      setLocationError('Please enter your location');
      shakeAnimation(locationShake);
      isValid = false;
    } else {
      setLocationError('');
    }

    return isValid;
  };

  /**
   * Handle form submission
   * 
   * Flow:
   * 1. Validate form fields
   * 2. Create request in context
   * 3. Navigate to RequestStatus screen
   */
  const handleSubmit = async () => {
    if (!validateForm() || !user) return;

    try {
      setIsSubmitting(true);

      // If sharing live location, ensure we have current coordinates
      if (shareLocation && !currentCoordinates) {
        await getCurrentLiveLocation();
      }

      // Use locationCoordinates if available (from GPS), otherwise try to get current location
      let targetLat = locationCoordinates?.latitude;
      let targetLng = locationCoordinates?.longitude;

      // If no coordinates set, try to get current location as fallback
      if (!targetLat || !targetLng) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            targetLat = currentLoc.coords.latitude;
            targetLng = currentLoc.coords.longitude;
            console.log('📍 Using current location as target:', targetLat, targetLng);
          }
        } catch (error) {
          console.log('Could not get location, proceeding without coordinates');
        }
      }

      console.log('📍 Creating request with:', {
        location: location.trim(),
        targetCoordinates: targetLat && targetLng ? { lat: targetLat, lng: targetLng } : 'Not available',
        shareLocation,
        liveLocation: currentCoordinates,
      });

      // Create blood request
      const requestId = await createRequest({
        recipientId: user.id,
        recipientName: user.name,
        bloodGroup,
        units: 1, // Always 1 unit per request
        acceptedUnits: 0,
        urgencyLevel,
        location: location.trim(),
        notes: notes.trim() || undefined,
        shareLocation,
        recipientLatitude: targetLat, // Target location coordinates (from GPS or typed)
        recipientLongitude: targetLng, // Target location coordinates (from GPS or typed)
      });

      console.log('✅ Blood request created:', requestId);

      // Navigate to status screen
      navigation.navigate('RequestStatus', { requestId });
    } catch (error: any) {
      console.error('❌ Error creating blood request:', error);
      showAlert({
        type: 'error',
        title: 'Request Failed',
        message: error?.message || 'Unable to create blood request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="water" size={48} color="#DC143C" />
          </View>
          <Text style={styles.headerTitle}>Request Blood</Text>
          <Text style={styles.headerSubtitle}>
            Fill in the details below to create a blood request
          </Text>
        </View>

        {/* Blood Group Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Blood Group <Text style={styles.required}>*</Text>
          </Text>
          <Animated.View 
            style={[
              styles.bloodGroupGrid,
              { transform: [{ translateX: bloodGroupShake }] }
            ]}
          >
            {bloodGroups.map((group) => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.bloodGroupButton,
                  bloodGroup === group && styles.bloodGroupButtonActive,
                  bloodGroupError && !bloodGroup && styles.bloodGroupButtonError,
                ]}
                onPress={() => handleSelectBloodGroup(group)}
                activeOpacity={0.7}
              >
                <View style={styles.bloodGroupIconContainer}>
                  <Ionicons 
                    name="water" 
                    size={24} 
                    color={bloodGroup === group ? '#fff' : '#DC143C'} 
                  />
                </View>
                <Text
                  style={[
                    styles.bloodGroupText,
                    bloodGroup === group && styles.bloodGroupTextActive,
                  ]}
                >
                  {group}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
          {bloodGroupError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#F44336" />
              <Text style={styles.errorText}>{bloodGroupError}</Text>
            </View>
          ) : null}
        </View>

        {/* Urgency Level Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Urgency Level <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.urgencyContainer}>
            <TouchableOpacity
              style={[
                styles.urgencyButton,
                urgencyLevel === 'NORMAL' && styles.urgencyButtonActive,
              ]}
              onPress={() => handleSelectUrgency('NORMAL')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="time-outline"
                size={28}
                color={urgencyLevel === 'NORMAL' ? '#fff' : '#DC143C'}
              />
              <Text
                style={[
                  styles.urgencyText,
                  urgencyLevel === 'NORMAL' && styles.urgencyTextActive,
                ]}
              >
                Normal
              </Text>
              <Text
                style={[
                  styles.urgencySubtext,
                  urgencyLevel === 'NORMAL' && styles.urgencySubtextActive,
                ]}
              >
                24-48 hours
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.urgencyButton,
                urgencyLevel === 'EMERGENCY' && styles.urgencyButtonActive,
              ]}
              onPress={() => handleSelectUrgency('EMERGENCY')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="alert-circle"
                size={28}
                color={urgencyLevel === 'EMERGENCY' ? '#fff' : '#DC143C'}
              />
              <Text
                style={[
                  styles.urgencyText,
                  urgencyLevel === 'EMERGENCY' && styles.urgencyTextActive,
                ]}
              >
                Emergency
              </Text>
              <Text
                style={[
                  styles.urgencySubtext,
                  urgencyLevel === 'EMERGENCY' && styles.urgencySubtextActive,
                ]}
              >
                Immediate
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Input with Autocomplete */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.locationHelper}>
            Type to search or tap 📍 to use your current location
          </Text>
          <Animated.View style={{ transform: [{ translateX: locationShake }], zIndex: 999 }}>
            <View style={[
              styles.inputContainer,
              locationError && styles.inputContainerError,
            ]}>
              <Ionicons name="location-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g., Jinnah Hospital, Lahore"
                value={location}
                onChangeText={handleLocationChange}
                placeholderTextColor="#999"
                editable={!isLoadingLocation}
                onFocus={() => {
                  if (locationSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#DC143C" style={styles.locationLoader} />
              ) : isLoadingLocation ? (
                <ActivityIndicator size="small" color="#DC143C" style={styles.locationLoader} />
              ) : (
                <TouchableOpacity 
                  onPress={requestLocationPermission}
                  style={styles.locationButton}
                >
                  <Ionicons name="navigate-circle" size={24} color="#DC143C" />
                </TouchableOpacity>
              )}
            </View>

            {/* Autocomplete Suggestions Dropdown */}
            {(() => {
              console.log('🎨 [Render] showSuggestions:', showSuggestions, 'suggestions count:', locationSuggestions.length);
              return showSuggestions && locationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={locationSuggestions}
                    keyExtractor={(item, index) => `${item.placeId}-${index}`}
                    scrollEnabled={false}
                    renderItem={({ item, index }) => (
                      <TouchableOpacity
                        style={[
                          styles.suggestionItem,
                          index === locationSuggestions.length - 1 && styles.suggestionItemLast,
                        ]}
                        onPress={() => handleSelectSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location" size={18} color="#DC143C" style={styles.suggestionIcon} />
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              );
            })()}
          </Animated.View>

          {locationError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={14} color="#F44336" />
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          ) : (
            <View style={styles.helperText}>
              <Ionicons name="search" size={14} color="#666" />
              <Text style={styles.helperTextInline}>
                {' '}Type at least 3 characters to search for locations
              </Text>
            </View>
          )}
          {locationCoordinates && (
            <View style={styles.locationConfirmed}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.locationConfirmedText}>
                ✓ Location confirmed with GPS coordinates for mapping
              </Text>
            </View>
          )}

          {/* Map Picker Button */}
          <TouchableOpacity
            style={styles.mapPickerButton}
            onPress={handleOpenMapPicker}
            activeOpacity={0.7}
          >
            <Ionicons name="map" size={20} color="#DC143C" />
            <Text style={styles.mapPickerButtonText}>
              Select on Map (Drag Pin for Precision)
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#DC143C" />
          </TouchableOpacity>
        </View>

        {/* Notes Input (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any additional information (e.g., hospital name, urgency details)..."
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Live Location Sharing */}
        <View style={styles.section}>
          <View style={styles.locationSharingHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Share Live Location (Optional)</Text>
              <Text style={styles.locationSharingSubtext}>
                Track your real-time movement for donors (separate from target location above)
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: '#ccc', true: '#DC143C' }}
              thumbColor={shareLocation ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#ccc"
            />
          </View>
          {shareLocation && (
            <View style={styles.locationSharingInfo}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
              <Text style={styles.locationSharingInfoText}>
                Donors will see both the target location above and your live position on the map
              </Text>
            </View>
          )}
          {!shareLocation && (
            <View style={styles.locationSharingInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#2196F3" />
              <Text style={[styles.locationSharingInfoText, { color: '#2196F3' }]}>
                Only the target location above will be shown to donors
              </Text>
            </View>
          )}
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
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={20} color="#DC143C" />
          <Text style={styles.infoText}>
            Your request will be sent to nearby donors who match your blood group. 
            You'll be notified when donors respond.
          </Text>
        </View>
      </ScrollView>

      {/* Location Map Picker Modal */}
      <LocationMapPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLatitude={locationCoordinates?.latitude || currentCoordinates?.latitude || 30.3753}
        initialLongitude={locationCoordinates?.longitude || currentCoordinates?.longitude || 69.3451}
        onLocationSelected={handleMapLocationSelected}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    marginBottom: 30,
    paddingTop: 10,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  required: {
    color: '#DC143C',
  },
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bloodGroupButton: {
    width: '23%',
    minWidth: 70,
    aspectRatio: 0.85,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  bloodGroupButtonActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
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
  bloodGroupButtonError: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  bloodGroupIconContainer: {
    marginBottom: 8,
  },
  bloodGroupText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  bloodGroupTextActive: {
    color: '#fff',
  },
  urgencyContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  urgencyButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 20,
    alignItems: 'center',
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
  urgencyButtonActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
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
  urgencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 10,
  },
  urgencyTextActive: {
    color: '#fff',
  },
  urgencySubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  urgencySubtextActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputContainerError: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    padding: 0,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  locationButton: {
    padding: 4,
  },
  locationLoader: {
    marginLeft: 8,
  },
  locationHelper: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    marginTop: -4,
    fontStyle: 'italic',
  },
  helperText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
  },
  helperTextInline: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  locationConfirmedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 250,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#DC143C',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  mapPickerButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#DC143C',
    marginLeft: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginLeft: 4,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#DC143C',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    marginLeft: 12,
    lineHeight: 18,
  },
  locationSharingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationSharingSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  locationSharingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  locationSharingInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 8,
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  locationWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 8,
  },
});

export default CreateBloodRequest;
