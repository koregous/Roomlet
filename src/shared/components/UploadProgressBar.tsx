'use client'

import { useUploadQueue } from '@/shared/stores/uploadQueueStore'
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, Upload, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function UploadProgressBar() {
  const {
    queue,
    isMinimized,
    uploadsThisMinute,
    toggleMinimize,
    clearCompleted,
    removeTask,
    retryFailed,
    getPendingCount,
    getActiveCount,
    getCompletedCount,
    getFailedCount,
    getTotalProgress,
    getUploadableCount,
  } = useUploadQueue()

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render during SSR
  if (!mounted) return null

  // Don't show if queue is empty
  if (queue.length === 0) return null

  const pendingCount = getPendingCount()
  const activeCount = getActiveCount()
  const completedCount = getCompletedCount()
  const failedCount = getFailedCount()
  const totalProgress = getTotalProgress()
  const uploadableCount = getUploadableCount()
  
  const oneMinuteAgo = Date.now() - 60000
  const recentUploadsCount = uploadsThisMinute.filter((t) => t > oneMinuteAgo).length

  const hasActive = activeCount > 0 || pendingCount > 0
  const hasErrors = failedCount > 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 shadow-2xl">
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition"
        onClick={toggleMinimize}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {hasActive ? (
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
          ) : hasErrors ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">
                {hasActive ? (
                  <>Uploading {activeCount} of {queue.length} images</>
                ) : hasErrors ? (
                  <>{failedCount} upload{failedCount !== 1 ? 's' : ''} failed</>
                ) : (
                  <>All uploads complete!</>
                )}
              </span>
              
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recentUploadsCount}/12 this min
                {uploadableCount > 0 && (
                  <span className="text-green-400">
                    ({uploadableCount} available)
                  </span>
                )}
              </span>
            </div>

            {hasActive && (
              <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {completedCount > 0 && !hasActive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearCompleted()
              }}
              className="text-xs px-3 py-1 text-gray-400 hover:text-white transition"
            >
              Clear
            </button>
          )}
          
          {hasErrors && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                retryFailed()
              }}
              className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
            >
              Retry Failed
            </button>
          )}

          <button className="p-1 text-gray-400 hover:text-white transition">
            {isMinimized ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="max-h-80 overflow-y-auto border-t border-gray-800">
          <div className="p-4 space-y-2">
            {queue.map((task) => (
              <UploadTaskItem key={task.id} task={task} onRemove={removeTask} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UploadTaskItem({ 
  task, 
  onRemove 
}: { 
  task: any
  onRemove: (id: string) => void 
}) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      case 'queued':
        return <Clock className="w-4 h-4 text-gray-400" />
      case 'uploading':
      case 'compressing':
      case 'validating':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      default:
        return <Upload className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      case 'queued':
        return 'text-gray-400'
      default:
        return 'text-blue-400'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg hover:bg-black/50 transition group">
      <div className="shrink-0">
        {getStatusIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-white truncate font-medium">
            {task.fileName}
          </span>
          <span className="text-xs text-gray-500 shrink-0">
            {formatFileSize(task.fileSize)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${getStatusColor()}`}>
            {task.status === 'success' && 'Uploaded'}
            {task.status === 'error' && (task.error || 'Failed')}
            {task.status === 'queued' && 'Waiting...'}
            {task.status === 'validating' && 'Validating...'}
            {task.status === 'compressing' && 'Compressing...'}
            {task.status === 'uploading' && `${task.progress}%`}
          </span>
          
          {task.retryCount > 0 && (
            <span className="text-xs text-gray-500">
              (retry #{task.retryCount})
            </span>
          )}
        </div>

        {(task.status === 'uploading' || task.status === 'compressing') && (
          <div className="mt-1 w-full bg-gray-800 rounded-full h-1 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}
      </div>

      {(task.status === 'error' || task.status === 'success') && (
        <button
          onClick={() => onRemove(task.id)}
          className="shrink-0 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
