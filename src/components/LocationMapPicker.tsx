import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

/**
 * LocationMapPicker
 *
 * Uses Leaflet.js inside a WebView — no native map module required.
 * Works in Expo Go with zero native build steps.
 * User can tap or drag the pin to choose a location.
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
  initialLatitude  = 34.0151,   // Default: Peshawar
  initialLongitude = 71.5249,
  onLocationSelected,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [address, setAddress] = useState('');
  const [coords, setCoords]   = useState({ latitude: initialLatitude, longitude: initialLongitude });
  const [isLoading, setIsLoading]       = useState(true);
  const [isGeocoding, setIsGeocoding]   = useState(false);
  const geocodeTimer = useRef<NodeJS.Timeout | null>(null);

  // Reset when modal opens with new initial coords
  useEffect(() => {
    if (visible) {
      setCoords({ latitude: initialLatitude, longitude: initialLongitude });
      setAddress('');
      setIsLoading(true);
      reverseGeocode(initialLatitude, initialLongitude);
    }
  }, [visible, initialLatitude, initialLongitude]);

  const reverseGeocode = async (lat: number, lon: number) => {
    setIsGeocoding(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'BDMS-App/1.0' } }
      );
      const data = await res.json();
      if (data?.address) {
        const a = data.address;
        const parts = [
          a.amenity || a.building,
          a.road || a.street,
          a.suburb || a.neighbourhood,
          a.city || a.town || a.village,
          a.state,
        ].filter(Boolean);
        setAddress(parts.join(', ') || data.display_name);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      }
    } catch (_) {
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Message from WebView when user taps/drags pin
  const handleWebMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'pin_moved') {
        const { lat, lng } = msg;
        setCoords({ latitude: lat, longitude: lng });
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(() => reverseGeocode(lat, lng), 600);
      }
    } catch (_) {}
  };

  const handleConfirm = () => {
    onLocationSelected({
      latitude:  coords.latitude,
      longitude: coords.longitude,
      address:   address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
    });
    onClose();
  };

  // ─── Leaflet HTML ────────────────────────────────────────────────────────
  const leafletHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-container { background: #e8e8e8; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${initialLatitude};
    var lng = ${initialLongitude};

    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var redIcon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;background:#DC143C;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });

    var marker = L.marker([lat, lng], { icon: redIcon, draggable: true }).addTo(map);

    function notifyPin(latlng) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'pin_moved',
        lat: latlng.lat,
        lng: latlng.lng,
      }));
    }

    marker.on('dragend', function(e) {
      notifyPin(e.target.getLatLng());
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      notifyPin(e.latlng);
    });
  </script>
</body>
</html>`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pin Location</Text>
            <Text style={styles.headerSub}>Tap map or drag pin to select</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: leafletHTML }}
            style={styles.map}
            onMessage={handleWebMessage}
            onLoadEnd={() => setIsLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            originWhitelist={['*']}
            mixedContentMode="always"
          />
          {isLoading && (
            <View style={styles.mapLoader}>
              <ActivityIndicator size="large" color="#DC143C" />
              <Text style={styles.mapLoaderText}>Loading map...</Text>
            </View>
          )}
        </View>

        {/* Address panel */}
        <View style={styles.panel}>
          <View style={styles.panelRow}>
            <Ionicons name="location" size={20} color="#DC143C" />
            <Text style={styles.panelLabel}>Selected Location</Text>
            {isGeocoding && <ActivityIndicator size="small" color="#DC143C" style={{ marginLeft: 'auto' }} />}
          </View>
          <Text style={styles.panelAddress} numberOfLines={2}>
            {address || 'Tap or drag the pin on the map'}
          </Text>
          <Text style={styles.panelCoords}>
            {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    ...Platform.select({
      android: { paddingTop: 16 },
    }),
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },

  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoaderText: { marginTop: 10, fontSize: 14, color: '#666' },

  panel: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#e0e0e0',
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  panelLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginLeft: 6 },
  panelAddress: { fontSize: 14, color: '#1a1a1a', lineHeight: 20, marginBottom: 4 },
  panelCoords: { fontSize: 11, color: '#999', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  actions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#DC143C', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#DC143C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  confirmBtnText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
});

export default LocationMapPicker;
