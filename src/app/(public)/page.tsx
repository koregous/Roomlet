import Link from 'next/link'
import type { Metadata } from 'next'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { PublishedSection } from '@/shared/lib/types'
import AuthRedirect from '@/shared/components/AuthRedirect'
import HomePageClient from './HomePageClient'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Roomlet - Build beautiful collections around anything you care about',
  description: 'Create curated collections, not endless posts. Turn your photos, projects, artwork, travels, and interests into beautiful showcase pages.',
}

interface Creator {
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  is_premium?: boolean
  sections: PublishedSection[]
}

export default async function HomePage() {
  const supabase = getSupabaseClient()

  // Fetch recent published sections for carousel
  const { data: recentSections } = await supabase
    .from('sections')
    .select(`
      id,
      title,
      blocks,
      view_count,
      published_at,
      is_nsfw,
      profiles!inner(username, display_name, avatar_url),
      categories!inner(id, name, slug, icon)
    `)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(12)

  const carouselSections: PublishedSection[] = (recentSections || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    blocks: s.blocks,
    view_count: s.view_count,
    published_at: s.published_at,
    is_nsfw: s.is_nsfw || false,
    creator: {
      username: s.profiles.username,
      display_name: s.profiles.display_name,
      avatar_url: s.profiles.avatar_url,
    },
    category: {
      id: s.categories.id,
      name: s.categories.name,
      slug: s.categories.slug,
      icon: s.categories.icon,
    },
  }))

  // Fetch profiles with their published sections
  const { data: profilesData } = await supabase
    .from('profiles')
    .select(`
      username,
      display_name,
      avatar_url,
      banner_url,
      bio,
      is_premium,
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
    .order('sections.view_count', { ascending: false, nullsFirst: false })
    .limit(3)

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
          sections: [],
        })
      }

      const creator = creatorsMap.get(username)!
      
      // Add sections for this creator
      profile.sections.forEach((s: any) => {
        if (creator.sections.length < 3) {
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
        }
      })
    })
  }

  const creators = Array.from(creatorsMap.values()).slice(0, 3)

  return (
    <>
      {/* Redirect logged-in users to gallery */}
      <AuthRedirect />
      
      <HomePageClient 
        carouselSections={carouselSections}
        creators={creators}
      />
    </>
  )
}