'use client'

import { useState, useMemo } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import SectionCard from '@/features/gallery/components/SectionCard'
import { PublishedSection } from '@/shared/lib/types'

interface Bookmark {
  id: string
  created_at: string
  section_id: string
  sections: any // Using any to handle Supabase join complexity
}

interface Props {
  initialBookmarks: Bookmark[]
}

export default function BookmarksPageClient({ initialBookmarks }: Props) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks)
  const [isLoading, setIsLoading] = useState(false)

  // Transform bookmarks data to match PublishedSection interface
  const transformedSections = useMemo(() => {
    return bookmarks
      .filter(b => b.sections) // Filter out any null sections
      .map(bookmark => {
        const section = bookmark.sections
        
        // Handle the nested profiles data - could be array or object
        const profileData = Array.isArray(section.profiles) 
          ? section.profiles[0] 
          : section.profiles

        return {
          id: section.id,
          title: section.title || 'Untitled',
          blocks: section.blocks || [],
          view_count: 0,
          published_at: section.created_at,
          is_nsfw: section.is_nsfw || false,
          creator: {
            username: profileData?.username || 'unknown',
            display_name: profileData?.display_name,
            avatar_url: profileData?.avatar_url,
          },
          category: {
            id: section.categories?.id || '',
            name: section.categories?.name || 'Uncategorized',
            slug: section.categories?.slug || 'uncategorized',
            icon: section.categories?.icon,
          },
          _bookmarkId: bookmark.id,
          _sectionId: bookmark.section_id,
        }
      })
  }, [bookmarks])

  const removeBookmark = async (sectionId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId }),
      })

      if (response.ok) {
        setBookmarks(bookmarks.filter(b => b.section_id !== sectionId))
      }
    } catch (error) {
      console.error('Failed to remove bookmark:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-red-500 fill-current" />
            My Bookmarks
          </h1>
          <p className="text-gray-400">
            {transformedSections.length} saved {transformedSections.length === 1 ? 'collection' : 'collections'}
          </p>
        </div>

        {/* Bookmarks Grid */}
        {transformedSections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {transformedSections.map((section: any) => (
              <div key={section._bookmarkId} className="relative group">
                <SectionCard section={section as PublishedSection} />
                
                {/* Remove button overlay */}
                <button
                  onClick={() => removeBookmark(section._sectionId)}
                  disabled={isLoading}
                  className="absolute top-4 right-4 p-2 bg-black/80 border border-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/50 hover:border-red-700"
                  title="Remove bookmark"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-300 mb-2">
              No bookmarks yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start exploring and bookmark collections you love!
            </p>
            <a
              href="/gallery"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Explore Gallery
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
