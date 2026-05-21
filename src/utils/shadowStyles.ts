import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-Platform Shadow Utility
 * 
 * Creates platform-appropriate shadow styles
 * - iOS: Uses shadowColor, shadowOffset, shadowOpacity, shadowRadius
 * - Android: Uses elevation
 * - Web: Uses boxShadow
 * 
 * Usage:
 * const styles = StyleSheet.create({
 *   card: {
 *     ...shadow(2), // For elevation-based
 *     // or
 *     ...shadowStyle({ color: '#000', offset: { width: 0, height: 2 }, opacity: 0.1, radius: 4, elevation: 3 })
 *   }
 * });
 */

interface ShadowProps {
  color?: string;
  offset?: { width: number; height: number };
  opacity?: number;
  radius?: number;
  elevation?: number;
}

/**
 * Generate cross-platform shadow styles
 * 
 * @param props - Shadow configuration
 * @returns Platform-appropriate styles
 */
export const shadowStyle = (props: ShadowProps): ViewStyle => {
  const {
    color = '#000',
    offset = { width: 0, height: 2 },
    opacity = 0.25,
    radius = 3.84,
    elevation = 5,
  } = props;

  if (Platform.OS === 'web') {
    // Web: Use boxShadow
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    } as ViewStyle;
  }

  if (Platform.OS === 'android') {
    // Android: Use elevation
    return {
      elevation,
    };
  }

  // iOS: Use shadow properties
  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
  };
};

/**
 * Predefined shadow presets based on Material Design elevation
 */
export const shadow = {
  // Elevation 1: Small shadow for subtle depth
  sm: shadowStyle({
    color: '#000',
    offset: { width: 0, height: 1 },
    opacity: 0.18,
    radius: 1.0,
    elevation: 1,
  }),

  // Elevation 2: Default shadow for cards
  md: shadowStyle({
    color: '#000',
    offset: { width: 0, height: 2 },
    opacity: 0.2,
    radius: 2.5,
    elevation: 2,
  }),

  // Elevation 3: Medium shadow
  lg: shadowStyle({
    color: '#000',
    offset: { width: 0, height: 2 },
    opacity: 0.23,
    radius: 3.84,
    elevation: 3,
  }),

  // Elevation 4: Prominent shadow
  xl: shadowStyle({
    color: '#000',
    offset: { width: 0, height: 4 },
    opacity: 0.25,
    radius: 5.0,
    elevation: 4,
  }),

  // Elevation 6: Large shadow for floating elements
  '2xl': shadowStyle({
    color: '#000',
    offset: { width: 0, height: 6 },
    opacity: 0.27,
    radius: 8.0,
    elevation: 6,
  }),

  // Custom crimson shadow for blood-related UI
  crimson: shadowStyle({
    color: '#DC143C',
    offset: { width: 0, height: 4 },
    opacity: 0.3,
    radius: 8.0,
    elevation: 4,
  }),
};

/**
 * No shadow (useful for removing shadows conditionally)
 */
export const noShadow = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
  ...(Platform.OS === 'web' ? { boxShadow: 'none' } : {}),
} as ViewStyle;

