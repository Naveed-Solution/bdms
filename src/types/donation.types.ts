/**
 * Donation Type Definitions
 * 
 * TypeScript interfaces for donation-related data
 */

import { BloodType } from './user.types';

export interface Donation {
  id: string;
  donorId: string;
  bloodType: BloodType;
  units: number;
  donationDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonationHistory {
  donations: Donation[];
  totalDonations: number;
  lastDonationDate: string;
  nextEligibleDate: string;
}

export interface EligibilityCheck {
  isEligible: boolean;
  reason?: string;
  nextEligibleDate?: string;
  requirements: {
    minimumAge: boolean; // 18+
    minimumWeight: boolean; // 50kg+
    timeSinceLastDonation: boolean; // 56 days
    healthStatus: boolean;
  };
}

