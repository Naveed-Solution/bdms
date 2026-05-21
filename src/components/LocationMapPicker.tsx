import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import MapView, { Marker, UrlTile, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

/**
 * ✅ OSM-BASED MAP PICKER
 * 
 * Allows users to select exact location by:
 * 1. Searching and selecting from suggestions (handled by parent)
 * 2. Dragging the pin on the map to precise location
 * 3. Reverse geocoding to get address when pin is moved
 * 
 * Uses Nominatim reverse geocoding (FREE, no API key)
 */

interface LocationMapPickerProps {
  visible: boolean;
  onClose: () => void;
  initialLatitude?: number;
  initialLongitude?: number;
  onLocationSelected: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
}

const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  visible,
  onClose,
  initialLatitude = 30.3753, // Default: Pakistan center
  initialLongitude = 69.3451,
  onLocationSelected,
}) => {
  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude,
  });
  const [address, setAddress] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const reverseGeocodeTimeout = useRef<NodeJS.Timeout | null>(null);

  /**
   * Reverse geocode coordinates to address
   * Debounced to avoid spamming API while dragging
   */
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      setIsReverseGeocoding(true);
      
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      
      console.log('🔄 [Reverse Geocode] Getting address for:', latitude, longitude);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BDMS-BloodDonationApp/1.0',
        },
      });

      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const addressParts = [
          addr.amenity || addr.building || addr.house_number,
          addr.road || addr.street,
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.village,
          addr.state,
          'Pakistan'
        ].filter(Boolean);

        const formattedAddress = addressParts.join(', ') || data.display_name;
        setAddress(formattedAddress);
        console.log('✅ [Reverse Geocode] Address:', formattedAddress);
      } else {
        setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (error) {
      console.error('❌ [Reverse Geocode] Error:', error);
      setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  /**
   * Handle marker drag end
   * Debounced reverse geocoding to avoid API spam
   */
  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    console.log('📍 [Map Picker] Pin moved to:', latitude, longitude);
    
    setSelectedLocation({ latitude, longitude });

    // Clear previous timeout
    if (reverseGeocodeTimeout.current) {
      clearTimeout(reverseGeocodeTimeout.current);
    }

    // Debounce reverse geocoding (wait 800ms after dragging stops)
    reverseGeocodeTimeout.current = setTimeout(() => {
      reverseGeocode(latitude, longitude);
    }, 800);
  };

  /**
   * Handle map press (tap to place pin)
   */
  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    console.log('📍 [Map Picker] Map tapped at:', latitude, longitude);
    
    setSelectedLocation({ latitude, longitude });

    // Clear previous timeout
    if (reverseGeocodeTimeout.current) {
      clearTimeout(reverseGeocodeTimeout.current);
    }

    // Reverse geocode after tap
    reverseGeocodeTimeout.current = setTimeout(() => {
      reverseGeocode(latitude, longitude);
    }, 800);
  };

  /**
   * Confirm location selection
   */
  const handleConfirm = () => {
    console.log('✅ [Map Picker] Location confirmed:', selectedLocation, address);
    onLocationSelected({
      ...selectedLocation,
      address: address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`,
    });
    onClose();
  };

  /**
   * Reverse geocode initial location
   */
  useEffect(() => {
    if (visible) {
      reverseGeocode(initialLatitude, initialLongitude);
    }

    // Cleanup timeout on unmount
    return () => {
      if (reverseGeocodeTimeout.current) {
        clearTimeout(reverseGeocodeTimeout.current);
      }
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Select Location</Text>
            <Text style={styles.headerSubtitle}>Drag pin to adjust</Text>
          </View>
          <View style={styles.closeButton} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: initialLatitude,
              longitude: initialLongitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {/* CartoDB Voyager tiles - More app-friendly than direct OSM */}
            <UrlTile
              urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />

            {/* Draggable Marker */}
            <Marker
              coordinate={selectedLocation}
              draggable
              onDragEnd={handleMarkerDragEnd}
              pinColor="#DC143C"
            >
              <View style={styles.customMarker}>
                <View style={styles.markerDot}>
                  <Ionicons name="location" size={40} color="#DC143C" />
                </View>
              </View>
            </Marker>
          </MapView>
        </View>

        {/* Address Display */}
        <View style={styles.addressContainer}>
          <View style={styles.addressHeader}>
            <Ionicons name="location-outline" size={20} color="#DC143C" />
            <Text style={styles.addressLabel}>Selected Location</Text>
            {isReverseGeocoding && (
              <ActivityIndicator size="small" color="#DC143C" style={styles.addressLoader} />
            )}
          </View>
          
          <Text style={styles.addressText} numberOfLines={3}>
            {address || 'Drag the pin or tap on the map to select location'}
          </Text>
          
          <View style={styles.coordinatesRow}>
            <Text style={styles.coordinatesText}>
              📍 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={!address && !isReverseGeocoding}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>

        {/* Help Hint */}
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.hintText}>
            Drag the red pin to adjust the exact location
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    alignItems: 'center',
  },
  markerDot: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 2,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addressContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  addressLoader: {
    marginLeft: 'auto',
  },
  addressText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  coordinatesRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#DC143C',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default LocationMapPicker;

