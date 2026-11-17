'use client'

import { X, Type, Image, Grid, LayoutList, Quote, Minus, Link, Music, Code2 } from 'lucide-react'
import { Block } from '@/shared/lib/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectBlock: (type: Block['type']) => void
  existingAudioBlocksCount: number // Track audio blocks across all sections
}

const BLOCK_OPTIONS = [
  {
    type: 'text' as const,
    label: 'Text',
    description: 'Rich text with headings & lists',
    icon: Type,
    color: 'from-blue-900/40 to-blue-950/40 border-blue-800/40',
  },
  {
    type: 'image' as const,
    label: 'Image',
    description: 'Single image with caption',
    icon: Image,
    color: 'from-purple-950/40 to-purple-900/40 border-purple-800/40',
  },
  {
    type: 'gallery' as const,
    label: 'Gallery',
    description: 'Grid of multiple images',
    icon: Grid,
    color: 'from-rose-950/40 to-rose-900/40 border-rose-800/40',
  },
  {
    type: 'carousel' as const,
    label: 'Carousel',
    description: 'Slideshow with navigation',
    icon: LayoutList,
    color: 'from-amber-950/40 to-amber-900/40 border-amber-800/40',
  },
  {
    type: 'quote' as const,
    label: 'Quote',
    description: 'Testimonial or highlight',
    icon: Quote,
    color: 'from-emerald-950/40 to-emerald-900/40 border-emerald-800/40',
  },
  {
    type: 'divider' as const,
    label: 'Divider',
    description: 'Visual separator',
    icon: Minus,
    color: 'from-gray-900/40 to-gray-950/40 border-gray-800/40',
  },
  {
    type: 'links' as const,
    label: 'Links',
    description: 'Button-style external links',
    icon: Link,
    color: 'from-cyan-950/40 to-cyan-900/40 border-cyan-800/40',
  },
  {
    type: 'audio' as const,
    label: 'Audio',
    description: 'Music player with controls',
    icon: Music,
    color: 'from-violet-950/40 to-violet-900/40 border-violet-800/40',
  },
  {
    type: 'embed' as const,
    label: 'Embed',
    description: 'YouTube, Spotify, iframes & more',
    icon: Code2,
    color: 'from-indigo-950/40 to-indigo-900/40 border-indigo-800/40',
  },
]

export default function BlockPicker({ isOpen, onClose, onSelectBlock, existingAudioBlocksCount }: Props) {
  if (!isOpen) return null

  const handleSelect = (type: Block['type']) => {
    // Prevent adding audio if limit reached
    if (type === 'audio' && existingAudioBlocksCount >= 1) {
      alert('You can only have 1 audio block on your profile. Remove the existing audio block to add a new one.')
      return
    }
    
    onSelectBlock(type)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-black border border-gray-800 rounded-lg shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-xl font-semibold text-white">Add Block</h3>
            <p className="text-sm text-gray-500 mt-0.5">Choose a content block to add</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white transition rounded-lg hover:bg-gray-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Block Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {BLOCK_OPTIONS.map((block) => {
            const Icon = block.icon
            const isAudioDisabled = block.type === 'audio' && existingAudioBlocksCount >= 1
            
            return (
              <button
                key={block.type}
                onClick={() => handleSelect(block.type)}
                disabled={isAudioDisabled}
                className={`group relative p-4 rounded-lg border bg-gradient-to-br ${block.color} transition-all duration-200 text-left ${
                  isAudioDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-[1.02] hover:brightness-125'
                }`}
              >
                {/* Icon */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-black/60 group-hover:bg-black/80 transition">
                    <Icon size={20} className="text-gray-300" />
                  </div>
                  <h4 className="text-base font-medium text-gray-200">{block.label}</h4>
                  {isAudioDisabled && (
                    <span className="ml-auto text-[10px] text-red-400 bg-red-950/50 px-2 py-0.5 rounded">
                      Limit: 1
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 leading-relaxed">
                  {isAudioDisabled ? 'Only 1 audio block allowed per profile' : block.description}
                </p>

                {/* Hover effect */}
                {!isAudioDisabled && (
                  <div className="absolute inset-0 rounded-lg ring-1 ring-white/0 group-hover:ring-white/10 transition pointer-events-none" />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-900/50">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-black border border-gray-700 rounded text-xs">ESC</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
