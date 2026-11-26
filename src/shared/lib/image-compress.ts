/**
 * Client-side image compression utility
 * Converts images to WebP and compresses them before upload
 * Note: GIFs are not compressed to preserve animation
 */

export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0-1
  format?: 'webp' | 'jpeg' | 'png'
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 2500,  // Generous default for art platform
  maxHeight: 2500,
  quality: 0.87,   // Higher quality for detail preservation
  format: 'webp',
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  // Skip compression for GIFs to preserve animation
  if (file.type === 'image/gif') {
    return file
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Resize-first strategy (Instagram's trick):
  // 1. Downscale resolution to max display size (throws away invisible pixels)
  // 2. Then apply lossy encoding (WebP/JPEG)
  // This gets 80% size reduction essentially "for free" perceptually
  
  // Skip compression for small files that are already in target format
  const SKIP_THRESHOLD = 800 * 1024 // 800KB - already efficient
  if (file.size < SKIP_THRESHOLD && file.type === `image/${opts.format}`) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img
          
          if (width > opts.maxWidth) {
            height = (height * opts.maxWidth) / width
            width = opts.maxWidth
          }
          
          if (height > opts.maxHeight) {
            width = (width * opts.maxHeight) / height
            height = opts.maxHeight
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // Use better quality scaling
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'))
                return
              }

              const newFileName = file.name.replace(/\.[^/.]+$/, `.${opts.format}`)
              const newFile = new File([blob], newFileName, {
                type: `image/${opts.format}`,
                lastModified: Date.now(),
              })

              // Only use compressed version if it's actually smaller
              if (newFile.size < file.size) {
                resolve(newFile)
              } else {
                resolve(file)
              }
            },
            `image/${opts.format}`,
            opts.quality
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Preset compression options for different use cases
 * 
 * Roomlet-specific presets optimized for art/gallery platform:
 * - Higher quality than Instagram (quality 0.87-0.90 vs their ~0.75)
 * - Larger max dimensions for detail preservation (2500-3000px vs 1080px)
 * - WebP format for ~30% better compression than JPEG at same quality
 */
export const COMPRESSION_PRESETS = {
  avatar: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.90, // Higher quality for profile images
    format: 'webp' as const,
  },
  banner: {
    maxWidth: 2000,
    maxHeight: 800,
    quality: 0.87,
    format: 'webp' as const,
  },
  gallery: {
    maxWidth: 2500,  // Up from 1920 - generous for full-bleed views
    maxHeight: 2500, // Maintains aspect ratio
    quality: 0.87,   // Up from 0.85 - better for art fidelity
    format: 'webp' as const,
  },
  galleryHighQuality: {
    maxWidth: 3000,  // For photographers/artists who want max detail
    maxHeight: 3000,
    quality: 0.90,   // Premium quality setting
    format: 'webp' as const,
  },
  thumbnail: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.82,   // Slightly higher than before
    format: 'webp' as const,
  },
  ogThumbnail: {
    maxWidth: 1200,  // OpenGraph standard size
    maxHeight: 630,  // 1200x630 is the recommended OG image size
    quality: 0.85,   // Good quality for social previews
    format: 'jpeg' as const, // JPEG for OpenGraph compatibility
  },
}

/**
 * Maximum file size constant (20MB)
 * Increased from 10MB to accommodate higher quality art/photography
 * Most files will be well under this after client-side compression
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Maximum file size after compression (server-side safety net)
 */
export const MAX_COMPRESSED_FILE_SIZE = 15 * 1024 * 1024 // 15MB

/**
 * Allowed image types
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

/**
 * Validate image file
 * 
 * Checks file size BEFORE compression - most files will be well under limit
 * after the resize+compress step runs.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' }
  }

  // Check file size (20MB max before compression)
  // After compression (resize to 2500px + WebP @ 0.87), most files will be 1-5MB
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return { 
      valid: false, 
      error: `File is too large (${sizeMB}MB). Maximum file size is 20MB.` 
    }
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported image format. Use JPG, PNG, WebP, or GIF' }
  }

  return { valid: true }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
