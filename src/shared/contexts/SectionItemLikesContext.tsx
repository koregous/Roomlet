'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Like state for the images of one section, keyed by image URL.
 *
 * Blocks and the Lightbox only know image URLs, while likes hang off
 * item_index ids. This provider bridges the two: it lazily loads
 * GET /api/sections/[id]/items the first time something asks (i.e. when a
 * Lightbox opens), so ordinary page views cost nothing extra.
 *
 * Outside a provider the hook returns null and consumers simply don't show a
 * like button.
 */

export interface SectionItemLike {
  id: string
  like_count: number
  liked_by_me: boolean
}

interface SectionItemLikesValue {
  /** Trigger the (one-time) load of this section's item ids + like state */
  load: () => void
  lookup: (url: string) => SectionItemLike | undefined
  update: (url: string, liked: boolean, count: number) => void
}

const SectionItemLikesContext = createContext<SectionItemLikesValue | null>(null)

export function SectionItemLikesProvider({
  sectionId,
  children,
}: {
  sectionId: string
  children: ReactNode
}) {
  const [items, setItems] = useState<Map<string, SectionItemLike>>(new Map())
  const loadStarted = useRef(false)

  const load = useCallback(() => {
    if (loadStarted.current) return
    loadStarted.current = true

    fetch(`/api/sections/${sectionId}/items`)
      .then(res => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: Array<{ id: string; url: string; like_count: number; liked_by_me: boolean }> }) => {
        const next = new Map<string, SectionItemLike>()
        for (const item of data.items || []) {
          // If a URL appears in several blocks, the first occurrence wins
          if (!next.has(item.url)) {
            next.set(item.url, {
              id: item.id,
              like_count: item.like_count,
              liked_by_me: item.liked_by_me,
            })
          }
        }
        setItems(next)
      })
      .catch(error => {
        console.error('Failed to load image likes:', error)
        loadStarted.current = false // allow a retry next time the lightbox opens
      })
  }, [sectionId])

  const lookup = useCallback((url: string) => items.get(url), [items])

  const update = useCallback((url: string, liked: boolean, count: number) => {
    setItems(prev => {
      const existing = prev.get(url)
      if (!existing) return prev
      const next = new Map(prev)
      next.set(url, { ...existing, liked_by_me: liked, like_count: count })
      return next
    })
  }, [])

  const value = useMemo(() => ({ load, lookup, update }), [load, lookup, update])

  return (
    <SectionItemLikesContext.Provider value={value}>
      {children}
    </SectionItemLikesContext.Provider>
  )
}

export function useSectionItemLikes(): SectionItemLikesValue | null {
  return useContext(SectionItemLikesContext)
}
