/**
 * NSFW Content Gate - Inline Interstitial
 * 
 * Shown within a tab/section when NSFW content is clicked but user hasn't enabled NSFW.
 * Different from the age verification modal - this is a lighter, inline confirmation.
 * Respects global NSFW preference.
 */

'use client'

import { useState } from 'react'
import { Eye, AlertTriangle } from 'lucide-react'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import AgeVerificationModal from './AgeVerificationModal'

interface Props {
  contentTitle: string
  onReveal?: () => void
}

export default function NSFWContentGate({ contentTitle, onReveal }: Props) {
  const { ageVerified, enable, verifyAge } = useNSFWPreferences()
  const [showAgeGate, setShowAgeGate] = useState(false)

  const handleReveal = () => {
    if (ageVerified) {
      // Already verified age, just enable NSFW
      enable()
      onReveal?.()
    } else {
      // Show age verification first
      setShowAgeGate(true)
    }
  }

  const handleAgeConfirm = () => {
    verifyAge()
    enable()
    setShowAgeGate(false)
    onReveal?.()
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-[400px] px-6">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="inline-flex p-4 bg-red-500/10 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          {/* Title */}
          <h3 className="text-xl font-serif text-white mb-2">
            Mature Content
          </h3>

          {/* Description */}
          <p className="text-gray-400 mb-1">
            <span className="font-medium text-white">{contentTitle}</span> contains mature content.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You must be 18 years or older to view this section.
          </p>

          {/* Action Button */}
          <button
            onClick={handleReveal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            <Eye size={18} />
            Show Content
          </button>

          {/* Help Text */}
          <p className="text-xs text-gray-600 mt-4">
            This will enable NSFW content across the entire site
          </p>
        </div>
      </div>

      {/* Age Verification Modal */}
      <AgeVerificationModal
        isOpen={showAgeGate}
        onConfirm={handleAgeConfirm}
        onCancel={() => setShowAgeGate(false)}
      />
    </>
  )
}
