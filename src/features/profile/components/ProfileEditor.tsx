'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Eye, Edit2, Copy, Check, Upload, X, Heart, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { Profile } from '@/shared/lib/types'
import { useProfile } from '@/features/profile/hooks/useProfile'
import { useToast } from '@/shared/components/Toast'
import { sanitizeUrl } from '@/shared/lib/sanitize'
import { FileValidationDialog } from '@/shared/components/FileValidationDialog'
import { validateImageFile } from '@/shared/lib/image-compress'
import ProfileBackgroundEditor from './ProfileBackgroundEditor'

const AUTO_SAVE_DELAY = 800 // 800ms debounce
const SAVED_INDICATOR_DURATION = 2000 // Show "Saved" for 2 seconds

// Drop Zone Components (defined outside to prevent remounting)

interface DropZoneProps {
  inputRef: React.RefObject<HTMLInputElement>
  uploading: boolean
  dragActive: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onFileChange: (file: File) => void
}

function ImageDropZone({
  inputRef,
  uploading,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
}: DropZoneProps) {
  return (
    <div
      className={`relative flex-1 flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
        dragActive ? 'border-white bg-white/5' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Upload size={24} className={dragActive ? 'text-white' : 'text-gray-500'} />
      <p className={`mt-2 text-sm ${dragActive ? 'text-white' : 'text-gray-400'}`}>
        {uploading ? 'Uploading...' : 'Click or drag to upload'}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Images, GIFs, or videos
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => {
          if (e.target.files?.[0]) onFileChange(e.target.files[0])
        }}
        disabled={uploading}
        className="hidden"
      />
    </div>
  )
}

interface Props {
  profile: Profile
  onSaved: () => void
}

export default function ProfileEditor({ profile, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [bannerUrl, setBannerUrl] = useState(profile.banner_url || '')
  const [bookmarksPublic, setBookmarksPublic] = useState(profile.bookmarks_public || false)
  const [isNSFW, setIsNSFW] = useState(profile.is_nsfw || false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [avatarDragActive, setAvatarDragActive] = useState(false)
  const [bannerDragActive, setBannerDragActive] = useState(false)
  const [profileUrl, setProfileUrl] = useState('')
  
  const [validationError, setValidationError] = useState<{
    error: string
    fileName?: string
    fileSize?: number
  } | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Use refs to store latest values for auto-save (avoid stale closure)
  const latestValuesRef = useRef({
    displayName,
    bio,
    avatarUrl,
    bannerUrl,
    bookmarksPublic,
    isNSFW,
  })

  // Update refs whenever values change
  useEffect(() => {
    latestValuesRef.current = {
      displayName,
      bio,
      avatarUrl,
      bannerUrl,
      bookmarksPublic,
      isNSFW,
    }
  }, [displayName, bio, avatarUrl, bannerUrl, bookmarksPublic, isNSFW])

  const { updateProfile, uploadAvatar, uploadBanner, setProfile } = useProfile()
  const { addToast } = useToast()

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)
    }
  }, [])

  // Sync the hook's internal profile state with the prop on mount and changes.
  useEffect(() => {
    setProfile(profile)
  }, [profile, setProfile])

  // Resolve window.location.origin safely (only in browser).
  useEffect(() => {
    setProfileUrl(`${window.location.origin}/${profile.username}`)
  }, [profile.username])

  // Refresh local form state when profile prop changes from parent.
  useEffect(() => {
    setDisplayName(profile.display_name || '')
    setBio(profile.bio || '')
    setAvatarUrl(profile.avatar_url || '')
    setBannerUrl(profile.banner_url || '')
    setBookmarksPublic(profile.bookmarks_public || false)
    setIsNSFW(profile.is_nsfw || false)
  }, [profile])

  // Auto-save function - uses refs to get latest values
  const performAutoSave = useCallback(async () => {
    console.log('[ProfileEditor] Auto-saving profile...')
    const values = latestValuesRef.current
    console.log('[ProfileEditor] bookmarksPublic value:', values.bookmarksPublic)
    setAutoSaving(true)
    setJustSaved(false)

    const ok = await updateProfile({
      display_name: values.displayName,
      bio: values.bio,
      avatar_url: values.avatarUrl,
      banner_url: values.bannerUrl,
      bookmarks_public: values.bookmarksPublic,
      is_nsfw: values.isNSFW,
    })

    setAutoSaving(false)

    if (ok) {
      console.log('[ProfileEditor] Auto-save successful')
      setJustSaved(true)
      onSaved()

      // Clear "Saved" indicator after delay
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current)
      }
      savedIndicatorTimerRef.current = setTimeout(() => {
        setJustSaved(false)
      }, SAVED_INDICATOR_DURATION)
    } else {
      console.log('[ProfileEditor] Auto-save failed')
    }
  }, [updateProfile, onSaved])

  const triggerAutoSave = useCallback(() => {
    // Clear "Saved" indicator when editing
    setJustSaved(false)
    if (savedIndicatorTimerRef.current) {
      clearTimeout(savedIndicatorTimerRef.current)
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave()
    }, AUTO_SAVE_DELAY)
  }, [performAutoSave])



  const handleAvatarUpload = async (file: File) => {
    // Validate file BEFORE attempting upload
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setValidationError({
        error: validation.error || 'Invalid file',
        fileName: file.name,
        fileSize: file.size,
      })
      if (avatarInputRef.current) avatarInputRef.current.value = ''
      return
    }

    setUploadingAvatar(true)
    const url = await uploadAvatar(file, avatarInputRef)
    if (url) setAvatarUrl(url)
    setUploadingAvatar(false)
    onSaved()
  }

  const handleBannerUpload = async (file: File) => {
    // Allow video/gif files for transparent backgrounds
    const isVideo = file.type.startsWith('video/')
    const isGif = file.type === 'image/gif'
    
    // Only validate static images (not gifs/videos)
    if (!isVideo && !isGif) {
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setValidationError({
          error: validation.error || 'Invalid file',
          fileName: file.name,
          fileSize: file.size,
        })
        if (bannerInputRef.current) bannerInputRef.current.value = ''
        return
      }
    } else {
      // Basic validation for video/gif
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        setValidationError({
          error: 'File too large. Maximum 10MB for videos and GIFs.',
          fileName: file.name,
          fileSize: file.size,
        })
        if (bannerInputRef.current) bannerInputRef.current.value = ''
        return
      }
    }

    setUploadingBanner(true)
    const url = await uploadBanner(file, bannerInputRef)
    if (url) setBannerUrl(url)
    setUploadingBanner(false)
    onSaved()
  }



  const copyProfileUrl = () => {
    navigator.clipboard.writeText(profileUrl)
    setCopiedUrl(true)
    addToast('Profile URL copied to clipboard!', 'success')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <>
      <FileValidationDialog
        isOpen={!!validationError}
        onClose={() => setValidationError(null)}
        error={validationError?.error || ''}
        fileName={validationError?.fileName}
        fileSize={validationError?.fileSize}
      />

      <div className="border border-ink-line p-8 mb-8 rounded-lg hover:border-gray-700 transition">
        <div className="flex justify-between items-start mb-6 flex-col md:flex-row gap-4">
          <div>
            <h2 className="text-3xl font-serif mb-2">{profile.display_name}</h2>
            <p className="text-gray-400">@{profile.username}</p>
            {profileUrl && (
              <p className="text-xs text-gray-500 mt-2">
                Profile URL: <span className="text-gray-400">{profileUrl}</span>
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-col md:flex-row">
            <button
              onClick={copyProfileUrl}
              className="ui-btn-secondary"
            >
              {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
              {copiedUrl ? 'Copied' : 'Copy URL'}
            </button>
            <Link
              href={`/${profile.username}`}
              className="ui-btn-secondary"
            >
              <Eye size={16} />
              View
            </Link>
            <button
              onClick={() => setEditing(!editing)}
              className="ui-btn-primary"
            >
              <Edit2 size={16} />
              Edit
            </button>
          </div>
        </div>

        {editing && (
          <div className="space-y-5 pt-6 border-t border-ink-line animate-slideUp">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Profile Picture</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ImageDropZone
                  inputRef={avatarInputRef}
                  uploading={uploadingAvatar}
                  dragActive={avatarDragActive}
                  onDragOver={(e) => { e.preventDefault(); setAvatarDragActive(true) }}
                  onDragLeave={() => setAvatarDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setAvatarDragActive(false)
                    if (e.dataTransfer.files?.[0]) handleAvatarUpload(e.dataTransfer.files[0])
                  }}
                  onFileChange={handleAvatarUpload}
                />
                <div className="space-y-3">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => {
                      setAvatarUrl(e.target.value)
                      if (editing) triggerAutoSave()
                    }}
                    disabled={uploadingAvatar}
                    className="ui-field py-2.5"
                    placeholder="Or paste URL"
                  />
                  {avatarUrl && (
                    <div className="relative">
                      <img
                        src={sanitizeUrl(avatarUrl)}
                        alt="Preview"
                        className="w-full h-32 rounded object-cover border border-ink-line"
                      />
                      <button
                        onClick={() => setAvatarUrl('')}
                        className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {uploadingAvatar && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                  Uploading...
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">Banner</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ImageDropZone
                  inputRef={bannerInputRef}
                  uploading={uploadingBanner}
                  dragActive={bannerDragActive}
                  onDragOver={(e) => { e.preventDefault(); setBannerDragActive(true) }}
                  onDragLeave={() => setBannerDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setBannerDragActive(false)
                    if (e.dataTransfer.files?.[0]) handleBannerUpload(e.dataTransfer.files[0])
                  }}
                  onFileChange={handleBannerUpload}
                />
                <div className="space-y-3">
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => {
                      setBannerUrl(e.target.value)
                      if (editing) triggerAutoSave()
                    }}
                    disabled={uploadingBanner}
                    className="ui-field py-2.5"
                    placeholder="Or paste URL"
                  />
                  {bannerUrl && (
                    <div className="relative">
                      {bannerUrl.match(/\.(mp4|webm|mov)$/i) ? (
                        <video
                          src={sanitizeUrl(bannerUrl)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-32 rounded object-cover border border-ink-line"
                        />
                      ) : (
                        <img
                          src={sanitizeUrl(bannerUrl)}
                          alt="Banner Preview"
                          className="w-full h-32 rounded object-cover border border-ink-line"
                        />
                      )}
                      <button
                        onClick={() => setBannerUrl('')}
                        className="absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {uploadingBanner && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                  <div className="h-4 w-4 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                  Uploading...
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (editing) triggerAutoSave()
                }}
                className="ui-field py-2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value)
                  if (editing) triggerAutoSave()
                }}
                rows={4}
                maxLength={500}
                className="ui-field resize-none py-2.5"
                placeholder="Tell your story..."
              />
              <p className="text-xs text-gray-600 mt-1 text-right">{bio.length}/500</p>
            </div>

            <div className="border border-ink-line rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                    <Heart size={16} className="text-red-500" />
                    Show Bookmarks on Profile
                  </label>
                  <p className="text-xs text-gray-500">
                    Allow others to see your bookmarked collections on your public profile. Your bookmarks are private by default.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = !bookmarksPublic
                    console.log('[ProfileEditor] Toggle clicked, setting bookmarksPublic to:', newValue)
                    setBookmarksPublic(newValue)
                    triggerAutoSave()
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black ${
                    bookmarksPublic ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      bookmarksPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Profile NSFW Toggle */}
            <div className="border border-red-900/50 rounded-lg p-4 bg-red-950/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1">
                    <EyeOff size={16} className="text-red-400" />
                    Mark Profile as NSFW
                  </label>
                  <p className="text-xs text-gray-500">
                    Mark your entire profile as NSFW (Not Safe For Work). Your profile will be blurred for users who have NSFW content disabled.
                  </p>
                  <p className="text-xs text-yellow-500/70 mt-2">
                    ⚠️ This applies to your entire profile, not individual sections. Use this if your profile consistently contains adult or sensitive content.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = !isNSFW
                    console.log('[ProfileEditor] NSFW toggle clicked, setting isNSFW to:', newValue)
                    setIsNSFW(newValue)
                    triggerAutoSave()
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black ${
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
            </div>

            {/* Premium Profile Background Upload */}
            <ProfileBackgroundEditor profile={profile} onSaved={onSaved} />

            <div className="flex items-center gap-3 pt-2">
              {autoSaving && (
                <span className="flex items-center gap-2 text-sm text-blue-400">
                  <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
                  Saving...
                </span>
              )}
              {!autoSaving && justSaved && (
                <span className="flex items-center gap-2 text-sm text-green-400">
                  <Check size={14} />
                  Saved
                </span>
              )}
              {!autoSaving && !justSaved && (
                <span className="text-sm text-gray-500">
                  Changes auto-save
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
