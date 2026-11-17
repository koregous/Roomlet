/**
 * Upload Worker - Orchestrates image uploads with rate limiting and retry logic
 * 
 * Features:
 * - Per-file validation before queuing
 * - Automatic compression with Instagram-style resize-first strategy
 * - Rate limiting: 12 uploads per minute, 3-4 concurrent max
 * - Auto-retry on failure with exponential backoff
 * - Progress tracking per file
 */

import { useUploadQueue, UploadTask } from '@/shared/stores/uploadQueueStore'
import { 
  compressImage, 
  validateImageFile, 
  COMPRESSION_PRESETS,
  MAX_COMPRESSED_FILE_SIZE 
} from '@/shared/lib/image-compress'

// Rate limiting constants
const UPLOADS_PER_MINUTE = 12
const MAX_CONCURRENT = 3
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 2000 // 2 seconds, doubles each retry

class UploadWorker {
  private processing = false
  private processingTasks = new Set<string>()

  /**
   * Add files to upload queue with validation
   * Returns array of task IDs for successfully queued files
   */
  async queueFiles(
    files: File[], 
    sectionId: string, 
    blockId: string,
    onError?: (fileName: string, error: string) => void
  ): Promise<string[]> {
    const taskIds: string[] = []
    const { addToQueue } = useUploadQueue.getState()
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    for (const file of files) {
      // Pre-flight validation
      const validation = validateImageFile(file)
      if (!validation.valid) {
        onError?.(file.name, validation.error || 'Invalid file')
        continue
      }

      // Add to queue
      const taskId = addToQueue({
        file,
        fileName: file.name,
        fileSize: file.size,
        sectionId,
        blockId,
        batchId,
      })

      taskIds.push(taskId)
    }

    // Start processing queue if not already running
    if (!this.processing) {
      this.startProcessing()
    }

    return taskIds
  }

  /**
   * Start processing the upload queue
   */
  private async startProcessing() {
    if (this.processing) return
    
    this.processing = true

    while (true) {
      const { queue, canUpload, getUploadableCount } = useUploadQueue.getState()

      // Find tasks that are ready to upload
      const pendingTasks = queue.filter(
        (task) => 
          task.status === 'queued' && 
          !this.processingTasks.has(task.id)
      )

      if (pendingTasks.length === 0) {
        // No more pending tasks, stop processing
        this.processing = false
        break
      }

      // Check rate limiting
      if (!canUpload()) {
        // Wait for rate limit window to open
        await this.waitForRateLimit()
        continue
      }

      // Check concurrent limit
      const availableSlots = Math.min(
        MAX_CONCURRENT - this.processingTasks.size,
        getUploadableCount()
      )

      if (availableSlots <= 0) {
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 500))
        continue
      }

      // Start processing available tasks
      const tasksToProcess = pendingTasks.slice(0, availableSlots)
      
      for (const task of tasksToProcess) {
        this.processUpload(task)
      }

