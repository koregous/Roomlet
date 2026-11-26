/**
 * Profile Tabs Component
 * 
 * Tab navigation for user profile sections.
 * Handles NSFW tabs with proper gating and visual indicators.
 * Supports mouse drag-to-scroll for better UX.
 */

'use client'

import { useRef, useState, useEffect } from 'react'
import { Section } from '@/shared/lib/types'
import { Lock, ShieldAlert, Heart } from 'lucide-react'

interface ProfileTab {
  id: string
  title: string
  section?: Section
  isNSFW?: boolean
  isBookmarksTab?: boolean
  bookmarks?: any[]
}

interface Props {
  tabs: ProfileTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function ProfileTabs({ tabs, activeTab, onTabChange }: Props) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
    // Prevent text selection while dragging
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollContainerRef.current.offsetLeft
    const walk = (x - startX) * 2 // Multiply by 2 for faster scroll
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsDragging(false)
    }
  }, [])

  return (
    <div className="border-b border-gray-800">
      <nav 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`flex gap-1 overflow-x-auto scrollbar-hide ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={(e) => {
                // Only trigger tab change if not dragging (prevent accidental clicks while dragging)
                if (!isDragging) {
                  onTabChange(tab.id)
                }
                e.stopPropagation()
              }}
              className={`
                flex items-center gap-2 px-4 py-3 
                text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors
                ${isActive
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                }
                ${tab.isNSFW ? 'text-red-400 hover:text-red-300' : ''}
              `}
            >
              {tab.isBookmarksTab && (
                <Heart size={14} className={isActive ? 'text-red-500 fill-current' : ''} />
              )}
              {tab.isNSFW && (
                <Lock size={14} className="text-red-400" />
              )}
              {tab.title}
              {tab.isNSFW && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded">
                  <ShieldAlert size={10} />
                  18+
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
