/**
 * Embed Parser - Smart URL detection and iframe generation
 * Converts URLs from popular services into embeddable iframes
 */

export interface EmbedResult {
  type: 'youtube' | 'spotify' | 'twitter' | 'vimeo' | 'soundcloud' | 'codepen' | 'roomlet' | 'generic'
  embedUrl: string
  originalUrl: string
  title?: string
  aspectRatio?: string
  isTrusted: boolean
}

// Trusted domains that don't need sandboxing
const TRUSTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'spotify.com',
  'twitter.com',
  'x.com',
  'vimeo.com',
  'soundcloud.com',
  'codepen.io',
  'open.spotify.com',
  'platform.twitter.com',
  'player.vimeo.com',
  'w.soundcloud.com',
  'codesandbox.io',
  'stackblitz.com',
  'replit.com',
  'figma.com',
  'miro.com',
  'notion.so',
  'airtable.com',
  'typeform.com',
]

/**
 * Parse a URL and return embed information
 */
export function parseEmbedUrl(url: string, siteOrigin?: string): EmbedResult | null {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname.replace('www.', '')

    // YouTube
    if (hostname === 'youtube.com' || hostname === 'youtu.be') {
      const videoId = extractYouTubeId(url)
      if (videoId) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          originalUrl: url,
          aspectRatio: '16/9',
          isTrusted: true,
        }
      }
    }

    // Spotify
    if (hostname === 'open.spotify.com') {
      const spotifyEmbed = url.replace('/track/', '/embed/track/').replace('/playlist/', '/embed/playlist/').replace('/album/', '/embed/album/')
      return {
        type: 'spotify',
        embedUrl: spotifyEmbed,
        originalUrl: url,
        aspectRatio: '16/9',
        isTrusted: true,
      }
    }

    // Twitter/X
    if (hostname === 'twitter.com' || hostname === 'x.com') {
      const tweetId = parsedUrl.pathname.split('/status/')[1]?.split('?')[0]
      if (tweetId) {
        return {
          type: 'twitter',
          embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`,
          originalUrl: url,
          aspectRatio: 'auto',
          isTrusted: true,
        }
      }
    }

    // Vimeo
    if (hostname === 'vimeo.com') {
      const videoId = parsedUrl.pathname.split('/')[1]
      if (videoId) {
        return {
          type: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${videoId}`,
          originalUrl: url,
          aspectRatio: '16/9',
          isTrusted: true,
        }
      }
    }

    // SoundCloud
    if (hostname === 'soundcloud.com') {
      return {
        type: 'soundcloud',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`,
        originalUrl: url,
        aspectRatio: 'auto',
        isTrusted: true,
      }
    }

    // CodePen
    if (hostname === 'codepen.io') {
      const penMatch = parsedUrl.pathname.match(/\/pen\/([^\/]+)/)
      const userMatch = parsedUrl.pathname.match(/^\/([^\/]+)/)
      if (penMatch && userMatch) {
        const [, penId] = penMatch
        const [, user] = userMatch
        return {
          type: 'codepen',
          embedUrl: `https://codepen.io/${user}/embed/${penId}?default-tab=result`,
          originalUrl: url,
          aspectRatio: '16/9',
          isTrusted: true,
        }
      }
    }

    // Roomlet section embed
    if (siteOrigin && (hostname === new URL(siteOrigin).hostname || hostname.includes('roomlet'))) {
      if (parsedUrl.pathname.includes('/embed/')) {
        return {
          type: 'roomlet',
          embedUrl: url,
          originalUrl: url,
          aspectRatio: '16/9',
          isTrusted: true,
        }
      }
    }

    // Generic - check if trusted
    const isTrusted = TRUSTED_DOMAINS.some(domain => hostname.includes(domain))
    
    return {
      type: 'generic',
      embedUrl: url,
      originalUrl: url,
      aspectRatio: '16/9',
      isTrusted,
    }
  } catch (error) {
    console.error('[parseEmbedUrl] Error parsing URL:', error)
    return null
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Sanitize iframe HTML to remove dangerous attributes
 */
export function sanitizeIframe(iframeHtml: string): string {
  // Remove dangerous attributes
  const dangerous = [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
  ]

  let sanitized = iframeHtml

  dangerous.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
    sanitized = sanitized.replace(regex, '')
  })

  // Remove javascript: protocols
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Ensure sandbox attribute for untrusted sources
  if (!sanitized.includes('sandbox=')) {
    sanitized = sanitized.replace('<iframe', '<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-forms"')
  }

  return sanitized
}

/**
 * Extract iframe src from HTML
 */
export function extractIframeSrc(iframeHtml: string): string | null {
  const match = iframeHtml.match(/src\s*=\s*["']([^"']+)["']/i)
  return match ? match[1] : null
}

/**
 * Check if URL is from a trusted domain
 */
export function isTrustedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return TRUSTED_DOMAINS.some(domain => hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * Validate embed URL for security
 */
export function validateEmbedUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' }
    }

    // Block localhost and private IPs in production
    if (process.env.NODE_ENV === 'production') {
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.') ||
        parsed.hostname.match(/^172\.(1[6-9]|2\d|3[01])\./)
      ) {
        return { valid: false, error: 'Cannot embed local or private URLs' }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' }
  }
}
