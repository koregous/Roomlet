/**
 * Section Limits Management
 * 
 * Enforces per-user section count limits to prevent abuse.
 * Free tier: 50 sections max
 * Premium tier: Unlimited sections
 */

import { getSupabaseServerClient } from './supabase-server'

// ── Limit Constants ──────────────────────────────────────────────────────────

export const SECTION_LIMITS = {
  FREE_TIER: 50,
  PREMIUM_TIER: Infinity, // Unlimited
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface SectionLimit {
  count: number        // Current section count
  limit: number        // Sections allowed
  remaining: number    // Sections remaining
  percentage: number   // Usage percentage (0-100)
  isAtLimit: boolean   // Whether user reached the limit
}

export interface SectionLimitCheck {
  allowed: boolean     // Whether creation is allowed
  limit: SectionLimit  // Current limit status
  error?: string       // Error message if not allowed
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Gets section limit info for a user
 */
export async function getUserSectionLimit(userId: string): Promise<SectionLimit> {
  const supabase = await getSupabaseServerClient()
  
  // Get user's profile to check if premium
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, id, is_premium')
    .eq('user_id', userId)
    .single()
  
  if (profileError || !profile) {
    console.error('[section-limits] Failed to get user profile:', profileError)
    return {
      count: 0,
      limit: SECTION_LIMITS.FREE_TIER,
      remaining: SECTION_LIMITS.FREE_TIER,
      percentage: 0,
      isAtLimit: false,
    }
  }

  // Count sections for this user
  const { count, error: countError } = await supabase
    .from('sections')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
  
  if (countError) {
    console.error('[section-limits] Failed to count sections:', countError)
    return {
      count: 0,
      limit: SECTION_LIMITS.FREE_TIER,
      remaining: SECTION_LIMITS.FREE_TIER,
      percentage: 0,
      isAtLimit: false,
    }
  }

  const sectionCount = count || 0
  
  // Check if user is premium
  const limit = profile.is_premium ? SECTION_LIMITS.PREMIUM_TIER : SECTION_LIMITS.FREE_TIER
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - sectionCount)
  const percentage = limit === Infinity ? 0 : Math.min(100, (sectionCount / limit) * 100)
  const isAtLimit = limit !== Infinity && sectionCount >= limit
  
  return {
    count: sectionCount,
    limit,
    remaining,
    percentage,
    isAtLimit,
  }
}

/**
 * Checks if a user can create a new section
 */
export async function checkSectionLimit(userId: string): Promise<SectionLimitCheck> {
  const limit = await getUserSectionLimit(userId)
  
  if (limit.isAtLimit) {
    return {
      allowed: false,
      limit,
      error: `Section limit reached. You have ${limit.count} of ${limit.limit} sections. Upgrade to Premium for unlimited sections.`,
    }
  }
  
  return {
    allowed: true,
    limit,
  }
}

/**
 * Check if user is premium
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('user_id', userId)
    .single()
  
  return profile?.is_premium || false
}
