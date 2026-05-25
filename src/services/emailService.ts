/**
 * Email Service
 * 
 * Handles communication with backend email API
 * Sends verification codes and verifies them
 */

// Backend API URL
// Updated to use your computer's IP address so mobile devices can connect
// Your computer IP: 

const API_URL = 'https://bdms-production-5878.up.railway.app/api';

export interface EmailServiceResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send verification code to email
 * 
 * @param email - Recipient email address
 * @param purpose - 'registration' or 'password-reset'
 * @returns Promise with response
 */
export async function sendVerificationCode(
  email: string,
  purpose: 'registration' | 'password-reset' = 'registration'
): Promise<EmailServiceResponse> {
  try {
    const response = await fetch(`${API_URL}/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, purpose }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send verification code');
    }

    return {
      success: true,
      message: data.message,
    };
  } catch (error) {
    console.error('❌ Email service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Verify code entered by user
 * 
 * @param email - User's email
 * @param code - 6-digit verification code
 * @returns Promise with response
 */
export async function verifyCode(
  email: string,
  code: string
): Promise<EmailServiceResponse> {
  try {
    const response = await fetch(`${API_URL}/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Invalid verification code');
    }

    return {
      success: true,
      message: data.message,
    };
  } catch (error) {
    console.error('❌ Verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

