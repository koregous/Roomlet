import { getSupabaseClient } from '@/shared/lib/supabase'
import { PublishedSection } from '@/shared/lib/types'
import type { Metadata } from 'next'
import CreatorsPageClient from './CreatorsPageClient'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Profiles - Discover talented profiles on Roomlet',
  description: 'Browse profiles and collections from creators showcasing their photography, art, projects, and interests.',
}

export interface Creator {
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  is_premium?: boolean
  is_nsfw?: boolean
  sections: PublishedSection[]
}

export default async function CreatorsPage() {
  const supabase = getSupabaseClient()

  // Fetch all profiles with published sections
  const { data: profilesData } = await supabase
    .from('profiles')
    .select(`
      username,
      display_name,
      avatar_url,
      banner_url,
      bio,
      is_premium,
      is_nsfw,
      sections!inner(
        id,
        title,
        blocks,
        view_count,
        published_at,
        published,
        is_nsfw,
        categories(id, name, slug, icon)
      )
    `)
    .eq('sections.published', true)

  // Group sections by creator
  const creatorsMap = new Map<string, Creator>()
  
  if (profilesData) {
    profilesData.forEach((profile: any) => {
      if (!profile.sections || profile.sections.length === 0) return

      const username = profile.username
      if (!creatorsMap.has(username)) {
        creatorsMap.set(username, {
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          banner_url: profile.banner_url,
          bio: profile.bio,
          is_premium: profile.is_premium,
          is_nsfw: profile.is_nsfw || false,
          sections: [],
        })
      }

      const creator = creatorsMap.get(username)!
      
      // Add all published sections for this creator
      profile.sections.forEach((s: any) => {
        creator.sections.push({
          id: s.id,
          title: s.title,
          blocks: s.blocks,
          view_count: s.view_count,
          published_at: s.published_at,
          is_nsfw: s.is_nsfw || false,
          creator: {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          },
          category: {
            id: s.categories.id,
            name: s.categories.name,
            slug: s.categories.slug,
            icon: s.categories.icon,
          },
        })
      })
    })
  }

  // Sort creators: premium first, then by total view count
  const creators = Array.from(creatorsMap.values()).sort((a, b) => {
    // Premium users always come first
    if (a.is_premium && !b.is_premium) return -1
    if (!a.is_premium && b.is_premium) return 1
    
    // If both same premium status, sort by view count
    const aViews = a.sections.reduce((sum, s) => sum + (s.view_count || 0), 0)
    const bViews = b.sections.reduce((sum, s) => sum + (s.view_count || 0), 0)
    return bViews - aViews
  })

  return <CreatorsPageClient creators={creators} />
}
