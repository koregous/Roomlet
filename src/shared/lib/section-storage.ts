/**
 * Section Storage Calculation
 * 
 * Helper functions to calculate storage usage from section blocks.
 * Used for quota tracking when sections are deleted or edited.
 */

import { Block } from './types'

/**
 * Calculate total storage (in bytes) used by a section's blocks
 * 
 * Counts file sizes from:
 * - Image blocks (single images)
 * - Gallery blocks (multiple images)
 * - Carousel blocks (multiple images)
 * - Audio blocks
 * 
 * @param blocks - Array of section blocks
 * @returns Total bytes used
 */
export function calculateBlocksStorage(blocks: Block[]): number {
  let totalBytes = 0

  for (const block of blocks) {
    switch (block.type) {
      case 'image': {
        // Single image block
        // Note: size is not stored in BlockContent type
        // This will need schema update or metadata tracking
        const size = (block.content?.image as any)?.size
        if (size && typeof size === 'number') {
          totalBytes += size
        }
        break
      }

      case 'gallery':
      case 'carousel': {
        const images = block.content?.images
        if (Array.isArray(images)) {
          for (const image of images) {
            const size = (image as any)?.size
            if (size && typeof size === 'number') {
              totalBytes += size
            }
          }
        }
        break
      }

      case 'audio': {
        // Audio file
        // Note: size is not stored in BlockContent type
        // This will need schema update or metadata tracking
        const size = (block.content as any)?.audioSize
        if (size && typeof size === 'number') {
          totalBytes += size
        }
        break
      }

      // Other block types (text, heading, divider, etc.) don't use storage
      default:
        break
    }
  }

  return totalBytes
}

/**
 * Calculate storage difference between old and new blocks
 * 
 * Used when editing sections to determine quota adjustment:
 * - Positive: more storage used (increment quota)
 * - Negative: less storage used (decrement quota)
 * - Zero: no change
 * 
 * @param oldBlocks - Previous block state
 * @param newBlocks - New block state
 * @returns Difference in bytes (new - old)
 */
export function calculateStorageDiff(oldBlocks: Block[], newBlocks: Block[]): number {
  const oldStorage = calculateBlocksStorage(oldBlocks)
  const newStorage = calculateBlocksStorage(newBlocks)
  return newStorage - oldStorage
}

/**
 * Extract all file URLs from blocks (for cleanup purposes)
 * 
 * @param blocks - Array of section blocks
 * @returns Array of file URLs
 */
export function extractFileUrls(blocks: Block[]): string[] {
  const urls: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'image': {
        const url = block.content?.image?.url
        if (url && typeof url === 'string') {
          urls.push(url)
        }
        break
      }

      case 'gallery':
      case 'carousel': {
        const images = block.content?.images
        if (Array.isArray(images)) {
          for (const image of images) {
            const url = image?.url
            if (url && typeof url === 'string') {
              urls.push(url)
            }
          }
        }
        break
      }

      case 'audio': {
        const url = block.content?.audioUrl
        if (url && typeof url === 'string') {
          urls.push(url)
        }
        break
      }

      default:
        break
    }
  }

  return urls
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
