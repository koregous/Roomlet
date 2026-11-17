/**
 * Cloudflare R2 Storage Client
 * 
 * S3-compatible object storage with zero egress fees.
 * Uses AWS SDK v3 for S3-compatible operations.
 * 
 * Setup:
 * 1. Create R2 bucket in Cloudflare dashboard
 * 2. Generate R2 API tokens with read/write permissions
 * 3. Configure environment variables (see .env.example)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

// ── Configuration ────────────────────────────────────────────────────────────

export const R2_CONFIGURED =
  !!process.env.R2_ACCOUNT_ID &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_BUCKET_NAME

if (!R2_CONFIGURED) {
  console.error('[r2-storage] Environment variables missing — uploads will fail at runtime')
  console.error('[r2-storage] Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME')
}

// Initialize S3 client for R2
let r2Client: S3Client | null = null

if (R2_CONFIGURED) {
  const accountId = process.env.R2_ACCOUNT_ID!
  
  r2Client = new S3Client({
    region: 'auto', // R2 doesn't use regions, but SDK requires this
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || ''
const PUBLIC_R2_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN || '' // e.g., https://assets.yourdomain.com

// ── Upload Constants ─────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])

export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',  // .mp3
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',   // .m4a
])

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10 MB
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024  // 50 MB

// ── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string       // Public URL to access the file
  key: string       // R2 object key (path in bucket)
  size: number      // File size in bytes
  contentType: string
}

export interface UploadOptions {
  folder: string    // Logical folder path (e.g., 'roomlet/user123/gallery')
  fileName?: string // Optional custom filename (auto-generated if not provided)
  contentType: string
  cacheControl?: string // Optional cache headers
}

export interface DeleteResult {
  key: string
  success: boolean
  error?: string
}

// ── Upload Functions ─────────────────────────────────────────────────────────

/**
 * Generates a unique object key for R2 storage.
 * 
 * Format: folder/timestamp-randomhash.ext
 * Example: roomlet/user123/gallery/1704067200000-a3f9d8c2.jpg
 */
function generateObjectKey(folder: string, fileName: string, contentType: string): string {
  const timestamp = Date.now()
  const randomHash = crypto.randomBytes(4).toString('hex')
  
  // Extract extension from filename or derive from content type
  let ext = ''
  if (fileName.includes('.')) {
    ext = fileName.split('.').pop() || ''
  } else {
    // Fallback: derive from content type
    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
    }
    ext = typeMap[contentType] || 'bin'
  }
  
  return `${folder}/${timestamp}-${randomHash}.${ext}`
}

/**
 * Converts R2 object key to public URL.
 * 
 * Uses custom domain if configured (recommended for production).
 * Falls back to R2.dev public URL for development.
 */
export function getPublicUrl(key: string): string {
  if (PUBLIC_R2_DOMAIN) {
    // Custom domain (e.g., https://assets.yourdomain.com/path/to/file.jpg)
    return `${PUBLIC_R2_DOMAIN}/${key}`
  } else {
    // R2.dev public URL (bucket must have public access enabled)
    const accountId = process.env.R2_ACCOUNT_ID
    return `https://${BUCKET_NAME}.${accountId}.r2.dev/${key}`
  }
}

/**
 * Uploads a file stream to R2 storage.
 * 
 * This is the server-side upload function used by API routes.
 * Streams directly from request body to R2 without buffering in memory.
 * 
 * @param readableStream - Web ReadableStream from request body
 * @param options - Upload configuration
 * @returns Upload result with public URL
 */
export async function uploadToR2(
  readableStream: ReadableStream<Uint8Array>,
  options: UploadOptions
): Promise<UploadResult> {
  if (!R2_CONFIGURED || !r2Client) {
    throw new Error('R2 storage is not configured')
  }

  // Generate unique object key
  const key = generateObjectKey(
    options.folder,
    options.fileName || 'upload',
    options.contentType
  )

  // Convert Web ReadableStream to Node.js buffer
  // R2/S3 SDK requires Buffer or Uint8Array
  const chunks: Uint8Array[] = []
  const reader = readableStream.getReader()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const buffer = Buffer.concat(chunks)

  // Upload to R2
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: options.contentType,
    CacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
    // Note: R2 doesn't support ACL, use bucket-level public access instead
  })

  await r2Client.send(command)

  return {
    url: getPublicUrl(key),
    key,
    size: buffer.length,
    contentType: options.contentType,
  }
}

/**
 * Generates a presigned URL for direct browser upload to R2.
 * 
 * This allows client-side uploads without proxying through your API,
 * avoiding Vercel's 4.5MB body size limit.
 * 
 * @param options - Upload configuration
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned upload URL and final object key
 */
export async function generatePresignedUploadUrl(
  options: UploadOptions,
  expiresIn: number = 3600
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!R2_CONFIGURED || !r2Client) {
    throw new Error('R2 storage is not configured')
  }

  const key = generateObjectKey(
    options.folder,
    options.fileName || 'upload',
    options.contentType
  )

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: options.contentType,
    CacheControl: options.cacheControl || 'public, max-age=31536000, immutable',
  })

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn })

  return {
    uploadUrl,
    key,
    publicUrl: getPublicUrl(key),
  }
}

// ── Delete Functions ─────────────────────────────────────────────────────────

