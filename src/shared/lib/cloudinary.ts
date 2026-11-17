import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary'

// ── Configure once at module load ────────────────────────────
export const CLOUDINARY_CONFIGURED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET

if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
} else {
  console.error('[cloudinary] Env vars missing — uploads will fail at runtime')
}

export const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export interface UploadResult {
  secure_url: string
  public_id: string
}

/**
 * Streams a Web API ReadableStream directly into Cloudinary's upload_stream.
 *
 * WHY THIS IS FASTER than the buffer approach:
 *   Before: file.arrayBuffer() loads the whole file into RAM, then Buffer.from()
 *   copies it again, then stream.end(buffer) sends it. That's two full in-memory
 *   copies before a single byte reaches Cloudinary — adds latency on large files.
 *
 *   Now: the readable stream from the request body pipes byte-by-byte into
 *   Cloudinary's upload stream. No intermediate copies, lower memory pressure,
 *   and Cloudinary starts receiving data immediately.
 *
 * WHY quality/fetch_format are removed from upload options:
 *   quality:'auto' and fetch_format:'auto' are synchronous post-processing steps
 *   on Cloudinary's side — they add 200–800ms before secure_url is returned.
 *   Instead, apply them at DELIVERY time via URL transformation params
 *   (q_auto,f_auto in the URL), which happens lazily on first CDN request and
 *   is then cached — zero cost at upload time.
 */
export function streamToCloudinary(
  readableStream: ReadableStream<Uint8Array>,
  options: UploadApiOptions
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        // quality:'auto' and fetch_format:'auto' deliberately omitted here.
        // Apply via URL: https://res.cloudinary.com/.../q_auto,f_auto/...
        // This saves 200-800ms per upload since Cloudinary doesn't have to
        // transcode before returning secure_url.
        ...options,
      },
      (error, result) => {
        if (error) return reject(error)
        if (!result) return reject(new Error('No result from Cloudinary'))
        resolve(result as UploadResult)
      }
    )

    // Pipe the Web ReadableStream into the Node writable stream directly.
    // Node 18+ supports ReadableStream.pipeTo via a WritableStream wrapper.
    const writer = new WritableStream<Uint8Array>({
      write(chunk) {
        uploadStream.write(chunk)
      },
      close() {
        uploadStream.end()
      },
      abort(err) {
        uploadStream.destroy(err)
        reject(err)
      },
    })

    readableStream.pipeTo(writer).catch(reject)
  })
}

/**
 * Rewrites a Cloudinary secure_url to include delivery-time transformations.
 * This is how quality and format optimisation happen at zero upload cost.
 *
 * Input:  https://res.cloudinary.com/demo/image/upload/v1/folder/file.jpg
 * Output: https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/v1/folder/file.jpg
 * 
 * Note: For GIFs, we skip f_auto to preserve animation
 */
export function withAutoOptimisation(url: string): string {
  // Check if the URL points to a GIF
  const isGif = url.toLowerCase().includes('.gif')
  
  if (isGif) {
    // For GIFs, only apply quality optimization, not format conversion
    // This preserves the animation
    return url.replace('/upload/', '/upload/q_auto/')
  }
  
  // For other formats, apply both quality and format optimization
  return url.replace('/upload/', '/upload/q_auto,f_auto/')
}

/**
 * Extracts the public_id from a Cloudinary URL.
 * 
 * Examples:
 * - https://res.cloudinary.com/demo/image/upload/v1234567890/roomlet/user123/gallery/image.jpg
 *   → roomlet/user123/gallery/image
 * - https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/v1/folder/file.png
 *   → folder/file
 * 
 * @param url - Full Cloudinary URL
 * @returns public_id (without extension) or null if invalid URL
 */
export function extractPublicId(url: string): string | null {
  try {
    // Match pattern: /upload/[transformations]/[version]/path/to/file.ext
    // or: /upload/[version]/path/to/file.ext
    const match = url.match(/\/upload\/(?:.*?\/)?v\d+\/(.+?)(?:\.\w+)?(?:\?|$)/)
    
    if (match && match[1]) {
      // Remove file extension if present
      return match[1].replace(/\.\w+$/, '')
    }
    
    return null
  } catch (error) {
    console.error('[extractPublicId] Failed to parse URL:', url, error)
    return null
  }
}

export interface CloudinaryDeleteResult {
  publicId: string
  success: boolean
  error?: string
}

/**
 * Deletes a single asset from Cloudinary by public_id.
 * 
 * @param publicId - The public_id of the asset to delete
 * @returns Result object with success status
 */
export async function deleteCloudinaryAsset(
  publicId: string
): Promise<CloudinaryDeleteResult> {
  if (!CLOUDINARY_CONFIGURED) {
    return {
      publicId,
      success: false,
      error: 'Cloudinary not configured',
    }
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // Invalidate CDN cache
    })

    // Cloudinary returns { result: 'ok' } on success, { result: 'not found' } if already deleted
    const success = result.result === 'ok' || result.result === 'not found'

    return {
      publicId,
      success,
      error: success ? undefined : `Unexpected result: ${result.result}`,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[deleteCloudinaryAsset] Failed to delete ${publicId}:`, errorMsg)
    
    return {
      publicId,
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Deletes multiple Cloudinary assets from URLs (best-effort).
 * 
 * Strategy:
 * - Parse public_id from each URL
 * - Delete all assets in parallel (Promise.allSettled)
 * - Log successes and failures
 * - Never throw (best-effort cleanup)
 * 
 * @param urls - Array of Cloudinary URLs to delete
 * @returns Summary of deletion results
 */
export async function deleteCloudinaryAssets(urls: string[]): Promise<{
  total: number
  succeeded: number
  failed: number
  results: CloudinaryDeleteResult[]
}> {
  if (!CLOUDINARY_CONFIGURED) {
    console.warn('[deleteCloudinaryAssets] Cloudinary not configured, skipping deletion')
    return {
      total: urls.length,
      succeeded: 0,
      failed: urls.length,
      results: urls.map((url) => ({
        publicId: url,
        success: false,
        error: 'Cloudinary not configured',
      })),
    }
  }

  const publicIds = urls
    .map((url) => extractPublicId(url))
    .filter((id): id is string => id !== null)

  if (publicIds.length === 0) {
    console.warn('[deleteCloudinaryAssets] No valid public_ids extracted from URLs')
    return {
      total: urls.length,
      succeeded: 0,
      failed: urls.length,
      results: urls.map((url) => ({
        publicId: url,
        success: false,
        error: 'Could not extract public_id from URL',
      })),
    }
  }

  // Delete all assets in parallel
  const deletePromises = publicIds.map((publicId) => deleteCloudinaryAsset(publicId))
  const results = await Promise.all(deletePromises)

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  // Log summary
  console.log(`[deleteCloudinaryAssets] Deleted ${succeeded}/${publicIds.length} assets`)
  
  if (failed > 0) {
    console.warn(
      `[deleteCloudinaryAssets] Failed to delete ${failed} assets:`,
      results.filter((r) => !r.success)
    )
  }

  return {
    total: publicIds.length,
    succeeded,
    failed,
    results,
  }
}