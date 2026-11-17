import { Section } from '@/shared/lib/types'
import { SectionItemLikesProvider } from '@/shared/contexts/SectionItemLikesContext'
import {
  TextBlock,
  ImageBlock,
  GalleryBlock,
  CarouselBlock,
  QuoteBlock,
  DividerBlock,
  LinksBlock,
  AudioBlock,
} from './blocks'

interface Props {
  section: Section
}

export default function BlockSection({ section }: Props) {
  // Sort blocks by position
  const sortedBlocks = [...section.blocks].sort((a, b) => a.position - b.position)

  return (
    <SectionItemLikesProvider sectionId={section.id}>
      <div className="space-y-6">
        <h2 className="text-2xl font-serif mb-6">{section.title}</h2>
      
        {sortedBlocks.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No content yet</p>
        ) : (
          <div className="space-y-6">
            {sortedBlocks.map((block) => (
              <div key={block.id}>
                {block.type === 'text' && <TextBlock block={block} />}
                {block.type === 'image' && <ImageBlock block={block} />}
                {block.type === 'gallery' && <GalleryBlock block={block} />}
                {block.type === 'carousel' && <CarouselBlock block={block} />}
                {block.type === 'quote' && <QuoteBlock block={block} />}
                {block.type === 'divider' && <DividerBlock block={block} />}
                {block.type === 'links' && <LinksBlock block={block} />}
                {block.type === 'audio' && <AudioBlock block={block} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionItemLikesProvider>
  )
}
