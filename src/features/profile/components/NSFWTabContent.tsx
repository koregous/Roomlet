/**
 * NSFW Tab Content Wrapper
 * 
 * Wraps NSFW section content with proper gating.
 * Shows interstitial if NSFW not enabled, otherwise shows content normally.
 */

'use client'

import { useState, useEffect } from 'react'
import { Section } from '@/shared/lib/types'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import NSFWContentGate from '@/shared/components/NSFWContentGate'
import BlockSection from '@/features/sections/components/BlockSection'
import { ShieldAlert } from 'lucide-react'

interface Props {
  section: Section
  username: string
}

export default function NSFWTabContent({ section, username }: Props) {
  const { isEnabled: nsfwEnabled } = useNSFWPreferences()
  const [revealed, setRevealed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-reveal if NSFW already enabled
  useEffect(() => {
    if (mounted && nsfwEnabled) {
      setRevealed(true)
    }
  }, [mounted, nsfwEnabled])

  if (!mounted) {
    // Loading state - show skeleton or nothing
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!revealed && !nsfwEnabled) {
    return (
      <NSFWContentGate
        contentTitle={section.title}
        onReveal={() => setRevealed(true)}
      />
    )
  }

  return (
    <div className="py-6">
      {/* NSFW Badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded">
          <ShieldAlert size={12} />
          NSFW Content
        </span>
        <span className="text-xs text-gray-500">
          Mature content enabled
        </span>
      </div>

      <BlockSection section={section} />
    </div>
  )
}

