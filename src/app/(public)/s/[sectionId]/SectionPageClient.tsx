'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import { ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import ViewTracker from '@/features/gallery/components/ViewTracker'
import ReportButton from '@/features/sections/components/ReportButton'
import ShareButton from '@/features/sections/components/ShareButton'
import BookmarkButton from '@/shared/components/BookmarkButton'
import ScrollProgress from '@/features/sections/components/ScrollProgress'
import RelatedSections from '@/features/sections/components/RelatedSections'
import AgeVerificationModal from '@/shared/components/AgeVerificationModal'
import TextBlock from '@/features/sections/components/blocks/TextBlock'
import ImageBlock from '@/features/sections/components/blocks/ImageBlock'
import GalleryBlock from '@/features/sections/components/blocks/GalleryBlock'
import CarouselBlock from '@/features/sections/components/blocks/CarouselBlock'
import QuoteBlock from '@/features/sections/components/blocks/QuoteBlock'
import DividerBlock from '@/features/sections/components/blocks/DividerBlock'
import LinksBlock from '@/features/sections/components/blocks/LinksBlock'
import AudioBlock from '@/features/sections/components/blocks/AudioBlock'
import EmbedBlock from '@/features/sections/components/blocks/EmbedBlock'
import { SectionItemLikesProvider } from '@/shared/contexts/SectionItemLikesContext'

interface Props {
  section: any
  categorySlug: string | null
  otherSectionsCount: number | null
  userIsAdmin: boolean
}

