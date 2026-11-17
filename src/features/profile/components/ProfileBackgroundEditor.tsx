'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, AlertCircle, Sparkles, EyeOff, Eye, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PremiumBadge from '@/shared/components/PremiumBadge'
import PremiumUpgradeDialog from '@/shared/components/PremiumUpgradeDialog'
import { Profile } from '@/shared/lib/types'
import {
  BACKGROUND_INTERVAL_OPTIONS,
  MAX_BACKGROUND_SLIDES,
  canAddSlide,
  getProfileBackgroundSlides,
  normalizeBackgroundInterval,
  slideTypeForContentType,
  type BackgroundSlide,
} from '@/shared/lib/background-slides'

interface Props {
  profile: Profile
  onSaved: () => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ACCEPT = 'video/mp4,video/webm,image/gif,image/jpeg,image/jpg,image/png,image/webp'

export default function ProfileBackgroundEditor({ profile, onSaved }: Props) {
  const router = useRouter()
  const [slides, setSlides] = useState<BackgroundSlide[]>(() => getProfileBackgroundSlides(profile))
  const [intervalSeconds, setIntervalSeconds] = useState(() =>
    normalizeBackgroundInterval(profile.profile_background_interval_seconds)
  )
  const [isNSFW, setIsNSFW] = useState(profile.background_is_nsfw || false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Latest slides for sequential uploads (state updates are async)
  const slidesRef = useRef(slides)
  slidesRef.current = slides

  const isPremium = profile.is_premium
  const hasBackground = slides.length > 0
  const hasVideo = slides.some(s => s.type === 'video')
  const canAddMore = slides.length < MAX_BACKGROUND_SLIDES && !hasVideo

  // Re-sync when the profile is reloaded from the server
  const profileKey = JSON.stringify([
    profile.profile_background_slides ?? null,
    profile.profile_background_url ?? null,
    profile.profile_background_interval_seconds ?? null,
    profile.background_is_nsfw ?? null,
  ])
  useEffect(() => {
    setSlides(getProfileBackgroundSlides(profile))
    setIntervalSeconds(normalizeBackgroundInterval(profile.profile_background_interval_seconds))
    setIsNSFW(profile.background_is_nsfw || false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const afterChange = () => {
    router.refresh()
    onSaved()
  }

  /** fetch + JSON, throwing the API's own message on failure */
  const request = async (input: string, init?: RequestInit) => {
    const res = await fetch(input, init)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Request failed')
    }
    return data
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  /** presigned URL → straight to R2 → confirm. Returns the updated slides. */
  const uploadOne = async (file: File): Promise<BackgroundSlide[]> => {
    const presigned = await request('/api/profile/background/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isNSFW,
      }),
    })

    // Direct to R2 (bypasses Vercel body limits)
    const uploadRes = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!uploadRes.ok) {
      throw new Error('Failed to upload file to storage')
    }

    const confirmed = await request('/api/profile/background/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicUrl: presigned.publicUrl, isNSFW }),
    })
    return confirmed.slides as BackgroundSlide[]
  }

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return

    if (!isPremium) {
      setShowUpgradeDialog(true)
      return
    }

    setError('')
    setNotice('')

    const remaining = MAX_BACKGROUND_SLIDES - slidesRef.current.length
    if (remaining <= 0) {
      setError(`You can have up to ${MAX_BACKGROUND_SLIDES} background images. Remove one to add another.`)
      return
    }

    const batch = files.slice(0, remaining)
    const skipped = files.length - batch.length

    setBusy(true)
    let added = 0
    try {
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i]

