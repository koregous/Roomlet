'use client'

import { useEffect, useState } from 'react'

/**
 * ScrollProgress - Shows reading progress for long sections
 * 
 * Displays a fixed progress bar at the top of the viewport
 * that fills as the user scrolls through the content.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      // Calculate scroll progress
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = (scrollTop / docHeight) * 100

      setProgress(Math.min(100, Math.max(0, scrollPercent)))
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    
    // Initial calculation
    updateProgress()

    return () => window.removeEventListener('scroll', updateProgress)
  }, [])

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-1 bg-gray-900/50 z-50"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
