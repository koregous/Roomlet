import { Crown } from 'lucide-react'

interface PremiumCrownProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'crown' | 'check'
}

export default function PremiumCrown({ 
  size = 'md',
  variant = 'check'
}: PremiumCrownProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 16,
  }

  // Check badge variant (scalloped edge badge like Twitch verified)
  if (variant === 'check') {
    return (
      <div 
        className={`
          inline-flex ${sizeClasses[size]}
          bg-white
          items-center justify-center
          border border-gray-300
          shadow-lg shadow-black/20
          relative
        `}
        title="Premium Member"
        style={{
          clipPath: 'polygon(50% 0%, 61% 10%, 80% 10%, 90% 21%, 90% 39%, 100% 50%, 90% 61%, 90% 80%, 79% 90%, 61% 90%, 50% 100%, 39% 90%, 21% 90%, 10% 79%, 10% 61%, 0% 50%, 10% 39%, 10% 20%, 21% 10%, 39% 10%)',
        }}
      >
        <svg
          width={iconSizes[size]}
          height={iconSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="black"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative z-10"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }

  // Crown variant (on avatar)
  return (
    <div 
      className={`
        absolute top-1 right-0 ${sizeClasses[size]}
        bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600
        rounded-full
        flex items-center justify-center
        border-2 border-black
        shadow-lg shadow-yellow-500/40
        rotate-[25deg]
        transition-transform duration-200
        hover:scale-110 hover:rotate-[15deg]
        z-10
      `}
      title="Premium Member"
      style={{
        transform: 'rotate(25deg) translateY(-2px)',
      }}
    >
      <Crown 
        size={iconSizes[size]} 
        className="text-yellow-900"
        fill="currentColor"
        strokeWidth={0}
        style={{
          transform: 'rotate(-5deg)',
        }}
      />
    </div>
  )
}
