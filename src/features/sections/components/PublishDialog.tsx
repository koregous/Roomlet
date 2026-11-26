'use client'

import { useState, useEffect } from 'react'
import { Category, Section } from '@/shared/lib/types'
import { X, ShieldAlert, ChevronDown, Check } from 'lucide-react'
import TagInput from '@/shared/components/TagInput'
import { suggestTags, POPULAR_TAGS } from '@/shared/lib/tagSuggestions'

interface Props {
  sectionId: string
  section: Section // Add full section for tag suggestions
  isOpen: boolean
  onClose: () => void
  onSuccess: (galleryUrl: string) => void
}

export default function PublishDialog({
  sectionId,
  section,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [isNsfw, setIsNsfw] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  // Generate tag suggestions when dialog opens
  useEffect(() => {
    if (isOpen && section) {
      const suggestions = suggestTags(section)
      setSuggestedTags(suggestions)
      // Pre-select high-confidence suggestions
      setSelectedTags(suggestions.slice(0, 3))
    }
  }, [isOpen, section])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/gallery/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data.categories || [])
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }

    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  const handlePublish = async () => {
    if (!selectedCategory) {
      setError('Please select a category')
      return
    }

    setIsPublishing(true)
    setError(null)

    try {
      // 1. First, update section metadata (category, NSFW flag, tags)
      const metadataResponse = await fetch('/api/sections/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          categoryId: selectedCategory,
          is_nsfw: isNsfw,
          published: false, // Don't publish yet - just set metadata
        }),
      })

      const metadataData = await metadataResponse.json()

      if (!metadataResponse.ok) {
        throw new Error(metadataData.error || 'Failed to update section metadata')
      }

      // 2. Add tags if any selected
      if (selectedTags.length > 0) {
        await fetch(`/api/sections/${sectionId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: selectedTags }),
        })
        // Don't fail if tags fail - just log it
      }

      // 3. Submit for review
      const submitResponse = await fetch('/api/sections/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      })

      const submitData = await submitResponse.json()

      if (!submitResponse.ok) {
        throw new Error(submitData.error || 'Failed to submit for review')
      }

      // Success - trigger success callback with empty URL (not published yet)
      onSuccess('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to submit section')
    } finally {
      setIsPublishing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-black rounded-lg border border-ink-line p-8 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif text-white">Submit for Review</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="relative">
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => !isPublishing && setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-black border border-ink-line text-white text-sm focus:border-white focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPublishing}
              >
                {selectedCategory ? (
                  <span className="flex items-center gap-2">
                    {categories.find(c => c.id === selectedCategory)?.icon} {categories.find(c => c.id === selectedCategory)?.name}
                  </span>
                ) : (
                  <span className="text-gray-500">Select a category...</span>
                )}
                <ChevronDown size={16} className={`text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDropdownOpen && !isPublishing && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute z-20 w-full mt-1 bg-black border border-ink-line rounded shadow-xl max-h-60 overflow-y-auto py-1">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat.id)
                          setIsDropdownOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors text-left"
                      >
                        <span className="flex items-center gap-2">
                          {cat.icon} {cat.name}
                        </span>
                        {selectedCategory === cat.id && <Check size={16} className="text-blue-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
              Tags (optional)
            </label>
            <TagInput
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              suggestions={suggestedTags}
              popularTags={POPULAR_TAGS}
              maxTags={8}
              placeholder="Add tags to help people discover your work..."
            />
            <p className="text-xs text-gray-600 mt-2">
              Tags help people find your work through search and discovery
            </p>
          </div>

          {/* NSFW Toggle */}
          <div className="pt-2 border-t border-ink-line">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={isNsfw}
                onChange={(e) => setIsNsfw(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-ink-line bg-black text-white focus:ring-2 focus:ring-white focus:ring-offset-0 focus:ring-offset-black cursor-pointer"
                disabled={isPublishing}
              />
              <div className="flex-1">
                <span className="text-sm text-white group-hover:text-gray-300 transition-colors flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-red-400" />
                  Mark as NSFW
                </span>
                <p className="text-xs text-gray-600 mt-1">
                  This content is not safe for work (adult, mature, or sensitive content). NSFW content is filtered by default in feeds and discovery.
                </p>
              </div>
            </label>
          </div>

          <p className="text-xs text-gray-600 pt-2">
            Your section will be reviewed by an admin before appearing in the gallery. You'll be notified once it's approved.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="flex-1 px-4 py-2 border border-ink-line text-gray-400 hover:text-white hover:border-gray-700 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={!selectedCategory || isPublishing}
            className="flex-1 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
