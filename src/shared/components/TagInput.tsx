'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Plus, Hash } from 'lucide-react'
import { Tag } from '@/shared/lib/types'

interface TagInputProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: string[]
  popularTags?: string[]
  maxTags?: number
  placeholder?: string
  className?: string
}

export default function TagInput({
  selectedTags = [],
  onTagsChange,
  suggestions = [],
  popularTags = [],
  maxTags = 10,
  placeholder = 'Add tags...',
  className = ''
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = [
    ...suggestions,
    ...popularTags
  ]
    .filter(tag => 
      !selectedTags.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
    )
    .slice(0, 8) // Max 8 suggestions shown

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (
      trimmed &&
      !selectedTags.includes(trimmed) &&
      selectedTags.length < maxTags
    ) {
      onTagsChange([...selectedTags, trimmed])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(selectedTags[selectedTags.length - 1])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium transition-colors"
            >
              <Hash className="w-3 h-3" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedTags.length < maxTags && (
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
            <Hash className="w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={placeholder}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => addTag(inputValue)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Add tag"
              >
                <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            )}
          </div>

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <div className="p-2">
                {suggestions.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Suggested
                    </div>
                    {suggestions
                      .filter(tag => !selectedTags.includes(tag))
                      .slice(0, 5)
                      .map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            addTag(tag)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                          <Hash className="w-3 h-3 text-blue-500" />
                          <span className="text-gray-900 dark:text-white">{tag}</span>
                          <span className="ml-auto text-xs text-gray-400">suggested</span>
                        </button>
                      ))}
                  </>
                )}

                {popularTags.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Popular
                    </div>
                    {popularTags
                      .filter(tag => 
                        !selectedTags.includes(tag) &&
                        !suggestions.includes(tag) &&
                        tag.toLowerCase().includes(inputValue.toLowerCase())
                      )
                      .slice(0, 5)
                      .map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            addTag(tag)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                          <Hash className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-900 dark:text-white">{tag}</span>
                        </button>
                      ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {selectedTags.length}/{maxTags} tags • Press Enter to add • Click to remove
      </p>
    </div>
  )
}
