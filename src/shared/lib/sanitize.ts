/**
 * URL sanitization utilities.
 *
 * The primary XSS vector in this app is user-supplied URLs rendered in
 * href/src attributes. React escapes text nodes automatically, but it does
 * NOT prevent javascript: URIs in href/src — those execute on click/load.
 *
 * Rules:
 *  - Allow only http: and https: schemes.
 *  - Return a safe fallback ('#') for anything else.
 *  - Never throw — always return a string.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

/**
 * Sanitizes a URL for use in an href or src attribute.
 * Returns '#' if the URL is empty, unparseable, or uses a disallowed scheme.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '#'

  const trimmed = url.trim()
  if (!trimmed) return '#'

  try {
    const parsed = new URL(trimmed)
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) return '#'
    return trimmed
  } catch {
    // Relative URLs (no scheme) — allow them as-is; they can't be javascript:
    // Only block if it starts with a scheme-like pattern that isn't http/https
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) return '#'
    return trimmed
  }
}

/**
 * Sanitizes a string for use as plain text content.
 * React already escapes text nodes, so this is a no-op for display —
 * it exists as an explicit marker that the value has been reviewed.
 */
export function sanitizeText(value: string | null | undefined): string {
  return value ?? ''
}
