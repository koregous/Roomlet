/**
 * Client-side R2 upload utilities
 * 
 * Handles browser-to-R2 uploads using presigned URLs.
 * This avoids routing large files through your API (Vercel's 4.5MB limit).
 */

export interface R2UploadResult {
  url: string          // Public URL to access the file
  key: string          // R2 object key
  size: number         // File size in bytes
}

export interface R2UploadOptions {
  folder: string       // e.g., 'gallery', 'avatar', 'banner'
  onProgress?: (progress: number) => void
}

/**
 * Upload a file directly to R2 from the browser using a presigned URL.
 * 
 * Flow:
 * 1. Request presigned URL from your API
 * 2. Upload file directly to R2 using that URL
 * 3. Return the public URL for the uploaded file
 * 
 * @param file - File to upload
 * @param options - Upload options
 * @returns Promise with upload result
 */
export async function uploadToR2(
  file: File,
  options: R2UploadOptions
): Promise<R2UploadResult> {
  // Step 1: Get presigned URL from our API
  const presignResponse = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder: options.folder,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })

  if (!presignResponse.ok) {
    const error = await presignResponse.json()
    throw new Error(error.error || 'Failed to get upload URL')
  }

  const { uploadUrl, publicUrl, key } = await presignResponse.json()

  // Step 2: Upload directly to R2
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', file.type)

    // Progress tracking
    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          options.onProgress!(percentComplete)
        }
      })
    }

    // Success
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve({
          url: publicUrl,
          key,
          size: file.size,
        })
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    // Error
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    // Abort
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'))
    })

    xhr.send(file)
  })
}

/**
 * Upload an image file to R2
 */
export async function uploadImageToR2(
  file: File,
  folder: 'gallery' | 'avatar' | 'banner' | 'covers',
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToR2(file, {
    folder,
    onProgress,
  })

  return result.url
}

/**
 * Upload an audio file to R2
 */
export async function uploadAudioToR2(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToR2(file, {
    folder: 'audio',
    onProgress,
  })

  return result.url
}