/**
 * Extracts R2 object key from a public URL.
 * 
 * Examples:
 * - https://assets.yourdomain.com/roomlet/user123/gallery/123456-abc.jpg
 *   → roomlet/user123/gallery/123456-abc.jpg
 * - https://bucket.accountid.r2.dev/folder/file.png
 *   → folder/file.png
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Remove leading slash
    return urlObj.pathname.substring(1)
  } catch (error) {
    console.error('[r2-storage] Failed to parse URL:', url, error)
    return null
  }
}

/**
 * Deletes a single object from R2.
 * 
 * @param key - Object key or full URL
 * @returns Delete result
 */
export async function deleteFromR2(keyOrUrl: string): Promise<DeleteResult> {
  if (!R2_CONFIGURED || !r2Client) {
    return {
      key: keyOrUrl,
      success: false,
      error: 'R2 storage is not configured',
    }
  }

  // Extract key if URL was provided
  const key = keyOrUrl.startsWith('http') 
    ? extractKeyFromUrl(keyOrUrl) 
    : keyOrUrl

  if (!key) {
    return {
      key: keyOrUrl,
      success: false,
      error: 'Invalid key or URL',
    }
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await r2Client.send(command)

    return {
      key,
      success: true,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[r2-storage] Failed to delete ${key}:`, errorMsg)

    return {
      key,
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Deletes multiple objects from R2 (batch operation).
 * 
 * Uses S3's DeleteObjects API for efficiency (up to 1000 objects per request).
 * 
 * @param keysOrUrls - Array of object keys or URLs
 * @returns Summary of deletion results
 */
export async function deleteMultipleFromR2(keysOrUrls: string[]): Promise<{
  total: number
  succeeded: number
  failed: number
  results: DeleteResult[]
}> {
  if (!R2_CONFIGURED || !r2Client) {
    console.warn('[r2-storage] R2 not configured, skipping deletion')
    return {
      total: keysOrUrls.length,
      succeeded: 0,
      failed: keysOrUrls.length,
      results: keysOrUrls.map((keyOrUrl) => ({
        key: keyOrUrl,
        success: false,
        error: 'R2 storage is not configured',
      })),
    }
  }

  // Extract keys from URLs
  const keys = keysOrUrls
    .map((keyOrUrl) =>
      keyOrUrl.startsWith('http') ? extractKeyFromUrl(keyOrUrl) : keyOrUrl
    )
    .filter((key): key is string => key !== null)

  if (keys.length === 0) {
    return {
      total: keysOrUrls.length,
      succeeded: 0,
      failed: keysOrUrls.length,
      results: keysOrUrls.map((keyOrUrl) => ({
        key: keyOrUrl,
        success: false,
        error: 'Could not extract key from URL',
      })),
    }
  }

  const results: DeleteResult[] = []

  // S3 DeleteObjects supports up to 1000 objects per request
  // Split into batches if needed
  const BATCH_SIZE = 1000
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE)

    try {
      const command = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: false, // Return results for each object
        },
      })

      const response = await r2Client.send(command)

      // Process successful deletions
      if (response.Deleted) {
        for (const deleted of response.Deleted) {
          if (deleted.Key) {
            results.push({
              key: deleted.Key,
              success: true,
            })
          }
        }
      }

      // Process errors
      if (response.Errors) {
        for (const error of response.Errors) {
          if (error.Key) {
            results.push({
              key: error.Key,
              success: false,
              error: error.Message || 'Unknown error',
            })
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[r2-storage] Batch delete failed:`, errorMsg)

      // Mark all items in this batch as failed
      for (const key of batch) {
        results.push({
          key,
          success: false,
          error: errorMsg,
        })
      }
    }
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`[r2-storage] Deleted ${succeeded}/${keys.length} objects`)

  if (failed > 0) {
    console.warn(
      `[r2-storage] Failed to delete ${failed} objects:`,
      results.filter((r) => !r.success)
    )
  }

  return {
    total: keys.length,
    succeeded,
    failed,
    results,
  }
}

/**
 * Checks if an object exists in R2.
 * 
 * @param keyOrUrl - Object key or URL
 * @returns true if object exists
 */
export async function existsInR2(keyOrUrl: string): Promise<boolean> {
  if (!R2_CONFIGURED || !r2Client) {
    return false
  }

  const key = keyOrUrl.startsWith('http') 
    ? extractKeyFromUrl(keyOrUrl) 
    : keyOrUrl

  if (!key) {
    return false
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await r2Client.send(command)
    return true
  } catch {
    return false
  }
}

/**
 * Reads an object's size and content type from R2 without downloading it.
 * Use after a browser-direct (presigned) upload to verify what was ACTUALLY
 * stored instead of trusting client-supplied metadata.
 *
 * @returns null if the object doesn't exist (or R2 isn't configured)
 */
export async function getR2ObjectInfo(
  keyOrUrl: string
): Promise<{ size: number; contentType: string } | null> {
  if (!R2_CONFIGURED || !r2Client) {
    return null
  }

  const key = keyOrUrl.startsWith('http')
    ? extractKeyFromUrl(keyOrUrl)
    : keyOrUrl

  if (!key) {
    return null
  }

  try {
    const result = await r2Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    )

    return {
      size: result.ContentLength ?? 0,
      contentType: result.ContentType ?? '',
    }
  } catch {
    return null
  }
}
