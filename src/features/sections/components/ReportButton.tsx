'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { useToast } from '@/shared/components/Toast'

interface ReportButtonProps {
  sectionId: string
  userId?: string | null
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading', description: 'Unwanted promotional content' },
  { value: 'harassment', label: 'Harassment or hate speech', description: 'Targets individuals or groups' },
  { value: 'adult_content', label: 'Adult content', description: 'Sexually explicit material' },
  { value: 'violence', label: 'Violence or harm', description: 'Graphic violence or threats' },
  { value: 'copyright', label: 'Copyright violation', description: 'Unauthorized use of copyrighted material' },
]

export default function ReportButton({ sectionId, userId }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addToast } = useToast()

  const handleSubmit = async () => {
    if (!selectedReason) {
      addToast('Please select a reason', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: sectionId,
          reason: selectedReason,
          reporter_user_id: userId,
        }),
      })

      if (response.ok) {
        addToast('Report submitted successfully. We will review it shortly.', 'success', 4000)
        setIsOpen(false)
        setSelectedReason('')
      } else {
        const error = await response.json()
        addToast(error.error || 'Failed to submit report', 'error')
      }
    } catch (error) {
      console.error('Failed to submit report:', error)
      addToast('Failed to submit report', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-lg transition"
        aria-label="Report content"
      >
        <Flag size={16} />
        <span className="hidden sm:inline">Report</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif font-semibold text-white">
                Report Content
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-400 mb-4">
                Please select the reason for reporting this content:
              </p>
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={`block p-4 border rounded-lg cursor-pointer transition ${
                    selectedReason === reason.value
                      ? 'border-blue-600 bg-blue-600/10'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                      selectedReason === reason.value
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-600'
                    }`}>
                      {selectedReason === reason.value && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">
                        {reason.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {reason.description}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white rounded-lg transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              False reports may result in action against your account
            </p>
          </div>
        </div>
      )}
    </>
  )
}
