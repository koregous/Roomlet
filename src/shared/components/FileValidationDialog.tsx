'use client'

import { AlertCircle, X } from 'lucide-react'
import { useEffect } from 'react'

interface FileValidationDialogProps {
  isOpen: boolean
  onClose: () => void
  error: string
  fileName?: string
  fileSize?: number
}

export function FileValidationDialog({
  isOpen,
  onClose,
  error,
  fileName,
  fileSize,
}: FileValidationDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-red-900/50 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto animate-slideUp"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <h2 id="dialog-title" className="text-xl font-semibold text-white">
                Upload Failed
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-gray-300 leading-relaxed">{error}</p>

            {fileName && (
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">File name:</span>
                  <span className="text-gray-200 font-medium truncate ml-2 max-w-[200px]" title={fileName}>
                    {fileName}
                  </span>
                </div>
                {fileSize && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">File size:</span>
                    <span className="text-gray-200 font-medium">{formatFileSize(fileSize)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-300 leading-relaxed">
                <strong className="font-semibold">Tip:</strong> Try compressing your image before uploading, or use a smaller image.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
