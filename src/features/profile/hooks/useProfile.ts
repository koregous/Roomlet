'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { Profile } from '@/shared/lib/types'
import { useToast } from '@/shared/components/Toast'
import { validateDisplayName, validateBio } from '@/shared/lib/content-moderation'

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { addToast } = useToast()

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return null
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // Profile doesn't exist yet — create it via the API
        try {
          const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: `user_${user.id.slice(0, 8)}`,
              display_name: user.email?.split('@')[0] || 'New User',
            }),
          })
          const result = await response.json()
          if (response.ok && result) {
            setProfile(result as Profile)
            addToast('Profile created successfully!', 'success')
            setLoading(false)
            return result as Profile
          } else {
            addToast(result.error || 'Failed to create profile', 'error')
          }
        } catch {
          addToast('Error creating profile', 'error')
        }
      }
      setLoading(false)
      return null
    }

    if (profileData) {
      setProfile(profileData as unknown as Profile)
      setLoading(false)
      return profileData as unknown as Profile
    }

    setLoading(false)
    return null
  }, [supabase, router, addToast])

  const updateProfile = useCallback(
    async (updates: {
      display_name: string
      bio: string
      avatar_url: string
      banner_url: string
      bookmarks_public?: boolean
      is_nsfw?: boolean
    }) => {
      if (!profile) {
        addToast('Profile not loaded yet, please try again', 'error')
        return false
      }

      // Validate display name for profanity
      if (updates.display_name) {
        const displayNameValidation = validateDisplayName(updates.display_name)
        if (!displayNameValidation.valid) {
          addToast(displayNameValidation.reason || 'Display name contains inappropriate language', 'error')
          return false
        }
      }

      // Validate bio for profanity (auto-clean option)
      let cleanedBio = updates.bio
      if (updates.bio) {
        const bioValidation = validateBio(updates.bio, true) // auto-clean enabled
        if (!bioValidation.valid) {
          addToast(bioValidation.reason || 'Bio contains inappropriate language', 'error')
          return false
        }
        // Use cleaned version if profanity was found
        if (bioValidation.cleaned) {
          cleanedBio = bioValidation.cleaned
          addToast('Some inappropriate language was filtered from your bio', 'info')
        }
      }

      const { error, data } = await (supabase as any)
        .from('profiles')
        .update({ 
          ...updates, 
          bio: cleanedBio, // Use cleaned bio
          updated_at: new Date().toISOString() 
        })
        .eq('id', profile.id as string)
        .select()
        .single()

      if (error) {
        addToast('Failed to update profile', 'error')
        return false
      }

      if (data) {
        setProfile(data as Profile)
      }

      addToast('Profile updated successfully!', 'success')
      return true
    },
    [profile, supabase, addToast]
  )

  const uploadAvatar = useCallback(
    async (file: File, inputRef: React.RefObject<HTMLInputElement>) => {
      if (!profile) {
        addToast('Profile not loaded yet, please try again', 'error')
        return null
      }

      try {
        // Import and use compression utility
        const { compressImage, validateImageFile, COMPRESSION_PRESETS } = await import(
          '@/shared/lib/image-compress'
        )

        // Validate file
        const validation = validateImageFile(file)
        if (!validation.valid) {
          addToast(validation.error || 'Invalid file', 'error')
          return null
        }

        // Compress image before upload
        addToast('Compressing image...', 'info')
        const compressedFile = await compressImage(file, COMPRESSION_PRESETS.avatar)

        const formData = new FormData()
        formData.append('file', compressedFile)

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
        const newUrl = data.url

        const { error, data: profileData } = await (supabase as any)
          .from('profiles')
          .update({ avatar_url: newUrl, updated_at: new Date().toISOString() })
          .eq('id', profile.id as string)
          .select()
          .single()

        if (error) throw error

        if (profileData) {
          setProfile(profileData as Profile)
        }

        addToast('Avatar uploaded successfully!', 'success')
        return newUrl
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`Failed to upload avatar: ${msg}`, 'error')
        return null
      } finally {
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [profile, supabase, addToast]
  )

  const uploadBanner = useCallback(
    async (file: File, inputRef: React.RefObject<HTMLInputElement>) => {
      if (!profile) {
        addToast('Profile not loaded yet, please try again', 'error')
        return null
      }

      try {
        // Import and use compression utility
        const { compressImage, validateImageFile, COMPRESSION_PRESETS } = await import(
          '@/shared/lib/image-compress'
        )

        // Validate file
        const validation = validateImageFile(file)
        if (!validation.valid) {
          addToast(validation.error || 'Invalid file', 'error')
          return null
        }

        // Compress image before upload
        addToast('Compressing image...', 'info')
        const compressedFile = await compressImage(file, COMPRESSION_PRESETS.banner)

        const formData = new FormData()
        formData.append('file', compressedFile)

        const response = await fetch('/api/upload/banner', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()
        const newUrl = data.url

        const { error, data: profileData } = await (supabase as any)
          .from('profiles')
          .update({ banner_url: newUrl, updated_at: new Date().toISOString() })
          .eq('id', profile.id as string)
          .select()
          .single()

        if (error) throw error

        if (profileData) {
          setProfile(profileData as Profile)
        }

        addToast('Banner uploaded successfully!', 'success')

        // ── Generate OG banner for social media previews ─────────
        // Only generate if profile doesn't already have one
        try {
          const { needsOGBanner, generateAndUploadOGBanner } = await import(
            '@/shared/lib/og-thumbnail'
          )
          
          const needsOG = await needsOGBanner(profile.id as string)
          if (needsOG) {
            console.log('[useProfile] Generating OG banner for profile:', profile.id)
            await generateAndUploadOGBanner(file, profile.id as string)
          }
        } catch (ogError) {
          // Don't fail the whole upload if OG generation fails
          console.error('[useProfile] OG banner generation failed:', ogError)
        }

        return newUrl
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`Failed to upload banner: ${msg}`, 'error')
        return null
      } finally {
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [profile, supabase, addToast]
  )

  return {
    profile,
    setProfile,
    loading,
    loadProfile,
    updateProfile,
    uploadAvatar,
    uploadBanner,
  }
}