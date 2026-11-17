/**
 * Client-side R2 upload utilities
 * 
 * Uses presigned URLs to upload directly from browser to R2,
 * bypassing our API and avoiding Vercel's body size limits.
 */

export interface R2UploadOptions {
  folder: string
  onProgress?: (progress: number) => void
}

export interface R2UploadResult {
  url: string
  key: string
}

/**
 * Upload a file directly to R2 from the browser using presigned URL
 * 
 * @param file - The file to upload
 * @param options - Upload options (folder path, progress callback)
 * @returns Promise with the upload result
 */
export async function uploadToR2(
  file: File,
  options: R2UploadOptions
): Promise<R2UploadResult> {
  // Step 1: Request presigned URL from our API
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
    const error = await presignResponse.json().catch(() => ({ error: 'Unknown error' }))
    console.error('[r2-upload-client] Presign failed:', {
      status: presignResponse.status,
      statusText: presignResponse.statusText,
      error,
      fileType: file.type,
      fileSize: file.size,
      folder: options.folder
    })
    throw new Error(error.error || `Failed to get upload URL (${presignResponse.status})`)
  }

  const { uploadUrl, publicUrl, key } = await presignResponse.json()

  // Step 2: Upload file directly to R2 using presigned URL
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track upload progress
    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          options.onProgress!(progress)
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve({
          url: publicUrl,
          key,
        })
      } else {
        console.error('[r2-upload-client] Upload failed:', {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText,
          uploadUrl: uploadUrl.substring(0, 100) + '...'
        })
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
      }
    })

    xhr.addEventListener('error', (e) => {
      console.error('[r2-upload-client] Network error during upload:', e)
      reject(new Error('Upload failed: Network error'))
    })

    xhr.addEventListener('abort', () => {
      console.error('[r2-upload-client] Upload was aborted')
      reject(new Error('Upload aborted'))
    })

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

/**
 * Upload an audio file to R2
 */
export async function uploadAudioToR2(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToR2(file, {
    folder: 'audio',
    onProgress,
  })
  return result.url
}

/**
 * Upload an image file to R2
 */
export async function uploadImageToR2(
  file: File,
  userId: string,
  folder: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToR2(file, {
    folder,
    onProgress,
  })
  return result.url
}