      // Small delay before next iteration
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * Wait for rate limit window to open
   */
  private async waitForRateLimit(): Promise<void> {
    const { uploadsThisMinute } = useUploadQueue.getState()
    
    if (uploadsThisMinute.length === 0) return

    // Find oldest upload timestamp
    const oldestUpload = Math.min(...uploadsThisMinute)
    const oneMinuteFromOldest = oldestUpload + 60000
    const now = Date.now()

    if (oneMinuteFromOldest > now) {
      const waitTime = oneMinuteFromOldest - now
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  /**
   * Process a single upload task
   */
  private async processUpload(task: UploadTask): Promise<void> {
    const { updateTask, recordUpload } = useUploadQueue.getState()
    
    this.processingTasks.add(task.id)

    try {
      // Step 1: Validation
      updateTask(task.id, { status: 'validating', progress: 5 })
      
      const validation = validateImageFile(task.file)
      if (!validation.valid) {
        throw new Error(validation.error || 'Validation failed')
      }

      // Step 2: Compression (resize-first strategy)
      updateTask(task.id, { status: 'compressing', progress: 15 })
      
      const compressedFile = await compressImage(task.file, COMPRESSION_PRESETS.gallery)
      
      // Check compressed file size (server-side safety net)
      if (compressedFile.size > MAX_COMPRESSED_FILE_SIZE) {
        throw new Error(
          `File is still too large after compression (${(compressedFile.size / (1024 * 1024)).toFixed(1)}MB). ` +
          `Maximum is 15MB. Try a smaller image.`
        )
      }

      updateTask(task.id, { progress: 30 })

      // Step 3: Upload to Cloudinary
      updateTask(task.id, { status: 'uploading', progress: 40 })

      const url = await this.uploadToCloudinary(
        compressedFile, 
        task.sectionId,
        (progress) => {
          // Update progress during upload (40-95)
          const uploadProgress = 40 + (progress * 0.55)
          updateTask(task.id, { progress: Math.round(uploadProgress) })
        }
      )

      // Step 4: Success
      updateTask(task.id, { 
        status: 'success', 
        progress: 100,
        url,
        completedAt: Date.now(),
      })

      // Record upload for rate limiting
      recordUpload()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      // Check if we should retry
      if (task.retryCount < MAX_RETRIES && this.shouldRetry(error)) {
        // Calculate backoff delay
        const delay = RETRY_DELAY_BASE * Math.pow(2, task.retryCount)
        
        // Schedule retry
        setTimeout(() => {
          updateTask(task.id, { 
            status: 'queued',
            progress: 0,
            retryCount: task.retryCount + 1,
          })
          
          // Restart processing if stopped
          if (!this.processing) {
            this.startProcessing()
          }
        }, delay)
      } else {
        // Max retries reached or non-retryable error
        updateTask(task.id, { 
          status: 'error', 
          progress: 0,
          error: errorMessage,
          completedAt: Date.now(),
        })
      }
    } finally {
      this.processingTasks.delete(task.id)
    }
  }

  /**
   * Upload file to Cloudinary with progress tracking
   */
  private async uploadToCloudinary(
    file: File,
    sectionId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionId', sectionId)

      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = e.loaded / e.total
          onProgress?.(progress)
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response.url)
          } catch (error) {
            reject(new Error('Invalid response from server'))
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText)
            reject(new Error(errorData.error || `Upload failed (${xhr.status})`))
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`))
          }
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
      })

      // Send request
      xhr.open('POST', '/api/upload/gallery')
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.send(formData)
    })
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    const message = error.message.toLowerCase()

    // Retryable errors
    const retryablePatterns = [
      'network error',
      'timeout',
      'rate limit',
      '429',
      '503',
      '504',
      'connection',
      'fetch failed',
    ]

    // Non-retryable errors
    const nonRetryablePatterns = [
      'invalid',
      'too large',
      'unsupported',
      'validation',
      '400',
      '401',
      '403',
      '404',
    ]

    // Check non-retryable first (these take precedence)
    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false
    }

    // Check retryable
    if (retryablePatterns.some(pattern => message.includes(pattern))) {
      return true
    }

    // Default: retry on unknown errors (could be transient)
    return true
  }

  /**
   * Cancel a specific upload
   */
  cancelUpload(taskId: string): void {
    const { removeTask } = useUploadQueue.getState()
    this.processingTasks.delete(taskId)
    removeTask(taskId)
  }

  /**
   * Cancel all uploads
   */
  cancelAll(): void {
    const { clearAll } = useUploadQueue.getState()
    this.processingTasks.clear()
    this.processing = false
    clearAll()
  }
}

// Export singleton instance
export const uploadWorker = new UploadWorker()

/**
 * React hook for easy integration
 */
export function useUploadWorker() {
  const queueFiles = (
    files: File[], 
    sectionId: string, 
    blockId: string,
    onError?: (fileName: string, error: string) => void
  ) => {
    return uploadWorker.queueFiles(files, sectionId, blockId, onError)
  }

  const cancelUpload = (taskId: string) => {
    uploadWorker.cancelUpload(taskId)
  }

  const cancelAll = () => {
    uploadWorker.cancelAll()
  }

  return {
    queueFiles,
    cancelUpload,
    cancelAll,
  }
}
