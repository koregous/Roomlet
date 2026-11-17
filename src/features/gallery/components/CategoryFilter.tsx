'use client'

import { Category } from '@/shared/lib/types'
import { useState } from 'react'
import { getCategoryIcon } from '@/shared/lib/category-icons'

interface Props {
  categories: Category[]
  selectedCategory?: string
  onCategoryChange: (categoryId: string | undefined) => void
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onCategoryChange(undefined)}
        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
          !selectedCategory
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        All Categories
      </button>

      {categories.map((category) => {
        const CategoryIcon = getCategoryIcon(category.slug)
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <CategoryIcon className="w-4 h-4" />
            <span>{category.name}</span>
          </button>
        )
      })}
    </div>
  )
}
