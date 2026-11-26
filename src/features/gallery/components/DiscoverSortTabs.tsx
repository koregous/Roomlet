'use client'

import Link from 'next/link'
import { Clock, Heart, Shuffle } from 'lucide-react'
import { useState } from 'react'

interface Props {
  currentSort: string
  categorySlug?: string
  onRandomClick?: () => void
}

export default function DiscoverSortTabs({ currentSort, categorySlug, onRandomClick }: Props) {
  const buildHref = (sort: string) => {
    const params = new URLSearchParams()
    if (sort !== 'recent') params.set('sort', sort)
    if (categorySlug) params.set('category', categorySlug)
    const query = params.toString()
    return `/discover-list${query ? `?${query}` : ''}`
  }

  const tabs = [
    { key: 'recent', label: 'Recent', icon: Clock, description: 'Latest published' },
    { key: 'bookmarked', label: 'Most Bookmarked', icon: Heart, description: 'Most bookmarked collections' },
    { key: 'random', label: 'Random', icon: Shuffle, description: 'Discover something new' },
  ]

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = currentSort === tab.key
          
          // Random button needs special handling to re-shuffle
          if (tab.key === 'random' && onRandomClick) {
            return (
              <button
                key={tab.key}
                onClick={onRandomClick}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            )
          }
          
          return (
            <Link
              key={tab.key}
              href={buildHref(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
