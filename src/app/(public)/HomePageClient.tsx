'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PublishedSection } from '@/shared/lib/types'
import { useNSFWPreferences } from '@/shared/lib/nsfw-preferences'
import CreatorCard from '@/features/gallery/components/CreatorCard'
import CinemaCarousel from '@/features/gallery/components/CinemaCarousel'

interface Creator {
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  sections: PublishedSection[]
}

interface Props {
  carouselSections: PublishedSection[]
  creators: Creator[]
}

export default function HomePageClient({ carouselSections, creators }: Props) {
  const { isEnabled: nsfwEnabled } = useNSFWPreferences()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter NSFW content based on user preference
  // Default: hide NSFW for anonymous users and users with NSFW disabled
  const filteredCarouselSections = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      return carouselSections.filter(s => !s.is_nsfw)
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return carouselSections
  }, [carouselSections, nsfwEnabled, mounted])

  const filteredCreators = useMemo(() => {
    // Always hide NSFW by default for anonymous users
    if (!mounted || !nsfwEnabled) {
      // Filter NSFW sections from each creator
      return creators.map(creator => ({
        ...creator,
        sections: creator.sections.filter(s => !s.is_nsfw)
      })).filter(creator => creator.sections.length > 0) // Remove creators with no SFW sections
    }
    // Show all content only if user is logged in AND has NSFW enabled
    return creators
  }, [creators, nsfwEnabled, mounted])

  return (
    <div className="min-h-screen bg-black">
      <section className="max-w-4xl mx-auto px-4 pt-32 pb-24 text-center">
        <h1 className="text-6xl md:text-7xl font-serif font-semibold text-white leading-tight mb-6 mobile-hero-text">
          Build beautiful collections<br />around anything you care about
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed mobile-hero-subtext">
          Create curated collections, not endless posts. Turn your photos, projects, artwork, travels, and interests into showcase pages.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-4 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition text-lg"
          >
            Create Collection
          </Link>
          <Link
            href="/gallery"
            className="px-8 py-4 border border-gray-700 text-white font-medium rounded-lg hover:border-gray-500 transition text-lg"
          >
            Explore Gallery
          </Link>
        </div>
      </section>

      {filteredCarouselSections.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-semibold text-white mb-3">
              See what people are creating
            </h2>
            <p className="text-gray-400">
              Real collections from the community
            </p>
          </div>
          <CinemaCarousel sections={filteredCarouselSections} />
        </section>
      )}

      <section className="max-w-4xl mx-auto px-4 py-20 border-t border-gray-900">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif font-semibold text-white mb-4">
            One profile. Multiple collections.
          </h2>
          <p className="text-gray-400 text-lg">
            Each collection can be published independently to the gallery
          </p>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
            <div>
              <div className="font-semibold text-white">yourname</div>
              <div className="text-sm text-gray-500">roomlet.app/yourname</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="text-2xl">📸</div>
              <div className="flex-1">
                <div className="font-medium text-white">Travel Photos 2026</div>
                <div className="text-xs text-gray-500">Published to Gallery</div>
              </div>
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                Public
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="text-2xl">🎨</div>
              <div className="flex-1">
                <div className="font-medium text-white">Design Portfolio</div>
                <div className="text-xs text-gray-500">Published to Gallery</div>
              </div>
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                Public
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="text-2xl">🎮</div>
              <div className="flex-1">
                <div className="font-medium text-white">Game Dev Projects</div>
                <div className="text-xs text-gray-500">Draft</div>
              </div>
              <div className="px-3 py-1 bg-gray-500/10 border border-gray-500/20 rounded text-xs text-gray-400">
                Private
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="text-2xl">✍️</div>
              <div className="flex-1">
                <div className="font-medium text-white">About Me</div>
                <div className="text-xs text-gray-500">Personal page</div>
              </div>
              <div className="px-3 py-1 bg-gray-500/10 border border-gray-500/20 rounded text-xs text-gray-400">
                Private
              </div>
            </div>
          </div>
        </div>
      </section>

      {filteredCreators.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-20 border-t border-gray-900">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-semibold text-white mb-4">
              Featured Profiles
            </h2>
            <p className="text-gray-400">
              See how others are using Roomlet
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {filteredCreators.map((creator) => (
              <CreatorCard key={creator.username} creator={creator} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              Explore all collections →
            </Link>
          </div>
        </section>
      )}

      {/* Why Roomlet - Comparison */}
      <section className="max-w-4xl mx-auto px-4 py-20 border-t border-gray-900">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-semibold text-white mb-4">
            Your interests deserve more<br />than a single post
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-3 px-4 text-sm font-medium text-gray-500">Platform</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-500">Best for</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800/50">
                <td className="py-4 px-4 text-gray-400">Instagram</td>
                <td className="py-4 px-4">Sharing updates</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-4 px-4 text-gray-400">Pinterest</td>
                <td className="py-4 px-4">Saving ideas</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-4 px-4 text-white font-medium">Roomlet</td>
                <td className="py-4 px-4 text-white">Curating collections</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-serif font-semibold text-white mb-6">
          Build your first collection today
        </h2>
        <p className="text-gray-400 mb-10 text-lg">
          Start showcasing what matters to you in minutes
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition text-lg"
        >
          Create Collection
        </Link>
      </section>

      <footer className="border-t border-gray-900 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Roomlet. Curate your corner of the internet.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/gallery" className="text-gray-400 hover:text-white transition">
                Gallery
              </Link>
              <Link href="/login" className="text-gray-400 hover:text-white transition">
                Login
              </Link>
              <Link href="/signup" className="text-gray-400 hover:text-white transition">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
