import { Metadata } from 'next'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { PublishedSection } from '@/shared/lib/types'
import DiscoverListPageClient from '@/features/gallery/components/DiscoverListPageClient'

export const metadata: Metadata = {
  title: 'Discover Collections - Browse All Creations | Roomlet',
  description: 'Browse all collections, galleries, and portfolios. Discover content by recent, trending, most viewed, or random.',
}

export const revalidate = 30 // ISR: revalidate every 30 seconds

interface PageProps {
  searchParams: {
    sort?: 'recent' | 'bookmarked' | 'random'
    category?: string
  }
}

export default async function DiscoverListPage({ searchParams }: PageProps) {
  const sort = searchParams.sort || 'recent'
  const categorySlug = searchParams.category
  
  const supabase = getSupabaseClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('position')

  let query = supabase
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

  if (categorySlug) {
    const category = categories?.find(c => c.slug === categorySlug)
    if (category) {
      query = query.eq('category_id', category.id)
    }
  }

  switch (sort) {
    case 'recent':
      query = query.order('published_at', { ascending: false })
      break
    case 'bookmarked':
      // Most bookmarked - we'll fetch all and sort by bookmark count in memory
      query = query.order('published_at', { ascending: false })
      break
    case 'random':
      query = query.order('id', { ascending: false }) // Fetch recent first, then shuffle client-side
      break
    default:
      query = query.order('published_at', { ascending: false })
  }

  // Limit to 50 per page
  query = query.limit(50)

  const { data: sectionsData } = await query

  let sections: PublishedSection[] = (sectionsData || []).map((s: any) => ({
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

  // For bookmarked sort, fetch bookmark counts and sort
  if (sort === 'bookmarked' && sections.length > 0) {
    const sectionIds = sections.map(s => s.id)
    
    const { data: bookmarkCounts } = await supabase
      .from('bookmarks')
      .select('section_id')
      .in('section_id', sectionIds)
    
    const bookmarkMap = new Map<string, number>()
    bookmarkCounts?.forEach(b => {
      bookmarkMap.set(b.section_id, (bookmarkMap.get(b.section_id) || 0) + 1)
    })
    
    sections.sort((a, b) => {
      const countA = bookmarkMap.get(a.id) || 0
      const countB = bookmarkMap.get(b.id) || 0
      return countB - countA
    })
  }

  // True random shuffle using Fisher-Yates algorithm
  if (sort === 'random') {
    for (let i = sections.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sections[i], sections[j]] = [sections[j], sections[i]]
    }
  }

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('*')
    .order('position')

  return (
    <DiscoverListPageClient
      sections={sections}
      categories={categoriesData || []}
      currentSort={sort}
      categorySlug={categorySlug}
    />
  )
}
