/**
 * Client-side Cloudinary upload utilities
 * 
 * Uploads directly from browser to Cloudinary, bypassing our API.
 * This avoids Vercel's 4.5MB body size limit on serverless functions.
 */

export interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  resource_type: string
  format: string
  bytes: number
}

export interface CloudinaryUploadOptions {
  resourceType: 'image' | 'video' | 'raw' | 'auto'
  folder?: string
  onProgress?: (progress: number) => void
}

export async function uploadToCloudinary(
  file: File,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName) {
    throw new Error('Cloudinary cloud name not configured')
  }

  if (!uploadPreset) {
    throw new Error('Cloudinary upload preset not configured')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  
  if (options.folder) {
    formData.append('folder', options.folder)
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${options.resourceType}/upload`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.open('POST', url, true)

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
        try {
          const result = JSON.parse(xhr.responseText) as CloudinaryUploadResult
          resolve(result)
        } catch (err) {
          reject(new Error('Failed to parse Cloudinary response'))
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText)
          reject(new Error(errorData.error?.message || `Upload failed with status ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'))
    })

    xhr.send(formData)
  })
}

export async function uploadAudioToCloudinary(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToCloudinary(file, {
    resourceType: 'video', // Cloudinary uses 'video' for audio
    folder: `roomlet/${userId}/audio`,
    onProgress,
  })

  return result.secure_url
}

export async function uploadImageToCloudinary(
  file: File,
  userId: string,
  folder: 'gallery' | 'avatar' | 'banner' | 'covers',
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadToCloudinary(file, {
    resourceType: 'image',
    folder: `roomlet/${userId}/${folder}`,
    onProgress,
  })

  return result.secure_url
}
