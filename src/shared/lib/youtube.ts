/**
 * YouTube utility functions
 */

/**
 * Extract YouTube video ID from various URL formats
 * 
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null

  url = url.trim()

  // Try different patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID itself
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'mq'): string {
  const qualityMap = {
    default: 'default', // 120x90
    mq: 'mqdefault',    // 320x180
    hq: 'hqdefault',    // 480x360
    sd: 'sddefault',    // 640x480
    maxres: 'maxresdefault', // 1280x720
  }

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

export function isValidYouTubeId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId)
}

export function createYouTubeEmbedUrl(videoId: string, autoplay: boolean = false): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: '0', // Hide YouTube controls
    modestbranding: '1', // Minimal YouTube branding
    rel: '0', // Don't show related videos
    showinfo: '0',
    fs: '0',
    playsinline: '1', // Play inline on mobile
  })

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}
