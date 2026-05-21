/**
 * User Type Definitions
 * 
 * TypeScript interfaces for user-related data
 */

export type UserRole = 'donor' | 'user' | null;

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  bloodType?: BloodType;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Donor extends User {
  role: 'donor';
  bloodType: BloodType;
  lastDonationDate?: string;
  totalDonations: number;
  isEligible: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  medicalInfo?: {
    weight: number;
    height: number;
    allergies?: string[];
    medications?: string[];
  };
}

export interface RegularUser extends User {
  role: 'user';
}

