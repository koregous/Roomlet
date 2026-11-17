'use client'

import { useState } from 'react'
import { Share2, X, Copy, Check } from 'lucide-react'
import { useToast } from '@/shared/components/Toast'
import { slugify } from '@/shared/lib/slug'

interface ShareButtonProps {
  sectionId: string
  title: string
  username?: string // Optional: if provided, use /{username}/{slug} format
}

/**
 * ShareButton - Share collection via social media or copy link
 * 
 * Provides multiple sharing options:
 * - Copy link (clipboard)
 * - Twitter/X
 * - Facebook
 * - Reddit
 * - Email
 */
export default function ShareButton({ sectionId, title, username }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'
  
  // Use pretty URL if username is provided, otherwise fallback to UUID
  const titleSlug = slugify(title)
  const sectionUrl = username 
    ? `${baseUrl}/${username}/${titleSlug}`
    : `${baseUrl}/s/${sectionId}`
  const encodedUrl = encodeURIComponent(sectionUrl)
  const encodedTitle = encodeURIComponent(title)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(sectionUrl)
      setCopied(true)
      addToast('Link copied to clipboard!', 'success', 2000)
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      addToast('Failed to copy link', 'error')
    }
  }

  const shareLinks = [
    {
      name: 'Twitter',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: 'hover:bg-black hover:text-white',
    },
    {
      name: 'Facebook',
      icon: 'f',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-600 hover:text-white',
    },
    {
      name: 'Reddit',
      icon: '🗨',
      url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      color: 'hover:bg-orange-600 hover:text-white',
    },
    {
      name: 'Email',
      icon: '✉',
      url: `mailto:?subject=${encodedTitle}&body=Check out this collection: ${encodedUrl}`,
      color: 'hover:bg-gray-700 hover:text-white',
    },
  ]

  return (
    <>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition"
        aria-label="Share collection"
      >
        <Share2 size={16} />
        <span className="hidden sm:inline">Share</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif font-semibold text-white">
                Share Collection
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Copy Link Section */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Collection Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sectionUrl}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-gray-700"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg transition font-medium ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {copied ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Share Options */}
            <div>
              <label className="block text-sm text-gray-400 mb-3">
                Share via
              </label>
              <div className="grid grid-cols-2 gap-3">
                {shareLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-4 bg-gray-950 border border-gray-800 rounded-lg transition ${link.color}`}
                    onClick={() => {
                      // Close modal after a short delay to allow the link to open
                      setTimeout(() => setIsOpen(false), 200)
                    }}
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <span className="font-medium">{link.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Native Share (Mobile) */}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: title,
                      url: sectionUrl,
                    })
                    setIsOpen(false)
                  } catch (error) {
                    // User cancelled or share failed
                    console.log('Share cancelled or failed:', error)
                  }
                }}
                className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                More sharing options...
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
