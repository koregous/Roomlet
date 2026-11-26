'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { User, Heart, EyeOff, Pencil } from 'lucide-react'
import { Profile, Section } from '@/shared/lib/types'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import { slugify } from '@/shared/lib/slug'
import BlockSection from '@/features/sections/components/BlockSection'
import ProfileTabs from './ProfileTabs'
import NSFWTabContent from './NSFWTabContent'
import { processProfileSections, ProfileSectionTab } from '../hooks/useProfileSections'
import SectionCard from '@/features/gallery/components/SectionCard'
import PremiumBadge from '@/shared/components/PremiumBadge'
import PremiumCrown from '@/shared/components/PremiumCrown'
import ProfileBackgroundLayer from './ProfileBackgroundLayer'
import {
  getProfileBackgroundSlides,
  normalizeBackgroundInterval,
} from '@/shared/lib/background-slides'
import ProfileMenu from './ProfileMenu'
import { useIsProfileOwner } from '../hooks/useIsProfileOwner'

// Bookmarks display component for profile page
function ProfileBookmarksTab({ bookmarks }: { bookmarks: any[] }) {
  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-gray-300 mb-2">
          No bookmarks yet
        </h3>
        <p className="text-gray-500">
          This user hasn't bookmarked any collections yet.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-gray-400">
          {bookmarks.length} bookmarked {bookmarks.length === 1 ? 'collection' : 'collections'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookmarks.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  profile: Profile
  sections: Section[]
  /**
   * When coming from a section-specific URL (e.g. /august/shaders),
   * pass the section id to pre-select that tab without relying on
   * the ?section= query param.
   */
  initialSectionId?: string
  /**
   * User's bookmarked sections (only provided if bookmarks_public is true)
   */
  bookmarks?: any[]
}

// Inner component uses useSearchParams — must be inside <Suspense>
function ProfileCardInner({ profile, sections, initialSectionId, bookmarks = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabs = processProfileSections(sections)
  
  // Add bookmarks tab if user has public bookmarks enabled
  const hasBookmarksTab = profile.bookmarks_public && bookmarks && bookmarks.length > 0
  
  // Debug logging
  console.log('[ProfileCard] bookmarks_public:', profile.bookmarks_public)
  console.log('[ProfileCard] bookmarks array:', bookmarks)
  console.log('[ProfileCard] bookmarks length:', bookmarks?.length)
  console.log('[ProfileCard] hasBookmarksTab:', hasBookmarksTab)
  
  const allTabs = hasBookmarksTab 
    ? [...tabs, { 
        id: '__bookmarks__', 
        title: 'Bookmarks', 
        isBookmarksTab: true,
        bookmarks 
      } as any]
    : tabs

  // Priority: 1) initialSectionId prop (from /[username]/[section] route)
  //           2) ?section=<slug> query param
  //           3) first section
  const resolveInitialSection = () => {
    if (initialSectionId) {
      const found = allTabs.find(t => t.id === initialSectionId)
      if (found) return found.id
    }
    const slugParam = searchParams.get('section')
    if (slugParam) {
      if (slugParam === 'bookmarks' && hasBookmarksTab) {
        return '__bookmarks__'
      }
      const found = allTabs.find(
        t => !t.isBookmarksTab && slugify(t.title) === slugParam
      )
      if (found) return found.id
    }
    return allTabs[0]?.id || ''
  }

  const [activeTabId, setActiveTabId] = useState<string>(resolveInitialSection)

  // Owner-only "Edit this section" control (resolved client-side; see hook)
  const isOwner = useIsProfileOwner(profile.user_id)

  const activeTab = allTabs.find(t => t.id === activeTabId)

  // Only update the query param — do not navigate to the /[section] sub-route
  // (that's for direct links / OG purposes). This keeps the profile page SPA-style.
  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId)
    const tab = allTabs.find(t => t.id === tabId)
    if (!tab) return
    
    const slug = tab.isBookmarksTab ? 'bookmarks' : slugify(tab.title)
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', slug)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Check if profile has background (slideshow slides, or the legacy single background)
  const backgroundSlides = getProfileBackgroundSlides(profile)
  const hasBackground = backgroundSlides.length > 0
  
  // Glass effect only for premium users with custom backgrounds
  const useGlassEffect = hasBackground && profile.is_premium

  // Check if should show NSFW warning (TODO: integrate with user settings)
  const userAllowsNSFW = true // TODO: Get from user context/settings
  const shouldShowNSFWWarning = profile.is_nsfw && !userAllowsNSFW
  const [nsfwRevealed, setNsfwRevealed] = useState(false)

  return (
    <div className={`min-h-screen text-white relative ${useGlassEffect ? '' : 'bg-black'}`}>
      {/* Profile Background Layer - Only for premium with background */}
      {useGlassEffect && hasBackground && (
        <ProfileBackgroundLayer
          slides={backgroundSlides}
          intervalSeconds={normalizeBackgroundInterval(profile.profile_background_interval_seconds)}
          posterUrl={profile.profile_background_poster_url}
          isNSFW={profile.background_is_nsfw || profile.is_nsfw || false}
          profileNSFW={profile.is_nsfw || false}
        />
      )}

      {/* NSFW Profile Warning Overlay */}
      {shouldShowNSFWWarning && !nsfwRevealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="max-w-md mx-4">
            <div className="bg-gray-900 rounded-2xl p-8 border-2 border-red-500/30 shadow-2xl">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 bg-red-500/20 rounded-full mb-4">
                  <EyeOff size={48} className="text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  NSFW Profile
                </h2>
                <p className="text-gray-300 mb-2">
                  This profile has been marked as NSFW (Not Safe For Work) by its owner.
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  The profile may contain sensitive, mature, or explicit content.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => window.history.back()}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => setNsfwRevealed(true)}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition"
                  >
                    Continue Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Glass morphism container - only when premium with background */}
      <div 
        className={`max-w-4xl mx-auto relative ${
          useGlassEffect 
            ? '' 
            : 'border-x border-gray-800 bg-black'
        }`}
        style={{ zIndex: 1 }}
      >
        {/* Banner - Only show when NOT using glass effect */}
        {!useGlassEffect && (
          <div className="h-56 w-full overflow-hidden relative">
            {profile.banner_url ? (
              // Regular banner image when no premium background
              <img
                src={sanitizeUrl(profile.banner_url)}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              // Default gradient when no banner
              <div className="w-full h-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900" />
            )}
          </div>
        )}

        <div 
          className={`border-b relative ${
            useGlassEffect 
              ? 'mt-40 pt-20 pb-6 px-8 border-white/10 bg-gray-900/20 backdrop-blur-sm rounded-t-[2rem]' 
              : 'px-8 py-6 border-gray-800 bg-transparent'
          }`}
        >
          {useGlassEffect ? (
            <div className="flex flex-col items-center text-center">
              {/* Avatar - absolutely positioned to float above container */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30">
                <div className="w-32 h-32 rounded-full border-4 bg-transparent border-white/10 flex items-center justify-center overflow-hidden relative">
                  {profile.avatar_url ? (
                    <img
                      src={sanitizeUrl(profile.avatar_url)}
                      alt={profile.display_name || profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="absolute top-4 right-4">
                <ProfileMenu profile={profile} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1 justify-center">
                  <h1 className="text-3xl font-serif">{profile.display_name}</h1>
                  {profile.is_premium && <PremiumCrown size="md" variant="check" />}
                </div>
                <p className="text-gray-400 text-base">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-gray-300 text-sm leading-relaxed mt-3 max-w-xl mx-auto">{profile.bio}</p>
                )}
              </div>
            </div>
          ) : (
            // Original left-aligned layout
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 relative z-20 -mt-20">
                <div className="w-32 h-32 rounded-full border-4 bg-black border-black flex items-center justify-center overflow-hidden relative">
                  {profile.avatar_url ? (
                    <img
                      src={sanitizeUrl(profile.avatar_url)}
                      alt={profile.display_name || profile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="flex-1 pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-serif">{profile.display_name}</h1>
                  {profile.is_premium && <PremiumCrown size="md" variant="check" />}
                </div>
                <p className="text-gray-400 text-base">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-gray-300 text-sm leading-relaxed mt-3">{profile.bio}</p>
                )}
              </div>

              <div className="pt-4">
                <ProfileMenu profile={profile} />
              </div>
            </div>
          )}
        </div>

        {allTabs.length > 0 && (
          <>
            <ProfileTabs 
              tabs={allTabs}
              activeTab={activeTabId}
              onTabChange={handleTabChange}
            />

            {activeTab && (
              <div 
                className={useGlassEffect 
                  ? 'px-8 py-10 bg-gray-900/20 backdrop-blur-sm rounded-b-[2rem]' 
                  : 'px-8 py-10'
                }
              >
                {/* Owner-only: jump straight to editing this section */}
                {isOwner && !activeTab.isBookmarksTab && activeTab.section && (
                  <div className="mb-6 flex justify-end">
                    <Link
                      href={`/dashboard/sections/${activeTab.section.id}?from=${encodeURIComponent(
                        `${pathname}?section=${slugify(activeTab.title)}`
                      )}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition"
                    >
                      <Pencil size={14} />
                      Edit this section
                    </Link>
                  </div>
                )}

                {activeTab.isBookmarksTab ? (
                  <ProfileBookmarksTab bookmarks={activeTab.bookmarks} />
                ) : activeTab.isNSFW ? (
                  <NSFWTabContent 
                    section={activeTab.section}
                    username={profile.username}
                  />
                ) : (
                  <BlockSection section={activeTab.section} />
                )}
              </div>
            )}
          </>
        )}

        {allTabs.length === 0 && (
          <div 
            className={`px-8 py-16 text-center text-gray-500 border-t ${
              useGlassEffect ? 'border-white/10' : 'border-gray-800'
            }`}
          >
            <p>No sections yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Public export wraps the inner component in Suspense so callers
// don't need to add their own boundary.
export default function ProfileCard(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ProfileCardInner {...props} />
    </Suspense>
  )
}
