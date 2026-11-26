/**
 * Content Moderation Utilities
 * 
 * Provides profanity filtering for user-generated content including:
 * - Usernames
 * - Display names
 * - Section titles
 * - Bio text
 * - Any other text input
 * 
 * Uses leo-profanity library which handles:
 * - English profanity
 * - Leetspeak substitutions (e.g., "a$$", "sh1t")
 * - Common obfuscation patterns
 * - Case-insensitive matching
 */

let profanityFilter: any = null;
let filterInitialized = false;

/**
 * Lazy-load the profanity filter
 * This prevents errors if leo-profanity isn't installed yet
 */
function getProfanityFilter() {
  if (filterInitialized) {
    return profanityFilter;
  }

  try {
    profanityFilter = require('leo-profanity');
    filterInitialized = true;
    
    // Optional: Add custom words to the filter
    // profanityFilter.add(['customword1', 'customword2']);
    
    return profanityFilter;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[content-moderation] leo-profanity not installed. Profanity filtering disabled.');
      console.warn('[content-moderation] Install with: npm install leo-profanity');
    }
    filterInitialized = true; // Don't keep trying
    return null;
  }
}

export function containsProfanity(text: string): boolean {
  const filter = getProfanityFilter();
  if (!filter) return false;
  
  return filter.check(text);
}

export function cleanProfanity(text: string): string {
  const filter = getProfanityFilter();
  if (!filter) return text;
  
  return filter.clean(text);
}

/**
 * Get list of profane words found in text
 */
export function listProfanity(text: string): string[] {
  const filter = getProfanityFilter();
  if (!filter) return [];
  
  return filter.list(text);
}

export interface ContentValidationResult {
  valid: boolean;
  cleaned?: string;
  profaneWords?: string[];
  reason?: string;
}

export function validateUsername(username: string): ContentValidationResult {
  if (containsProfanity(username)) {
    return {
      valid: false,
      reason: 'Username contains inappropriate language',
      profaneWords: listProfanity(username),
    };
  }
  
  return { valid: true };
}

export function validateDisplayName(displayName: string): ContentValidationResult {
  if (containsProfanity(displayName)) {
    return {
      valid: false,
      reason: 'Display name contains inappropriate language',
      profaneWords: listProfanity(displayName),
    };
  }
  
  return { valid: true };
}

export function validateSectionTitle(title: string): ContentValidationResult {
  if (containsProfanity(title)) {
    return {
      valid: false,
      reason: 'Title contains inappropriate language',
      profaneWords: listProfanity(title),
    };
  }
  
  return { valid: true };
}

/**
 * Validate bio text (optional: can auto-clean instead of rejecting)
 */
export function validateBio(bio: string, autoClean: boolean = false): ContentValidationResult {
  if (containsProfanity(bio)) {
    if (autoClean) {
      return {
        valid: true,
        cleaned: cleanProfanity(bio),
        profaneWords: listProfanity(bio),
      };
    }
    
    return {
      valid: false,
      reason: 'Bio contains inappropriate language',
      profaneWords: listProfanity(bio),
    };
  }
  
  return { valid: true };
}

export function validateTextContent(
  text: string,
  options: {
    autoClean?: boolean;
    fieldName?: string;
  } = {}
): ContentValidationResult {
  const { autoClean = false, fieldName = 'Content' } = options;
  
  if (containsProfanity(text)) {
    if (autoClean) {
      return {
        valid: true,
        cleaned: cleanProfanity(text),
        profaneWords: listProfanity(text),
      };
    }
    
    return {
      valid: false,
      reason: `${fieldName} contains inappropriate language`,
      profaneWords: listProfanity(text),
    };
  }
  
  return { valid: true };
}

/**
 * Add custom words to the profanity filter
 * Useful for platform-specific terms or slang
 */
export function addCustomProfanity(words: string[]) {
  const filter = getProfanityFilter();
  if (filter) {
    filter.add(words);
  }
}

/**
 * Remove words from the profanity filter
 * Useful if false positives occur
 */
export function removeCustomProfanity(words: string[]) {
  const filter = getProfanityFilter();
  if (filter) {
    filter.remove(words);
  }
}

export function resetProfanityFilter() {
  const filter = getProfanityFilter();
  if (filter) {
    filter.reset();
  }
}
