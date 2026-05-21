/**
 * Formatting Utilities
 * Functions to format data for display
 */

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format time to readable string
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate days until next donation
 */
export function daysUntilNextDonation(lastDonationDate: Date | string): number {
  const last = typeof lastDonationDate === 'string' 
    ? new Date(lastDonationDate) 
    : lastDonationDate;
  
  const nextEligible = new Date(last);
  nextEligible.setDate(nextEligible.getDate() + 56); // 8 weeks
  
  const today = new Date();
  const diffTime = nextEligible.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Format distance to location
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  
  const km = meters / 1000;
  return `${km.toFixed(1)}km`;
}

