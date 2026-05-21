/**
 * Blood Request Type Definitions
 * 
 * TypeScript interfaces for blood request data
 */

import { BloodType } from './user.types';

export type RequestUrgency = 'low' | 'medium' | 'high' | 'emergency';
export type RequestStatus = 'pending' | 'fulfilled' | 'cancelled' | 'expired';

export interface BloodRequest {
  id: string;
  userId: string;
  userName: string;
  bloodType: BloodType;
  units: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  notes?: string;
  requestDate: string;
  expiryDate: string;
  responses?: RequestResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface RequestResponse {
  id: string;
  requestId: string;
  donorId: string;
  donorName: string;
  donorBloodType: BloodType;
  response: 'accepted' | 'declined';
  message?: string;
  responseDate: string;
}

export interface EmergencyRequest extends BloodRequest {
  urgency: 'emergency';
  contactNumber: string;
}

