import { Block } from '@/shared/lib/types'

interface Props {
  block: Block
}

export default function DividerBlock({ block }: Props) {
  const style = block.content.dividerStyle || 'line'
  const spacing = block.content.spacing || 'medium' // small, medium, large

  const spacingClass = {
    small: 'my-4',
    medium: 'my-6',
    large: 'my-12',
  }[spacing] || 'my-6'

  if (style === 'line') {
    return <hr className={`border-t border-gray-600 ${spacingClass}`} />
  }

  if (style === 'dots') {
    return (
      <div className={`flex justify-center items-center gap-2 ${spacingClass}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
      </div>
    )
  }

  if (style === 'stars') {
    return (
      <div className={`flex justify-center items-center gap-3 text-gray-500 text-lg ${spacingClass}`}>
        <span>⭐</span>
        <span>⭐</span>
        <span>⭐</span>
      </div>
    )
  }

  if (style === 'wave') {
    return (
      <div className={`flex justify-center ${spacingClass}`}>
        <svg
          className="w-32 h-4 text-gray-500"
          viewBox="0 0 100 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 5 Q 12.5 0, 25 5 T 50 5 T 75 5 T 100 5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    )
  }

  if (style === 'gradient') {
    return (
      <div className={`${spacingClass}`}>
        <div className="h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent" />
      </div>
    )
  }

  if (style === 'dashed') {
    return <hr className={`border-t border-dashed border-gray-500 ${spacingClass}`} />
  }

  if (style === 'double') {
    return (
      <div className={`space-y-1 ${spacingClass}`}>
        <hr className="border-t border-gray-600" />
        <hr className="border-t border-gray-600" />
      </div>
    )
  }

  // Fallback to line
  return <hr className={`border-t border-gray-600 ${spacingClass}`} />
}