export default function SectionPageClient({
  section,
  categorySlug,
  otherSectionsCount,
  userIsAdmin,
}: Props) {
  const { isEnabled: nsfwEnabled, enabled, ageVerified, enable, verifyAge } = useNSFWPreferences()
  const [showAgeGate, setShowAgeGate] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Get category icon on client side
  const CategoryIcon = categorySlug ? getCategoryIcon(categorySlug) : null

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine if content should be shown
  useEffect(() => {
    if (!mounted) return
    
    if (!section.is_nsfw) {
      // SFW content - always show
      setShowContent(true)
    } else {
      // NSFW content - check preference
      setShowContent(nsfwEnabled)
    }
  }, [mounted, section.is_nsfw, nsfwEnabled])

  const handleShowNSFW = () => {
    if (ageVerified) {
      // Age already verified, just enable NSFW
      enable()
      setShowContent(true)
    } else {
      // Need age verification first
      setShowAgeGate(true)
    }
  }

  const handleAgeVerified = () => {
    verifyAge()
    enable()
    setShowAgeGate(false)
    setShowContent(true)
  }

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  // Show NSFW gate if content is NSFW and user hasn't enabled it
  if (section.is_nsfw && !showContent) {
    return (
      <>
        <AgeVerificationModal
          isOpen={showAgeGate}
          onConfirm={handleAgeVerified}
          onCancel={() => setShowAgeGate(false)}
        />

        <div className="min-h-screen bg-black">
          <ScrollProgress />

          <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Back button */}
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors"
            >
              <span>←</span> Back to Gallery
            </Link>

            {/* NSFW Warning Interstitial */}
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="max-w-md text-center p-8 bg-gray-900 rounded-lg border border-red-900/30">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-10 h-10 text-red-400" />
                  </div>
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">
                  18+ Content Warning
                </h1>

                <p className="text-gray-300 mb-2">
                  <strong>{section.title}</strong>
                </p>

                <p className="text-gray-400 mb-6">
                  This section contains mature content marked as NSFW (Not Safe For Work). 
                  You must be 18 years or older to view this content.
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleShowNSFW}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    I am 18+, Show Content
                  </button>

                  <Link
                    href="/gallery"
                    className="block w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors text-center"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <EyeOff size={18} />
                      Go Back to Gallery
                    </div>
                  </Link>
                </div>

                <p className="text-xs text-gray-500 mt-6">
                  By clicking "Show Content", you confirm that you are at least 18 years old 
                  and agree to view mature content.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show full content
  return (
    <div className="min-h-screen bg-black">
      {/* Scroll Progress Indicator */}
      <ScrollProgress />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors"
        >
          <span>←</span> Back to Gallery
        </Link>

        {/* Creator header */}
        <div className="flex items-start gap-4 mb-8 p-6 bg-gray-900 rounded-lg border border-gray-800">
          <Link href={`/${section.profiles.username}`} className="shrink-0">
            {section.profiles.avatar_url ? (
              <img
                src={section.profiles.avatar_url}
                alt={section.profiles.username}
                className="w-16 h-16 rounded-full object-cover hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                {section.profiles.username[0].toUpperCase()}
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <Link href={`/${section.profiles.username}`}>
              <h2 className="font-bold text-xl text-white hover:text-blue-400 transition-colors">
                {section.profiles.display_name || section.profiles.username}
              </h2>
            </Link>
            <p className="text-gray-400 text-sm">@{section.profiles.username}</p>
            {section.profiles.bio && (
              <p className="hidden sm:block text-gray-500 text-sm mt-2 line-clamp-2">
                {section.profiles.bio}
              </p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <BookmarkButton sectionId={section.id} />
            <ShareButton 
              sectionId={section.id} 
              title={section.title} 
              username={section.profiles.username}
            />
            <ReportButton sectionId={section.id} userId={section.profiles.id} />
          </div>
        </div>

        {/* Section title & meta */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-4xl font-bold text-white">{section.title}</h1>
            {section.is_nsfw && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-semibold">
                <ShieldAlert size={14} />
                18+
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
            {section.categories && CategoryIcon && (
              <>
                <div className="flex items-center gap-1.5">
                  <CategoryIcon className="w-4 h-4" />
                  <span>{section.categories.name}</span>
                </div>

                <span>•</span>
              </>
            )}

            <span>
              {new Date(section.published_at || section.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Render blocks */}
        <SectionItemLikesProvider sectionId={section.id}>
          <div className="space-y-6 mb-12">
            {section.blocks.map((block: any) => {
              switch (block.type) {
                case 'text':
                  return <TextBlock key={block.id} block={block} />
                case 'image':
                  return <ImageBlock key={block.id} block={block} />
                case 'gallery':
                  return <GalleryBlock key={block.id} block={block} />
                case 'carousel':
                  return <CarouselBlock key={block.id} block={block} />
                case 'quote':
                  return <QuoteBlock key={block.id} block={block} />
                case 'divider':
                  return <DividerBlock key={block.id} block={block} />
                case 'links':
                  return <LinksBlock key={block.id} block={block} />
                case 'audio':
                  return <AudioBlock key={block.id} block={block} />
                case 'embed':
                  return <EmbedBlock key={block.id} block={block} />
                default:
                  return null
              }
            })}
          </div>
        </SectionItemLikesProvider>

        {/* Footer CTA */}
        <div className="p-8 bg-gradient-to-br from-gray-900 to-gray-950 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-6 text-center">
            {otherSectionsCount && otherSectionsCount > 0 ? (
              <>
                {section.profiles.display_name || section.profiles.username} has{' '}
                <span className="text-white font-semibold">
                  {otherSectionsCount}
                </span>{' '}
                other published{' '}
                {otherSectionsCount === 1 ? 'section' : 'sections'}
              </>
            ) : (
              <>This is the only published section from this creator</>
            )}
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href={`/${section.profiles.username}`}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              View Full Profile
            </Link>

            <Link
              href="/gallery"
              className="px-8 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              Browse More
            </Link>
          </div>
        </div>

        {/* Related Sections from Same Category */}
        {section.categories && (
          <RelatedSections
            categoryId={section.categories.id}
            categoryName={section.categories.name}
            categorySlug={section.categories.slug}
            currentSectionId={section.id}
            limit={6}
          />
        )}

        {/* Track view */}
        <ViewTracker sectionId={section.id} />
      </div>
    </div>
  )
}
