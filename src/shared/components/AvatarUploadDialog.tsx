'use client'

import { useState, useRef } from 'react'
import { Upload, X, Sparkles, Camera } from 'lucide-react'
import { useToast } from './Toast'

interface AvatarUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (avatarUrl: string) => void
  onSkip?: () => void
}

export default function AvatarUploadDialog({
  isOpen,
  onClose,
  onUploadComplete,
  onSkip,
}: AvatarUploadDialogProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'error')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      addToast('Image must be smaller than 10MB', 'error')
      return
    }

    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      // Update profile with new avatar
      const profileResponse = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar_url: data.url }),
      })

      if (!profileResponse.ok) {
        throw new Error('Failed to update profile')
      }

      addToast('Profile photo uploaded!', 'success')
      onUploadComplete(data.url)
      onClose()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upload failed'
      addToast(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSkip = () => {
    onSkip?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-purple-500/30 rounded-2xl p-8 max-w-md w-full relative animate-scale-in">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="bg-purple-500/20 rounded-full p-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">
              Add Your Profile Photo
            </h2>
            <p className="text-sm text-gray-400">
              Help others recognize you. You can always change this later.
            </p>
          </div>
        </div>

        {/* Upload area */}
        <div className="mb-6">
          {preview ? (
            // Preview
            <div className="relative">
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-800">
                <img
                  src={preview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => {
                  setPreview(null)
                  setSelectedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm rounded-full p-2 hover:bg-black transition"
                aria-label="Remove image"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            // Upload button
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square border-2 border-dashed border-gray-700 rounded-2xl hover:border-purple-500/50 hover:bg-purple-500/5 transition flex flex-col items-center justify-center gap-3 group"
            >
              <div className="bg-gray-800 group-hover:bg-purple-500/20 rounded-full p-4 transition">
                <Camera className="w-8 h-8 text-gray-400 group-hover:text-purple-400 transition" />
              </div>
              <div className="text-center">
                <p className="text-white font-medium mb-1">Choose a photo</p>
                <p className="text-xs text-gray-500">JPG, PNG, GIF up to 10MB</p>
              </div>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {preview ? (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-500 hover:to-blue-500 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Photo
                </>
              )}
            </button>
          ) : null}

          <button
            onClick={handleSkip}
            disabled={uploading}
            className="w-full text-gray-400 hover:text-white transition text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip for now
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
