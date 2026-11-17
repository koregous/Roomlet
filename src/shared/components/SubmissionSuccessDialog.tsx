'use client'

import { Check, Clock } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function SubmissionSuccessDialog({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  const handleClose = () => {
    onClose()
    // Refresh to show updated status
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-black rounded-lg border border-gray-800 p-8 max-w-md w-full">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
            <Check size={32} className="text-green-500" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-serif text-white">Submitted for Review!</h2>
          
          <p className="text-gray-300 text-sm leading-relaxed">
            Your section has been submitted to our moderation queue. 
            An admin will review it shortly and approve or provide feedback.
          </p>

          {/* What Happens Next */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-left">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              What happens next?
            </h3>
            <ul className="space-y-2 text-xs text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">1.</span>
                <span>Your section is now in the approval queue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">2.</span>
                <span>An admin will review the content and category</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">3.</span>
                <span>If approved, it will appear in the gallery immediately</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">4.</span>
                <span>If rejected, you'll see the reason and can edit & resubmit</span>
              </li>
            </ul>
          </div>

          {/* Status Badge Info */}
          <p className="text-xs text-gray-500">
            You'll see a <span className="text-yellow-400">⏳ Pending Review</span> badge on your section in the dashboard.
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="w-full mt-6 px-4 py-3 bg-white text-black hover:bg-gray-200 rounded text-sm font-medium transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
