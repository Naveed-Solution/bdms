import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ExpoLocation from 'expo-location';
import { useAuth } from '../context/AuthContext';

/**
 * ✅ LiveTrackingMap — rebuilt on Leaflet.js inside a WebView
 *
 * react-native-maps' <MapView> is a wrapper around the native Google Maps SDK
 * on Android REGARDLESS of which tile URLs are fed to it via <UrlTile>.
 * Without a configured com.google.android.geo.API_KEY in AndroidManifest.xml,
 * MapView.onCreate() throws IllegalStateException and crashes the app the
 * instant this component mounts. Leaflet-in-WebView has zero native map
 * dependency and needs no API key at all.
 */

interface Location {
  userId: string;
  userName: string;
  userRole: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
}

interface StaticLocation {
  latitude: number;
  longitude: number;
  updatedAt: number;
}

interface LiveTrackingMapProps {
  requestId: string;
  shareLocation?: boolean;
  donorId?: string;
  onLocationUpdate?: (latitude: number, longitude: number) => void;
  onRouteUpdate?: (distance: string, duration: string) => void;
}

const API_BASE_URL = 'https://bdms-production-5878.up.railway.app/api';

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  requestId,
  shareLocation = false,
  donorId,
  onLocationUpdate,
  onRouteUpdate,
}) => {
  const { user } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recipientStaticLocation, setRecipientStaticLocation] = useState<StaticLocation | null>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [webViewReady, setWebViewReady] = useState(false);

  /** Request location permission */
  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to use live tracking features.',
          [{ text: 'OK' }]
        );
      }
    })();
  }, []);

  /** Watch + push own location to backend if sharing */
  useEffect(() => {
    if (!locationPermission || !shareLocation) return;
    let locationSubscription: ExpoLocation.LocationSubscription | null = null;

    (async () => {
      try {
        locationSubscription = await ExpoLocation.watchPositionAsync(
          { accuracy: ExpoLocation.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (location) => {
            const { latitude, longitude } = location.coords;
            if (onLocationUpdate) onLocationUpdate(latitude, longitude);
            updateLocationOnServer(latitude, longitude);
          }
        );
      } catch (error) {
        console.error('Error watching location:', error);
      }
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [locationPermission, shareLocation, requestId]);

  const updateLocationOnServer = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, requestId, latitude, longitude }),
      });
      if (!response.ok) console.error('Failed to update location on server');
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  /** Fetch all locations for this request */
  const fetchLocations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/location/${requestId}`);
      const data = await response.json();

      if (data.success && data.locations) {
        const mappedLocations = data.locations.map((loc: any) => ({
          userId: loc.user_id,
          userName: loc.user_name,
          userRole: loc.user_role === 'user' ? 'recipient' : loc.user_role,
          latitude: loc.latitude,
          longitude: loc.longitude,
          updatedAt: loc.updated_at,
        }));

        const donorLocations = mappedLocations.filter((loc: Location) => loc.userRole === 'donor');
        const recipientLiveLocations = mappedLocations.filter((loc: Location) => loc.userRole === 'recipient');

        if (recipientLiveLocations.length > 0) {
          setRecipientName(recipientLiveLocations[0].userName);
        }

        setLocations([...donorLocations, ...recipientLiveLocations]);
      }

      if (data.recipientStaticLocation) {
        setRecipientStaticLocation({
          latitude: data.recipientStaticLocation.latitude,
          longitude: data.recipientStaticLocation.longitude,
          updatedAt: data.recipientStaticLocation.updatedAt,
        });
      }

      if (data.recipientName && !recipientName) {
        setRecipientName(data.recipientName);
      }
    } catch (error) {
      console.error('❌ [LiveTracking] Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Poll for location updates every 3s */
  useEffect(() => {
    if (!requestId) return;
    fetchLocations();
    const interval = setInterval(fetchLocations, 3000);
    return () => clearInterval(interval);
  }, [requestId]);

  /** Distance calc (haversine, km) */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /** Fetch route polyline from backend (OSRM) */
  const fetchRoute = async () => {
    if (!donorId) return;
    try {
      const url = `${API_BASE_URL}/route/${requestId}?donorId=${donorId}`;
      const response = await fetch(url);
      if (!response.ok) {
        setRouteCoordinates([]);
        if (onRouteUpdate) onRouteUpdate('', '');
        return;
      }
      const responseText = await response.text();
      const data = JSON.parse(responseText);

      if (data.success && data.route) {
        const { coordinates, distance, duration } = data.route;
        setRouteCoordinates(coordinates);
        if (onRouteUpdate) onRouteUpdate(`${distance} km`, `${duration} min`);
      } else {
        setRouteCoordinates([]);
        if (onRouteUpdate) onRouteUpdate('', '');
      }
    } catch (error) {
      console.error('❌ [Route] Error fetching route:', error);
      setRouteCoordinates([]);
      if (onRouteUpdate) onRouteUpdate('', '');
    }
  };

  useEffect(() => {
    const donor = locations.find((loc) => loc.userRole === 'donor');
    if (donor && recipientStaticLocation && donorId) {
      fetchRoute();
    } else {
      setRouteCoordinates([]);
      if (onRouteUpdate) onRouteUpdate('', '');
    }
  }, [locations, recipientStaticLocation, donorId]);

  /** Push fresh data into the already-loaded WebView map (no reload needed) */
  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;

    const validLocations = locations.filter(
      (loc) => loc.userId && loc.latitude && loc.longitude && !isNaN(loc.latitude) && !isNaN(loc.longitude)
    );
    const donorLocations = validLocations.filter((loc) => loc.userRole === 'donor');
    const recipientLiveLocations = validLocations.filter((loc) => loc.userRole === 'recipient');

    const donor = donorLocations[0];
    const distanceStr =
      donor && recipientStaticLocation
        ? (() => {
            const d = calculateDistance(
              donor.latitude,
              donor.longitude,
              recipientStaticLocation.latitude,
              recipientStaticLocation.longitude
            );
            return d < 1 ? `${(d * 1000).toFixed(0)} meters` : `${d.toFixed(2)} km`;
          })()
        : null;

    const payload = {
      donorLocations,
      recipientLiveLocations,
      recipientStaticLocation,
      recipientName,
      routeCoordinates,
      distanceStr,
    };

    webViewRef.current.postMessage(JSON.stringify({ type: 'update', payload }));
  }, [locations, recipientStaticLocation, routeCoordinates, recipientName, webViewReady]);

  const handleWebMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') setWebViewReady(true);
    } catch (_) {}
  };

  // Initial center: recipient target if known, else generic default (Pakistan)
  const initialLat = recipientStaticLocation?.latitude ?? 31.5204;
  const initialLng = recipientStaticLocation?.longitude ?? 74.3587;

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
    .label-badge {
      background: #fff; padding: 2px 6px; border-radius: 8px; border: 1px solid #ddd;
      font-size: 9px; font-weight: bold; color: #333; letter-spacing: 0.3px; white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${initialLat}, ${initialLng}], 12);
    L.tileLayer('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var donorMarkers = [];
    var recipientLiveMarkers = [];
    var targetMarker = null;
    var routeLine = null;

    function makeIcon(emoji, bg, label) {
      return L.divIcon({
        className: '',
        html: '<div style="display:flex;flex-direction:column;align-items:center;">' +
              '<div style="width:40px;height:40px;background:' + bg + ';border-radius:50%;border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;">' + emoji + '</div>' +
              '<div class="label-badge" style="margin-top:2px;">' + label + '</div>' +
              '</div>',
        iconSize: [60, 60],
        iconAnchor: [30, 40],
      });
    }

    function clearMarkers(arr) {
      arr.forEach(function(m) { map.removeLayer(m); });
      return [];
    }

    function render(payload) {
      donorMarkers = clearMarkers(donorMarkers);
      recipientLiveMarkers = clearMarkers(recipientLiveMarkers);
      if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }

      var bounds = [];

      (payload.donorLocations || []).forEach(function(loc) {
        var m = L.marker([loc.latitude, loc.longitude], { icon: makeIcon('🩸', '#DC143C', 'DONOR (LIVE)') }).addTo(map);
        m.bindPopup('<b>🩸 BLOOD DONOR</b><br/>' + (loc.userName || 'User'));
        donorMarkers.push(m);
        bounds.push([loc.latitude, loc.longitude]);
      });

      (payload.recipientLiveLocations || []).forEach(function(loc) {
        var m = L.marker([loc.latitude, loc.longitude], { icon: makeIcon('📍', '#2196F3', 'RECIPIENT (LIVE)') }).addTo(map);
        m.bindPopup('<b>📍 RECIPIENT (LIVE)</b><br/>' + (loc.userName || 'User'));
        recipientLiveMarkers.push(m);
        bounds.push([loc.latitude, loc.longitude]);
      });

      if (payload.recipientStaticLocation) {
        var t = payload.recipientStaticLocation;
        targetMarker = L.marker([t.latitude, t.longitude], { icon: makeIcon('🏥', '#4CAF50', 'TARGET LOCATION') }).addTo(map);
        targetMarker.bindPopup('<b>🏥 TARGET LOCATION</b><br/>' + (payload.recipientName || 'Recipient'));
        bounds.push([t.latitude, t.longitude]);
      }

      if (payload.routeCoordinates && payload.routeCoordinates.length > 0) {
        var latlngs = payload.routeCoordinates.map(function(c) { return [c.latitude, c.longitude]; });
        routeLine = L.polyline(latlngs, { color: '#2196F3', weight: 4 }).addTo(map);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    }

    document.addEventListener('message', function(e) { handleMessage(e.data); });
    window.addEventListener('message', function(e) { handleMessage(e.data); });

    function handleMessage(raw) {
      try {
        var msg = JSON.parse(raw);
        if (msg.type === 'update') render(msg.payload);
      } catch (err) {}
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>`;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: leafletHTML }}
        style={styles.map}
        onMessage={handleWebMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
      />
      {shareLocation && (
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Sharing Location</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  statusBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '600' },
});

export default LiveTrackingMap;
