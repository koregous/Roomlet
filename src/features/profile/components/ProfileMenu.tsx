'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Share2, Flag, Check, Copy } from 'lucide-react'
import { Profile } from '@/shared/lib/types'

interface Props {
  profile: Profile
  isOwnProfile?: boolean
}

export default function ProfileMenu({ profile, isOwnProfile = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const profileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/${profile.username}` 
    : ''

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.display_name || profile.username}'s Profile`,
          text: profile.bio || `Check out ${profile.display_name || profile.username} on Roomlet`,
          url: profileUrl,
        })
        setIsOpen(false)
      } catch (err) {
        // User cancelled share or share failed
        console.log('Share cancelled')
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(profileUrl)
        setShareSuccess(true)
        setTimeout(() => {
          setShareSuccess(false)
          setIsOpen(false)
        }, 1500)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleReport = () => {
    setIsOpen(false)
    setShowReportDialog(true)
  }

  // Don't show report option for own profile
  if (isOwnProfile) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          aria-label="Profile menu"
        >
          <MoreVertical size={20} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-12 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              {shareSuccess ? (
                <>
                  <Check size={16} className="text-green-500" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Share Profile</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          aria-label="Profile menu"
        >
          <MoreVertical size={20} />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-12 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition border-b border-gray-800"
            >
              {shareSuccess ? (
                <>
                  <Check size={16} className="text-green-500" />
                  <span>Link copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Share Profile</span>
                </>
              )}
            </button>
            <button
              onClick={handleReport}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition"
            >
              <Flag size={16} />
              <span>Report Profile</span>
            </button>
          </div>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <ReportProfileDialog
          profile={profile}
          onClose={() => setShowReportDialog(false)}
        />
      )}
    </>
  )
}

// Report Profile Dialog Component
function ReportProfileDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [reason, setReason] = useState<'spam' | 'harassment' | 'inappropriate_background' | 'inappropriate_content' | 'impersonation' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!reason) {
      setError('Please select a reason')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/reports/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profile.username,
          reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report')
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full border border-gray-800 shadow-2xl">
        {success ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Report Submitted
            </h3>
            <p className="text-gray-400 text-sm">
              Thank you for helping keep Roomlet safe. We'll review this report shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">Report Profile</h3>
              <p className="text-gray-400 text-sm mt-1">
                Report @{profile.username} for violating community guidelines
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Why are you reporting this profile?
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'spam', label: 'Spam or misleading' },
                    { value: 'harassment', label: 'Harassment or hate speech' },
                    { value: 'inappropriate_background', label: 'Inappropriate background' },
                    { value: 'inappropriate_content', label: 'Inappropriate content' },
                    { value: 'impersonation', label: 'Impersonation' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        reason === option.value
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={option.value}
                        checked={reason === option.value}
                        onChange={(e) => setReason(e.target.value as any)}
                        className="text-red-500 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-300">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reason}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
