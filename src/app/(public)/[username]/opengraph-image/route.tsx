import { ImageResponse } from 'next/og'
import { getSupabaseClient } from '@/shared/lib/supabase'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = getSupabaseClient()

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('banner_url, og_banner_url, display_name, username, bio')
      .eq('username', params.username.toLowerCase())
      .single()

    if (error) {
      console.error('[OG Image] Supabase error:', error)
      throw error
    }

    const name = profileData?.display_name || params.username
    const bannerUrl = profileData?.banner_url
    const ogBannerUrl = profileData?.og_banner_url // JPEG for OpenGraph
    const bio = profileData?.bio

    // Priority: Use JPEG banner for OpenGraph (Satori compatible)
    if (ogBannerUrl) {
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
              src={ogBannerUrl}
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

    // Skip WebP banner_url - Satori can't decode it
    // Fall through to generated card instead

    // Fallback: generated image with name and bio
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
          <div style={{ fontSize: '72px', fontWeight: 800, marginBottom: '24px' }}>
            {name}
          </div>
          {bio && (
            <div
              style={{
                fontSize: '32px',
                color: '#9ca3af',
                textAlign: 'center',
                maxWidth: '800px',
              }}
            >
              {bio}
            </div>
          )}
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (error) {
    console.error('[OG Image] Error generating image:', error)
    
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
          @{params.username}
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
