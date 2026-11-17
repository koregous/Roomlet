import { MetadataRoute } from 'next'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/slug'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseClient()

  // Fetch all user profiles (all are indexable by default)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, updated_at')
    .order('updated_at', { ascending: false })

  const userProfiles = (profiles || []).map((profile) => ({
    url: `${SITE_URL}/${profile.username}`,
    lastModified: profile.updated_at ? new Date(profile.updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // Fetch all published sections with username
  // Include SFW content by default, optionally include NSFW (currently excluded)
  const { data: sections } = await supabase
    .from('sections')
    .select('id, title, updated_at, is_nsfw, profiles!inner(username)')
    .eq('published', true)
    .eq('is_nsfw', false) // Only include SFW content in sitemap
    .order('updated_at', { ascending: false })

  const sectionPages = (sections || []).map((section) => {
    const username = (section.profiles as any)?.username
    const slug = slugify(section.title)
    
    return {
      // Use pretty URL format: /[username]/[slug]
      url: `${SITE_URL}/${username}/${slug}`,
      lastModified: section.updated_at ? new Date(section.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }
  })

  // Fetch all categories for gallery pages
  const { data: categories } = await supabase
    .from('categories')
    .select('slug')
    .order('name')

  const categoryPages = (categories || []).map((cat) => ({
    url: `${SITE_URL}/gallery?category=${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [
    // Core pages
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/gallery`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/creators`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/discover-list`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    // Auth pages (low priority)
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // Dynamic content (profiles and sections)
    ...categoryPages,
    ...userProfiles,
    ...sectionPages,
  ]
}
