/**
 * Unified Storage Abstraction Layer
 * 
 * Provides a single interface for storage operations that works with:
 * - Cloudflare R2 (primary, recommended)
 * - Cloudinary (legacy, for backwards compatibility)
 * 
 * This abstraction allows seamless migration between storage providers
 * and supports mixed deployments during transition period.
 */

import {
  uploadToR2,
  deleteFromR2,
  deleteMultipleFromR2,
  R2_CONFIGURED,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AUDIO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_AUDIO_SIZE,
  type UploadResult as R2UploadResult,
} from './r2-storage'

import {
  streamToCloudinary,
  deleteCloudinaryAsset,
  deleteCloudinaryAssets,
  CLOUDINARY_CONFIGURED,
  ALLOWED_TYPES as CLOUDINARY_ALLOWED_TYPES,
  MAX_FILE_SIZE as CLOUDINARY_MAX_FILE_SIZE,
  type UploadResult as CloudinaryUploadResult,
} from './cloudinary'

import { isCloudinaryUrl, isR2Url } from './section-assets'

// ── Storage Provider Detection ───────────────────────────────────────────────

export type StorageProvider = 'r2' | 'cloudinary' | 'none'

/**
 * Determines which storage provider to use based on configuration.
 * Priority: R2 > Cloudinary
 */
export function getStorageProvider(): StorageProvider {
  if (R2_CONFIGURED) return 'r2'
  if (CLOUDINARY_CONFIGURED) return 'cloudinary'
  return 'none'
}

export const STORAGE_PROVIDER = getStorageProvider()
export const STORAGE_CONFIGURED = STORAGE_PROVIDER !== 'none'

// ── Unified Types ────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string       // Public URL
  key: string       // Provider-specific identifier (R2 key or Cloudinary public_id)
  size?: number     // File size (R2 only)
  provider: StorageProvider
}

export interface DeleteResult {
  key: string
  success: boolean
  error?: string
  provider: StorageProvider
}

export interface UploadOptions {
  folder: string
  fileName?: string
  contentType: string
}

// ── Upload Functions ─────────────────────────────────────────────────────────

/**
 * Unified upload function that routes to the configured storage provider.
 */
export async function uploadFile(
  readableStream: ReadableStream<Uint8Array>,
  options: UploadOptions
): Promise<UploadResult> {
  const provider = getStorageProvider()

  if (provider === 'r2') {
    const result = await uploadToR2(readableStream, options)
    return {
      url: result.url,
      key: result.key,
      size: result.size,
      provider: 'r2',
    }
  }

  if (provider === 'cloudinary') {
    const result = await streamToCloudinary(readableStream, {
      folder: options.folder,
    })
    return {
      url: result.secure_url,
      key: result.public_id,
      provider: 'cloudinary',
    }
  }

  throw new Error('No storage provider configured')
}

// ── Delete Functions ─────────────────────────────────────────────────────────

/**
 * Deletes a file from the appropriate storage provider based on URL.
 * Automatically detects provider from URL.
 */
export async function deleteFile(urlOrKey: string): Promise<DeleteResult> {
  // Detect provider from URL
  let provider: StorageProvider
  if (isR2Url(urlOrKey)) {
    provider = 'r2'
  } else if (isCloudinaryUrl(urlOrKey)) {
    provider = 'cloudinary'
  } else {
    // Try current provider
    provider = getStorageProvider()
  }

  if (provider === 'r2') {
    const result = await deleteFromR2(urlOrKey)
    return {
      ...result,
      provider: 'r2',
    }
  }

  if (provider === 'cloudinary') {
    const result = await deleteCloudinaryAsset(urlOrKey)
    return {
      key: result.publicId,
      success: result.success,
      error: result.error,
      provider: 'cloudinary',
    }
  }

  return {
    key: urlOrKey,
    success: false,
    error: 'No storage provider configured',
    provider: 'none',
  }
}

/**
 * Deletes multiple files, automatically routing to correct providers.
 * Handles mixed URLs (some R2, some Cloudinary) intelligently.
 */
export async function deleteMultipleFiles(urlsOrKeys: string[]): Promise<{
  total: number
  succeeded: number
  failed: number
  results: DeleteResult[]
}> {
  // Group URLs by provider
  const r2Urls: string[] = []
  const cloudinaryUrls: string[] = []
  const unknownUrls: string[] = []

  for (const url of urlsOrKeys) {
    if (isR2Url(url)) {
      r2Urls.push(url)
    } else if (isCloudinaryUrl(url)) {
      cloudinaryUrls.push(url)
    } else {
      unknownUrls.push(url)
    }
  }

  const results: DeleteResult[] = []

  // Delete R2 files
  if (r2Urls.length > 0) {
    const r2Result = await deleteMultipleFromR2(r2Urls)
    results.push(
      ...r2Result.results.map((r) => ({
        ...r,
        provider: 'r2' as StorageProvider,
      }))
    )
  }

  // Delete Cloudinary files
  if (cloudinaryUrls.length > 0) {
    const cloudinaryResult = await deleteCloudinaryAssets(cloudinaryUrls)
    results.push(
      ...cloudinaryResult.results.map((r) => ({
        key: r.publicId,
        success: r.success,
        error: r.error,
        provider: 'cloudinary' as StorageProvider,
      }))
    )
  }

  // Handle unknown URLs (try current provider)
  for (const url of unknownUrls) {
    const result = await deleteFile(url)
    results.push(result)
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  return {
    total: urlsOrKeys.length,
    succeeded,
    failed,
    results,
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES_UNIFIED = new Set([
  ...ALLOWED_IMAGE_TYPES,
  ...CLOUDINARY_ALLOWED_TYPES,
])

export const ALLOWED_AUDIO_TYPES_UNIFIED = ALLOWED_AUDIO_TYPES

export const MAX_IMAGE_SIZE_UNIFIED = Math.max(MAX_IMAGE_SIZE, CLOUDINARY_MAX_FILE_SIZE)
export const MAX_AUDIO_SIZE_UNIFIED = MAX_AUDIO_SIZE

/**
 * Validates if a file type is allowed for upload.
 */
export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES_UNIFIED.has(contentType)
}

/**
 * Validates if an audio file type is allowed for upload.
 */
export function isAllowedAudioType(contentType: string): boolean {
  return ALLOWED_AUDIO_TYPES_UNIFIED.has(contentType)
}

/**
 * Validates file size for images.
 */
export function isValidImageSize(size: number): boolean {
  return size <= MAX_IMAGE_SIZE_UNIFIED
}

/**
 * Validates file size for audio.
 */
export function isValidAudioSize(size: number): boolean {
  return size <= MAX_AUDIO_SIZE_UNIFIED
}

// ── Export Constants ─────────────────────────────────────────────────────────

export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AUDIO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_AUDIO_SIZE,
}
