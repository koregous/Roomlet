import { Block } from '@/shared/lib/types'

interface Props {
  block: Block
}

export default function QuoteBlock({ block }: Props) {
  const quote = block.content.quote
  const author = block.content.author
  const style = block.content.quoteStyle || 'minimal' // default style

  if (!quote) {
    return null
  }

  // Minimal style (current default)
  if (style === 'minimal') {
    return (
      <blockquote className="border-l-4 border-gray-700 pl-6 py-4 my-4 bg-gray-900/30">
        <p className="text-lg text-gray-300 italic leading-relaxed mb-2">
          "{quote}"
        </p>
        {author && (
          <cite className="text-sm text-gray-500 not-italic">
            — {author}
          </cite>
        )}
      </blockquote>
    )
  }

  // Boxed style - full border, centered
  if (style === 'boxed') {
    return (
      <blockquote className="border-2 border-gray-700 p-8 my-6 text-center bg-gray-900/20">
        <p className="text-xl text-gray-200 italic leading-relaxed mb-3">
          "{quote}"
        </p>
        {author && (
          <cite className="text-sm text-gray-400 not-italic font-medium">
            — {author}
          </cite>
        )}
      </blockquote>
    )
  }

  // Accent style - background color, large quote marks
  if (style === 'accent') {
    return (
      <blockquote className="relative bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 p-8 my-6">
        {/* Large opening quote mark */}
        <div className="absolute top-4 left-4 text-6xl text-gray-700 leading-none font-serif">
          "
        </div>
        <div className="relative z-10 pl-8">
          <p className="text-lg text-gray-200 leading-relaxed mb-3">
            {quote}
          </p>
          {author && (
            <cite className="text-sm text-gray-400 not-italic font-medium">
              — {author}
            </cite>
          )}
        </div>
        {/* Large closing quote mark */}
        <div className="absolute bottom-4 right-4 text-6xl text-gray-700 leading-none font-serif">
          "
        </div>
      </blockquote>
    )
  }

  // Card style - elevated with shadow
  if (style === 'card') {
    return (
      <blockquote className="bg-black border border-gray-800 shadow-xl p-8 my-6 rounded-lg">
        <div className="flex gap-4">
          {/* Quote icon */}
          <div className="shrink-0 text-gray-600">
            <svg
              className="w-8 h-8"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-lg text-gray-200 leading-relaxed mb-3">
              {quote}
            </p>
            {author && (
              <cite className="text-sm text-gray-500 not-italic">
                — {author}
              </cite>
            )}
          </div>
        </div>
      </blockquote>
    )
  }

  // Fallback to minimal
  return (
    <blockquote className="border-l-4 border-gray-700 pl-6 py-4 my-4 bg-gray-900/30">
      <p className="text-lg text-gray-300 italic leading-relaxed mb-2">
        "{quote}"
      </p>
      {author && (
        <cite className="text-sm text-gray-500 not-italic">
          — {author}
        </cite>
      )}
    </blockquote>
  )
}
