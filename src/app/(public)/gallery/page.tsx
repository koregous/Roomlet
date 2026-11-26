import { getSupabaseClient } from '@/shared/lib/supabase'
import { PublishedSection, Category } from '@/shared/lib/types'
import type { Metadata } from 'next'
import GalleryPageClient from '@/features/gallery/components/GalleryPageClient'
import { getBookmarkCounts } from '@/shared/lib/bookmark-counts'

export const revalidate = 30 // ISR: revalidate every 30 seconds

interface Props {
  searchParams: { 
    category?: string
    sort?: string 
  }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (!searchParams.category) {
    return {
      title: 'Gallery - Discover Curated Collections',
      description: 'Explore photography albums, art portfolios, gaming projects, and creative showcases from creators around the world.',
    }
  }

  const supabase = getSupabaseClient()
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', searchParams.category)
    .single()

  if (!category) {
    return {
      title: 'Gallery - Roomlet',
    }
  }

  return {
    title: `${category.name} - Roomlet Gallery`,
    description: category.description || `Discover ${category.name} content on Roomlet`,
  }
}

const SECTION_SELECT = `
  id,
  title,
  blocks,
  view_count,
  published_at,
  updated_at,
  is_nsfw,
  profiles!inner(username, display_name, avatar_url),
  categories!inner(id, name, slug, icon)
`

function toPublishedSection(s: any): PublishedSection {
  return {
    id: s.id,
    title: s.title,
    blocks: s.blocks,
    view_count: s.view_count,
    published_at: s.published_at,
    updated_at: s.updated_at,
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
  }
}

// How many collections a category page shows, and how many candidates we rank
// when sorting by bookmarks / shuffling.
const CATEGORY_PAGE_SIZE = 24
const RANKING_POOL_SIZE = 300
const SHUFFLE_POOL_SIZE = 60

export default async function GalleryPage({ searchParams }: Props) {
  const supabase = getSupabaseClient()

  const categorySlug = searchParams.category
  const sort = searchParams.sort || 'bookmarked'

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('*')
    .order('position')

  const categories: Category[] = categoriesData || []

  // If category filter is specified, get the category
  let selectedCategory: Category | null = null
  if (categorySlug) {
    selectedCategory = categories.find(c => c.slug === categorySlug) || null
  }

  // Gallery only shows content that has passed moderation
  const approvedSections = () =>
    supabase
      .from('sections')
      .select(SECTION_SELECT)
      .eq('published', true)
      .eq('approval_status', 'approved')

  // Category view: just the (sorted) collections of that category
  if (selectedCategory) {
    let sections: PublishedSection[] = []

    if (sort === 'bookmarked') {
      // Rank a pool of the category's collections by *all* their bookmarks, then
      // take the top page. (Previously only the 24 newest were fetched and then
      // sorted, so an older popular collection could never surface.)
      const { data: poolRows } = await supabase
        .from('sections')
        .select('id')
        .eq('published', true)
        .eq('approval_status', 'approved')
        .eq('category_id', selectedCategory.id)
        .order('published_at', { ascending: false })
        .limit(RANKING_POOL_SIZE)

      const poolIds = (poolRows || []).map(r => r.id as string)
      const counts = await getBookmarkCounts(supabase, poolIds)

      const topIds = poolIds
        .map((id, index) => ({ id, index, count: counts.get(id) || 0 }))
        // Most bookmarked first; `index` keeps newest-first order on ties
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .slice(0, CATEGORY_PAGE_SIZE)
        .map(entry => entry.id)

      if (topIds.length > 0) {
        const { data: rows } = await approvedSections().in('id', topIds)
        const byId = new Map((rows || []).map((row: any) => [row.id, row]))
        sections = topIds
          .map(id => byId.get(id))
          .filter(Boolean)
          .map(toPublishedSection)
      }
    } else if (sort === 'random') {
      // Shuffle a pool of recent collections, then take a page
      const { data: rows } = await approvedSections()
        .eq('category_id', selectedCategory.id)
        .order('published_at', { ascending: false })
        .limit(SHUFFLE_POOL_SIZE)

      sections = (rows || []).map(toPublishedSection)

      // True random shuffle using Fisher-Yates algorithm
      for (let i = sections.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sections[i], sections[j]] = [sections[j], sections[i]]
      }
      sections = sections.slice(0, CATEGORY_PAGE_SIZE)
    } else {
      // 'recent'
      const { data: rows } = await approvedSections()
        .eq('category_id', selectedCategory.id)
        .order('published_at', { ascending: false })
        .limit(CATEGORY_PAGE_SIZE)

      sections = (rows || []).map(toPublishedSection)
    }

    return (
      <GalleryPageClient
        recent={[]}
        featured={[]}
        featuredByCategory={{}}
        allCollections={sections}
        categories={categories}
        totalCollections={sections.length}
        hasMoreCollections={false}
        selectedCategory={selectedCategory}
        selectedSort={sort}
      />
    )
  }

  // Full gallery view
  //
  // Nothing here is age-limited: a quiet week must not empty the page. The
  // "Recently Published" row is simply the latest few collections, however old.
  //
  // NOTE: PostgREST rejects `not.in.(null)` for uuid columns (and the whole
  // query then silently returns no data), so exclusion filters are only added
  // when there is actually something to exclude.
  const { data: recentData } = await approvedSections()
    .order('published_at', { ascending: false })
    .limit(6)

  const recent: PublishedSection[] = (recentData || []).map(toPublishedSection)
  const recentIds = recent.map(s => s.id)

  // Newest few per category (excluding the ones already shown in "recent"), in parallel
  const categoryResults = await Promise.all(
    categories.map(async category => {
      let query = approvedSections().eq('category_id', category.id)
      if (recentIds.length > 0) {
        query = query.not('id', 'in', `(${recentIds.join(',')})`)
      }
      const { data } = await query
        .order('published_at', { ascending: false })
        .limit(3)
      return { category, data }
    })
  )

  const newestByCategory: Record<string, { category: PublishedSection['category']; sections: PublishedSection[] }> = {}

  for (const { category, data: categoryNewest } of categoryResults) {
    if (categoryNewest && categoryNewest.length > 0) {
      newestByCategory[category.id] = {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon,
        },
        sections: categoryNewest.map(toPublishedSection),
      }
    }
  }

  // Everything shown above is excluded from "All Collections"
  const newestSections = Object.values(newestByCategory).flatMap(c => c.sections)
  const excludedIds = [...recentIds, ...newestSections.map(s => s.id)]

  let allCollectionsQuery = approvedSections()
  let totalQuery = supabase
    .from('sections')
    .select('id', { count: 'exact', head: true })
    .eq('published', true)
    .eq('approval_status', 'approved')

  if (excludedIds.length > 0) {
    const excluded = `(${excludedIds.join(',')})`
    allCollectionsQuery = allCollectionsQuery.not('id', 'in', excluded)
    totalQuery = totalQuery.not('id', 'in', excluded)
  }

  const [{ data: allCollectionsData }, { count: totalCollections }] = await Promise.all([
    allCollectionsQuery.order('published_at', { ascending: false }).limit(15),
    totalQuery,
  ])

  const allCollections: PublishedSection[] = (allCollectionsData || []).map(toPublishedSection)
  const hasMoreCollections = (totalCollections || 0) > 15

  return (
    <GalleryPageClient
      recent={recent}
      featured={newestSections}
      featuredByCategory={newestByCategory}
      allCollections={allCollections}
      categories={categories}
      totalCollections={totalCollections || 0}
      hasMoreCollections={hasMoreCollections}
      selectedCategory={null}
      selectedSort={sort}
    />
  )
}
