'use client'

import { useEffect, useState } from 'react'
import { HardDrive, AlertTriangle, Sparkles } from 'lucide-react'
import PremiumUpgradeDialog from './PremiumUpgradeDialog'

interface StorageQuota {
  used: number
  limit: number
  remaining: number
  percentage: number
  isOverLimit: boolean
}

interface StorageQuotaWidgetProps {
  userId: string
}

export default function StorageQuotaWidget({ userId }: StorageQuotaWidgetProps) {
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)

  useEffect(() => {
    fetchQuota()
  }, [userId])

  const fetchQuota = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/storage/quota')
      if (!response.ok) {
        throw new Error('Failed to fetch storage quota')
      }
      
      const data = await response.json()
      setQuota(data.quota)
    } catch (err) {
      console.error('[StorageQuotaWidget] Failed to fetch quota:', err)
      setError('Failed to load storage info')
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  if (loading) {
    return (
      <div className="border border-gray-800 p-6 rounded-lg bg-black">
        <div className="flex items-center gap-3">
          <HardDrive size={20} className="text-gray-500" />
          <div className="flex-1">
            <p className="text-sm text-gray-500">Loading storage info...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !quota) {
    return (
      <div className="border border-gray-800 p-6 rounded-lg bg-black">
        <div className="flex items-center gap-3">
          <HardDrive size={20} className="text-gray-500" />
          <div className="flex-1">
            <p className="text-sm text-gray-400">Storage info unavailable</p>
          </div>
        </div>
      </div>
    )
  }

  const getProgressColor = () => {
    if (quota.percentage >= 90) return 'bg-red-500'
    if (quota.percentage >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const getTextColor = () => {
    if (quota.percentage >= 90) return 'text-red-400'
    if (quota.percentage >= 75) return 'text-yellow-400'
    return 'text-gray-300'
  }

  const showWarning = quota.percentage >= 75
  const showUpgradePrompt = quota.percentage >= 90

  return (
    <div className={`border ${showWarning ? 'border-yellow-900' : 'border-gray-800'} p-6 rounded-lg bg-black`}>
      <div className="flex items-start gap-3 mb-4">
        <HardDrive size={20} className={quota.isOverLimit ? 'text-red-400' : 'text-gray-400'} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-200">Storage Used</h3>
            {showWarning && (
              <AlertTriangle size={16} className={quota.isOverLimit ? 'text-red-400' : 'text-yellow-400'} />
            )}
          </div>
          
          <div className="space-y-2">
            <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${Math.min(100, quota.percentage)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className={getTextColor()}>
                {formatBytes(quota.used)} / {formatBytes(quota.limit)}
              </span>
              <span className={getTextColor()}>
                {Math.round(quota.percentage)}%
              </span>
            </div>

            {!quota.isOverLimit && (
              <p className="text-xs text-gray-500">
                {formatBytes(quota.remaining)} remaining
              </p>
            )}

            {/* Warning message */}
            {quota.isOverLimit && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                Storage limit reached. Upgrade to continue uploading.
              </p>
            )}

            {showUpgradePrompt && !quota.isOverLimit && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles size={14} className="text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-400">
                    Running low on space. Upgrade to Premium for <strong className="text-purple-400">20x more storage</strong>.
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
        trigger="storage"
        currentUsage={{
          used: formatBytes(quota.used),
          limit: formatBytes(quota.limit),
        }}
      />
    </div>
  )
}
