/**
 * Simple in-memory rate limiter for MVP.
 * 
 * IMPORTANT: This uses process memory, so it:
 * - Resets on each deployment
 * - Doesn't work across multiple serverless instances
 * - Is NOT production-grade for high traffic
 * 
 * For production, upgrade to Upstash Redis:
 * https://github.com/upstash/ratelimit
 * 
 * But for solo MVP with <100 users, this provides basic protection
 * against simple bot attacks without adding infrastructure.
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every 5 minutes
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, 5 * 60 * 1000)
    }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Check if request should be allowed
   * @param identifier - Usually IP address or user ID
   * @param limit - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns { allowed: boolean, remaining: number, resetAt: number }
   */
  check(
    identifier: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const record = this.store.get(identifier)

    if (!record || now > record.resetAt) {
      const resetAt = now + windowMs
      this.store.set(identifier, { count: 1, resetAt })
      return { allowed: true, remaining: limit - 1, resetAt }
    }

    // Existing window
    if (record.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt }
    }

    record.count++
    this.store.set(identifier, record)
    return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt }
  }

  /**
   * Get current rate limit status without incrementing
   */
  status(identifier: string): { count: number; resetAt: number } | null {
    const record = this.store.get(identifier)
    if (!record) return null

    const now = Date.now()
    if (now > record.resetAt) {
      this.store.delete(identifier)
      return null
    }

    return { count: record.count, resetAt: record.resetAt }
  }

  /**
   * Reset rate limit for an identifier (useful for testing)
   */
  reset(identifier: string) {
    this.store.delete(identifier)
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// Global singleton instance
const rateLimiter = new InMemoryRateLimiter()

/**
 * Rate limit presets for common use cases
 */
export const RateLimits = {
  // Strict: For sensitive operations (reports)
  STRICT: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute

  // Gallery uploads: Allow batch uploads for collections (12-20 images)
  GALLERY_UPLOAD: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute

  // Profile uploads: Avatar/banner (less frequent, smaller limit okay)
  PROFILE_UPLOAD: { limit: 5, windowMs: 60 * 1000 }, // 5 per minute

  // Normal: For most API operations
  NORMAL: { limit: 30, windowMs: 60 * 1000 }, // 30 per minute

  // Generous: For reads and public endpoints
  GENEROUS: { limit: 100, windowMs: 60 * 1000 }, // 100 per minute

  // Login attempts per IP, and per account identifier
  LOGIN: { limit: 10, windowMs: 5 * 60 * 1000 }, // 10 per 5 minutes

  // Account changes that need the password (email, username, password, delete)
  ACCOUNT_SENSITIVE: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes

  // View tracking: One view per section per IP per 5 minutes
  VIEW_TRACKING: { limit: 1, windowMs: 5 * 60 * 1000 }, // 1 per 5 minutes
} as const

/**
 * Extract IP address from Next.js request
 */
export function getClientIP(request: Request): string {
  // Try headers in order of reliability
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  const real = headers.get('x-real-ip')
  const cloudflare = headers.get('cf-connecting-ip')

  // x-forwarded-for can have multiple IPs (client, proxy1, proxy2)
  // First one is the actual client
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (cloudflare) return cloudflare
  if (real) return real

  return 'unknown'
}

/**
 * Simple helper for rate limiting an endpoint
 * 
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const ip = getClientIP(request)
 *   const rateLimitResult = checkRateLimit(ip, RateLimits.STRICT)
 *   
 *   if (!rateLimitResult.allowed) {
 *     return NextResponse.json(
 *       { error: 'Too many requests. Please try again later.' },
 *       { 
 *         status: 429,
 *         headers: rateLimitResult.headers 
 *       }
 *     )
 *   }
 *   
 *   // ... rest of handler
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  options: { limit: number; windowMs: number }
): {
  allowed: boolean
  remaining: number
  resetAt: number
  headers: Record<string, string>
} {
  const result = rateLimiter.check(identifier, options.limit, options.windowMs)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': options.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  }

  if (!result.allowed) {
    headers['Retry-After'] = Math.ceil((result.resetAt - Date.now()) / 1000).toString()
  }

  return {
    ...result,
    headers,
  }
}

/**
 * Composite rate limiter for view tracking
 * Combines IP + section ID to prevent view spam
 */
export function checkViewRateLimit(ip: string, sectionId: string): {
  allowed: boolean
  headers: Record<string, string>
} {
  const identifier = `view:${sectionId}:${ip}`
  return checkRateLimit(identifier, RateLimits.VIEW_TRACKING)
}

export default rateLimiter
