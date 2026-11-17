'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Smooth scroll provider using Lenis
 * Only enabled on public profile pages (desktop only)
 */
export default function SmoothScroll() {
  const pathname = usePathname()

  useEffect(() => {
    // Only enable on public profile pages (not dashboard, not mobile)
    const isPublicProfile = pathname.startsWith('/') && 
                            pathname !== '/' && 
                            !pathname.startsWith('/dashboard') &&
                            !pathname.startsWith('/login') &&
                            !pathname.startsWith('/signup')

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const isDesktop = !isMobile && window.innerWidth >= 1024

    if (!isPublicProfile || !isDesktop) {
      return
    }

    // Dynamically import Lenis (code-split, not in main bundle)
    import('@studio-freight/lenis').then(({ default: Lenis }) => {
      const lenis = new Lenis({
        lerp: 0.05,              // Smooth but responsive
        duration: 1.5,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.7,    // Not too slow
        infinite: false,
      })

      // Add class to HTML
      document.documentElement.classList.add('lenis', 'lenis-smooth')

      // Animation loop
      function raf(time: number) {
        lenis.raf(time)
        requestAnimationFrame(raf)
      }

      const rafId = requestAnimationFrame(raf)

      // Cleanup on unmount or route change
      return () => {
        cancelAnimationFrame(rafId)
        lenis.destroy()
        document.documentElement.classList.remove('lenis', 'lenis-smooth')
      }
    })
  }, [pathname])

  return null
}
