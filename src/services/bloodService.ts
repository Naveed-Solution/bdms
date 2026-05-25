/**
 * Blood Service
 * API calls related to blood donations and requests
 */

const BASE_URL = 'https://bdms-production-5878.up.railway.app/api';

/**
 * Search for blood donors by blood type
 */
export async function searchDonors(bloodType: string, location: string) {
  try {
    const response = await fetch(
      `${BASE_URL}/donors/search?bloodType=${bloodType}&location=${location}`
    );
    
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Donor search error:', error);
    throw error;
  }
}

/**
 * Create emergency blood request
 */
export async function createEmergencyRequest(data: {
  bloodType: string;
  units: number;
  location: string;
  urgency: string;
}) {
  try {
    const response = await fetch(`${BASE_URL}/requests/emergency`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create emergency request');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Emergency request error:', error);
    throw error;
  }
}


