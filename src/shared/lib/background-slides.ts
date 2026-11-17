/**
 * Profile background slideshow - shared types and pure helpers.
 *
 * No server/client imports on purpose: used by API routes, the editor, and the
 * public renderer.
 *
 * Storage: profiles.profile_background_slides (JSONB array). The legacy columns
 * profile_background_url/_type mirror slide #1 so older code keeps working, and
 * profiles that predate slides (not yet backfilled) fall back to the legacy pair.
 */

import type { BackgroundSlide, BackgroundSlideType } from './types'

export type { BackgroundSlide, BackgroundSlideType }

/** Max slides per profile (also enforced by a DB CHECK constraint) */
export const MAX_BACKGROUND_SLIDES = 5

/** Selectable seconds-per-slide values */
export const BACKGROUND_INTERVAL_OPTIONS = [5, 8, 12, 20] as const
export const DEFAULT_BACKGROUND_INTERVAL = 8

const SLIDE_TYPES = new Set<string>(['image', 'gif', 'video'])

/** Defensively parse whatever is in the JSONB column into valid slides */
export function parseBackgroundSlides(raw: unknown): BackgroundSlide[] {
  if (!Array.isArray(raw)) return []

  const slides: BackgroundSlide[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { url, type, size } = item as Record<string, unknown>
    if (typeof url !== 'string' || url.length === 0) continue
    if (typeof type !== 'string' || !SLIDE_TYPES.has(type)) continue

    slides.push({
      url,
      type: type as BackgroundSlideType,
      size: typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : 0,
    })
    if (slides.length >= MAX_BACKGROUND_SLIDES) break
  }
  return slides
}

/** Slides for a profile, falling back to the legacy single background */
export function getProfileBackgroundSlides(profile: {
  profile_background_slides?: unknown
  profile_background_url?: string | null
  profile_background_type?: string | null
}): BackgroundSlide[] {
  const slides = parseBackgroundSlides(profile.profile_background_slides)
  if (slides.length > 0) return slides

  if (
    profile.profile_background_url &&
    profile.profile_background_type &&
    SLIDE_TYPES.has(profile.profile_background_type)
  ) {
    return [
      {
        url: profile.profile_background_url,
        type: profile.profile_background_type as BackgroundSlideType,
        size: 0,
      },
    ]
  }
  return []
}

/** Clamp to an allowed interval, defaulting when invalid */
export function normalizeBackgroundInterval(value: unknown): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : value
  return typeof n === 'number' && (BACKGROUND_INTERVAL_OPTIONS as readonly number[]).includes(n)
    ? n
    : DEFAULT_BACKGROUND_INTERVAL
}

/** Legacy column values that mirror the first slide (keeps older code working) */
export function legacyColumnsFor(slides: BackgroundSlide[]) {
  const first = slides[0]
  return {
    profile_background_url: first ? first.url : null,
    profile_background_type: first ? first.type : null,
    profile_background_poster_url: null as string | null,
  }
}

/** Map a declared/actual content type to a slide type (null if not allowed) */
export function slideTypeForContentType(contentType: string): BackgroundSlideType | null {
  const ct = contentType.toLowerCase().split(';')[0].trim()
  if (ct === 'video/mp4' || ct === 'video/webm') return 'video'
  if (ct === 'image/gif') return 'gif'
  if (ct === 'image/jpeg' || ct === 'image/jpg' || ct === 'image/png' || ct === 'image/webp') return 'image'
  return null
}

/**
 * Can `incoming` be added to `existing`? A video is only allowed as the sole
 * slide: slideshows are images/GIFs only (a 30s video has no sensible interval).
 */
export function canAddSlide(
  existing: BackgroundSlide[],
  incoming: BackgroundSlideType
): { ok: true } | { ok: false; reason: string } {
  if (existing.length >= MAX_BACKGROUND_SLIDES) {
    return { ok: false, reason: `You can have up to ${MAX_BACKGROUND_SLIDES} background images.` }
  }
  if (incoming === 'video' && existing.length > 0) {
    return { ok: false, reason: 'A video background can’t be combined with other backgrounds. Remove them first.' }
  }
  if (existing.some(s => s.type === 'video')) {
    return { ok: false, reason: 'Remove the video background before adding images for a slideshow.' }
  }
  return { ok: true }
}

/**
 * Does `url` point inside this user's own profile-background folder?
 * `prefix` is the public URL of `roomlet/{userId}/profile-background/`.
 * Rejects traversal, query strings and fragments.
 */
export function isOwnBackgroundUrl(url: string, prefix: string): boolean {
  if (!url.startsWith(prefix)) return false
  const rest = url.slice(prefix.length)
  return rest.length > 0 && !/[/?#\\]/.test(rest) && !rest.includes('..')
}

/** Is `order` exactly a permutation of the current slide urls? */
export function isPermutationOfUrls(order: unknown, slides: BackgroundSlide[]): order is string[] {
  if (!Array.isArray(order) || order.length !== slides.length) return false
  if (!order.every((u) => typeof u === 'string')) return false
  const current = new Set(slides.map(s => s.url))
  return new Set(order).size === order.length && order.every((u) => current.has(u))
}
