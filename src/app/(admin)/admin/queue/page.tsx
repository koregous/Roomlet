'use client'

import { useEffect, useState } from 'react'
import { Check, X, Eye, Filter, AlertCircle } from 'lucide-react'
import { Block } from '@/shared/lib/types'
import { useToast } from '@/shared/components/Toast'
import Image from 'next/image'

interface QueueSection {
  id: string
  title: string
  blocks: Block[]
  is_nsfw: boolean
  submitted_at: string
  category: {
    id: string
    name: string
    slug: string
    icon: string
  } | null
  creator: {
    username: string
    display_name: string
    avatar_url: string
  }
}

export default function AdminQueuePage() {
  const [sections, setSections] = useState<QueueSection[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'newest' | 'oldest'>('newest')
  const [nsfwFilter, setNsfwFilter] = useState<'all' | 'true' | 'false'>('all')
  const [selectedSection, setSelectedSection] = useState<QueueSection | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    loadQueue()
  }, [filter, nsfwFilter])

  const loadQueue = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        filter,
        nsfw: nsfwFilter,
        limit: '50',
      })

      const response = await fetch(`/api/admin/queue?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch queue')
      }

      const data = await response.json()
      setSections(data.sections || [])
    } catch (error) {
      console.error('Error loading queue:', error)
      addToast('Failed to load queue', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (sectionId: string, sectionTitle: string) => {
    if (actionInProgress) return

    try {
      setActionInProgress(true)
      const response = await fetch('/api/admin/queue/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve')
      }

      addToast(`"${sectionTitle}" approved and published!`, 'success')
      setShowPreview(false)
      setAdminNotes('')
      loadQueue()
    } catch (error: any) {
      console.error('Error approving:', error)
      addToast(error.message || 'Failed to approve section', 'error')
    } finally {
      setActionInProgress(false)
    }
  }

  const handleReject = async (sectionId: string, sectionTitle: string) => {
    if (actionInProgress) return

    if (!rejectionReason.trim()) {
      addToast('Please provide a rejection reason', 'error')
      return
    }

    try {
      setActionInProgress(true)
      const response = await fetch('/api/admin/queue/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          reason: rejectionReason,
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject')
      }

      addToast(`"${sectionTitle}" rejected`, 'success')
      setShowPreview(false)
      setRejectionReason('')
      setAdminNotes('')
      loadQueue()
    } catch (error: any) {
      console.error('Error rejecting:', error)
      addToast(error.message || 'Failed to reject section', 'error')
    } finally {
      setActionInProgress(false)
    }
  }

  const openPreview = (section: QueueSection) => {
    setSelectedSection(section)
    setShowPreview(true)
    setRejectionReason('')
    setAdminNotes('')
  }

  const closePreview = () => {
    if (!actionInProgress) {
      setShowPreview(false)
      setSelectedSection(null)
      setRejectionReason('')
      setAdminNotes('')
    }
  }

  const getFirstImage = (blocks: Block[]): string | null => {
    for (const block of blocks) {
      if (block.type === 'image' && block.content.image?.url) {
        return block.content.image.url
      }
      if (block.type === 'gallery' && block.content.images && block.content.images.length > 0) {
        return block.content.images[0].url
      }
      if (block.type === 'carousel' && block.content.images && block.content.images.length > 0) {
        return block.content.images[0].url
      }
    }
    return null
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif text-white mb-2">Approval Queue</h1>
            <p className="text-gray-500 text-sm">
              {loading ? 'Loading...' : `${sections.length} pending submission${sections.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'newest' | 'oldest')}
              className="px-3 py-2 bg-gray-900 border border-gray-800 text-white text-sm rounded focus:border-white focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <select
              value={nsfwFilter}
              onChange={(e) => setNsfwFilter(e.target.value as 'all' | 'true' | 'false')}
              className="px-3 py-2 bg-gray-900 border border-gray-800 text-white text-sm rounded focus:border-white focus:outline-none"
            >
              <option value="all">All Content</option>
              <option value="false">Safe Only</option>
              <option value="true">NSFW Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 border-4 border-gray-800 border-t-white rounded-full animate-spin" />
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg">No pending submissions</p>
            <p className="text-gray-600 text-sm mt-2">Check back later for new content to review</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => {
              const thumbnail = getFirstImage(section.blocks)
              
              return (
                <div
                  key={section.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:border-gray-700 transition"
                >
                  {thumbnail ? (
                    <div className="relative aspect-video bg-gray-800">
                      <Image
                        src={thumbnail}
                        alt={section.title}
                        fill
                        className="object-cover"
                      />
                      {section.is_nsfw && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                          NSFW
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-600 text-sm">No preview</span>
                    </div>
                  )}

                  <div className="p-4">
                    <h3 className="font-medium text-white mb-2 truncate">{section.title}</h3>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                      <span>@{section.creator.username}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(section.submitted_at)}</span>
                    </div>

                    {section.category && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                        <span>{section.category.icon}</span>
                        <span>{section.category.name}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openPreview(section)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition"
                      >
                        <Eye size={14} />
                        Preview
                      </button>
                      <button
                        onClick={() => handleApprove(section.id, section.title)}
                        disabled={actionInProgress}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition disabled:opacity-50"
                        title="Quick approve"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {showPreview && selectedSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={closePreview}
            />

            <div className="relative bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-start z-10">
                <div className="flex-1">
                  <h2 className="text-2xl font-serif text-white mb-2">{selectedSection.title}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>@{selectedSection.creator.username}</span>
                    {selectedSection.category && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {selectedSection.category.icon} {selectedSection.category.name}
                        </span>
                      </>
                    )}
                    {selectedSection.is_nsfw && (
                      <>
                        <span>•</span>
                        <span className="text-red-400">NSFW</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={closePreview}
                  disabled={actionInProgress}
                  className="text-gray-500 hover:text-white transition disabled:opacity-50"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-black border border-gray-800 rounded-lg p-6 mb-6">
                  <div className="space-y-4">
                    {selectedSection.blocks.map((block) => {
                      if (block.type === 'image' && block.content.image) {
                        return (
                          <div key={block.id} className="relative aspect-video">
                            <Image
                              src={block.content.image.url}
                              alt={block.content.image.alt || ''}
                              fill
                              className="object-contain"
                            />
                          </div>
                        )
                      }
                      if (block.type === 'gallery' && block.content.images) {
                        return (
                          <div key={block.id} className="grid grid-cols-3 gap-2">
                            {block.content.images.slice(0, 9).map((img, idx) => (
                              <div key={idx} className="relative aspect-square">
                                <Image
                                  src={img.url}
                                  alt={img.altText || ''}
                                  fill
                                  className="object-cover rounded"
                                />
                              </div>
                            ))}
                          </div>
                        )
                      }
                      if (block.type === 'text' && block.content.text) {
                        return (
                          <div key={block.id} className="text-gray-300 text-sm">
                            {block.content.text}
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Rejection Reason (visible to user)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g., 'Too pornographic', 'Wrong category', 'Low quality spam'..."
                      className="w-full px-3 py-2 bg-black border border-gray-800 text-white text-sm rounded focus:border-white focus:outline-none resize-none"
                      rows={3}
                      disabled={actionInProgress}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Internal Notes (admin-only)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Optional notes for other admins..."
                      className="w-full px-3 py-2 bg-black border border-gray-800 text-white text-sm rounded focus:border-white focus:outline-none resize-none"
                      rows={2}
                      disabled={actionInProgress}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedSection.id, selectedSection.title)}
                      disabled={actionInProgress}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded transition disabled:opacity-50"
                    >
                      <Check size={18} />
                      {actionInProgress ? 'Approving...' : 'Approve & Publish'}
                    </button>
                    <button
                      onClick={() => handleReject(selectedSection.id, selectedSection.title)}
                      disabled={actionInProgress || !rejectionReason.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded transition disabled:opacity-50"
                    >
                      <X size={18} />
                      {actionInProgress ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
