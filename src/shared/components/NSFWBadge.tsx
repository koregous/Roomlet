/**
 * NSFW Content Badge
 * 
 * Visual indicator for NSFW content.
 * Shows on section cards, thumbnails, and individual pages.
 */

'use client'

import { ShieldAlert } from 'lucide-react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function NSFWBadge({ size = 'md', className = '' }: Props) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  }

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  }

  return (
    <span
      className={`
        inline-flex items-center
        bg-red-500/20 border border-red-500/30
        text-red-400 font-medium rounded
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <ShieldAlert size={iconSizes[size]} />
      NSFW
    </span>
  )
}
