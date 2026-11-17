import Link from 'next/link'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { extractThumbnail } from '@/shared/lib/feed'

interface RelatedSectionsProps {
  categoryId: string
  categoryName: string
  categorySlug: string
  currentSectionId: string
  limit?: number
}

/**
 * RelatedSections - Shows other sections from the same category
 * 
 * Displays a horizontal scrollable carousel of related content
 * at the bottom of the section page.
 */
export default async function RelatedSections({
  categoryId,
  categoryName,
  categorySlug,
  currentSectionId,
  limit = 6,
}: RelatedSectionsProps) {
  const supabase = getSupabaseClient()

  // Fetch related sections from the same category
  const { data: relatedSections } = await supabase
    .from('sections')
    .select(`
      id,
      title,
      blocks,
      view_count,
      published_at,
      profiles!inner(username, display_name, avatar_url)
    `)
    .eq('category_id', categoryId)
    .eq('published', true)
    .neq('id', currentSectionId)
    .order('published_at', { ascending: false })
    .limit(limit)

  // Don't render if no related sections
  if (!relatedSections || relatedSections.length === 0) {
    return null
  }

  // Get category icon
  const CategoryIcon = getCategoryIcon(categorySlug)

  return (
    <div className="mt-16 mb-12">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        {CategoryIcon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 border border-gray-800">
            <CategoryIcon className="w-5 h-5 text-blue-400" />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-white">
            More from {categoryName}
          </h2>
          <p className="text-sm text-gray-500">
            Explore similar content
          </p>
        </div>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-gray-900">
          {relatedSections.map((section: any) => {
            // Extract thumbnail - check if it's a real image URL (not OG fallback)
            const thumbnailUrl = extractThumbnail(section.blocks, section.id)
            const hasRealThumbnail = thumbnailUrl && !thumbnailUrl.includes('/opengraph-image')
            
            return (
              <Link
                key={section.id}
                href={`/s/${section.id}`}
                className="flex-none w-72 snap-start group"
              >
                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-blue-900/20">
                  {/* Thumbnail */}
                  {hasRealThumbnail ? (
                    <div className="relative aspect-video bg-gray-950 overflow-hidden">
                      <img
                        src={thumbnailUrl}
                        alt={section.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
                      <span className="text-4xl text-gray-800">📄</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
                      {section.title}
                    </h3>

                    {/* Creator Info */}
                    <div className="flex items-center gap-2 mb-3">
                      {section.profiles.avatar_url ? (
                        <img
                          src={section.profiles.avatar_url}
                          alt={section.profiles.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                          {section.profiles.username[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-gray-400 truncate">
                        {section.profiles.display_name || section.profiles.username}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {section.view_count || 0} view{section.view_count !== 1 ? 's' : ''}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(section.published_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* View All Link */}
        <div className="mt-4 text-center">
          <Link
            href={`/gallery?category=${categorySlug}`}
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all {categoryName} content
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
