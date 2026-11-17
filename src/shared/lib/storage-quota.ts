/**
 * Storage Quota Management
 * 
 * Tracks and enforces per-user storage limits to prevent abuse.
 * Free tier: 500MB total across all sections.
 * 
 * Future: Premium tier with higher limits (2GB, 10GB, etc.)
 */

import { getSupabaseServerClient } from './supabase-server'

// ── Quota Constants ──────────────────────────────────────────────────────────

export const STORAGE_LIMITS = {
  FREE_TIER: 500 * 1024 * 1024,      // 500 MB (524,288,000 bytes)
  PREMIUM_TIER: 10 * 1024 * 1024 * 1024, // 10 GB (10,737,418,240 bytes)
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface StorageQuota {
  used: number          // Bytes used
  limit: number         // Bytes allowed
  remaining: number     // Bytes remaining
  percentage: number    // Usage percentage (0-100)
  isOverLimit: boolean  // Whether user exceeded quota
}

export interface StorageQuotaCheck {
  allowed: boolean      // Whether upload is allowed
  quota: StorageQuota   // Current quota status
  requiredSpace: number // Bytes needed for upload
  error?: string        // Error message if not allowed
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Formats bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Gets storage quota for a user
 */
export async function getUserStorageQuota(userId: string): Promise<StorageQuota> {
  const supabase = await getSupabaseServerClient()
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('storage_used_bytes, is_premium')
    .eq('user_id', userId)
    .single()
  
  if (error || !profile) {
    console.error('[storage-quota] Failed to get user quota:', error)
    return {
      used: 0,
      limit: STORAGE_LIMITS.FREE_TIER,
      remaining: STORAGE_LIMITS.FREE_TIER,
      percentage: 0,
      isOverLimit: false,
    }
  }
  
  const used = profile.storage_used_bytes || 0
  const limit = profile.is_premium ? STORAGE_LIMITS.PREMIUM_TIER : STORAGE_LIMITS.FREE_TIER
  const remaining = Math.max(0, limit - used)
  const percentage = Math.min(100, (used / limit) * 100)
  const isOverLimit = used >= limit
  
  return {
    used,
    limit,
    remaining,
    percentage,
    isOverLimit,
  }
}

/**
 * Checks if a user can upload a file of given size
 */
export async function checkStorageQuota(
  userId: string,
  fileSize: number
): Promise<StorageQuotaCheck> {
  const quota = await getUserStorageQuota(userId)
  
  // Check if upload would exceed quota
  const wouldExceed = (quota.used + fileSize) > quota.limit
  
  if (wouldExceed) {
    return {
      allowed: false,
      quota,
      requiredSpace: fileSize,
      error: `Upload would exceed storage quota. You have ${formatBytes(quota.remaining)} remaining, but need ${formatBytes(fileSize)}.`,
    }
  }
  
  return {
    allowed: true,
    quota,
    requiredSpace: fileSize,
  }
}

/**
 * Increments user storage usage (call after successful upload)
 */
export async function incrementStorageUsage(
  userId: string,
  bytes: number
): Promise<void> {
  const supabase = await getSupabaseServerClient()
  
  const { error } = await supabase.rpc('increment_storage_usage', {
    p_user_id: userId,
    p_bytes: bytes,
  })
  
  if (error) {
    console.error('[storage-quota] Failed to increment storage:', error)
    // Don't throw - this shouldn't fail the upload
    // We can recalculate later if needed
  }
}

/**
 * Decrements user storage usage (call after successful deletion)
 */
export async function decrementStorageUsage(
  userId: string,
  bytes: number
): Promise<void> {
  const supabase = await getSupabaseServerClient()
  
  const { error } = await supabase.rpc('decrement_storage_usage', {
    p_user_id: userId,
    p_bytes: bytes,
  })
  
  if (error) {
    console.error('[storage-quota] Failed to decrement storage:', error)
  }
}

/**
 * Recalculates storage usage from scratch by scanning all user content
 * Use this to fix discrepancies or backfill data
 */
export async function recalculateUserStorage(userId: string): Promise<number> {
  const supabase = await getSupabaseServerClient()
  
  const { data, error } = await supabase.rpc('calculate_user_storage', {
    p_user_id: userId,
  })
  
  if (error) {
    console.error('[storage-quota] Failed to recalculate storage:', error)
    throw new Error('Failed to recalculate storage')
  }
  
  const totalBytes = data as number
  
  // Update profiles table with calculated value
  await supabase
    .from('profiles')
    .update({ storage_used_bytes: totalBytes })
    .eq('user_id', userId)
  
  return totalBytes
}

/**
 * Gets storage usage statistics for all users (admin only)
 */
export async function getAllUsersStorageStats() {
  const supabase = await getSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, storage_used_bytes')
    .order('storage_used_bytes', { ascending: false })
    .limit(100)
  
  if (error) {
    console.error('[storage-quota] Failed to get storage stats:', error)
    return []
  }
  
  return data.map(profile => ({
    userId: profile.user_id,
    username: profile.username,
    used: profile.storage_used_bytes || 0,
    usedFormatted: formatBytes(profile.storage_used_bytes || 0),
    percentage: ((profile.storage_used_bytes || 0) / STORAGE_LIMITS.FREE_TIER) * 100,
  }))
}
