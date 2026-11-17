'use client'

import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, Sparkles, EyeOff, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PremiumBadge from '@/shared/components/PremiumBadge'
import PremiumUpgradeDialog from '@/shared/components/PremiumUpgradeDialog'
import { Profile } from '@/shared/lib/types'

interface Props {
  profile: Profile
  onSaved: () => void
}

export default function ProfileBackgroundEditor({ profile, onSaved }: Props) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isNSFW, setIsNSFW] = useState(profile.background_is_nsfw || false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPremium = profile.is_premium
  const hasBackground = !!profile.profile_background_url

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const handleUpload = async (file: File) => {
    if (!isPremium) {
      setShowUpgradeDialog(true)
      return
    }

    // Validate file size
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setError(`File too large. Maximum ${formatBytes(maxSize)}, your file is ${formatBytes(file.size)}.`)
      return
    }

    // Validate file type
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'image/gif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ]
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: MP4, WebM, GIF, JPG, PNG, WebP')
      return
    }

    setUploading(true)
    setError('')

    try {
      // Step 1: Get presigned URL from our API
      const presignedRes = await fetch('/api/profile/background/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isNSFW: isNSFW,
        }),
      })

      const presignedData = await presignedRes.json()

      if (!presignedRes.ok) {
        throw new Error(presignedData.error || presignedData.message || 'Failed to get upload URL')
      }

      // Step 2: Upload directly to R2 using presigned URL (bypasses Vercel limits!)
      const uploadRes = await fetch(presignedData.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage')
      }

      // Step 3: Confirm upload and update profile
      const confirmRes = await fetch('/api/profile/background/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicUrl: presignedData.publicUrl,
          backgroundType: presignedData.backgroundType,
          fileSize: file.size,
          isNSFW: presignedData.isNSFW,
        }),
      })

      const confirmData = await confirmRes.json()

      if (!confirmRes.ok) {
        throw new Error(confirmData.error || 'Failed to confirm upload')
      }

      // Refresh the page to show new background
      router.refresh()
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to upload background')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove profile background? This cannot be undone.')) return

    setUploading(true)
    setError('')

    try {
      const res = await fetch('/api/profile/background', { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove background')
      }

      router.refresh()
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Failed to remove background')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
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
                Set a stunning animated background on your profile with glass morphism effects. Premium users can upload videos, GIFs, or images to create eye-catching profiles.
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Video, GIF, or static image backgrounds
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Glass morphism overlay for readability
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                  Up to 10MB file size, 30 second videos
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
            onClick={handleRemove}
            disabled={uploading}
            className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition disabled:opacity-50"
          >
            <X size={16} />
            Remove
          </button>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Upload a video, GIF, or image as your profile background (max 10MB, 30s for videos)
      </p>

      {/* Current background preview */}
      {hasBackground && (
        <div className="mb-4 relative rounded-lg overflow-hidden border border-gray-800">
          {profile.profile_background_type === 'video' && (
            <video
              src={profile.profile_background_url!}
              poster={profile.profile_background_poster_url || undefined}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-48 object-cover"
            />
          )}
          {(profile.profile_background_type === 'gif' || profile.profile_background_type === 'image') && (
            <img
              src={profile.profile_background_url!}
              alt="Background preview"
              className="w-full h-48 object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <span className="text-white text-sm font-medium">
              Current: {profile.profile_background_type?.toUpperCase()}
            </span>
          </div>
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
            <label className="text-sm text-gray-300">Mark background as NSFW</label>
          </div>
          <button
            type="button"
            onClick={() => setIsNSFW(!isNSFW)}
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

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          dragActive 
            ? 'border-purple-500 bg-purple-500/10' 
            : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/30'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,image/gif,image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
          disabled={uploading}
          className="hidden"
        />
        
        <Upload size={32} className={dragActive ? 'text-purple-400 mx-auto mb-3' : 'text-gray-500 mx-auto mb-3'} />
        
        {uploading ? (
          <p className="text-gray-300 mb-2">Uploading background...</p>
        ) : (
          <>
            <p className="text-gray-300 mb-2">
              {dragActive ? 'Drop file here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 text-sm">
              MP4, WebM, GIF, JPG, PNG, WebP (max 10MB)
            </p>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Info text */}
      <p className="text-gray-500 text-xs mt-4">
        💡 Backgrounds count toward your 10GB storage quota. Videos are auto-looped and muted for optimal UX.
      </p>
    </div>
  )
}
