import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { Hash, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { PublishedSection } from '@/shared/lib/types'
import { getCategoryIcon } from '@/shared/lib/category-icons'

interface PageProps {
  params: {
    tag: string
  }
  searchParams: {
    sort?: 'popular' | 'recent'
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tagSlug = decodeURIComponent(params.tag)
  const tagName = tagSlug.replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return {
    title: `${tagName} - Discover Community Creations | Roomlet`,
    description: `Browse ${tagName} profiles, galleries, and collections created by the Roomlet community. Get inspired and create your own.`,
    openGraph: {
      title: `${tagName} - Discover Community Creations`,
      description: `Browse ${tagName} profiles, galleries, and collections created by the Roomlet community.`,
    }
  }
}

export default async function TagDiscoveryPage({ params, searchParams }: PageProps) {
  const tagSlug = decodeURIComponent(params.tag)
  const sort = searchParams.sort || 'popular'
  const supabase = getSupabaseClient()

  // Get tag info
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('*')
    .eq('slug', tagSlug)
    .single()

  if (tagError || !tag) {
    notFound()
  }

  // Get sections with this tag
  const query = supabase
    .from('section_tags')
    .select(`
      section_id,
      sections!inner (
        id,
        title,
        blocks,
        view_count,
        published_at,
        profiles!inner (
          username,
          display_name,
          avatar_url
        ),
        categories (
          id,
          name,
          slug,
          icon
        )
      )
    `)
    .eq('tag_id', tag.id)
    .eq('sections.published', true)

  // Apply sorting
  if (sort === 'recent') {
    query.order('sections(published_at)', { ascending: false })
  } else {
    query.order('sections(view_count)', { ascending: false })
  }

  const { data: results, error } = await query.limit(50)

  if (error) {
    console.error('Error fetching sections:', error)
    return <div>Error loading sections</div>
  }

  const sections = results?.map(r => {
    const s = (r as any).sections
    return {
      id: s.id,
      title: s.title,
      blocks: s.blocks,
      view_count: s.view_count,
      published_at: s.published_at,
      creator: {
        username: s.profiles.username,
        display_name: s.profiles.display_name,
        avatar_url: s.profiles.avatar_url,
      },
      category: s.categories ? {
        id: s.categories.id,
        name: s.categories.name,
        slug: s.categories.slug,
        icon: s.categories.icon,
      } : undefined
    }
  }) || []

  // Get related tags
  const { data: relatedTags } = await supabase
    .from('tags')
    .select('id, name, slug, usage_count')
    .neq('id', tag.id)
    .order('usage_count', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {tag.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {sections.length} {sections.length === 1 ? 'creation' : 'creations'}
              </p>
            </div>
          </div>

          {tag.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {tag.description}
            </p>
          )}

          {/* Sort Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <Link
              href={`/discover/${tagSlug}`}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                sort === 'popular'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Popular
            </Link>
            <Link
              href={`/discover/${tagSlug}?sort=recent`}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                sort === 'recent'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              Recent
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {sections.length === 0 ? (
              <div className="text-center py-12">
                <Hash className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No creations yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Be the first to create something with this tag!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {sections.map((section) => (
                  <SectionCard key={section.id} section={section} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {relatedTags && relatedTags.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Related Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relatedTags.map((relatedTag) => (
                    <Link
                      key={relatedTag.id}
                      href={`/discover/${relatedTag.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-full text-sm transition-colors"
                    >
                      <Hash className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">{relatedTag.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ section }: { section: any }) {
  // Get first image from blocks for preview
  const firstImage = section.blocks.find((b: any) => 
    b.type === 'image' || b.type === 'gallery' || b.type === 'carousel'
  )

  const imageUrl = firstImage?.content?.image?.url || 
                   firstImage?.content?.images?.[0]?.url
  
  const CategoryIcon = section.category ? getCategoryIcon(section.category.slug) : null

  return (
    <Link
      href={`/s/${section.id}`}
      className="group block bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
    >
      {/* Preview Image */}
      {imageUrl && (
        <div className="aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <img
            src={imageUrl}
            alt={section.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {section.title}
        </h3>

        {/* Creator */}
        <div className="flex items-center gap-2 mb-3">
          {section.creator.avatar_url && (
            <img
              src={section.creator.avatar_url}
              alt={section.creator.username}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {section.creator.display_name || section.creator.username}
          </span>
        </div>

        {/* Category & Views */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          {section.category && CategoryIcon && (
            <span className="flex items-center gap-1.5">
              <CategoryIcon className="w-4 h-4" />
              {section.category.name}
            </span>
          )}
          <span>{section.view_count} views</span>
        </div>
      </div>
    </Link>
  )
}
