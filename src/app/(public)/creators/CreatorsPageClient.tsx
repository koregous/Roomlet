'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users } from 'lucide-react'
import CreatorCard from '@/features/gallery/components/CreatorCard'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import { Creator } from './page'

interface Props {
  creators: Creator[]
}

export default function CreatorsPageClient({ creators }: Props) {
  const { isEnabled: nsfwEnabled } = useNSFWPreferences()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter NSFW profiles and sections based on user preference
  const filteredCreators = useMemo(() => {
    // Always hide NSFW by default for anonymous users and users with NSFW disabled
    if (!mounted || !nsfwEnabled) {
      return creators
        // Filter out profiles marked as NSFW
        .filter(creator => !creator.is_nsfw)
        // Filter NSFW sections from remaining creators
        .map(creator => ({
          ...creator,
          sections: creator.sections.filter(s => !s.is_nsfw)
        }))
        // Remove creators with no SFW sections
        .filter(creator => creator.sections.length > 0)
    }
    // Show all content only if user has NSFW enabled
    return creators
  }, [creators, nsfwEnabled, mounted])

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif font-semibold text-white mb-3">Profiles</h1>
          <p className="text-gray-400 text-lg">Discover interesting profiles and their collections</p>
        </div>

        {/* Creators Grid */}
        {filteredCreators.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.username} creator={creator} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-2xl font-semibold text-gray-300 mb-2">
              No profiles yet
            </h3>
            <p className="text-gray-500">
              {!nsfwEnabled 
                ? 'Enable NSFW content to see more profiles'
                : 'Be the first to publish your collections!'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
