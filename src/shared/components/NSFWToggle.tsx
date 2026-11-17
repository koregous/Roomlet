/**
 * NSFW Content Toggle
 * 
 * Site-wide toggle for enabling/disabling NSFW content.
 * Shows age verification modal on first enable.
 * Persists preference across page loads.
 */

'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import AgeVerificationModal from './AgeVerificationModal'

interface Props {
  className?: string
  showLabel?: boolean
}

export default function NSFWToggle({ className = '', showLabel = true }: Props) {
  const { enabled, ageVerified, enable, disable, verifyAge } = useNSFWPreferences()
  const [showAgeGate, setShowAgeGate] = useState(false)

  const handleToggle = () => {
    if (enabled) {
      // Turning off - no gate needed
      disable()
    } else {
      // Turning on - check age verification
      if (ageVerified) {
        enable()
      } else {
        // Show age gate modal
        setShowAgeGate(true)
      }
    }
  }

  const handleAgeConfirm = () => {
    verifyAge()
    enable()
    setShowAgeGate(false)
  }

  const handleAgeCancel = () => {
    setShowAgeGate(false)
  }

  return (
    <>
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-2 px-3 py-2 
          border border-gray-800 rounded
          transition-colors
          ${enabled 
            ? 'bg-white text-black hover:bg-gray-200' 
            : 'bg-black text-gray-400 hover:text-white hover:border-gray-700'
          }
          ${className}
        `}
        title={enabled ? 'Hide NSFW content' : 'Show NSFW content (18+)'}
      >
        {enabled ? (
          <>
            <Eye size={16} />
            {showLabel && <span className="text-sm">NSFW: On</span>}
          </>
        ) : (
          <>
            <EyeOff size={16} />
            {showLabel && <span className="text-sm">NSFW: Off</span>}
          </>
        )}
      </button>

      <AgeVerificationModal
        isOpen={showAgeGate}
        onConfirm={handleAgeConfirm}
        onCancel={handleAgeCancel}
      />
    </>
  )
}
