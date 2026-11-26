/**
 * NSFW Preferences Management
 * 
 * Handles persistent site-wide NSFW content preferences with age verification.
 * Uses localStorage for persistence and provides React hooks for easy integration.
 */

const NSFW_PREF_KEY = 'roomlet_nsfw_enabled'
const AGE_VERIFIED_KEY = 'roomlet_age_verified'

export interface NSFWPreferences {
  enabled: boolean
  ageVerified: boolean
}

/**
 * Get current NSFW preferences from localStorage.
 * Defaults to disabled and not verified.
 */
export function getNSFWPreferences(): NSFWPreferences {
  if (typeof window === 'undefined') {
    return { enabled: false, ageVerified: false }
  }

  try {
    const enabled = localStorage.getItem(NSFW_PREF_KEY) === 'true'
    const ageVerified = localStorage.getItem(AGE_VERIFIED_KEY) === 'true'
    
    return { enabled, ageVerified }
  } catch {
    return { enabled: false, ageVerified: false }
  }
}

/**
 * Check if NSFW content should be shown.
 * Returns true only if both enabled and age verified.
 */
export function isNSFWEnabled(): boolean {
  const prefs = getNSFWPreferences()
  return prefs.enabled && prefs.ageVerified
}

/**
 * Enable NSFW content.
 * Should only be called AFTER age verification.
 */
export function enableNSFW(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(NSFW_PREF_KEY, 'true')
    // Dispatch custom event for React components to pick up
    window.dispatchEvent(new Event('nsfw-preference-changed'))
  } catch (err) {
    console.error('Failed to enable NSFW:', err)
  }
}

export function disableNSFW(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(NSFW_PREF_KEY, 'false')
    // Dispatch custom event for React components to pick up
    window.dispatchEvent(new Event('nsfw-preference-changed'))
  } catch (err) {
    console.error('Failed to disable NSFW:', err)
  }
}

/**
 * Mark age as verified.
 * This is a one-time gate before enabling NSFW content.
 */
export function setAgeVerified(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(AGE_VERIFIED_KEY, 'true')
  } catch (err) {
    console.error('Failed to set age verified:', err)
  }
}

/**
 * Clear all NSFW preferences (for testing or user reset).
 */
export function clearNSFWPreferences(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(NSFW_PREF_KEY)
    localStorage.removeItem(AGE_VERIFIED_KEY)
    window.dispatchEvent(new Event('nsfw-preference-changed'))
  } catch (err) {
    console.error('Failed to clear NSFW preferences:', err)
  }
}

/**
 * React hook for NSFW preferences with live updates.
 */
export function useNSFWPreferences() {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      ageVerified: false,
      isEnabled: false,
      enable: () => {},
      disable: () => {},
      verifyAge: () => {},
    }
  }

  const [prefs, setPrefs] = React.useState<NSFWPreferences>(getNSFWPreferences)

  React.useEffect(() => {
    const handleChange = () => {
      setPrefs(getNSFWPreferences())
    }

    window.addEventListener('nsfw-preference-changed', handleChange)
    return () => window.removeEventListener('nsfw-preference-changed', handleChange)
  }, [])

  return {
    enabled: prefs.enabled,
    ageVerified: prefs.ageVerified,
    isEnabled: prefs.enabled && prefs.ageVerified,
    enable: enableNSFW,
    disable: disableNSFW,
    verifyAge: setAgeVerified,
  }
}

// For non-React usage, need to import React for the hook
import React from 'react'
