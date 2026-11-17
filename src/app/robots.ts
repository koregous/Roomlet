import { MetadataRoute } from 'next'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/slug'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const supabase = getSupabaseClient()

  // Fetch all NSFW section URLs to explicitly disallow them from indexing
  const { data: nsfwSections } = await supabase
    .from('sections')
    .select('id, title, profiles!inner(username)')
    .eq('is_nsfw', true)
    .eq('published', true)

  // Generate disallow patterns for NSFW content only
  const nsfwDisallowPatterns: string[] = []
  
  if (nsfwSections && nsfwSections.length > 0) {
    for (const section of nsfwSections) {
      // Disallow UUID-based URLs: /s/[uuid]
      nsfwDisallowPatterns.push(`/s/${section.id}`)
      
      // Disallow pretty URLs: /[username]/[slug]
      if (section.profiles && 'username' in section.profiles) {
        const username = (section.profiles as any).username
        const slug = slugify(section.title)
        nsfwDisallowPatterns.push(`/${username}/${slug}`)
      }
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',           // Homepage
          '/gallery',    // Gallery pages
          '/gallery?*',  // Gallery with filters
          '/creators',   // Creators list
          '/discover',   // Discovery pages
          '/discover-list', // List view
          '/discover/*', // Tag discovery
        ],
        disallow: [
          '/api/',       // API routes
          '/dashboard',  // User dashboard
          '/dashboard/*',
          '/admin/',     // Admin panel
          '/admin/*',
          '/auth/',      // Auth callbacks
          '/_next/',     // Next.js internals
          ...nsfwDisallowPatterns, // NSFW content
        ],
      },
      // Special rule for image crawlers - also block NSFW
      {
        userAgent: ['Googlebot-Image', 'Bingbot-Image'],
        disallow: nsfwDisallowPatterns.length > 0 ? nsfwDisallowPatterns : ['/nsfw-placeholder'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
