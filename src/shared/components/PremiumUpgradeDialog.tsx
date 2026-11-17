'use client'

import { X, Sparkles, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PremiumBadge from './PremiumBadge'

interface PremiumUpgradeDialogProps {
  isOpen: boolean
  onClose: () => void
  trigger: 'storage' | 'sections' | 'music' | 'video' | 'background' | 'general'
  currentUsage?: {
    used?: number | string
    limit?: number | string
  }
}

const TRIGGER_MESSAGES = {
  storage: {
    title: 'Storage Limit Reached',
    description: 'You\'ve reached your 500MB storage limit. Upgrade to Premium for 10GB of storage — 20x more space for your collections.',
    icon: '💾',
  },
  sections: {
    title: 'Section Limit Reached',
    description: 'You\'ve reached the limit of 50 sections. Upgrade to Premium for unlimited sections and build as many collections as you want.',
    icon: '📚',
  },
  music: {
    title: 'Music Block Limit',
    description: 'Free accounts can add 1 music block per profile. Upgrade to Premium to add 3-5 music blocks and create richer soundscapes.',
    icon: '🎵',
  },
  video: {
    title: 'Video Blocks - Premium Only',
    description: 'Video blocks are a Premium feature. Upgrade to embed videos in your collections with custom styling and controls.',
    icon: '🎬',
  },
  background: {
    title: 'Animated Backgrounds - Premium Only',
    description: 'Animated profile backgrounds are a Premium feature. Upgrade to set stunning video, GIF, or image backgrounds with glass morphism effects.',
    icon: '✨',
  },
  general: {
    title: 'Upgrade to Premium',
    description: 'Unlock the full power of Roomlet with Premium features designed for serious curators.',
    icon: '🚀',
  },
}

const PREMIUM_FEATURES = [
  { feature: '10GB Storage', detail: '20x more space' },
  { feature: 'Unlimited Sections', detail: 'Build endless collections' },
  { feature: '3-5 Music Blocks', detail: 'Rich audio experiences' },
  { feature: 'Video Blocks', detail: 'Embed videos with style' },
  { feature: 'Animated Backgrounds', detail: 'Glass morphism effects' },
  { feature: 'Premium Badge', detail: 'Stand out as a curator' },
  { feature: 'Priority Support', detail: 'Get help faster' },
]

export default function PremiumUpgradeDialog({
  isOpen,
  onClose,
  trigger,
  currentUsage,
}: PremiumUpgradeDialogProps) {
  const router = useRouter()
  const message = TRIGGER_MESSAGES[trigger]

  if (!isOpen) return null

  function handleUpgrade() {
    router.push('/premium')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-800 rounded-xl max-w-2xl w-full shadow-2xl pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 border-b border-gray-800">
            <div className="flex items-start gap-4">
              <div className="text-4xl">{message.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-semibold text-white">
                    {message.title}
                  </h2>
                  <PremiumBadge size="sm" variant="gradient" />
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {message.description}
                </p>
                
                {/* Current Usage */}
                {currentUsage && (trigger === 'storage' || trigger === 'sections') && (
                  <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
                    <span className="text-red-400 font-medium">
                      {trigger === 'storage' && `${currentUsage.used} / ${currentUsage.limit}`}
                      {trigger === 'sections' && `${currentUsage.used} / ${currentUsage.limit} sections`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition text-gray-400 hover:text-white"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          {/* Features List */}
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-400" />
              Premium Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PREMIUM_FEATURES.map((item) => (
                <div
                  key={item.feature}
                  className="flex items-start gap-2 text-sm"
                >
                  <Check size={16} className="text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-white font-medium">{item.feature}</div>
                    <div className="text-gray-500 text-xs">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="p-6 border-b border-gray-800 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
            <div className="text-center">
              <div className="inline-flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-white">$5</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-gray-400 text-sm">
                or $48/year (save 20%)
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                <Check size={14} />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium transition shadow-lg shadow-purple-500/20"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
