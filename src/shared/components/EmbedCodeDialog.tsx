'use client'

import { useState } from 'react'
import { X, Copy, Check, Code } from 'lucide-react'
import { useToast } from './Toast'

interface EmbedCodeDialogProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  sectionTitle: string
}

export default function EmbedCodeDialog({
  isOpen,
  onClose,
  sectionId,
  sectionTitle,
}: EmbedCodeDialogProps) {
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [width, setWidth] = useState('100%')
  const [height, setHeight] = useState('600')
  const { addToast } = useToast()

  if (!isOpen) return null

  const embedUrl = `${window.location.origin}/embed/${sectionId}?theme=${theme}`
  const embedCode = `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}px" 
  frameborder="0" 
  allowfullscreen
  title="${sectionTitle}"
></iframe>`

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    addToast('Embed code copied!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-purple-500/30 rounded-2xl p-8 max-w-2xl w-full animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <div className="bg-purple-500/20 rounded-full p-2">
              <Code className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Embed Section
              </h2>
              <p className="text-sm text-gray-400">
                Share "{sectionTitle}" on your website or Notion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            aria-label="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Customization options */}
        <div className="mb-6 space-y-4">
          {/* Theme selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
                  theme === 'dark'
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
                  theme === 'light'
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                Light
              </button>
            </div>
          </div>

          {/* Width */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Width
            </label>
            <input
              type="text"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              placeholder="100% or 800px"
            />
          </div>

          {/* Height */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Height (pixels)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              placeholder="600"
            />
          </div>
        </div>

        {/* Embed code preview */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Embed Code
          </label>
          <div className="relative">
            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Preview link */}
        <div className="mb-6">
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-300 hover:underline"
          >
            Preview embed →
          </a>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-500 hover:to-blue-500 transition font-semibold flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Code
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition font-semibold"
          >
            Close
          </button>
        </div>

        {/* Usage tips */}
        <div className="mt-6 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
          <p className="text-xs text-gray-400 mb-2">
            <strong className="text-gray-300">Usage Tips:</strong>
          </p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Works in Notion, WordPress, Webflow, and most platforms</li>
            <li>Adjust height based on your content length</li>
            <li>Use "100%" width for responsive layouts</li>
            <li>Section must be published to embed</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
