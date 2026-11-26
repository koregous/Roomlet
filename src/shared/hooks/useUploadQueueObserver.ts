/**
 * Upload Queue Observer Hook
 * 
 * Watches the upload queue for completed uploads in a specific section/block
 * and triggers auto-save when uploads finish.
 * 
 * This hook bridges the global upload queue with per-section auto-save logic.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useUploadQueue, UploadTask } from '@/shared/stores/uploadQueueStore'

interface UploadQueueObserverOptions {
  sectionId: string
  blockId: string
  onUploadComplete: (task: UploadTask) => void
  onUploadError?: (error: string, fileName: string) => void
}

/**
 * Hook to observe upload queue changes and handle completed uploads
 * 
 * @param options Configuration object
 * @param options.sectionId - Section ID to watch
 * @param options.blockId - Block ID to watch
 * @param options.onUploadComplete - Callback when upload succeeds
 * @param options.onUploadError - Optional callback when upload fails
 */
export function useUploadQueueObserver({
  sectionId,
  blockId,
  onUploadComplete,
  onUploadError,
}: UploadQueueObserverOptions) {
  const { queue } = useUploadQueue()
  
  // Track processed task IDs to avoid double-processing
  const processedTaskIds = useRef(new Set<string>())

  const relevantTasks = queue.filter(
    (task) => task.sectionId === sectionId && task.blockId === blockId
  )

  // Process completed tasks
  useEffect(() => {
    for (const task of relevantTasks) {
      // Skip if already processed
      if (processedTaskIds.current.has(task.id)) {
        continue
      }

      if (task.status === 'success' && task.url) {
        console.log('[UploadQueueObserver] Upload completed:', task.fileName, task.url)
        onUploadComplete(task)
        processedTaskIds.current.add(task.id)
      }

      if (task.status === 'error' && task.error) {
        console.log('[UploadQueueObserver] Upload failed:', task.fileName, task.error)
        onUploadError?.(task.error, task.fileName)
        processedTaskIds.current.add(task.id)
      }
    }
  }, [relevantTasks, onUploadComplete, onUploadError])

  const getUploadStats = useCallback(() => {
    const tasks = queue.filter(
      (task) => task.sectionId === sectionId && task.blockId === blockId
    )

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'queued').length,
      active: tasks.filter(
        (t) => t.status === 'validating' || t.status === 'compressing' || t.status === 'uploading'
      ).length,
      completed: tasks.filter((t) => t.status === 'success').length,
      failed: tasks.filter((t) => t.status === 'error').length,
      tasks, // Return full tasks for progress tracking
    }
  }, [queue, sectionId, blockId])

  return {
    getUploadStats,
    relevantTasks,
  }
}
