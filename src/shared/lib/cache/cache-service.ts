/**
 * Cache Service Abstraction Layer
 * 
 * Provides a unified interface for caching with TTL support.
 * Currently implements in-memory caching for development.
 * Can be extended to support Redis or other cache providers in production.
 */

export interface CacheOptions {
  ttl?: number; // Time-to-live in seconds
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(pattern?: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * In-memory cache provider with TTL support
 * 
 * Features:
 * - Automatic expiration based on TTL
 * - Pattern-based key deletion
 * - Memory-efficient with automatic cleanup
 */
export class InMemoryCacheProvider implements CacheProvider {
  private cache: Map<string, CacheEntry<unknown>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.cleanupInterval = null;

    // Start automatic cleanup of expired entries
    this.startCleanup(cleanupIntervalMs);
  }

  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, intervalMs);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[Cache] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? 60; // Default 60 seconds
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Convert glob pattern to regex
    const regex = this.patternToRegex(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Convert glob pattern to regex
   * Supports * wildcard
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Cache key generation utility
 * 
 * Generates consistent cache keys based on parameters
 */
export class CacheKeyGenerator {
  private prefix: string;

  constructor(prefix: string = 'cache') {
    this.prefix = prefix;
  }

  /**
   * Generate cache key from parameters
   */
  generate(namespace: string, params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort();
    const parts = sortedKeys.map((key) => {
      const value = params[key];
      if (Array.isArray(value)) {
        return `${key}:${value.sort().join(',')}`;
      }
      return `${key}:${value}`;
    });

    return `${this.prefix}:${namespace}:${parts.join(':')}`;
  }

  /**
   * Generate pattern for clearing related keys
   */
  pattern(namespace: string): string {
    return `${this.prefix}:${namespace}:*`;
  }
}

// Global cache instance
let globalCache: CacheProvider | null = null;

/**
 * Get or create global cache instance
 */
export function getCache(): CacheProvider {
  if (!globalCache) {
    globalCache = new InMemoryCacheProvider();
  }
  return globalCache;
}

/**
 * Set global cache provider (for testing or production Redis setup)
 */
export function setCache(provider: CacheProvider): void {
  globalCache = provider;
}

/**
 * Cache invalidation utilities for featured content
 */
export class FeaturedCacheInvalidator {
  constructor(private cache: CacheProvider, private keyGen: CacheKeyGenerator) {}

  /**
   * Invalidate all featured content cache entries
   */
  async invalidateAll(): Promise<void> {
    const pattern = this.keyGen.pattern('featured');
    await this.cache.clear(pattern);
    console.log('[Cache] Invalidated all featured content caches');
  }

  /**
   * Invalidate specific featured content query
   */
  async invalidateQuery(params: Record<string, unknown>): Promise<void> {
    const key = this.keyGen.generate('featured', params);
    await this.cache.delete(key);
    console.log(`[Cache] Invalidated featured query: ${key}`);
  }

  /**
   * Invalidate rotation config cache
   */
  async invalidateConfig(): Promise<void> {
    const pattern = this.keyGen.pattern('rotation-config');
    await this.cache.clear(pattern);
    console.log('[Cache] Invalidated rotation config cache');
  }

  /**
   * Warm cache by preloading common queries
   */
  async warmCache(loader: () => Promise<void>): Promise<void> {
    try {
      await loader();
      console.log('[Cache] Cache warming completed');
    } catch (error) {
      console.error('[Cache] Cache warming failed:', error);
    }
  }
}
