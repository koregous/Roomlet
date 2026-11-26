'use client'

import { Block } from '@/shared/lib/types'
import { useState } from 'react'
import { AlertCircle, ExternalLink } from 'lucide-react'

interface Props {
  block: Block
  isEditing?: boolean
  onChange?: (updates: Partial<Block['content']>) => void
}

export default function EmbedBlock({ block, isEditing = false, onChange }: Props) {
  const [loadError, setLoadError] = useState(false)
  const { embedUrl, embedHtml, aspectRatio = '16/9', height = 400, embedType } = block.content

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-400 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
          <p className="mb-2">📎 Embed Block</p>
          {embedType && (
            <p className="text-xs text-gray-500 capitalize">Type: {embedType}</p>
          )}
          {embedUrl && (
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-2"
            >
              View source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="relative bg-black rounded-lg overflow-hidden border border-gray-800">
          <EmbedPreview
            embedUrl={embedUrl}
            embedHtml={embedHtml}
            aspectRatio={aspectRatio}
            height={height}
            embedType={embedType}
            onError={() => setLoadError(true)}
          />
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
              <div className="text-center p-4">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">Failed to load embed</p>
                <p className="text-xs text-gray-500 mt-1">Check the URL or try again</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // View mode
  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <EmbedPreview
        embedUrl={embedUrl}
        embedHtml={embedHtml}
        aspectRatio={aspectRatio}
        height={height}
        embedType={embedType}
        onError={() => setLoadError(true)}
      />
      {loadError && (
        <div className="flex items-center justify-center bg-gray-900 p-8 min-h-[200px]">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Embed unavailable</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EmbedPreview({
  embedUrl,
  embedHtml,
  aspectRatio,
  height,
  embedType,
  onError,
}: {
  embedUrl?: string
  embedHtml?: string
  aspectRatio: string
  height: number
  embedType?: string
  onError: () => void
}) {
  // Use custom HTML if provided
  if (embedHtml) {
    return (
      <div
        className="w-full"
        style={{ height: aspectRatio === 'auto' ? `${height}px` : 'auto' }}
        dangerouslySetInnerHTML={{ __html: embedHtml }}
      />
    )
  }

  // Use URL for iframe
  if (embedUrl) {
    const aspectRatioStyle = aspectRatio !== 'auto' ? `aspect-[${aspectRatio.replace('/', '-')}]` : ''

    return (
      <div className={aspectRatioStyle || ''} style={aspectRatio === 'auto' ? { height: `${height}px` } : {}}>
        <iframe
          src={embedUrl}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          onError={onError}
          sandbox={
            embedType === 'youtube' ||
            embedType === 'spotify' ||
            embedType === 'vimeo' ||
            embedType === 'twitter' ||
            embedType === 'soundcloud' ||
            embedType === 'codepen' ||
            embedType === 'roomlet'
              ? undefined
              : 'allow-scripts allow-same-origin allow-popups allow-forms'
          }
        />
      </div>
    )
  }

  return (
    <div className="bg-gray-900 p-8 text-center text-gray-500 min-h-[200px] flex items-center justify-center">
      <p className="text-sm">No embed configured</p>
    </div>
  )
}
