'use client'

import { useEffect, useState } from 'react'
import { Layers, AlertTriangle, Sparkles } from 'lucide-react'
import PremiumUpgradeDialog from './PremiumUpgradeDialog'

interface SectionLimit {
  count: number
  limit: number
  remaining: number
  percentage: number
}

interface SectionLimitWidgetProps {
  userId: string
  currentCount?: number // Optional: Pass current count from parent to avoid extra fetch
}

export default function SectionLimitWidget({ userId, currentCount }: SectionLimitWidgetProps) {
  const [limit, setLimit] = useState<SectionLimit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  useEffect(() => {
    fetchLimit()
  }, [userId])

  const fetchLimit = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/sections/check-limit')
      if (!response.ok) {
        throw new Error('Failed to fetch section limit')
      }
      
      const data = await response.json()
      setLimit(data.limit)
    } catch (err) {
      console.error('[SectionLimitWidget] Failed to fetch limit:', err)
      setError('Failed to load section info')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-gray-800 p-6 rounded-lg bg-black">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-gray-500" />
          <div className="flex-1">
            <p className="text-sm text-gray-500">Loading section info...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !limit) {
    return (
      <div className="border border-gray-800 p-6 rounded-lg bg-black">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-gray-500" />
          <div className="flex-1">
            <p className="text-sm text-gray-400">Section info unavailable</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if user is premium (unlimited sections)
  // API returns null for unlimited (Infinity can't be JSON serialized)
  const isPremium = limit.limit === null || limit.limit === Infinity

  const getProgressColor = () => {
    if (limit.percentage >= 100) return 'bg-red-500'
    if (limit.percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getTextColor = () => {
    if (limit.percentage >= 100) return 'text-red-400'
    if (limit.percentage >= 80) return 'text-yellow-400'
    return 'text-gray-300'
  }

  const showWarning = !isPremium && limit.percentage >= 80
  const isAtLimit = !isPremium && limit.count >= limit.limit
  const showUpgradePrompt = !isPremium && limit.percentage >= 90

  return (
    <div className={`border ${showWarning ? 'border-yellow-900' : 'border-gray-800'} p-6 rounded-lg bg-black`}>
      <div className="flex items-start gap-3">
        <Layers size={20} className={isAtLimit ? 'text-red-400' : 'text-gray-400'} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-200">Sections</h3>
            {showWarning && (
              <AlertTriangle size={16} className={isAtLimit ? 'text-red-400' : 'text-yellow-400'} />
            )}
          </div>
          
          <div className="space-y-2">
            {/* Section count */}
            <div className="flex items-center justify-between text-sm">
              <span className={isPremium ? 'text-gray-300' : getTextColor()}>
                {limit.count} / {isPremium ? '∞' : (limit.limit || 50)} sections
              </span>
              {!isPremium && (
                <span className={getTextColor()}>
                  {Math.round(limit.percentage)}%
                </span>
              )}
            </div>

            {/* Progress bar - only for non-premium */}
            {!isPremium && (
              <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${Math.min(100, limit.percentage)}%` }}
                />
              </div>
            )}

            {/* Premium badge - shows unlimited sections */}
            {isPremium && (
              <p className="text-xs text-purple-400 flex items-center gap-1">
                <Sparkles size={12} />
                Unlimited sections
              </p>
            )}

            {/* Remaining count */}
            {!isAtLimit && limit.limit !== Infinity && (
              <p className="text-xs text-gray-500">
                {limit.remaining} remaining
              </p>
            )}

            {/* At limit message */}
            {isAtLimit && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                Section limit reached. Upgrade to create more sections.
              </p>
            )}

            {/* Upgrade prompt */}
            {showUpgradePrompt && !isAtLimit && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles size={14} className="text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-400">
                    Almost at your limit. Upgrade to Premium for <strong className="text-purple-400">unlimited sections</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeDialog(true)}
                  className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-medium rounded transition"
                >
                  Upgrade to Premium
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Premium Upgrade Dialog */}
      <PremiumUpgradeDialog
        isOpen={showUpgradeDialog}
        onClose={() => setShowUpgradeDialog(false)}
        trigger="sections"
        currentUsage={{
          used: limit.count,
          limit: limit.limit === Infinity ? '∞' : limit.limit,
        }}
      />
    </div>
  )
}
