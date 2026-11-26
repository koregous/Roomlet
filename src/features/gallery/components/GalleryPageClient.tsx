/**
 * Client-side Gallery Page Component
 * 
 * Handles NSFW filtering and toggle state.
 * Filters out NSFW sections unless user has enabled them.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { PublishedSection, Category } from '@/shared/lib/types'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import GalleryGrid from './GalleryGrid'
import CinemaCarousel from './CinemaCarousel'
import Link from 'next/link'
import { Sparkles, Palette, Flame, List, Grid3x3 } from 'lucide-react'

interface Props {
  recent: PublishedSection[]
  featured: PublishedSection[]
  featuredByCategory: Record<string, { category: PublishedSection['category']; sections: PublishedSection[] }>
  allCollections: PublishedSection[]
  categories: Category[]
  totalCollections: number
  hasMoreCollections: boolean
  selectedCategory: Category | null
  selectedSort: string
}

export default function GalleryPageClient({
  recent,
  featured,
  featuredByCategory,
  allCollections,
  categories,
  totalCollections,
  hasMoreCollections,
  selectedCategory,
  selectedSort,
}: Props) {
  const { isEnabled: nsfwEnabled } = useNSFWPreferences()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // If category is selected, we're in filtered view
  const isFilteredView = !!selectedCategory

  // Filter NSFW content based on user preference
  // Default: hide NSFW for anonymous users and users with NSFW disabled
  const filteredRecent = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      return recent.filter(s => !s.is_nsfw)
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return recent
  }, [recent, nsfwEnabled, mounted])

  const filteredFeatured = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      return featured.filter(s => !s.is_nsfw)
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return featured
  }, [featured, nsfwEnabled, mounted])

  const filteredFeaturedByCategory = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      const filtered: typeof featuredByCategory = {}
      for (const [categoryId, data] of Object.entries(featuredByCategory)) {
        const filteredSections = data.sections.filter(s => !s.is_nsfw)
        if (filteredSections.length > 0) {
          filtered[categoryId] = {
            category: data.category,
            sections: filteredSections,
          }
        }
      }
      return filtered
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return featuredByCategory
  }, [featuredByCategory, nsfwEnabled, mounted])

  const filteredAllCollections = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      return allCollections.filter(s => !s.is_nsfw)
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return allCollections
  }, [allCollections, nsfwEnabled, mounted])

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header with NSFW Toggle */}
        <div className="mb-12">
          {isFilteredView && (
            <div className="mb-4 text-sm text-gray-400">
              <Link href="/gallery" className="hover:text-white transition-colors">
                Gallery
              </Link>
              <span className="mx-2">›</span>
              <span className="text-white">{selectedCategory.name}</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3">
                {isFilteredView && selectedCategory.icon && (
                  <span className="text-gray-400">{selectedCategory.icon}</span>
                )}
                {isFilteredView ? selectedCategory.name : 'Gallery'}
              </h1>
              <p className="text-gray-400">
                {isFilteredView && selectedCategory.description
                  ? selectedCategory.description
                  : 'Explore curated collections and creative showcases'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/discover-list"
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg border border-gray-800 transition-colors flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                <span>List View</span>
              </Link>
            </div>
          </div>

          {isFilteredView && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Sort by:</span>
              <Link
                href={`/gallery?category=${selectedCategory.slug}&sort=bookmarked`}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedSort === 'bookmarked'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Most Bookmarked
              </Link>
              <Link
                href={`/gallery?category=${selectedCategory.slug}&sort=recent`}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedSort === 'recent'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Recent
              </Link>
              <Link
                href={`/gallery?category=${selectedCategory.slug}&sort=random`}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  selectedSort === 'random'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Random
              </Link>
            </div>
          )}
        </div>

        {isFilteredView && (
          <section className="mb-16">
            <GalleryGrid sections={filteredAllCollections} />
          </section>
        )}

        {!isFilteredView && (
          <>
            {Object.keys(filteredFeaturedByCategory).length > 0 && (
              <>
                {Object.values(filteredFeaturedByCategory).map(({ category, sections }) => (
                  <section key={category.id} className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-serif font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                        Newest in {category.name}
                      </h2>
                      <Link
                        href={`/gallery?category=${category.slug}`}
                        className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                      >
                        View all {category.name}
                        <span className="text-xs">→</span>
                      </Link>
                    </div>
                    <GalleryGrid sections={sections} />
                  </section>
                ))}
              </>
            )}

            <section className="mb-16">
              <h2 className="text-2xl font-serif font-semibold text-white mb-6">
                Browse by Category
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/gallery?category=${cat.slug}`}
                    className="group p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-all hover:scale-[1.02]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <div className="font-medium text-white group-hover:text-blue-400 transition-colors text-sm">
                        {cat.name}
                      </div>
                    </div>
                    {cat.description && (
                      <div className="text-xs text-gray-500 mt-2 line-clamp-1">
                        {cat.description}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>

            {filteredRecent.length > 0 && (
              <section className="mb-16">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-serif font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    Recently Published
                  </h2>
                </div>
                <CinemaCarousel sections={filteredRecent} />
              </section>
            )}

            {filteredAllCollections.length > 0 && (
              <section className="mb-16">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-serif font-semibold text-white flex items-center gap-2">
                      <Grid3x3 className="w-6 h-6 text-blue-400" />
                      All Collections
                    </h2>
                    <Link
                      href="/discover-list"
                      className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      View all
                      <span className="text-xs">→</span>
                    </Link>
                  </div>
                  <p className="text-sm text-gray-500">
                    Discover more beyond featured and recent • {totalCollections} collections
                  </p>
                </div>

                <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/30">
                  <GalleryGrid sections={filteredAllCollections} />
                </div>
                
                {hasMoreCollections && (
                  <div className="mt-6 text-center">
                    <Link
                      href="/discover-list"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                      <List className="w-4 h-4" />
                      Browse All {totalCollections} Collections
                    </Link>
                  </div>
                )}
              </section>
            )}

            {Object.keys(filteredFeaturedByCategory).length === 0 && filteredRecent.length === 0 && filteredAllCollections.length === 0 && (
              <div className="text-center py-16">
                <Palette className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold text-gray-300 mb-2">
                  No content yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Be the first to publish something amazing!
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
