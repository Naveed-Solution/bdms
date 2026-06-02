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
import LocationMapPicker from '../../components/LocationMapPicker';

type NavigationProp = StackNavigationProp<RootStackParamList, 'CreateBloodRequest'>;

interface Suggestion {
  label: string;
  latitude: number;
  longitude: number;
  dist: number;
}

const CreateBloodRequest: React.FC = () => {
  const navigation   = useNavigation<NavigationProp>();
  const { user }     = useAuth();
  const { createRequest } = useBloodRequest();
  const { showAlert }     = useAlert();

  // ── Form fields ──────────────────────────────────────────────────────────
  const [bloodGroup,    setBloodGroup]    = useState('');
  const [urgencyLevel,  setUrgencyLevel]  = useState<UrgencyLevel>('NORMAL');
  const [notes,         setNotes]         = useState('');
  const [shareLocation, setShareLocation] = useState(true);
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // ── Location ─────────────────────────────────────────────────────────────
  const [locationText,   setLocationText]   = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deviceCoords,   setDeviceCoords]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingGPS,   setIsLoadingGPS]   = useState(false);
  const [showMapPicker,  setShowMapPicker]  = useState(false);

  // ── Search suggestions ───────────────────────────────────────────────────
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching,     setIsSearching]     = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Validation ───────────────────────────────────────────────────────────
  const [bloodGroupError, setBloodGroupError] = useState('');
  const [locationError,   setLocationError]   = useState('');
  const bloodGroupShake = useRef(new Animated.Value(0)).current;
  const locationShake   = useRef(new Animated.Value(0)).current;

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    fetchDeviceLocation();
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  // ── GPS ──────────────────────────────────────────────────────────────────
  const fetchDeviceLocation = async () => {
    try {
      setIsLoadingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ]) as Location.LocationObject;

      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setDeviceCoords(coords);

      // Reverse geocode to pre-fill the text field
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'BDMS-App/1.0' } }
        );
        const data = await res.json();
        if (data?.address) {
          const a = data.address;
          const parts = [
            a.amenity || a.building,
            a.road,
            a.suburb || a.neighbourhood,
            a.city || a.town || a.village,
            a.state,
          ].filter(Boolean);
          const addr = parts.join(', ') || data.display_name;
          setLocationText(addr);
          setLocationCoords(coords);
        }
      } catch (_) { /* silent */ }
    } catch (e: any) {
      if (!e?.message?.includes('timeout')) console.warn('GPS error:', e);
    } finally {
      setIsLoadingGPS(false);
    }
  };

  // ── Text search (Nominatim, debounced 500 ms) ────────────────────────────
  const handleLocationTextChange = (text: string) => {
    setLocationText(text);
    setLocationError('');
    // User typed something new — clear previously confirmed coords
    if (locationCoords) setLocationCoords(null);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length >= 3) {
      searchTimer.current = setTimeout(() => doSearch(text.trim()), 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const doSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const base = deviceCoords || { latitude: 34.0151, longitude: 71.5249 };
      const url  =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&countrycodes=pk` +
        `&viewbox=${base.longitude - 5},${base.latitude + 5},${base.longitude + 5},${base.latitude - 5}&bounded=0`;

      const res  = await fetch(url, { headers: { 'User-Agent': 'BDMS-App/1.0' } });
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        const results: Suggestion[] = data.map((item: any) => {
          const a    = item.address || {};
          const lat  = parseFloat(item.lat);
          const lon  = parseFloat(item.lon);
          const dLat = (lat - base.latitude)  * Math.PI / 180;
          const dLon = (lon - base.longitude) * Math.PI / 180;
          const hav  =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(base.latitude * Math.PI / 180) *
            Math.cos(lat         * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
          const parts = [
            a.amenity || a.building,
            a.road,
            a.suburb || a.neighbourhood,
            a.city || a.town || a.village,
            a.state,
          ].filter(Boolean);
          return { label: parts.join(', ') || item.display_name, latitude: lat, longitude: lon, dist };
        });
        results.sort((a, b) => a.dist - b.dist);
        setSuggestions(results.slice(0, 5));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (_) {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (item: Suggestion) => {
    setLocationText(item.label);
    setLocationCoords({ latitude: item.latitude, longitude: item.longitude });
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationError('');
  };

  // ── Map picker callback ──────────────────────────────────────────────────
  const handleMapLocationSelected = (loc: { latitude: number; longitude: number; address: string }) => {
    setLocationText(loc.address);
    setLocationCoords({ latitude: loc.latitude, longitude: loc.longitude });
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationError('');
    setShowMapPicker(false);
  };

  // ── Shake animation ──────────────────────────────────────────────────────
  const shake = (v: Animated.Value) =>
    Animated.sequence([
      Animated.timing(v, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(v, { toValue:   0, duration: 50, useNativeDriver: true }),
    ]).start();

  // ── Validation ───────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    let valid = true;
    if (!bloodGroup) {
      setBloodGroupError('Please select a blood group');
      shake(bloodGroupShake);
      valid = false;
    } else {
      setBloodGroupError('');
    }
    if (!locationText.trim()) {
      setLocationError('Please enter or pin a location');
      shake(locationShake);
      valid = false;
    } else {
      setLocationError('');
    }
    return valid;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm() || !user) return;
    try {
      setIsSubmitting(true);
      // Use confirmed coords if available; fall back to device GPS
      const finalCoords = locationCoords ?? deviceCoords ?? undefined;

      const requestId = await createRequest({
        recipientId:        user.id,
        recipientName:      user.name,
        bloodGroup,
        units:              1,
        acceptedUnits:      0,
        urgencyLevel,
        location:           locationText.trim(),
        notes:              notes.trim() || undefined,
        shareLocation,
        recipientLatitude:  finalCoords?.latitude,
        recipientLongitude: finalCoords?.longitude,
      });

      navigation.navigate('RequestStatus', { requestId });
    } catch (error: any) {
      console.error('Error creating blood request:', error);
      showAlert({
        type: 'error',
        title: 'Request Failed',
        message: error?.message || 'Unable to create blood request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
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

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="water" size={48} color="#DC143C" />
          </View>
          <Text style={styles.headerTitle}>Request Blood</Text>
          <Text style={styles.headerSubtitle}>
            Fill in the details below to create a blood request
          </Text>
        </View>

        {/* ── Blood Group ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Blood Group <Text style={styles.required}>*</Text>
          </Text>
          <Animated.View
            style={[styles.bloodGroupGrid, { transform: [{ translateX: bloodGroupShake }] }]}
          >
            {bloodGroups.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.bloodGroupBtn,
                  bloodGroup === g && styles.bloodGroupBtnActive,
                  bloodGroupError && !bloodGroup && styles.bloodGroupBtnError,
                ]}
                onPress={() => { setBloodGroup(g); setBloodGroupError(''); }}
                activeOpacity={0.7}
              >
                <Ionicons name="water" size={22} color={bloodGroup === g ? '#fff' : '#DC143C'} />
                <Text style={[styles.bloodGroupText, bloodGroup === g && styles.bloodGroupTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
          {bloodGroupError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#F44336" />
              <Text style={styles.errorText}>{bloodGroupError}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Urgency ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Urgency Level <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.urgencyRow}>
            {(['NORMAL', 'EMERGENCY'] as UrgencyLevel[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.urgencyBtn, urgencyLevel === level && styles.urgencyBtnActive]}
                onPress={() => setUrgencyLevel(level)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={level === 'NORMAL' ? 'time-outline' : 'alert-circle'}
                  size={28}
                  color={urgencyLevel === level ? '#fff' : '#DC143C'}
                />
                <Text style={[styles.urgencyText, urgencyLevel === level && styles.urgencyTextActive]}>
                  {level === 'NORMAL' ? 'Normal' : 'Emergency'}
                </Text>
                <Text style={[styles.urgencySub, urgencyLevel === level && styles.urgencySubActive]}>
                  {level === 'NORMAL' ? '24–48 hours' : 'Immediate'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Location ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Hospital / Location <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.hint}>
            Search by name <Text style={styles.hintBold}>or</Text> tap "Pin on Map" to drop a pin.
          </Text>

          <Animated.View style={{ transform: [{ translateX: locationShake }], zIndex: 20 }}>

            {/* ── Text search row ── */}
            <View style={[styles.inputRow, locationError ? styles.inputRowError : null]}>
              <Ionicons name="search-outline" size={20} color="#888" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                placeholder="Search hospital, clinic, landmark…"
                placeholderTextColor="#bbb"
                value={locationText}
                onChangeText={handleLocationTextChange}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                editable={!isLoadingGPS}
                returnKeyType="search"
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#DC143C" style={{ marginLeft: 6 }} />
              ) : (
                <TouchableOpacity onPress={fetchDeviceLocation} style={styles.gpsBtn} disabled={isLoadingGPS}>
                  {isLoadingGPS
                    ? <ActivityIndicator size="small" color="#DC143C" />
                    : <Ionicons name="navigate-circle" size={28} color="#DC143C" />
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* ── Suggestions dropdown ── */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.dropdown}>
                <FlatList
                  data={suggestions}
                  keyExtractor={(_, i) => String(i)}
                  scrollEnabled={false}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[
                        styles.suggestionItem,
                        index === suggestions.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => handleSelectSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="location" size={16} color="#DC143C" style={{ marginRight: 10, flexShrink: 0 }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* ── Divider ── */}
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            {/* ── Map Pin button ── */}
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => setShowMapPicker(true)}
              activeOpacity={0.8}
            >
              <View style={styles.mapBtnIcon}>
                <Ionicons name="map" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapBtnTitle}>Pin on Map</Text>
                <Text style={styles.mapBtnSub}>Tap or drag the pin to the exact location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#DC143C" />
            </TouchableOpacity>

            {/* ── Confirmed location badge ── */}
            {locationText.trim() !== '' && locationCoords && (
              <View style={styles.confirmedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.confirmedText} numberOfLines={2}>{locationText}</Text>
                <TouchableOpacity
                  onPress={() => { setLocationText(''); setLocationCoords(null); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#888" />
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>

          {locationError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#F44336" />
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Notes ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ward number, contact details, urgency specifics…"
            value={notes}
            onChangeText={setNotes}
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* ── Live Location Toggle ── */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Share Live Location</Text>
              <Text style={styles.hint}>Let donors see your real-time position on the map</Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: '#ccc', true: '#DC143C' }}
              thumbColor={shareLocation ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={20} color="#2196F3" />
          <Text style={styles.infoText}>
            Your request will be sent to nearby donors who match your blood group.
            You'll be notified when donors respond.
          </Text>
        </View>

      </ScrollView>

      {/* ── Full-screen Map Picker Modal ── */}
      <LocationMapPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLatitude={locationCoords?.latitude   || deviceCoords?.latitude   || 34.0151}
        initialLongitude={locationCoords?.longitude || deviceCoords?.longitude || 71.5249}
        onLocationSelected={handleMapLocationSelected}
      />

    </KeyboardAvoidingView>
  );
};

const shadow = (color = '#000', elevation = 2, opacity = 0.1) =>
  Platform.select({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: elevation }, shadowOpacity: opacity, shadowRadius: elevation * 2 },
    android: { elevation },
  });

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView:     { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 50 },

  // Header
  header: { alignItems: 'center', marginBottom: 28, paddingTop: 8 },
  iconWrapper: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    ...shadow('#DC143C', 4, 0.2),
  },
  headerTitle:    { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 13, color: '#777', textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },

  // Sections
  section:      { marginBottom: 22 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 10 },
  required:     { color: '#DC143C' },
  hint:         { fontSize: 12, color: '#888', marginBottom: 10 },
  hintBold:     { fontWeight: '700', color: '#555' },

  // Blood groups
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bloodGroupBtn: {
    width: '23%', minWidth: 68, aspectRatio: 0.85,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#e0e0e0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    ...shadow('#000', 2, 0.08),
  },
  bloodGroupBtnActive: { backgroundColor: '#DC143C', borderColor: '#DC143C', ...shadow('#DC143C', 4, 0.3) },
  bloodGroupBtnError:  { borderColor: '#F44336' },
  bloodGroupText:      { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginTop: 4 },
  bloodGroupTextActive:{ color: '#fff' },

  // Urgency
  urgencyRow:    { flexDirection: 'row', gap: 12 },
  urgencyBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2,
    borderColor: '#e0e0e0', padding: 18, alignItems: 'center',
    ...shadow('#000', 2, 0.08),
  },
  urgencyBtnActive:  { backgroundColor: '#DC143C', borderColor: '#DC143C', ...shadow('#DC143C', 4, 0.3) },
  urgencyText:       { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginTop: 8 },
  urgencyTextActive: { color: '#fff' },
  urgencySub:        { fontSize: 12, color: '#777', marginTop: 3 },
  urgencySubActive:  { color: 'rgba(255,255,255,0.85)' },

  // Location input row
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ddd',
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    ...shadow('#000', 1, 0.07),
  },
  inputRowError: { borderColor: '#F44336' },
  textInput:     { flex: 1, fontSize: 14, color: '#1a1a1a', padding: 0 },
  gpsBtn:        { padding: 4 },

  // Dropdown
  dropdown: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e0e0e0',
    marginTop: 4, overflow: 'hidden',
    ...shadow('#000', 6, 0.12),
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f2f2f2',
  },
  suggestionText: { flex: 1, fontSize: 13, color: '#333', lineHeight: 18 },

  // OR divider
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  orLine:    { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  orText:    { fontSize: 12, color: '#aaa', fontWeight: '600', marginHorizontal: 10 },

  // Map pin button
  mapBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#DC143C',
    padding: 14, gap: 12,
    ...shadow('#DC143C', 2, 0.1),
  },
  mapBtnIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#DC143C',
    justifyContent: 'center', alignItems: 'center',
  },
  mapBtnTitle: { fontSize: 15, fontWeight: '700', color: '#DC143C' },
  mapBtnSub:   { fontSize: 12, color: '#888', marginTop: 2 },

  // Confirmed badge
  confirmedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#C8E6C9', gap: 8,
  },
  confirmedText: { flex: 1, fontSize: 13, color: '#2E7D32', lineHeight: 18 },

  // Errors
  errorRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  errorText: { fontSize: 12, color: '#F44336', marginLeft: 4, fontWeight: '500' },

  // Notes
  textArea: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ddd',
    padding: 14, minHeight: 85,
    fontSize: 14, color: '#1a1a1a', textAlignVertical: 'top',
  },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center' },

  // Submit
  submitBtn: {
    backgroundColor: '#DC143C', borderRadius: 16,
    paddingVertical: 17, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 20, gap: 8,
    ...shadow('#DC143C', 6, 0.4),
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Info card
  infoCard: {
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start',
    borderLeftWidth: 4, borderLeftColor: '#2196F3', gap: 12,
  },
  infoText: { flex: 1, fontSize: 13, color: '#555', lineHeight: 19 },
});

export default CreateBloodRequest;
