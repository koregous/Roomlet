'use client'

import { useState, useRef, useEffect } from 'react'
import { Eye } from 'lucide-react'

interface Props {
  backgroundUrl: string
  type: 'video' | 'gif' | 'image'
  posterUrl?: string | null
  isNSFW: boolean
  profileNSFW: boolean
}

export default function ProfileBackgroundLayer({
  backgroundUrl,
  type,
  posterUrl,
  isNSFW,
  profileNSFW
}: Props) {
  const [revealed, setRevealed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Check user's NSFW preferences (for now, always show - TODO: integrate with user settings)
  const userAllowsNSFW = true // TODO: Get from user context/settings
  const shouldBlur = isNSFW && !userAllowsNSFW && !revealed

  // Lazy loading with Intersection Observer
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        
        // Pause video when not in view (performance optimization)
        if (type === 'video' && videoRef.current) {
          if (entry.isIntersecting) {
            videoRef.current.play().catch(() => {
              // Autoplay might fail, that's ok
            })
          } else {
            videoRef.current.pause()
          }
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [type])

  const handleReveal = () => {
    setRevealed(true)
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Background media (only load when visible) */}
      {isVisible && (
        <>
          {type === 'video' && (
            <video
              ref={videoRef}
              src={backgroundUrl}
              poster={posterUrl || undefined}
              autoPlay
              loop
              muted
              playsInline
              className={`w-full h-full object-cover ${shouldBlur ? 'blur-[40px] scale-110' : ''}`}
              style={{ transition: 'filter 0.3s ease-in-out' }}
            />
          )}
          
          {(type === 'gif' || type === 'image') && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className={`w-full h-full object-cover ${shouldBlur ? 'blur-[40px] scale-110' : ''}`}
              style={{ transition: 'filter 0.3s ease-in-out' }}
            />
          )}
        </>
      )}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80" />

      {/* NSFW blur overlay with click-to-reveal */}
      {shouldBlur && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer group z-10"
          onClick={handleReveal}
        >
          <div className="backdrop-blur-sm bg-black/60 rounded-2xl px-8 py-6 border-2 border-red-500/30 group-hover:border-red-500/60 transition-all group-hover:scale-105">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-red-500/20 rounded-full group-hover:bg-red-500/30 transition-colors">
                <Eye size={32} className="text-red-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-1">
                  {profileNSFW ? 'NSFW Profile' : 'NSFW Background'}
                </h3>
                <p className="text-gray-300 text-sm">
                  This {profileNSFW ? 'profile contains' : 'background may contain'} sensitive content
                </p>
                <p className="text-gray-400 text-xs mt-2 group-hover:text-gray-300 transition-colors">
                  Click to reveal
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
