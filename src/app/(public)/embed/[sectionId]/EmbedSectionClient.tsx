'use client'

import { Section } from '@/shared/lib/types'
import TextBlock from '@/features/sections/components/blocks/TextBlock'
import ImageBlock from '@/features/sections/components/blocks/ImageBlock'
import GalleryBlock from '@/features/sections/components/blocks/GalleryBlock'
import CarouselBlock from '@/features/sections/components/blocks/CarouselBlock'
import QuoteBlock from '@/features/sections/components/blocks/QuoteBlock'
import DividerBlock from '@/features/sections/components/blocks/DividerBlock'
import LinksBlock from '@/features/sections/components/blocks/LinksBlock'
import AudioBlock from '@/features/sections/components/blocks/AudioBlock'
import EmbedBlock from '@/features/sections/components/blocks/EmbedBlock'
import { ExternalLink } from 'lucide-react'

interface Props {
  section: Section
  creator: {
    username: string
    display_name: string
    avatar_url: string
  }
  theme: 'light' | 'dark'
}

export default function EmbedSectionClient({ section, creator, theme }: Props) {
  const sectionUrl = `${window.location.origin}/${creator.username}/${encodeURIComponent(section.title.toLowerCase().replace(/\s+/g, '-'))}`

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header with attribution */}
        <div className="mb-6 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {creator.avatar_url && (
                <img
                  src={creator.avatar_url}
                  alt={creator.display_name || creator.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                  {section.title}
                </h1>
                <p className="text-sm text-gray-500">
                  by {creator.display_name || creator.username}
                </p>
              </div>
            </div>
            
            {/* View Full Section link */}
            <a
              href={sectionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                theme === 'light'
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              <span className="text-sm font-medium">View Full</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Section blocks */}
        <div className="space-y-6">
          {section.blocks
            .sort((a, b) => a.position - b.position)
            .map((block) => {
              switch (block.type) {
                case 'text':
                  return <TextBlock key={block.id} block={block} />
                case 'image':
                  return <ImageBlock key={block.id} block={block} />
                case 'gallery':
                  return <GalleryBlock key={block.id} block={block} />
                case 'carousel':
                  return <CarouselBlock key={block.id} block={block} />
                case 'quote':
                  return <QuoteBlock key={block.id} block={block} />
                case 'divider':
                  return <DividerBlock key={block.id} block={block} />
                case 'links':
                  return <LinksBlock key={block.id} block={block} />
                case 'audio':
                  return <AudioBlock key={block.id} block={block} />
                case 'embed':
                  return <EmbedBlock key={block.id} block={block} />
                default:
                  return null
              }
            })}
        </div>

        {/* Footer attribution */}
        <div className={`mt-8 pt-6 border-t ${theme === 'light' ? 'border-gray-200' : 'border-gray-800'} text-center`}>
          <p className="text-sm text-gray-500">
            Powered by{' '}
            <a
              href={window.location.origin}
              target="_blank"
              rel="noopener noreferrer"
              className={theme === 'light' ? 'text-black hover:underline' : 'text-white hover:underline'}
            >
              Roomlet
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
