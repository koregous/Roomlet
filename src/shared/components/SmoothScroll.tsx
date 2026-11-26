'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Smooth scroll provider using Lenis.
 * Only enabled on public profile pages (desktop only).
 *
 * NOTE: the cleanup MUST be returned from the effect itself. Previously it was
 * returned from inside the dynamic import's .then(), so React never called it:
 * every route change leaked another Lenis instance + requestAnimationFrame loop,
 * which made the app slower the longer you navigated.
 */
const APP_PREFIXES = ['/dashboard', '/admin', '/login', '/signup', '/premium', '/embed']

export default function SmoothScroll() {
  const pathname = usePathname()

  useEffect(() => {
    const isPublicProfile =
      pathname !== '/' && !APP_PREFIXES.some((p) => pathname.startsWith(p))
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const isDesktop = !isMobile && window.innerWidth >= 1024
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!isPublicProfile || !isDesktop || reduceMotion) return

    let cancelled = false
    let rafId = 0
    let destroy: (() => void) | null = null

    import('@studio-freight/lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      const lenis = new Lenis({
        lerp: 0.05,
        duration: 1.5,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.7,
        infinite: false,
      })
      document.documentElement.classList.add('lenis', 'lenis-smooth')

      const raf = (time: number) => {
        lenis.raf(time)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)

      destroy = () => {
        cancelAnimationFrame(rafId)
        lenis.destroy()
        document.documentElement.classList.remove('lenis', 'lenis-smooth')
      }
    })

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [pathname])

  return null
}
