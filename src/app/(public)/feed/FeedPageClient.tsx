'use client'

import { Fragment, useState, useCallback, useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { Heart, ImageIcon, AlertCircle, Check, X } from 'lucide-react'
import type {
  PersonalizedFeedResponse,
  PersonalizedFeedItem,
  SuggestedCollection,
} from '@/shared/lib/types'
import { isNSFWEnabled } from '@/shared/lib/nsfw-preferences'
import ItemLikeButton from '@/shared/components/ItemLikeButton'

interface Props {
  initialFeed: PersonalizedFeedResponse
}

// Below this many bookmarks we nudge people to bookmark more collections
const SUGGESTION_THRESHOLD = 3

export default function FeedPageClient({ initialFeed }: Props) {
  const [items, setItems] = useState<PersonalizedFeedItem[]>(initialFeed.items)
  const [cursor, setCursor] = useState(initialFeed.cursor)
  const [hasMore, setHasMore] = useState(initialFeed.has_more)
  const [mode, setMode] = useState(initialFeed.mode)
  const [bookmarkCount, setBookmarkCount] = useState(initialFeed.bookmark_count)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(
    initialFeed.bookmark_count < SUGGESTION_THRESHOLD
  )

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  })

  // Replace the feed with a fresh first page (used for NSFW toggle + after bookmarking)
  const refreshFeed = useCallback(async (includeNsfw: boolean) => {
    try {
      const response = await fetch(`/api/feed/personalized?limit=50&include_nsfw=${includeNsfw}`)
      if (!response.ok) throw new Error(`Failed to refresh feed: ${response.statusText}`)
      const data: PersonalizedFeedResponse = await response.json()
      setItems(data.items)
      setCursor(data.cursor)
      setHasMore(data.has_more)
      setMode(data.mode)
      setBookmarkCount(data.bookmark_count)
    } catch (err) {
      console.error('Failed to refresh feed:', err)
    }
  }, [])

  // Check NSFW preference on mount and refetch if enabled
  useEffect(() => {
    const includeNsfw = isNSFWEnabled()
    setNsfwEnabled(includeNsfw)

    // If NSFW is enabled and initial feed was loaded without NSFW, refetch
    if (includeNsfw && !initialLoadDone) {
      setInitialLoadDone(true)
      refreshFeed(true)
    } else {
      setInitialLoadDone(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load more items when scroll trigger is in view
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !cursor) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/feed/personalized?limit=50&cursor=${encodeURIComponent(cursor)}&include_nsfw=${nsfwEnabled}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load feed: ${response.statusText}`)
      }

      const data: PersonalizedFeedResponse = await response.json()

      setItems(prev => {
        // Guard against duplicates if a page was fetched twice
        const seen = new Set(prev.map(item => item.id))
        return [...prev, ...data.items.filter(item => !seen.has(item.id))]
      })
      setCursor(data.cursor)
      setHasMore(data.has_more)
      setMode(data.mode)
    } catch (err) {
      console.error('Failed to load more items:', err)
      setError(err instanceof Error ? err.message : 'Failed to load more items')
    } finally {
      setIsLoading(false)
    }
  }, [cursor, hasMore, isLoading, nsfwEnabled])

  // Trigger load more when scroll trigger is visible
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMore()
    }
  }, [inView, hasMore, isLoading, loadMore])

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-white mb-2">
            Your Feed
          </h1>
          <p className="text-gray-400">
            {mode === 'personalized'
              ? `Latest from your ${bookmarkCount} bookmarked ${bookmarkCount === 1 ? 'collection' : 'collections'}, plus fresh picks from across Roomlet`
              : 'Fresh from the community - bookmark collections to make this feed yours'
            }
          </p>
        </div>

        {/* Bookmark suggestions: only while the feed is thin */}
        {showSuggestions && (
          <SuggestedCollections
            bookmarkCount={bookmarkCount}
            onDismiss={() => setShowSuggestions(false)}
            onBookmarked={() => refreshFeed(isNSFWEnabled())}
          />
        )}

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item, index) => {
                const startsDiscovery =
                  bookmarkCount > 0 &&
                  item.source === 'discovery' &&
                  (index === 0 || items[index - 1].source === 'bookmarked')

                return (
                  <Fragment key={item.id}>
                    {startsDiscovery && (
                      <div className="col-span-full pt-4 pb-1">
                        <h2 className="text-lg font-serif font-semibold text-white">
                          {index === 0
                            ? 'Your collections are quiet right now'
                            : 'More from across Roomlet'}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {index === 0
                            ? "Here's what's new elsewhere while you wait"
                            : "You're all caught up on your collections"}
                        </p>
                      </div>
                    )}
                    <FeedItemCard item={item} />
                  </Fragment>
                )
              })}
            </div>

            {hasMore && (
              <div ref={loadMoreRef} className="py-8 text-center">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
                    <span>Loading more...</span>
                  </div>
                ) : error ? (
                  <div className="space-y-3">
                    <p className="text-red-400 flex items-center justify-center gap-2">
                      <AlertCircle size={16} />
                      {error}
                    </p>
                    <button
                      onClick={loadMore}
                      className="px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {!hasMore && items.length > 0 && (
              <div className="py-8 text-center text-gray-500">
                You&apos;ve reached the end
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Row of collections worth bookmarking. Bookmarking one refreshes the feed so
 * the collection's images show up immediately.
 */
function SuggestedCollections({
  bookmarkCount,
  onDismiss,
  onBookmarked,
}: {
  bookmarkCount: number
  onDismiss: () => void
  onBookmarked: () => void
}) {
  const [collections, setCollections] = useState<SuggestedCollection[] | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    fetch(`/api/feed/suggestions?include_nsfw=${isNSFWEnabled()}`)
      .then(res => (res.ok ? res.json() : { collections: [] }))
      .then((data: { collections: SuggestedCollection[] }) => {
        if (!cancelled) setCollections(data.collections || [])
      })
      .catch(err => {
        console.error('Failed to load suggestions:', err)
        if (!cancelled) setCollections([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addBookmark = async (sectionId: string) => {
    if (pending.has(sectionId) || added.has(sectionId)) return
    setPending(prev => new Set(prev).add(sectionId))

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: sectionId }),
      })
      if (!response.ok) throw new Error(`Bookmark failed: ${response.status}`)

      const data: { bookmarked?: boolean } = await response.json()
      if (data.bookmarked) {
        setAdded(prev => new Set(prev).add(sectionId))
        onBookmarked()
      }
    } catch (err) {
      console.error('Failed to bookmark suggestion:', err)
    } finally {
      setPending(prev => {
        const next = new Set(prev)
        next.delete(sectionId)
        return next
      })
    }
  }

  // Nothing to suggest (or still loading): render nothing rather than an empty box
  if (!collections || collections.length === 0) return null

  return (
    <section className="mb-10 border border-gray-800 rounded-lg bg-gray-900/30 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-serif font-semibold text-white">
            {bookmarkCount === 0
              ? 'Bookmark a few collections to build your feed'
              : 'Find more collections you might like'}
          </h2>
          <p className="text-sm text-gray-400">
            New images from collections you bookmark show up here first.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-gray-500 hover:text-white transition-colors"
          aria-label="Hide suggestions"
          title="Hide suggestions"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {collections.map(collection => {
          const isAdded = added.has(collection.id)
          const isPending = pending.has(collection.id)

          return (
            <div
              key={collection.id}
              className="w-56 shrink-0 bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
            >
              <a href={collection.url} className="block">
                <div className="aspect-[4/3] bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={collection.thumbnail_url}
                    alt={collection.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </a>
              <div className="p-3 space-y-2">
                <a href={collection.url} className="block">
                  <div className="text-sm font-medium text-white truncate" title={collection.title}>
                    {collection.title}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {collection.creator.display_name} • {collection.category.name}
                  </div>
                </a>
                <button
                  onClick={() => addBookmark(collection.id)}
                  disabled={isPending || isAdded}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    isAdded
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-gray-500 hover:text-white'
                  } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isAdded ? <Check size={14} /> : <Heart size={14} />}
                  {isAdded ? 'Bookmarked' : 'Bookmark'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Feed item card component
 * Displays image with metadata and a per-image like button
 */
function FeedItemCard({ item }: { item: PersonalizedFeedItem }) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div className="group bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition-all duration-200">
      <a href={item.section.url} className="block">
        <div className="aspect-square relative bg-gray-800">
          {!imageError ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse"></div>
              )}

              <img
                src={item.image_url}
                alt={item.alt_text || item.section.title}
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  console.error(`Failed to load image: ${item.image_url}`)
                  setImageError(true)
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
              <ImageIcon size={32} className="mb-2" />
              <span className="text-xs">Failed to load</span>
            </div>
          )}

          {/* NSFW Badge */}
          {item.is_nsfw && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-red-900/90 backdrop-blur-sm text-red-100 text-xs font-medium rounded border border-red-700">
              NSFW
            </div>
          )}
        </div>
      </a>

      <div className="p-3 flex items-start justify-between gap-2">
        <a href={item.section.url} className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium text-white truncate" title={item.section.title}>
            {item.section.title}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="truncate" title={item.creator.display_name || item.creator.username}>
              {item.creator.display_name || item.creator.username}
            </span>
            <span>•</span>
            <span className="whitespace-nowrap" title={new Date(item.upload_time).toLocaleString()}>
              {formatTimeAgo(item.upload_time)}
            </span>
          </div>
        </a>
        <ItemLikeButton
          itemId={item.id}
          initialLiked={item.liked_by_me}
          initialCount={item.like_count}
        />
      </div>
    </div>
  )
}

/**
 * Empty state: only reachable when nothing is published anywhere yet
 */
function EmptyState() {
  return (
    <div className="text-center py-16">
      <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />

      <h3 className="text-2xl font-semibold text-gray-300 mb-2">
        Nothing to show yet
      </h3>

      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        No images have been published yet. Explore the gallery and bookmark collections you love to see their latest updates here.
      </p>

      <a
        href="/gallery"
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Explore Gallery
      </a>
    </div>
  )
}

/**
 * Format timestamp as relative time ago
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "1w ago"
 */
function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const seconds = Math.floor((now.getTime() - time.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 2419200) return `${Math.floor(seconds / 604800)}w ago` // ~4 weeks

  // For older items, show the actual date
  return time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
