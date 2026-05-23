import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, UrlTile, Callout, Polyline } from 'react-native-maps';
import * as ExpoLocation from 'expo-location';
import { useAuth } from '../context/AuthContext';

/**
 * ✅ MIGRATED FROM GOOGLE MAPS TO OPENSTREETMAP
 * - Removed PROVIDER_GOOGLE
 * - Using OpenStreetMap tiles (free, no API key needed)
 * - All geocoding/search uses Photon API (OSM-based)
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

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ 
  requestId, 
  shareLocation = false,
  donorId,
  onLocationUpdate,
  onRouteUpdate 
}) => {
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recipientStaticLocation, setRecipientStaticLocation] = useState<StaticLocation | null>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);

  console.log('🗺️ [LiveTrackingMap] Render:', {
    requestId,
    shareLocation,
    donorId,
    loading,
    hasTarget: !!recipientStaticLocation,
    locationsCount: locations.length,
    userRole: user?.role
  });

  /**
   * Request location permission
   */
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

  /**
   * Get current location and update continuously if sharing
   */
  useEffect(() => {
    if (!locationPermission || !shareLocation) return;

    let locationSubscription: ExpoLocation.LocationSubscription | null = null;

    (async () => {
      try {
        // Start watching position
        locationSubscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.High,
            timeInterval: 3000, // Update every 3 seconds
            distanceInterval: 5, // Or when moved 5 meters
          },
          (location) => {
            const { latitude, longitude } = location.coords;
            setMyLocation({ latitude, longitude });
            
            // Send location to backend
            if (onLocationUpdate) {
              onLocationUpdate(latitude, longitude);
            }
            
            updateLocationOnServer(latitude, longitude);
          }
        );
      } catch (error) {
        console.error('Error watching location:', error);
      }
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationPermission, shareLocation, requestId]);

  /**
   * Update location on server
   */
  const updateLocationOnServer = async (latitude: number, longitude: number) => {
    try {
      const API_BASE_URL = 'http://https://192.168.1.26/api';
      const response = await fetch(`${API_BASE_URL}/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          requestId,
          latitude,
          longitude,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update location on server');
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  /**
   * Fetch all locations for this request
   */
  const fetchLocations = async () => {
    console.log('📡 [LiveTrackingMap] Fetching locations for request:', requestId);
    try {
      const API_BASE_URL = 'http://https://192.168.1.26/api';
      const response = await fetch(`${API_BASE_URL}/location/${requestId}`);
      const data = await response.json();
      
      console.log('📡 [LiveTrackingMap] API Response:', {
        success: data.success,
        locationsCount: data.locations?.length,
        hasRecipientStatic: !!data.recipientStaticLocation,
        shareLocation: data.shareLocation
      });

      if (data.success && data.locations) {
        // Map snake_case to camelCase
        const mappedLocations = data.locations.map((loc: any) => ({
          userId: loc.user_id,
          userName: loc.user_name,
          userRole: loc.user_role === 'user' ? 'recipient' : loc.user_role,
          latitude: loc.latitude,
          longitude: loc.longitude,
          updatedAt: loc.updated_at,
        }));
        
        // Separate donor live location from recipient live location
        const donorLocations = mappedLocations.filter((loc: Location) => loc.userRole === 'donor');
        const recipientLiveLocations = mappedLocations.filter((loc: Location) => loc.userRole === 'recipient');
        
        // Store recipient name if available
        if (recipientLiveLocations.length > 0) {
          setRecipientName(recipientLiveLocations[0].userName);
        }
        
        // Store donor locations and recipient live locations (if sharing)
        setLocations([...donorLocations, ...recipientLiveLocations]);
        
        console.log('📍 [LiveTracking] Donors:', donorLocations.length, 'Recipients (live):', recipientLiveLocations.length);
      }

      // Store recipient's static target location and name
      if (data.recipientStaticLocation) {
        setRecipientStaticLocation({
          latitude: data.recipientStaticLocation.latitude,
          longitude: data.recipientStaticLocation.longitude,
          updatedAt: data.recipientStaticLocation.updatedAt,
        });
        console.log('🎯 [LiveTracking] Target location set');
      }

      if (data.recipientName && !recipientName) {
        setRecipientName(data.recipientName);
      }
    } catch (error) {
      console.error('❌ [LiveTracking] Error fetching locations:', error);
    } finally {
      console.log('✅ [LiveTrackingMap] Setting loading to false');
      setLoading(false);
    }
  };

  /**
   * Poll for location updates
   */
  useEffect(() => {
    if (!requestId) return;

    fetchLocations();

    const interval = setInterval(fetchLocations, 3000); // Fetch every 3 seconds

    return () => clearInterval(interval);
  }, [requestId]);

  /**
   * Intelligently zoom to fit all markers
   */
  useEffect(() => {
    if (mapRef.current) {
      const validLocations = locations.filter(
        loc => loc.userId && loc.latitude && loc.longitude && 
              !isNaN(loc.latitude) && !isNaN(loc.longitude)
      );

      const coordinates: { latitude: number; longitude: number }[] = [];

      // Add all live locations
      validLocations.forEach(loc => {
        coordinates.push({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      });

      // Always add recipient's static target location
      if (recipientStaticLocation) {
        coordinates.push({
          latitude: recipientStaticLocation.latitude,
          longitude: recipientStaticLocation.longitude,
        });
      }

      if (coordinates.length > 0) {
        console.log('🎯 [LiveTracking] Auto-zooming to fit', coordinates.length, 'markers');

        // Delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates(coordinates, {
              edgePadding: {
                top: 100,
                right: 80,
                bottom: 200,
                left: 80,
              },
              animated: true,
            });
          }
        }, 500);
      }
    }
  }, [locations, recipientStaticLocation]);

  /**
   * Calculate initial region
   */
  const getInitialRegion = () => {
    // Prefer recipient's target location as the center
    if (recipientStaticLocation) {
      return {
        latitude: recipientStaticLocation.latitude,
        longitude: recipientStaticLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    if (myLocation) {
      return {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    if (locations.length > 0) {
      const firstLocation = locations[0];
      return {
        latitude: firstLocation.latitude,
        longitude: firstLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Default to a generic location if no data available
    return {
      latitude: 31.5204, // Lahore, Pakistan (default)
      longitude: 74.3587,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  /**
   * Calculate distance between two coordinates (in km)
   */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * Get distance between donor and target location
   */
  const getDistanceToTarget = (): string | null => {
    const donor = locations.find(loc => loc.userRole === 'donor');

    if (donor && recipientStaticLocation) {
      const distance = calculateDistance(
        donor.latitude,
        donor.longitude,
        recipientStaticLocation.latitude,
        recipientStaticLocation.longitude
      );

      const distanceStr = distance < 1 
        ? `${(distance * 1000).toFixed(0)} meters` 
        : `${distance.toFixed(2)} km`;

      return distanceStr;
    }

    return null;
  };

  /**
   * Fetch route from backend API
   * Backend calculates route using OSRM
   */
  const fetchRoute = async () => {
    if (!donorId) {
      console.log('⚠️ [Route] No donor ID, skipping route calculation');
      return;
    }

    try {
      const API_BASE_URL = 'http://https://192.168.1.26/api';
      const url = `${API_BASE_URL}/route/${requestId}?donorId=${donorId}`;
      
      console.log('🛣️ [Route] Fetching from backend:', url);
      console.log('🛣️ [Route] Request ID:', requestId, 'Donor ID:', donorId);
      
      const response = await fetch(url);
      
      console.log('🛣️ [Route] Response status:', response.status, response.statusText);
      
      // Check if response is OK
      if (!response.ok) {
        console.error('❌ [Route] HTTP error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ [Route] Error response:', errorText);
        setRouteCoordinates([]);
        if (onRouteUpdate) {
          onRouteUpdate('', '');
        }
        return;
      }
      
      // Get response text first to debug
      const responseText = await response.text();
      console.log('🛣️ [Route] Response text:', responseText.substring(0, 200));
      
      // Parse JSON
      const data = JSON.parse(responseText);
      console.log('🛣️ [Route] Parsed data:', data);
      
      if (data.success && data.route) {
        const { coordinates, distance, duration } = data.route;
        
        console.log('✅ [Route] Route received:', coordinates.length, 'points,', distance, 'km,', duration, 'min');
        
        setRouteCoordinates(coordinates);
        
        // Notify parent component about route update
        if (onRouteUpdate) {
          onRouteUpdate(`${distance} km`, `${duration} min`);
        }
        
        console.log('✅ [Route] Route updated successfully');
      } else {
        console.log('⚠️ [Route] No route available:', data.error || 'Unknown error');
        setRouteCoordinates([]);
        if (onRouteUpdate) {
          onRouteUpdate('', '');
        }
      }
    } catch (error) {
      console.error('❌ [Route] Error fetching route:', error);
      console.error('❌ [Route] Error details:', JSON.stringify(error, null, 2));
      setRouteCoordinates([]);
      if (onRouteUpdate) {
        onRouteUpdate('', '');
      }
    }
  };

  /**
   * Update route when donor location changes
   */
  useEffect(() => {
    const donor = locations.find(loc => loc.userRole === 'donor');
    
    if (donor && recipientStaticLocation && donorId) {
      console.log('🔄 [Route] Updating route - donor moved or target changed');
      fetchRoute();
    } else {
      // Clear route if donor or target is missing
      setRouteCoordinates([]);
      if (onRouteUpdate) {
        onRouteUpdate('', '');
      }
    }
  }, [locations, recipientStaticLocation, donorId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const validLocations = locations.filter(
    loc => loc.userId && loc.latitude && loc.longitude && 
          !isNaN(loc.latitude) && !isNaN(loc.longitude)
  );

  const donorLocations = validLocations.filter(loc => loc.userRole === 'donor');
  const recipientLiveLocations = validLocations.filter(loc => loc.userRole === 'recipient');

  console.log('🗺️ [LiveTracking] Rendering map:', {
    donorsCount: donorLocations.length,
    recipientsLiveCount: recipientLiveLocations.length,
    hasTarget: !!recipientStaticLocation,
    shareLocation
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation={Boolean(locationPermission && shareLocation)}
        showsMyLocationButton={Boolean(locationPermission)}
        showsCompass={true}
        loadingEnabled={true}
        mapType="standard"
      >
        {/* CartoDB Voyager tiles - More app-friendly than direct OSM */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {/* Route from donor to target (BLUE LINE) */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#2196F3" // Blue route line
            strokeWidth={4}
            lineDashPattern={[1]} // Solid line
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Donor live location markers (RED) */}
        {donorLocations.map((location, index) => (
          <Marker
            key={`donor-${location.userId}-${index}`}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            pinColor="red"
          >
            <View style={styles.markerWrapper}>
              <View style={[styles.customMarkerContainer, { backgroundColor: '#DC143C' }]}>
                <Text style={styles.markerEmoji}>🩸</Text>
              </View>
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>DONOR (LIVE)</Text>
              </View>
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>🩸 BLOOD DONOR</Text>
                <Text style={styles.calloutName}>{location.userName || 'User'}</Text>
                <Text style={styles.calloutTime}>
                  Live • Updated: {new Date(location.updatedAt * 1000).toLocaleTimeString()}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Recipient static target location (GREEN) - Always visible */}
        {recipientStaticLocation && (
          <Marker
            key="recipient-target"
            coordinate={{
              latitude: recipientStaticLocation.latitude,
              longitude: recipientStaticLocation.longitude,
            }}
            pinColor="green"
          >
            <View style={styles.markerWrapper}>
              <View style={[styles.customMarkerContainer, { backgroundColor: '#4CAF50' }]}>
                <Text style={styles.markerEmoji}>🏥</Text>
              </View>
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>TARGET LOCATION</Text>
              </View>
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>🏥 TARGET LOCATION</Text>
                <Text style={styles.calloutName}>{recipientName || 'Recipient'}</Text>
                <Text style={styles.calloutTime}>Blood needed here</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {/* Recipient live location (BLUE) - Only if sharing */}
        {recipientLiveLocations.map((location, index) => (
          <Marker
            key={`recipient-live-${location.userId}-${index}`}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            pinColor="blue"
          >
            <View style={styles.markerWrapper}>
              <View style={[styles.customMarkerContainer, { backgroundColor: '#2196F3' }]}>
                <Text style={styles.markerEmoji}>📍</Text>
              </View>
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>RECIPIENT (LIVE)</Text>
              </View>
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>📍 RECIPIENT (LIVE)</Text>
                <Text style={styles.calloutName}>{location.userName || 'User'}</Text>
                <Text style={styles.calloutTime}>
                  Live • Updated: {new Date(location.updatedAt * 1000).toLocaleTimeString()}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Minimal Status Indicator (Optional - can be removed) */}
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
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  markerWrapper: {
    alignItems: 'center',
  },
  customMarkerContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 22,
  },
  markerLabel: {
    marginTop: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  markerLabelText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 0.3,
  },
  calloutContainer: {
    padding: 10,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  calloutName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  calloutTime: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
});

export default LiveTrackingMap;


