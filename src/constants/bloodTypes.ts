/**
 * Blood Type Constants
 * 
 * Blood type definitions and compatibility rules
 */

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export type BloodType = typeof BLOOD_TYPES[number];

/**
 * Blood compatibility matrix
 * Key: Recipient blood type
 * Value: Array of compatible donor blood types
 */
export const BLOOD_COMPATIBILITY: Record<BloodType, BloodType[]> = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // Universal recipient
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-'], // Universal donor (can receive only from O-)
};

/**
 * Check if donor blood type is compatible with recipient
 */
export function isCompatible(donorType: BloodType, recipientType: BloodType): boolean {
  return BLOOD_COMPATIBILITY[recipientType].includes(donorType);
}

/**
 * Get list of compatible donors for a recipient
 */
export function getCompatibleDonors(recipientType: BloodType): BloodType[] {
  return BLOOD_COMPATIBILITY[recipientType];
}

/**
 * Get list of recipients who can receive from this donor
 */
export function getCompatibleRecipients(donorType: BloodType): BloodType[] {
  return BLOOD_TYPES.filter(recipientType => 
    BLOOD_COMPATIBILITY[recipientType].includes(donorType)
  );
}

