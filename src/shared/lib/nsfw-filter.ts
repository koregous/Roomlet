/**
 * Server-Side NSFW Filtering Utilities
 * 
 * Helper functions for filtering NSFW content in Server Components.
 * Use these when you need to filter sections server-side based on request parameters.
 */

import { PublishedSection } from './types'

/**
 * Filter out NSFW sections from an array.
 * 
 * @param sections - Array of sections to filter
 * @returns Array with NSFW sections removed
 */
export function filterNSFW(sections: PublishedSection[]): PublishedSection[] {
  return sections.filter((s) => !s.is_nsfw)
}

/**
 * Check if a section is NSFW.
 * 
 * @param section - Section to check
 * @returns true if section is marked as NSFW
 */
export function isNSFW(section: PublishedSection): boolean {
  return section.is_nsfw === true
}

/**
 * Split sections into SFW and NSFW arrays.
 * 
 * @param sections - Array of sections to split
 * @returns Object with sfw and nsfw arrays
 */
export function splitByNSFW(sections: PublishedSection[]): {
  sfw: PublishedSection[]
  nsfw: PublishedSection[]
} {
  const sfw: PublishedSection[] = []
  const nsfw: PublishedSection[] = []

  for (const section of sections) {
    if (section.is_nsfw) {
      nsfw.push(section)
    } else {
      sfw.push(section)
    }
  }

  return { sfw, nsfw }
}

/**
 * Get NSFW count from an array of sections.
 * 
 * @param sections - Array of sections
 * @returns Number of NSFW sections
 */
export function getNSFWCount(sections: PublishedSection[]): number {
  return sections.filter((s) => s.is_nsfw).length
}
