import { Sparkles } from 'lucide-react'

interface PremiumBadgeProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'gradient' | 'solid' | 'outline'
  showIcon?: boolean
}

export default function PremiumBadge({ 
  size = 'sm', 
  variant = 'gradient',
  showIcon = true 
}: PremiumBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  }

  const variantClasses = {
    gradient: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
    solid: 'bg-purple-600 text-white',
    outline: 'border border-purple-600 text-purple-400 bg-purple-600/10',
  }

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  }

  return (
    <span 
      className={`
        inline-flex items-center gap-1 
        ${sizeClasses[size]} 
        ${variantClasses[variant]}
        rounded-full font-medium
        transition-all duration-200
        hover:scale-105
      `}
      title="Premium Member"
    >
      {showIcon && <Sparkles size={iconSizes[size]} className="shrink-0" />}
      <span>Premium</span>
    </span>
  )
}
