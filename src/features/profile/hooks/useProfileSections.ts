/**
 * Profile Sections Hook
 * 
 * Manages sections for a profile with NSFW filtering.
 * Separates SFW and NSFW sections for proper tab display.
 */

import { Section } from '@/shared/lib/types'

export interface ProfileSectionTab {
  id: string
  title: string
  section: Section
  isNSFW: boolean
}

/**
 * Process sections into tabs, separating NSFW content.
 * NSFW sections always shown as tabs (never hidden), but gated.
 */
export function processProfileSections(sections: Section[]): ProfileSectionTab[] {
  return sections
    .filter((s) => s.visible) // Only show visible sections
    .sort((a, b) => a.position - b.position) // Respect position
    .map((section) => ({
      id: section.id,
      title: section.title,
      section,
      isNSFW: section.is_nsfw || false,
    }))
}

/**
 * Check if any section is NSFW.
 * Used to determine if profile has mature content.
 */
export function hasNSFWContent(sections: Section[]): boolean {
  return sections.some((s) => s.is_nsfw)
}

/**
 * Get preview images for a section.
 * Used for tab previews or profile banners.
 * 
 * IMPORTANT: Should exclude NSFW sections for profile-level previews
 * to avoid leaking mature content outside the gate.
 */
export function getSectionPreviewImages(section: Section): string[] {
  const images: string[] = []

  if (!section.blocks) return images

  for (const block of section.blocks) {
    switch (block.type) {
      case 'image':
        if (block.content.image?.url) {
          images.push(block.content.image.url)
        }
        break

      case 'gallery':
      case 'carousel':
        if (block.content.images && Array.isArray(block.content.images)) {
          for (const img of block.content.images) {
            if (img.url) {
              images.push(img.url)
            }
          }
        }
        break
    }

    // Limit to first 3 images
    if (images.length >= 3) break
  }

  return images
}

/**
 * Get profile banner/preview images, excluding NSFW sections.
 * This prevents mature content from appearing in the profile header.
 */
export function getProfilePreviewImages(sections: Section[]): string[] {
  const sfwSections = sections.filter((s) => !s.is_nsfw && s.visible)
  const allImages: string[] = []

  for (const section of sfwSections) {
    const sectionImages = getSectionPreviewImages(section)
    allImages.push(...sectionImages)
    
    // Get up to 5 total images
    if (allImages.length >= 5) break
  }

  return allImages.slice(0, 5)
}
