import { Metadata } from 'next'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { Hash, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Discover Tags - Browse Community Creations | Roomlet',
  description: 'Explore profiles, galleries, and collections by tag. Discover amazing content created by the Roomlet community.',
}

export default async function DiscoverPage() {
  const supabase = getSupabaseClient()

  const { data: tags } = await supabase
    .from('tags_with_counts')
    .select('*')
    .gt('published_section_count', 0)
    .order('usage_count', { ascending: false })
    .limit(100)

  const trendingTags = tags?.filter(t => t.usage_count >= 10) || []
  const popularTags = tags?.filter(t => t.usage_count >= 3 && t.usage_count < 10) || []
  const emergingTags = tags?.filter(t => t.usage_count < 3) || []

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Discover by Tag
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Explore profiles, galleries, and collections organized by tags. Find exactly what inspires you.
          </p>
        </div>

        {trendingTags.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Trending
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trendingTags.map((tag) => (
                <TagCard key={tag.id} tag={tag} variant="trending" />
              ))}
            </div>
          </section>
        )}

        {popularTags.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Popular
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popularTags.map((tag) => (
                <TagCard key={tag.id} tag={tag} variant="popular" />
              ))}
            </div>
          </section>
        )}

        {emergingTags.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Emerging
            </h2>
            <div className="flex flex-wrap gap-3">
              {emergingTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/discover/${tag.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                >
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white">{tag.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {tag.published_section_count}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {tags?.length === 0 && (
          <div className="text-center py-12">
            <Hash className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tags yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Tags will appear here as creators publish their work
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface TagCardProps {
  tag: any
  variant: 'trending' | 'popular'
}

function TagCard({ tag, variant }: TagCardProps) {
  return (
    <Link
      href={`/discover/${tag.slug}`}
      className="group block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
          <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        {variant === 'trending' && (
          <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
            <TrendingUp className="w-3 h-3" />
            Hot
          </span>
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {tag.name}
      </h3>
      
      {tag.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {tag.description}
        </p>
      )}
      
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{tag.published_section_count} {tag.published_section_count === 1 ? 'creation' : 'creations'}</span>
        <span>•</span>
        <span>{tag.usage_count} total uses</span>
      </div>
    </Link>
  )
}
