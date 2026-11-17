import { ImageResponse } from 'next/og'
import { getSupabaseClient } from '@/shared/lib/supabase'

export const runtime = 'edge'

// Helper: get first image from blocks (prioritize gallery)
// Note: Next.js ImageResponse only supports JPEG, PNG, GIF (not WebP)
function getPreviewImage(blocks: any[]): string | null {
  // Helper to check if image format is supported by Next.js ImageResponse
  const isSupportedFormat = (url: string): boolean => {
    const lower = url.toLowerCase()
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || 
           lower.endsWith('.png') || lower.endsWith('.gif') ||
           lower.includes('.jpg?') || lower.includes('.jpeg?') ||
           lower.includes('.png?') || lower.includes('.gif?')
  }

  // Prioritize gallery blocks
  const galleryBlock = blocks.find((b: any) => b.type === 'gallery')
  if (galleryBlock?.content?.images) {
    // Find first non-WebP image
    for (const image of galleryBlock.content.images) {
      const imageUrl = typeof image === 'string' ? image : image.url
      if (imageUrl && typeof imageUrl === 'string' && isSupportedFormat(imageUrl)) {
        return imageUrl
      }
    }
  }

  // Then carousel blocks
  const carouselBlock = blocks.find((b: any) => b.type === 'carousel')
  if (carouselBlock?.content?.images) {
    for (const image of carouselBlock.content.images) {
      const imageUrl = typeof image === 'string' ? image : image.url
      if (imageUrl && typeof imageUrl === 'string' && isSupportedFormat(imageUrl)) {
        return imageUrl
      }
    }
  }

  // Finally, single image blocks
  const imageBlock = blocks.find((b: any) => b.type === 'image')
  if (imageBlock?.content?.image?.url) {
    const url = imageBlock.content.image.url
    if (isSupportedFormat(url)) {
      return url
    }
  }

  // Audio blocks with cover art
  const audioBlock = blocks.find((b: any) => b.type === 'audio')
  if (audioBlock?.content?.audioCoverUrl) {
    const url = audioBlock.content.audioCoverUrl
    if (isSupportedFormat(url)) {
      return url
    }
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: { sectionId: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { data: section, error } = await supabase
      .from('sections')
      .select(`
        *,
        profiles!inner(username, display_name, avatar_url, banner_url),
        categories(name, icon)
      `)
      .eq('id', params.sectionId)
      .eq('published', true) // Only fetch published sections
      .single()

    if (error) {
      console.error('[Section OG] Supabase error:', error)
      throw error
    }

    const profile = section.profiles
    const name = profile.display_name || profile.username
    const banner = profile.banner_url
    const ogImageUrl = section.og_image_url // JPEG thumbnail for OpenGraph
    const previewImage = getPreviewImage(section.blocks || [])

    console.log('[Section OG] OG Image URL:', ogImageUrl)
    console.log('[Section OG] Preview image:', previewImage)
    console.log('[Section OG] Banner:', banner)
    console.log('[Section OG] Section has blocks:', section.blocks?.length || 0)
    
    // Priority 1: Use dedicated OG thumbnail (JPEG, always works)
    if (ogImageUrl) {
      console.log('[Section OG] Using dedicated OG thumbnail')
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              position: 'relative',
            }}
          >
            <img
              src={ogImageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ),
        { width: 1200, height: 630 }
      )
    }
    
    // Debug: log first gallery block structure
    const galleryBlock = (section.blocks || []).find((b: any) => b.type === 'gallery')
    if (galleryBlock) {
      console.log('[Section OG] Gallery block images:', JSON.stringify(galleryBlock.content?.images?.slice(0, 2)))
      const totalImages = galleryBlock.content?.images?.length || 0
      const webpCount = (galleryBlock.content?.images || []).filter((img: any) => {
        const url = typeof img === 'string' ? img : img.url
        return url?.toLowerCase().includes('.webp')
      }).length
      if (webpCount > 0) {
        console.log(`[Section OG] Skipped ${webpCount}/${totalImages} WebP images (ImageResponse doesn't support WebP)`)
      }
    }

    // Priority 2: If we have a non-WebP preview image, use it
    if (previewImage) {
      console.log('[Section OG] Using preview image:', previewImage)
      
      // Fetch and verify the image is accessible before using it
      try {
        const imgResponse = await fetch(previewImage, { method: 'HEAD' })
        console.log('[Section OG] Image HEAD check:', imgResponse.status, imgResponse.headers.get('content-type'))
        
        if (!imgResponse.ok) {
          console.error('[Section OG] Image not accessible:', imgResponse.status)
          throw new Error(`Image not accessible: ${imgResponse.status}`)
        }
      } catch (fetchError) {
        console.error('[Section OG] Image fetch failed:', fetchError)
        // Continue to fallback instead of using broken image
        return generatePublishedFallbackImage(section, banner, name)
      }
      
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              position: 'relative',
            }}
          >
            <img
              src={previewImage}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ),
        { width: 1200, height: 630 }
      )
    }

    // Check if section has any images (even WebP ones we can't use directly)
    const hasWebPImages = galleryBlock?.content?.images?.length > 0
    
    console.log('[Section OG] Has WebP images:', hasWebPImages)
    console.log('[Section OG] Preview image found:', !!previewImage)
    
    // If section has WebP images but no compatible format, use first WebP with fetch
    if (!previewImage && hasWebPImages) {
      const firstImage = galleryBlock.content.images[0]
      const webpUrl = typeof firstImage === 'string' ? firstImage : firstImage.url
      
      console.log('[Section OG] First image URL:', webpUrl)
      console.log('[Section OG] Is WebP:', webpUrl?.toLowerCase().includes('.webp'))
      
      if (webpUrl && webpUrl.toLowerCase().includes('.webp')) {
        console.log('[Section OG] Attempting to use WebP image via fetch:', webpUrl)
        
        try {
          // Fetch the WebP image and pass it as arrayBuffer
          const imgResponse = await fetch(webpUrl)
          if (!imgResponse.ok) {
            throw new Error(`Failed to fetch: ${imgResponse.status}`)
          }
          
          const imageBuffer = await imgResponse.arrayBuffer()
          console.log('[Section OG] Fetched WebP image, size:', imageBuffer.byteLength)
          
          // Use the fetched image data directly
          return new ImageResponse(
            (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  position: 'relative',
                }}
              >
                <img
                  // @ts-ignore - Next.js og can accept arrayBuffer
                  src={imageBuffer}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            ),
            { width: 1200, height: 630 }
          )
        } catch (fetchError) {
          console.error('[Section OG] Failed to fetch WebP image:', fetchError)
          // Fall through to banner/generated fallback
        }
      }
    }

    return generatePublishedFallbackImage(section, banner, name)
  } catch (error) {
    console.error('[Section OG] Error generating image:', error)
    
    // Ultimate fallback
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: '#fff',
            fontSize: '64px',
            fontWeight: 800,
          }}
        >
          Section
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}

// Helper function to generate fallback images
function generatePublishedFallbackImage(section: any, banner: string | null, name: string) {
  // Fallback: use profile banner (but check if it's WebP)
  if (banner) {
    const isWebP = banner.toLowerCase().includes('.webp')
    
    if (!isWebP) {
      // Non-WebP banner can be used directly
      console.log('[Section OG] Using banner fallback (non-WebP)')
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              position: 'relative',
            }}
          >
            <img
              src={banner}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ),
        { width: 1200, height: 630 }
      )
    } else {
      // Banner is WebP - skip to generated card
      console.log('[Section OG] Banner is WebP, skipping to generated card')
    }
  }

  // Ultimate fallback: generated card
  console.log('[Section OG] Using generated card fallback')
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
          padding: '80px',
        }}
      >
        <div style={{ fontSize: '72px', fontWeight: 800, marginBottom: '24px', textAlign: 'center' }}>
          {section.title}
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#9ca3af',
            textAlign: 'center',
          }}
        >
          by {name}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
