/**
 * Utilities for extracting and managing asset URLs from Section blocks.
 * Used for cascade deletion when sections are removed.
 */

import { Block, Section } from './types'

/**
 * Extracts all storage URLs from a section's blocks.
 * 
 * Scans through all block types and collects:
 * - Single image blocks
 * - Gallery/carousel images
 * - Audio cover art
 * - Audio files
 * 
 * @param section - The section to extract URLs from
 * @returns Array of unique storage URLs
 */
export function extractStorageUrls(section: Section): string[] {
  const urls: string[] = []

  if (!section.blocks || section.blocks.length === 0) {
    return urls
  }

  for (const block of section.blocks) {
    switch (block.type) {
      case 'image':
        if (block.content.image?.url) {
          urls.push(block.content.image.url)
        }
        break

      case 'gallery':
      case 'carousel':
        // Multiple images in gallery/carousel
        if (block.content.images && Array.isArray(block.content.images)) {
          for (const img of block.content.images) {
            if (img.url) {
              urls.push(img.url)
            }
          }
        }
        break

      case 'audio':
        if (block.content.audioUrl) {
          urls.push(block.content.audioUrl)
        }
        if (block.content.audioCoverUrl) {
          urls.push(block.content.audioCoverUrl)
        }
        break

      // Other block types (text, quote, divider, links) don't have storage assets
      default:
        break
    }
  }

  return [...new Set(urls)].filter((url) => isStorageUrl(url))
}

/**
 * Legacy function name for backwards compatibility.
 * @deprecated Use extractStorageUrls instead
 */
export function extractCloudinaryUrls(section: Section): string[] {
  return extractStorageUrls(section)
}

export function isCloudinaryUrl(url: string): boolean {
  try {
    return url.includes('cloudinary.com') || url.includes('res.cloudinary')
  } catch {
    return false
  }
}

export function isR2Url(url: string): boolean {
  try {
    // Check for custom R2 domain (from env var)
    const customDomain = process.env.NEXT_PUBLIC_R2_DOMAIN
    if (customDomain && url.startsWith(customDomain)) {
      return true
    }
    
    // Check for r2.dev URLs
    return url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com')
  } catch {
    return false
  }
}

/**
 * Checks if a URL is from any supported storage provider.
 * 
 * @param url - URL to check
 * @returns true if URL is from a known storage provider
 */
export function isStorageUrl(url: string): boolean {
  return isCloudinaryUrl(url) || isR2Url(url)
}

export function extractStorageUrlsFromSections(sections: Section[]): string[] {
  const allUrls = sections.flatMap((section) => extractStorageUrls(section))
  return [...new Set(allUrls)]
}

/**
 * Legacy function name for backwards compatibility.
 * @deprecated Use extractStorageUrlsFromSections instead
 */
export function extractCloudinaryUrlsFromSections(sections: Section[]): string[] {
  return extractStorageUrlsFromSections(sections)
}
