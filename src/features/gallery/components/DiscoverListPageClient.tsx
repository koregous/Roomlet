/**
 * Client-side Discover List Page Component
 * 
 * Handles NSFW filtering and toggle state for the discover list view.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { PublishedSection, Category } from '@/shared/lib/types'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import DiscoverListView from './DiscoverListView'
import DiscoverSortTabs from './DiscoverSortTabs'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { Search } from 'lucide-react'

interface Props {
  sections: PublishedSection[]
  categories: Category[]
  currentSort: 'recent' | 'bookmarked' | 'random'
  categorySlug?: string
}

export default function DiscoverListPageClient({
  sections,
  categories,
  currentSort,
  categorySlug,
}: Props) {
  const { isEnabled: nsfwEnabled } = useNSFWPreferences()
  const [mounted, setMounted] = useState(false)
  const [displaySections, setDisplaySections] = useState(sections)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Update display sections when props change
  useEffect(() => {
    setDisplaySections(sections)
  }, [sections])

  // Fisher-Yates shuffle algorithm
  const shuffleSections = () => {
    const shuffled = [...displaySections]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setDisplaySections(shuffled)
  }

  // Filter NSFW content based on user preference
  // Default: hide NSFW for anonymous users and users with NSFW disabled
  const filteredSections = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      return displaySections.filter(s => !s.is_nsfw)
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return displaySections
  }, [displaySections, nsfwEnabled, mounted])

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Discover Collections
            </h1>
            <p className="text-gray-400">
              Browse {filteredSections.length} collections • {categorySlug ? `${categories?.find(c => c.slug === categorySlug)?.name || 'Category'}` : 'All Categories'}
            </p>
          </div>
        </div>

        {/* Sort Tabs */}
        <DiscoverSortTabs 
          currentSort={currentSort} 
          categorySlug={categorySlug}
          onRandomClick={currentSort === 'random' ? shuffleSections : undefined}
        />

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <a
            href="/discover-list"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !categorySlug
                ? 'bg-blue-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-700'
            }`}
          >
            All
          </a>
          {categories?.map(cat => {
            const CategoryIcon = getCategoryIcon(cat.slug)
            return (
              <a
                key={cat.id}
                href={`/discover-list?category=${cat.slug}${currentSort !== 'recent' ? `&sort=${currentSort}` : ''}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  categorySlug === cat.slug
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-900 border border-gray-800 text-gray-300 hover:border-gray-700'
                }`}
              >
                <CategoryIcon className="w-4 h-4" />
                {cat.name}
              </a>
            )
          })}
        </div>

        {/* List View */}
        <DiscoverListView sections={filteredSections} />

        {/* Empty State */}
        {filteredSections.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No collections found
            </h3>
            <p className="text-gray-400 mb-6">
              {categorySlug ? 'Try a different category or' : ''} Be the first to publish something!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
