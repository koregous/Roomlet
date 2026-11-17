/**
 * OpenGraph Thumbnail Generator
 * 
 * Generates JPEG thumbnails for OpenGraph/social media previews
 * since Next.js ImageResponse doesn't support WebP
 */

import { compressImage, COMPRESSION_PRESETS } from './image-compress'

/**
 * Generate and upload OG thumbnail for a section
 * Should only be called for the first image in a gallery
 */
export async function generateAndUploadOGThumbnail(
  imageFile: File,
  sectionId: string
): Promise<string | null> {
  try {
    console.log('[OG Thumbnail] Generating JPEG thumbnail for section:', sectionId)

    // Compress to JPEG thumbnail (1200x630 @ 0.85 quality)
    const jpegThumbnail = await compressImage(imageFile, COMPRESSION_PRESETS.ogThumbnail)
    
    console.log('[OG Thumbnail] Compressed:', {
      original: (imageFile.size / 1024).toFixed(1) + 'KB',
      compressed: (jpegThumbnail.size / 1024).toFixed(1) + 'KB',
      format: jpegThumbnail.type,
    })

    // Upload to OG thumbnail endpoint
    const formData = new FormData()
    formData.append('file', jpegThumbnail)
    formData.append('sectionId', sectionId)

    const response = await fetch('/api/upload/og-thumbnail', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[OG Thumbnail] Upload failed:', error)
      return null
    }

    const result = await response.json()
    console.log('[OG Thumbnail] Successfully uploaded:', result.url)
    
    return result.url
  } catch (error) {
    console.error('[OG Thumbnail] Error generating/uploading:', error)
    return null
  }
}

/**
 * Check if section needs OG thumbnail
 * Fetches section to see if og_image_url is already set
 */
export async function needsOGThumbnail(sectionId: string): Promise<boolean> {
  try {
    // Use Supabase browser client to check section
    const { getSupabaseBrowserClient } = await import('@/shared/lib/supabase-browser')
    const supabase = getSupabaseBrowserClient()
    
    const { data, error } = await supabase
      .from('sections')
      .select('og_image_url')
      .eq('id', sectionId)
      .single()

    if (error) {
      console.error('[OG Thumbnail] Error checking section:', error)
      return false
    }

    return !data.og_image_url
  } catch (error) {
    console.error('[OG Thumbnail] Error:', error)
    return false
  }
}

/**
 * Generate and upload OG banner for a profile
 * Should be called after banner upload
 */
export async function generateAndUploadOGBanner(
  imageFile: File,
  profileId: string
): Promise<string | null> {
  try {
    console.log('[OG Banner] Generating JPEG banner for profile:', profileId)

    // Compress to JPEG banner (1200x630 @ 0.85 quality)
    const jpegBanner = await compressImage(imageFile, COMPRESSION_PRESETS.ogThumbnail)
    
    console.log('[OG Banner] Compressed:', {
      original: (imageFile.size / 1024).toFixed(1) + 'KB',
      compressed: (jpegBanner.size / 1024).toFixed(1) + 'KB',
      format: jpegBanner.type,
    })

    // Upload to OG banner endpoint
    const formData = new FormData()
    formData.append('file', jpegBanner)
    formData.append('profileId', profileId)

    const response = await fetch('/api/upload/og-banner', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('[OG Banner] Upload failed:', error)
      return null
    }

    const result = await response.json()
    console.log('[OG Banner] Successfully uploaded:', result.url)
    
    return result.url
  } catch (error) {
    console.error('[OG Banner] Error generating/uploading:', error)
    return null
  }
}

/**
 * Check if profile needs OG banner
 * Fetches profile to see if og_banner_url is already set
 */
export async function needsOGBanner(profileId: string): Promise<boolean> {
  try {
    // Use Supabase browser client to check profile
    const { getSupabaseBrowserClient } = await import('@/shared/lib/supabase-browser')
    const supabase = getSupabaseBrowserClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('og_banner_url')
      .eq('id', profileId)
      .single()

    if (error) {
      console.error('[OG Banner] Error checking profile:', error)
      return false
    }

    return !data.og_banner_url
  } catch (error) {
    console.error('[OG Banner] Error:', error)
    return false
  }
}
