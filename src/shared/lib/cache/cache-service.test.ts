/**
 * Cache Service Tests
 * 
 * Unit tests for the cache abstraction layer
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  InMemoryCacheProvider,
  generateFeaturedCacheKey,
  generateRotationConfigCacheKey,
  getFeaturedCachePattern,
} from './cache-service'

describe('InMemoryCacheProvider', () => {
  let cache: InMemoryCacheProvider

  beforeEach(() => {
    cache = new InMemoryCacheProvider()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('get and set', () => {
    it('should store and retrieve values', async () => {
      await cache.set('test-key', 'test-value')
      const result = await cache.get('test-key')
      expect(result).toBe('test-value')
    })

    it('should handle complex objects', async () => {
      const obj = { id: '123', name: 'Test', nested: { value: 42 } }
      await cache.set('obj-key', obj)
      const result = await cache.get('obj-key')
      expect(result).toEqual(obj)
    })

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent')
      expect(result).toBeNull()
    })

    it('should overwrite existing values', async () => {
      await cache.set('key', 'value1')
      await cache.set('key', 'value2')
      const result = await cache.get('key')
      expect(result).toBe('value2')
    })
  })

  describe('TTL and expiration', () => {
    it('should respect TTL and expire entries', async () => {
      await cache.set('ttl-key', 'value', { ttl: 60 })
      
      // Should exist before expiration
      let result = await cache.get('ttl-key')
      expect(result).toBe('value')

      // Fast-forward time past expiration
      vi.advanceTimersByTime(61000)

      // Should be expired and return null
      result = await cache.get('ttl-key')
      expect(result).toBeNull()
    })

    it('should store values without TTL indefinitely', async () => {
      await cache.set('no-ttl-key', 'value')
      
      // Fast-forward a long time
      vi.advanceTimersByTime(1000000)
      
      // Should still exist
      const result = await cache.get('no-ttl-key')
      expect(result).toBe('value')
    })

    it('should clear expiration timer when overwriting with TTL', async () => {
      await cache.set('key', 'value1', { ttl: 10 })
      await cache.set('key', 'value2', { ttl: 60 })
      
      // Fast-forward past first TTL but before second
      vi.advanceTimersByTime(15000)
      
      // Should still have value2
      const result = await cache.get('key')
      expect(result).toBe('value2')
    })
  })

  describe('delete', () => {
    it('should delete existing keys', async () => {
      await cache.set('key', 'value')
      await cache.delete('key')
      const result = await cache.get('key')
      expect(result).toBeNull()
    })

    it('should handle deleting non-existent keys gracefully', async () => {
      await expect(cache.delete('non-existent')).resolves.not.toThrow()
    })

    it('should clear expiration timers on delete', async () => {
      await cache.set('key', 'value', { ttl: 60 })
      await cache.delete('key')
      
      // Fast-forward time
      vi.advanceTimersByTime(61000)
      
      // Should still be null (and not cause issues)
      const result = await cache.get('key')
      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should clear all entries when no pattern provided', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')
      
      await cache.clear()
      
      expect(await cache.get('key1')).toBeNull()
      expect(await cache.get('key2')).toBeNull()
      expect(await cache.get('key3')).toBeNull()
    })

    it('should clear only matching entries with pattern', async () => {
      await cache.set('featured:10:none', 'value1')
      await cache.set('featured:20:abc', 'value2')
      await cache.set('rotation:config', 'value3')
      
      await cache.clear('featured:*')
      
      expect(await cache.get('featured:10:none')).toBeNull()
      expect(await cache.get('featured:20:abc')).toBeNull()
      expect(await cache.get('rotation:config')).toBe('value3')
    })

    it('should support wildcard patterns', async () => {
      await cache.set('user:123', 'value1')
      await cache.set('user:456', 'value2')
      await cache.set('product:789', 'value3')
      
      await cache.clear('user:*')
      
      expect(await cache.get('user:123')).toBeNull()
      expect(await cache.get('user:456')).toBeNull()
      expect(await cache.get('product:789')).toBe('value3')
    })
  })

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await cache.set('key', 'value')
      expect(await cache.has('key')).toBe(true)
    })

    it('should return false for non-existent keys', async () => {
      expect(await cache.has('non-existent')).toBe(false)
    })

    it('should return false for expired keys', async () => {
      await cache.set('key', 'value', { ttl: 10 })
      
      expect(await cache.has('key')).toBe(true)
      
      vi.advanceTimersByTime(11000)
      
      expect(await cache.has('key')).toBe(false)
    })
  })
})

describe('Cache key generation utilities', () => {
  describe('generateFeaturedCacheKey', () => {
    it('should generate key with default parameters', () => {
      const key = generateFeaturedCacheKey()
      expect(key).toBe('featured:10:none')
    })

    it('should generate key with custom limit', () => {
      const key = generateFeaturedCacheKey(20)
      expect(key).toBe('featured:20:none')
    })

    it('should generate key with excludeIds', () => {
      const key = generateFeaturedCacheKey(10, ['id1', 'id2', 'id3'])
      expect(key).toBe('featured:10:id1,id2,id3')
    })

    it('should sort excludeIds for consistency', () => {
      const key1 = generateFeaturedCacheKey(10, ['id3', 'id1', 'id2'])
      const key2 = generateFeaturedCacheKey(10, ['id1', 'id2', 'id3'])
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different parameters', () => {
      const key1 = generateFeaturedCacheKey(10, ['id1'])
      const key2 = generateFeaturedCacheKey(10, ['id2'])
      const key3 = generateFeaturedCacheKey(20, ['id1'])
      
      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
      expect(key2).not.toBe(key3)
    })
  })

  describe('generateRotationConfigCacheKey', () => {
    it('should generate consistent rotation config key', () => {
      const key1 = generateRotationConfigCacheKey()
      const key2 = generateRotationConfigCacheKey()
      expect(key1).toBe('rotation:config')
      expect(key1).toBe(key2)
    })
  })

  describe('getFeaturedCachePattern', () => {
    it('should return pattern for featured cache keys', () => {
      const pattern = getFeaturedCachePattern()
      expect(pattern).toBe('featured:*')
    })
  })
})
