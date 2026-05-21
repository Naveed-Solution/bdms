/**
 * OpenStreetMap Services API
 * 
 * ✅ COMPLETELY FREE - No API keys, no billing, no credit cards
 * 
 * This module provides location services using open-source alternatives:
 * - Nominatim: Primary search, geocoding, and reverse geocoding
 * - OSRM: Routing and directions
 * 
 * IMPORTANT: Nominatim requires User-Agent header and has 1 req/sec rate limit
 * All services are community-provided and free for reasonable use.
 */

/**
 * Photon API - Fast Location Search (Alternative)
 * https://photon.komoot.io
 * 
 * NOTE: Not used as primary search due to address accuracy
 * Keeping for reference/fallback
 */
export const photonAPI = {
  /**
   * Search for locations by query
   * @param query - Search term (e.g., "Jinnah Hospital Lahore")
   * @param options - Optional search parameters
   */
  search: async (
    query: string, 
    options?: {
      limit?: number;
      countryCode?: string; // e.g., 'pk' for Pakistan
      lat?: number;
      lon?: number;
      radius?: number; // in km
    }
  ) => {
    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit || 5),
      lang: 'en',
    });

    if (options?.countryCode) {
      params.append('countrycodes', options.countryCode);
    }

    if (options?.lat && options?.lon) {
      params.append('lat', String(options.lat));
      params.append('lon', String(options.lon));
    }

    const url = `https://photon.komoot.io/api/?${params.toString()}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return { results: [], error: null };
      }

      const results = data.features.map((feature: any) => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates; // [lng, lat] in GeoJSON

        // Build human-readable address
        const addressParts = [
          props.name,
          props.street,
          props.housenumber,
          props.city || props.district,
          props.state,
          props.country
        ].filter(Boolean);

        return {
          name: props.name || '',
          displayName: addressParts.join(', '),
          address: {
            street: props.street,
            city: props.city || props.district,
            state: props.state,
            country: props.country,
            postcode: props.postcode,
          },
          coordinates: {
            latitude: coords[1], // GeoJSON uses [lng, lat]
            longitude: coords[0],
          },
          osmId: props.osm_id,
          osmType: props.osm_type,
          type: props.type,
        };
      });

      return { results, error: null };
    } catch (error) {
      console.error('[OSM Photon] Search error:', error);
      return { 
        results: [], 
        error: error instanceof Error ? error.message : 'Search failed' 
      };
    }
  },
};

/**
 * Nominatim API - Reverse Geocoding
 * https://nominatim.openstreetmap.org
 * 
 * Free reverse geocoding service
 * REQUIRED: Must include User-Agent header (OSM policy)
 * Rate limit: 1 request per second
 */
export const nominatimAPI = {
  /**
   * Convert coordinates to address (reverse geocoding)
   * @param latitude - Latitude coordinate
   * @param longitude - Longitude coordinate
   */
  reverseGeocode: async (latitude: number, longitude: number) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BDMS-BloodDonationApp/1.0', // Required by Nominatim
        },
      });

      const data = await response.json();

      if (!data || data.error) {
        return { 
          address: null, 
          error: data?.error || 'No address found' 
        };
      }

      const addr = data.address || {};

      // Build formatted address
      const addressParts = [
        addr.amenity || addr.building || addr.house_number,
        addr.road || addr.street,
        addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.village,
        addr.state,
        addr.country
      ].filter(Boolean);

      return {
        address: {
          formatted: addressParts.join(', '),
          displayName: data.display_name,
          street: addr.road || addr.street,
          city: addr.city || addr.town || addr.village,
          state: addr.state,
          country: addr.country,
          postcode: addr.postcode,
          coordinates: {
            latitude: parseFloat(data.lat),
            longitude: parseFloat(data.lon),
          },
        },
        error: null,
      };
    } catch (error) {
      console.error('[OSM Nominatim] Reverse geocoding error:', error);
      return { 
        address: null, 
        error: error instanceof Error ? error.message : 'Reverse geocoding failed' 
      };
    }
  },

  /**
   * Search for address (forward geocoding)
   * @param address - Address string to search
   */
  geocode: async (address: string, countryCode?: string) => {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      addressdetails: '1',
      limit: '5',
    });

    if (countryCode) {
      params.append('countrycodes', countryCode);
    }

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BDMS-BloodDonationApp/1.0',
        },
      });

      const data = await response.json();

      if (!data || data.length === 0) {
        return { results: [], error: null };
      }

      const results = data.map((item: any) => ({
        displayName: item.display_name,
        coordinates: {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        },
        address: item.address,
        osmId: item.osm_id,
        osmType: item.osm_type,
      }));

      return { results, error: null };
    } catch (error) {
      console.error('[OSM Nominatim] Geocoding error:', error);
      return { 
        results: [], 
        error: error instanceof Error ? error.message : 'Geocoding failed' 
      };
    }
  },
};

/**
 * OSRM API - Routing and Directions
 * https://project-osrm.org
 * 
 * Free routing service for calculating routes between points
 * Public server available at: https://router.project-osrm.org
 */
export const osrmAPI = {
  /**
   * Get route between two points
   * @param start - Starting coordinates {lat, lng}
   * @param end - Ending coordinates {lat, lng}
   */
  getRoute: async (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ) => {
    // OSRM format: longitude,latitude (opposite of typical)
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return { route: null, error: 'No route found' };
      }

      const route = data.routes[0];

      return {
        route: {
          distance: route.distance, // in meters
          duration: route.duration, // in seconds
          geometry: route.geometry, // GeoJSON LineString
          steps: route.legs[0]?.steps || [],
        },
        error: null,
      };
    } catch (error) {
      console.error('[OSRM] Routing error:', error);
      return { 
        route: null, 
        error: error instanceof Error ? error.message : 'Routing failed' 
      };
    }
  },

  /**
   * Calculate distance matrix between multiple points
   */
  getDistanceMatrix: async (
    sources: Array<{ latitude: number; longitude: number }>,
    destinations: Array<{ latitude: number; longitude: number }>
  ) => {
    // Convert to OSRM format: longitude,latitude
    const coords = [...sources, ...destinations]
      .map(c => `${c.longitude},${c.latitude}`)
      .join(';');

    const sourceIndices = sources.map((_, i) => i).join(';');
    const destIndices = destinations.map((_, i) => i + sources.length).join(';');

    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=${sourceIndices}&destinations=${destIndices}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code !== 'Ok') {
        return { matrix: null, error: 'Matrix calculation failed' };
      }

      return {
        matrix: {
          durations: data.durations, // in seconds
          distances: data.distances, // in meters
        },
        error: null,
      };
    } catch (error) {
      console.error('[OSRM] Distance matrix error:', error);
      return { 
        matrix: null, 
        error: error instanceof Error ? error.message : 'Matrix calculation failed' 
      };
    }
  },
};

/**
 * Usage Examples:
 * 
 * // Search for locations
 * const { results } = await photonAPI.search('Jinnah Hospital Lahore', {
 *   countryCode: 'pk',
 *   limit: 5
 * });
 * 
 * // Reverse geocode coordinates
 * const { address } = await nominatimAPI.reverseGeocode(31.5204, 74.3587);
 * 
 * // Get route between two points
 * const { route } = await osrmAPI.getRoute(
 *   { latitude: 31.5204, longitude: 74.3587 },
 *   { latitude: 31.5497, longitude: 74.3436 }
 * );
 */

