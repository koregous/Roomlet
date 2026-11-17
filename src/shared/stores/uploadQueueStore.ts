import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UploadStatus = 
  | 'queued'      // In queue, waiting to start
  | 'validating'  // Checking file size/type
  | 'compressing' // Compressing image
  | 'uploading'   // HTTP request in flight
  | 'success'     // Completed successfully
  | 'error'       // Failed with error

export interface UploadTask {
  id: string                    // Unique task ID
  file: File                    // The file to upload
  fileName: string              // Original file name
  fileSize: number              // File size in bytes
  sectionId: string             // Which section this belongs to
  blockId: string               // Which block within section
  batchId: string               // ID of the upload batch
  status: UploadStatus          // Current status
  progress: number              // 0-100
  error?: string                // Error message if failed
  url?: string                  // Cloudinary URL on success
  retryCount: number            // Number of retry attempts
  queuedAt: number              // Timestamp when queued
  queueIndex: number            // Position in original selection order (for proper insertion)
  startedAt?: number            // Timestamp when upload started
  completedAt?: number          // Timestamp when finished
}

interface UploadQueueState {
  // State
  queue: UploadTask[]
  uploadsThisMinute: number[]   // Array of timestamps for rate limiting
  isMinimized: boolean          // Is progress bar minimized?
  
  // Actions
  addToQueue: (task: Omit<UploadTask, 'id' | 'status' | 'progress' | 'retryCount' | 'queuedAt' | 'queueIndex'>) => string
  updateTask: (id: string, updates: Partial<UploadTask>) => void
  removeTask: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
  retryFailed: () => void
  recordUpload: () => void      // Record an upload for rate limiting
  canUpload: () => boolean      // Check if we can upload now (rate limit)
  getUploadableCount: () => number // How many uploads available this minute
  toggleMinimize: () => void
  
  // Computed
  getPendingCount: () => number
  getActiveCount: () => number
  getCompletedCount: () => number
  getFailedCount: () => number
  getTotalProgress: () => number
}

export const useUploadQueue = create<UploadQueueState>()(
  persist(
    (set, get) => ({
      // Initial state
      queue: [],
      uploadsThisMinute: [],
      isMinimized: false,

      // Add new upload to queue
      addToQueue: (task) => {
        const state = get()
        const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Get next queue index for THIS BATCH of uploads to this block
        const now = Date.now()
        
        const currentBatchTasks = state.queue.filter(t => t.batchId === task.batchId)
        const queueIndex = currentBatchTasks.length
        
        const newTask: UploadTask = {
          ...task,
          id,
          status: 'queued',
          progress: 0,
          retryCount: 0,
          queuedAt: now,
          queueIndex,
        }
        
        set((state) => ({
          queue: [...state.queue, newTask],
        }))
        
        return id
      },

      // Update specific task
      updateTask: (id, updates) => {
        set((state) => ({
          queue: state.queue.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }))
      },

      // Remove task from queue
      removeTask: (id) => {
        set((state) => ({
          queue: state.queue.filter((task) => task.id !== id),
        }))
      },

      // Clear completed tasks
      clearCompleted: () => {
        set((state) => ({
          queue: state.queue.filter((task) => task.status !== 'success'),
        }))
      },

      // Clear all tasks
      clearAll: () => {
        set({ queue: [] })
      },

      // Retry all failed tasks
      retryFailed: () => {
        set((state) => ({
          queue: state.queue.map((task) =>
            task.status === 'error'
              ? { ...task, status: 'queued', progress: 0, error: undefined, retryCount: task.retryCount + 1 }
              : task
          ),
        }))
      },

      // Record an upload completion for rate limiting
      recordUpload: () => {
        const now = Date.now()
        set((state) => ({
          uploadsThisMinute: [...state.uploadsThisMinute, now],
        }))
      },

      // Check if we can upload (under rate limit)
      canUpload: () => {
        const { uploadsThisMinute } = get()
        const oneMinuteAgo = Date.now() - 60000
        
        // Clean old timestamps
        const recentUploads = uploadsThisMinute.filter((t) => t > oneMinuteAgo)
        
        // Update state with cleaned timestamps
        if (recentUploads.length !== uploadsThisMinute.length) {
          set({ uploadsThisMinute: recentUploads })
        }
        
        return recentUploads.length < 12 // 12 uploads per minute limit
      },

      // Get number of uploads available this minute
      getUploadableCount: () => {
        const { uploadsThisMinute } = get()
        const oneMinuteAgo = Date.now() - 60000
        const recentUploads = uploadsThisMinute.filter((t) => t > oneMinuteAgo)
        return Math.max(0, 12 - recentUploads.length)
      },

      // Toggle minimize state
      toggleMinimize: () => {
        set((state) => ({ isMinimized: !state.isMinimized }))
      },

      // Get count of pending (queued) tasks
      getPendingCount: () => {
        return get().queue.filter((t) => t.status === 'queued').length
      },

      // Get count of active (validating/compressing/uploading) tasks
      getActiveCount: () => {
        return get().queue.filter((t) => 
          t.status === 'validating' || 
          t.status === 'compressing' || 
          t.status === 'uploading'
        ).length
      },

      // Get count of completed tasks
      getCompletedCount: () => {
        return get().queue.filter((t) => t.status === 'success').length
      },

      // Get count of failed tasks
      getFailedCount: () => {
        return get().queue.filter((t) => t.status === 'error').length
      },

      // Get overall progress percentage
      getTotalProgress: () => {
        const { queue } = get()
        if (queue.length === 0) return 0
        
        const totalProgress = queue.reduce((sum, task) => sum + task.progress, 0)
        return Math.round(totalProgress / queue.length)
      },
    }),
    {
      name: 'roomlet-upload-queue',
      // Only persist queue structure, not File objects
      partialize: (state) => ({
        isMinimized: state.isMinimized,
        // Don't persist actual queue or rate limit data (loses File objects anyway)
      }),
    }
  )
)
