'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Eye } from 'lucide-react'
import type { BackgroundSlide } from '@/shared/lib/background-slides'

/** Crossfade duration between slides */
const FADE_MS = 1200

interface Props {
  /** One slide = static background (or a single video). Two or more = crossfading slideshow */
  slides: BackgroundSlide[]
  /** Seconds each slide is shown (slideshow only) */
  intervalSeconds?: number
  /** Poster frame for a single video background */
  posterUrl?: string | null
  isNSFW: boolean
  profileNSFW: boolean
}

export default function ProfileBackgroundLayer({
  slides,
  intervalSeconds = 8,
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

  // Slideshow state
  const count = slides.length
  const [current, setCurrent] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)

  // People who ask their OS for less motion get the first slide, static
  const isSlideshow = count > 1 && !reducedMotion
  const firstSlide = slides[0]

  // Start from the first slide again whenever the set of slides changes
  useEffect(() => {
    setCurrent(0)
  }, [count, firstSlide?.url])

  // Respect prefers-reduced-motion
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Don't burn CPU/battery cycling slides in a background tab
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)

        // Pause video when not in view (performance optimization)
        if (firstSlide?.type === 'video' && videoRef.current) {
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
  }, [firstSlide?.type])

  // Advance the slideshow
  useEffect(() => {
    if (!isSlideshow || !isVisible || !tabVisible) return

    const id = window.setInterval(
      () => setCurrent(c => (c + 1) % count),
      Math.max(3, intervalSeconds) * 1000
    )
    return () => window.clearInterval(id)
  }, [isSlideshow, isVisible, tabVisible, count, intervalSeconds])

  // Only the previous, current and next slides are mounted at once. The next one
  // loads invisibly (opacity 0) so the crossfade never waits on the network, and
  // memory stays bounded even with five large images.
  const mountedIndexes = useMemo(() => {
    if (!isSlideshow) return [0]
    return Array.from(
      new Set([(current - 1 + count) % count, current, (current + 1) % count])
    ).sort((a, b) => a - b)
  }, [isSlideshow, current, count])

  const handleReveal = () => {
    setRevealed(true)
  }

  if (!firstSlide) return null

  const mediaClass = `w-full h-full object-cover ${shouldBlur ? 'blur-[40px] scale-110' : ''}`

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Background media (only load when visible) */}
      {isVisible && (
        <>
          {!isSlideshow && firstSlide.type === 'video' && (
            <video
              ref={videoRef}
              src={firstSlide.url}
              poster={posterUrl || undefined}
              autoPlay
              loop
              muted
              playsInline
              className={mediaClass}
              style={{ transition: 'filter 0.3s ease-in-out' }}
            />
          )}

          {!isSlideshow && firstSlide.type !== 'video' && (
            <img
              src={firstSlide.url}
              alt="Profile background"
              className={mediaClass}
              style={{ transition: 'filter 0.3s ease-in-out' }}
            />
          )}

          {isSlideshow &&
            mountedIndexes.map(index => (
              <img
                key={slides[index].url}
                src={slides[index].url}
                alt=""
                aria-hidden="true"
                decoding="async"
                className={`absolute inset-0 ${mediaClass}`}
                style={{
                  opacity: index === current ? 1 : 0,
                  transition: `opacity ${FADE_MS}ms ease-in-out, filter 0.3s ease-in-out`,
                }}
              />
            ))}
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
