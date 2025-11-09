/**
 * Privacy utilities for GDPR-compliant PII handling
 * All PII must be stripped before sending to LLM services
 */

// Regex patterns for UK-specific PII
const PII_PATTERNS = {
  // UK Unique Taxpayer Reference (10 digits)
  UTR: /\b\d{10}\b/g,
  
  // UK National Insurance Number (format: AB123456C)
  NINO: /\b[A-Z]{2}\s?\d{6}\s?[A-Z]\b/gi,
  
  // UK Bank Account Numbers (8 digits)
  ACCOUNT_NUMBER: /\b\d{8}\b/g,
  
  // UK Sort Codes (format: 12-34-56 or 123456)
  SORT_CODE: /\b\d{2}[-\s]?\d{2}[-\s]?\d{2}\b/g,
  
  // UK Postcodes (flexible pattern)
  POSTCODE: /\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/gi,
  
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (UK format)
  PHONE: /\b(?:(?:\+44\s?|0)(?:\d\s?){9,10})\b/g,
  
  // Names (heuristic - catches Title Name Surname patterns)
  NAME: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
  
  // Addresses (heuristic - number + street)
  ADDRESS: /\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Close|Way|Court|Place)\b/gi,
  
  // Date of birth patterns (various formats)
  DOB: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{2,4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
};

/**
 * Anonymizes PII from text using regex patterns
 */
export const anonymizePII = (text: string): string => {
  if (!text) return text;
  
  let anonymized = text;
  
  // Apply all PII patterns
  anonymized = anonymized.replace(PII_PATTERNS.UTR, '[UTR_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.NINO, '[NINO_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.ACCOUNT_NUMBER, '[ACCOUNT_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.SORT_CODE, '[SORT_CODE_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.EMAIL, '[EMAIL_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.PHONE, '[PHONE_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.POSTCODE, '[POSTCODE_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.NAME, '[NAME_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.ADDRESS, '[ADDRESS_REMOVED]');
  anonymized = anonymized.replace(PII_PATTERNS.DOB, '[DOB_REMOVED]');
  
  return anonymized;
};

/**
 * Sanitizes data before sending to LLM
 */
export const sanitizeForLLM = (data: any): string => {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  return anonymizePII(jsonString);
};

/**
 * Validates that text doesn't contain PII
 * Returns array of detected PII types
 */
export const detectPII = (text: string): string[] => {
  const detected: string[] = [];
  
  if (PII_PATTERNS.UTR.test(text)) detected.push('UTR');
  if (PII_PATTERNS.NINO.test(text)) detected.push('NINO');
  if (PII_PATTERNS.ACCOUNT_NUMBER.test(text)) detected.push('Account Number');
  if (PII_PATTERNS.SORT_CODE.test(text)) detected.push('Sort Code');
  if (PII_PATTERNS.EMAIL.test(text)) detected.push('Email');
  if (PII_PATTERNS.PHONE.test(text)) detected.push('Phone');
  if (PII_PATTERNS.POSTCODE.test(text)) detected.push('Postcode');
  if (PII_PATTERNS.NAME.test(text)) detected.push('Name');
  if (PII_PATTERNS.ADDRESS.test(text)) detected.push('Address');
  if (PII_PATTERNS.DOB.test(text)) detected.push('Date of Birth');
  
  return detected;
};

/**
 * Privacy middleware for logging data access
 */
export const privacyMiddleware = {
  /**
   * Log data access for GDPR audit trail
   */
  logDataAccess: async (
    userId: string,
    dataType: string,
    action: string,
    metadata?: Record<string, any>
  ) => {
    // Import here to avoid circular dependency
    const { supabaseAdmin } = await import('@/lib/supabase/client');
    
    return await (supabaseAdmin as any).from('audit_logs').insert({
      user_id: userId,
      action,
      data_type: dataType,
      metadata: metadata || {}
    });
  },
  
  /**
   * Ensure no PII in LLM calls
   */
  sanitizeForLLM,
  
  /**
   * Validate data before processing
   */
  validateNoPII: (text: string): { valid: boolean; detected: string[] } => {
    const detected = detectPII(text);
    return {
      valid: detected.length === 0,
      detected
    };
  }
};

/**
 * Extract structured data without PII
 */
export const extractStructuredData = (text: string) => {
  const anonymized = anonymizePII(text);
  
  // Extract dates
  const dates = extractDates(anonymized);
  
  // Extract reference numbers (non-PII identifiers)
  const references = extractReferences(anonymized);
  
  // Extract monetary amounts
  const amounts = extractAmounts(anonymized);
  
  // Extract HMRC department mentions
  const departments = extractDepartments(anonymized);
  
  return {
    dates,
    references,
    amounts,
    departments,
    text: anonymized
  };
};

// Helper functions for structured data extraction
const extractDates = (text: string): string[] => {
  const datePattern = /\b(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})\b/gi;
  return text.match(datePattern) || [];
};

const extractReferences = (text: string): string[] => {
  // Extract reference numbers (typically alphanumeric codes that aren't PII)
  const refPattern = /\bRef(?:erence)?[\s:]*([\w\-\/]+)\b/gi;
  const matches = text.matchAll(refPattern);
  return Array.from(matches, m => m[1]);
};

const extractAmounts = (text: string): string[] => {
  const amountPattern = /£\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
  return text.match(amountPattern) || [];
};

const extractDepartments = (text: string): string[] => {
  const departments = [
    'VAT',
    'Self Assessment',
    'PAYE',
    'Corporation Tax',
    'CIS',
    'Compliance',
    'Debt Management',
    'Adjudicator',
    'Tax Credits',
    'National Insurance'
  ];
  
  const found: string[] = [];
  departments.forEach(dept => {
    if (text.includes(dept)) {
      found.push(dept);
    }
  });
  
  return found;
};

