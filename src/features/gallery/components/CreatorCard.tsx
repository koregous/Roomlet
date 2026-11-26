import Link from 'next/link'
import { PublishedSection } from '@/shared/lib/types'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import PremiumBadge from '@/shared/components/PremiumBadge'
import PremiumCrown from '@/shared/components/PremiumCrown'

interface Creator {
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url?: string | null
  bio: string | null
  sections: PublishedSection[]
  is_premium?: boolean
}

interface CreatorCardProps {
  creator: Creator
}

export default function CreatorCard({ creator }: CreatorCardProps) {
  return (
    <div className="group border border-gray-800 rounded-lg bg-gray-900/30 hover:border-gray-700 transition-all hover:scale-[1.02]">
      <Link href={`/${creator.username}`} className="block">
        {/* Banner + Avatar wrapper — relative, NO overflow-hidden here */}
        <div className="relative">
          {/* Banner (only this clips) */}
          {creator.banner_url ? (
            <div className="h-32 rounded-t-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
              <img
                src={creator.banner_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-32 rounded-t-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20" />
          )}

          {/* Avatar — absolutely positioned, out of the clipped flow */}
          <div className="absolute left-6 -bottom-10 z-10">
            <div className="relative">
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.display_name || creator.username}
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-900 bg-gray-900"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-2xl border-4 border-gray-900">
                  {(creator.display_name || creator.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Content — pt-12 replaces the old -mt-10 trick */}
        <div className="px-6 pt-12 pb-6 rounded-b-lg">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-white group-hover:text-blue-400 transition text-lg">
                {creator.display_name || creator.username}
              </div>
              {creator.is_premium && <PremiumCrown size="sm" variant="check" />}
            </div>
            <div className="text-sm text-gray-500">@{creator.username}</div>
          </div>

          {creator.bio && (
            <p className="text-sm text-gray-400 mb-4 line-clamp-2 leading-relaxed">
              {creator.bio}
            </p>
          )}

          {creator.sections.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {creator.sections.slice(0, 4).map((section) => {
                const CategoryIcon = getCategoryIcon(section.category.slug)
                return (
                  <div
                    key={section.id}
                    className="px-3 py-1.5 bg-black/50 border border-gray-800 rounded-full text-xs text-gray-300 flex items-center gap-1.5"
                  >
                    <CategoryIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[120px]">{section.title}</span>
                  </div>
                )
              })}
              {creator.sections.length > 4 && (
                <div className="px-3 py-1.5 bg-black/50 border border-gray-800 rounded-full text-xs text-gray-500">
                  +{creator.sections.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
