/**
 * Practice/Firm Settings
 * Store user's practice details for letter generation
 */

export interface PracticeSettings {
  firmName: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  chargeOutRate?: number; // £ per hour for professional fees
  defaultSignatory?: string; // Name for letter signing
}

const STORAGE_KEY = 'lightpoint_practice_settings';

/**
 * Get practice settings from localStorage
 */
export function getPracticeSettings(): PracticeSettings | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load practice settings:', error);
    return null;
  }
}

/**
 * Save practice settings to localStorage
 */
export function savePracticeSettings(settings: PracticeSettings): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('✅ Practice settings saved');
  } catch (error) {
    console.error('Failed to save practice settings:', error);
    throw new Error('Failed to save settings');
  }
}

/**
 * Clear practice settings
 */
export function clearPracticeSettings(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEY);
  console.log('🗑️ Practice settings cleared');
}

/**
 * Get practice letterhead text for letter generation
 */
export function getPracticeLetterhead(): string {
  const settings = getPracticeSettings();
  
  if (!settings) {
    // Default fallback
    return `Professional Accountancy Services Ltd

45 Victoria Street
Westminster
London SW1H 0EU
Tel: 020 7946 0832
Email: complaints@professional-accounting.co.uk`;
  }
  
  const { firmName, address, contact } = settings;
  
  return `${firmName}

${address.line1}
${address.line2 ? address.line2 + '\n' : ''}${address.city}
${address.postcode}
Tel: ${contact.phone}
Email: ${contact.email}`;
}

/**
 * Check if practice settings are configured
 */
export function hasPracticeSettings(): boolean {
  return getPracticeSettings() !== null;
}

