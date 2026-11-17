/**
 * Shared utilities for feed API endpoints (JSON and RSS)
 */

import type { Block } from './types'

/**
 * Generate a user-friendly section URL.
 * Format: /{username}/{section-title-slug}
 * 
 * @param username - Creator's username
 * @param title - Section title
 * @returns User-friendly section URL path
 */
export function generateSectionUrl(username: string, title: string): string {
  // Trim whitespace and newlines from inputs
  const cleanUsername = username.trim()
  const cleanTitle = title.trim()
  
  const sectionSlug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  
  return `/${cleanUsername}/${sectionSlug}`
}

/**
 * Extract all image URLs from section blocks.
 * Returns an array of all images found in gallery, image, and carousel blocks.
 * 
 * @param blocks - Array of section blocks
 * @returns Array of image URLs
 */
export function extractAllImages(blocks: Block[]): string[] {
  const images: string[] = []

  if (!blocks || blocks.length === 0) {
    return images
  }

  blocks.forEach((block) => {
    // Single image block
    if (block.type === 'image' && block.content?.image?.url) {
      images.push(block.content.image.url)
    }
    
    // Gallery or carousel blocks
    if ((block.type === 'gallery' || block.type === 'carousel') && block.content?.images) {
      block.content.images.forEach((img: any) => {
        if (img?.url) {
          images.push(img.url)
        }
      })
    }
  })

  return images
}

/**
 * Extract thumbnail URL from section blocks.
 * Priority: gallery block > image block > carousel block > OG image fallback
 * 
 * @param blocks - Array of section blocks
 * @param sectionId - Section ID for OG image fallback
 * @returns Thumbnail URL
 */
export function extractThumbnail(blocks: Block[], sectionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomlet.app'
  
  // Default OG image if no image blocks found
  const defaultOgImage = `${baseUrl}/s/${sectionId}/opengraph-image`

  if (!blocks || blocks.length === 0) {
    return defaultOgImage
  }

  // Look for gallery block first (multiple images)
  const galleryBlock = blocks.find((b) => 
    b.type === 'gallery' && Array.isArray(b.content?.images) && b.content.images.length > 0
  )
  if (galleryBlock?.content?.images?.[0]?.url) {
    return galleryBlock.content.images[0].url
  }

  // Look for single image block
  const imageBlock = blocks.find((b) => 
    b.type === 'image' && b.content?.image?.url
  )
  if (imageBlock?.content?.image?.url) {
    return imageBlock.content.image.url
  }

  // Look for carousel block
  const carouselBlock = blocks.find((b) => 
    b.type === 'carousel' && Array.isArray(b.content?.images) && b.content.images.length > 0
  )
  if (carouselBlock?.content?.images?.[0]?.url) {
    return carouselBlock.content.images[0].url
  }

  // Fallback to OG image
  return defaultOgImage
}

/**
 * Infer MIME type from URL extension.
 * Returns null if unable to determine or if URL is invalid.
 * 
 * @param url - Image URL
 * @returns MIME type or null
 */
export function inferMimeType(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
      return 'image/jpeg'
    }
    if (pathname.endsWith('.png')) {
      return 'image/png'
    }
    if (pathname.endsWith('.gif')) {
      return 'image/gif'
    }
    if (pathname.endsWith('.webp')) {
      return 'image/webp'
    }
    if (pathname.endsWith('.svg')) {
      return 'image/svg+xml'
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Escape XML special characters for RSS feed.
 * 
 * @param unsafe - Unsafe string with potential XML special chars
 * @returns Escaped string safe for XML
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