        const type = slideTypeForContentType(file.type)
        if (!type) {
          throw new Error(`"${file.name}": invalid file type. Allowed: MP4, WebM, GIF, JPG, PNG, WebP`)
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`"${file.name}" is too large. Maximum ${formatBytes(MAX_FILE_SIZE)}, this file is ${formatBytes(file.size)}.`)
        }
        const verdict = canAddSlide(slidesRef.current, type)
        if (!verdict.ok) {
          throw new Error(verdict.reason)
        }

        setStatus(batch.length > 1 ? `Uploading ${i + 1} of ${batch.length}...` : 'Uploading...')
        const next = await uploadOne(file)
        slidesRef.current = next
        setSlides(next)
        added++
      }

      if (skipped > 0) {
        setNotice(`Added ${added}. The limit is ${MAX_BACKGROUND_SLIDES} images, so ${skipped} ${skipped === 1 ? 'file was' : 'files were'} skipped.`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload background')
    } finally {
      setBusy(false)
      setStatus('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (added > 0) afterChange()
    }
  }

  // ── Remove / reorder / settings ───────────────────────────────────────────

  const removeSlide = async (url: string) => {
    const isLast = slides.length === 1
    if (!confirm(isLast ? 'Remove profile background? This cannot be undone.' : 'Remove this image from your background?')) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await request(`/api/profile/background?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      setSlides(data.slides)
      if (data.slides.length === 0) setIsNSFW(false)
      afterChange()
    } catch (err: any) {
      setError(err.message || 'Failed to remove image')
    } finally {
      setBusy(false)
    }
  }

  const removeAll = async () => {
    if (!confirm('Remove your entire profile background? This cannot be undone.')) return

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/profile/background', { method: 'DELETE' })
      setSlides([])
      setIsNSFW(false)
      afterChange()
    } catch (err: any) {
      setError(err.message || 'Failed to remove background')
    } finally {
      setBusy(false)
    }
  }

  const patch = (body: Record<string, unknown>) =>
    request('/api/profile/background', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const moveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= slides.length) return

    const previous = slides
    const next = [...slides]
    ;[next[index], next[target]] = [next[target], next[index]]
    setSlides(next) // optimistic

    setBusy(true)
    setError('')
    try {
      await patch({ order: next.map(s => s.url) })
      afterChange()
    } catch (err: any) {
      setSlides(previous)
      setError(err.message || 'Failed to reorder images')
    } finally {
      setBusy(false)
    }
  }

  const changeInterval = async (value: number) => {
    const previous = intervalSeconds
    setIntervalSeconds(value)
    setError('')
    try {
      await patch({ intervalSeconds: value })
      afterChange()
    } catch (err: any) {
      setIntervalSeconds(previous)
      setError(err.message || 'Failed to update slideshow speed')
    }
  }

  const toggleNSFW = async () => {
    const next = !isNSFW
    setIsNSFW(next)
    // No background yet: the choice is applied with the first upload
    if (!hasBackground) return

    setError('')
    try {
      await patch({ isNSFW: next })
      afterChange()
    } catch (err: any) {
      setIsNSFW(!next)
      setError(err.message || 'Failed to update NSFW setting')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    handleFiles(Array.from(e.dataTransfer.files || []))
  }

  // Free user - show locked section
  if (!isPremium) {
    return (
      <>
        <div className="border border-purple-900/50 rounded-lg p-6 bg-gradient-to-br from-purple-950/20 to-pink-950/20">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <Sparkles size={24} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-medium text-white">Profile Background</h3>
                <PremiumBadge size="sm" variant="gradient" />
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Set a stunning animated background on your profile with glass morphism effects. Premium users can upload videos, GIFs, or images, or combine up to {MAX_BACKGROUND_SLIDES} images into a slideshow.
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Video, GIF, or static image backgrounds
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Slideshow of up to {MAX_BACKGROUND_SLIDES} images that fade into each other
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Glass morphism overlay for readability
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Up to 10MB per file, 30 second videos
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeDialog(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition shadow-lg shadow-purple-500/20"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>

        <PremiumUpgradeDialog
          isOpen={showUpgradeDialog}
          onClose={() => setShowUpgradeDialog(false)}
          trigger="background"
        />
      </>
    )
  }

  // Premium user - show upload/manage section
  return (
    <div className="border border-purple-900/50 rounded-lg p-6 bg-gradient-to-br from-purple-950/10 to-pink-950/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-white">Profile Background</h3>
          <PremiumBadge size="sm" variant="gradient" />
        </div>
        {hasBackground && (
          <button
            onClick={removeAll}
            disabled={busy}
            className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition disabled:opacity-50"
          >
            <X size={16} />
            {slides.length > 1 ? 'Remove all' : 'Remove'}
          </button>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Upload a video, GIF, or image, or add up to {MAX_BACKGROUND_SLIDES} images to make a slideshow that fades between them (max 10MB each, 30s for videos).
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        disabled={busy}
        className="hidden"
      />

      {/* Current slides */}
      {hasBackground && (
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {slides.map((slide, index) => (
              <div
                key={slide.url}
                className="relative rounded-lg overflow-hidden border border-gray-800 bg-gray-900 aspect-video"
              >
                {slide.type === 'video' ? (
                  <video
                    src={slide.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={slide.url}
                    alt={`Background ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                <span className="absolute bottom-1.5 left-2 text-xs text-white font-medium pointer-events-none">
                  {slides.length > 1 ? `${index + 1} of ${slides.length}` : slide.type.toUpperCase()}
                </span>

                <button
                  onClick={() => removeSlide(slide.url)}
                  disabled={busy}
                  aria-label={`Remove image ${index + 1}`}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600/80 text-white transition disabled:opacity-50"
                >
                  <X size={14} />
                </button>

                {slides.length > 1 && (
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button
                      onClick={() => moveSlide(index, -1)}
                      disabled={busy || index === 0}
                      aria-label="Move earlier"
                      className="p-1 rounded bg-black/60 hover:bg-black/80 text-white transition disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => moveSlide(index, 1)}
                      disabled={busy || index === slides.length - 1}
                      aria-label="Move later"
                      className="p-1 rounded bg-black/60 hover:bg-black/80 text-white transition disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {canAddMore && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="aspect-video rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-500/10 text-gray-400 hover:text-white transition flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={22} />
                <span className="text-xs">
                  {status || `Add image (${slides.length}/${MAX_BACKGROUND_SLIDES})`}
                </span>
              </button>
            )}
          </div>

          {hasVideo && (
            <p className="text-xs text-gray-500 mt-2">
              Video backgrounds can&apos;t be combined with images. Remove the video to build a slideshow.
            </p>
          )}
        </div>
      )}

      {/* Slideshow speed */}
      {slides.length >= 2 && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800 flex items-center justify-between gap-3">
          <label htmlFor="background-interval" className="text-sm text-gray-300">
            Change image every
          </label>
          <select
            id="background-interval"
            value={intervalSeconds}
            onChange={(e) => changeInterval(parseInt(e.target.value, 10))}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
          >
            {BACKGROUND_INTERVAL_OPTIONS.map(seconds => (
              <option key={seconds} value={seconds}>{seconds} seconds</option>
            ))}
          </select>
        </div>
      )}

      {/* NSFW toggle */}
      <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNSFW ? (
              <EyeOff size={16} className="text-red-400" />
            ) : (
              <Eye size={16} className="text-gray-400" />
            )}
            <label className="text-sm text-gray-300">
              {slides.length > 1 ? 'Mark background as NSFW (applies to every image)' : 'Mark background as NSFW'}
            </label>
          </div>
          <button
            type="button"
            onClick={toggleNSFW}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isNSFW ? 'bg-red-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isNSFW ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isNSFW
            ? 'Background will be blurred for users with NSFW disabled'
            : 'Background will be visible to all users'}
        </p>
      </div>

      {/* Upload area (first background) */}
      {!hasBackground && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/30'
          } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !busy && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <Upload size={32} className={dragActive ? 'text-purple-400 mx-auto mb-3' : 'text-gray-500 mx-auto mb-3'} />

          {busy ? (
            <p className="text-gray-300 mb-2">{status || 'Uploading background...'}</p>
          ) : (
            <>
              <p className="text-gray-300 mb-2">
                {dragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-gray-500 text-sm">
                Select several images to make a slideshow. MP4, WebM, GIF, JPG, PNG, WebP (max 10MB each)
              </p>
            </>
          )}
        </div>
      )}

      {/* Notice / error messages */}
      {notice && (
        <div className="mt-4 text-sm text-gray-300 p-3 bg-gray-800/60 border border-gray-700 rounded-lg">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info text */}
      <p className="text-gray-500 text-xs mt-4">
        💡 Backgrounds count toward your 10GB storage quota. Videos are auto-looped and muted. Visitors who prefer reduced motion see the first image only.
      </p>
    </div>
  )
}
