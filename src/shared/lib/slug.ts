/**
 * Converts a string to a URL-safe slug.
 * e.g. "Minecraft Shader Collection" → "minecraft-shader-collection"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // remove non-word chars (keep hyphens)
    .replace(/[\s_]+/g, '-')   // spaces and underscores → hyphens
    .replace(/^-+|-+$/g, '')   // trim leading/trailing hyphens
}

/**
 * Checks if a URL path segment matches a section title (via slug comparison).
 */
export function matchesSlug(title: string, slug: string): boolean {
  return slugify(title) === slug.toLowerCase()
}
