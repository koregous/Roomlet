/**
 * Age Verification Modal
 * 
 * One-time gate shown before enabling NSFW content.
 * Standard practice for liability/compliance.
 */

'use client'

import { AlertTriangle, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function AgeVerificationModal({ isOpen, onConfirm, onCancel }: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-black rounded-lg border border-gray-800 p-8 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-yellow-500/10 rounded-lg">
            <AlertTriangle className="text-yellow-500" size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-serif text-white mb-2">
              Age Verification Required
            </h2>
            <p className="text-sm text-gray-400">
              You must be 18 years or older to view NSFW content
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-300">
            By confirming, you certify that:
          </p>
          <ul className="space-y-2 text-sm text-gray-400 pl-4">
            <li className="flex items-start gap-2">
              <span className="text-gray-600 mt-0.5">•</span>
              <span>You are at least 18 years old</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600 mt-0.5">•</span>
              <span>You understand this will enable mature content across the site</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-600 mt-0.5">•</span>
              <span>Viewing such content is legal in your jurisdiction</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              This setting will be remembered across your browsing sessions. You can disable it at any time from the gallery filters.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 rounded text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded text-sm font-medium transition-colors"
          >
            I am 18 or older
          </button>
        </div>
      </div>
    </div>
  )
}
