// Existing types
export type BackgroundSlideType = 'video' | 'gif' | 'image'

export interface BackgroundSlide {
  url: string
  type: BackgroundSlideType
  size: number // bytes (0 = unknown, e.g. backfilled legacy backgrounds)
}

export interface Profile {
  id: string
  user_id: string // Auth user ID - different from profiles.id
  username: string
  display_name?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  theme?: string
  bookmarks_public?: boolean
  created_at: string
  updated_at: string
  // Premium fields
  is_premium?: boolean
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  subscription_start_date?: string | null
  // NSFW fields
  is_nsfw?: boolean // Profile-wide NSFW flag
  // Premium background fields
  profile_background_url?: string | null
  profile_background_type?: 'video' | 'gif' | 'image' | null
  background_is_nsfw?: boolean
  profile_background_poster_url?: string | null
  // Slideshow: ordered list (max 5). Slide #1 is mirrored into profile_background_url/_type
  profile_background_slides?: BackgroundSlide[]
  profile_background_interval_seconds?: number
}

export interface Section {
  id: string
  profile_id: string
  title: string
  blocks: Block[]
  position: number
  visible: boolean
  created_at: string
  updated_at: string
  // Gallery Discovery fields
  published?: boolean
  published_at?: string | null
  category_id?: string | null
  view_count?: number
  last_viewed_at?: string | null
  is_nsfw?: boolean
  // Tags
  tags?: Tag[]
  // Approval System fields
  approval_status?: 'draft' | 'pending' | 'approved' | 'rejected'
  submitted_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  rejection_reason?: string | null
  admin_notes?: string | null
}

export interface Block {
  id: string
  type: BlockType
  content: BlockContent
  position: number
}

export type BlockType =
  | 'text'
  | 'image'
  | 'gallery'
  | 'carousel'
  | 'quote'
  | 'divider'
  | 'links'
  | 'audio'
  | 'embed'

export interface BlockContent {
  // Text block
  text?: string

  // Image block
  image?: {
    url: string
    caption?: string
    alt?: string
  }

  // Gallery block
  images?: Array<{
    url: string
    caption?: string
    altText?: string
  }>
  columns?: 2 | 3 | 4
  aspectRatio?: 'auto' | '1/1' | '3/2' | '16/9' | '4/3' | string
  sortOrder?: 'newest' | 'oldest' | 'custom'

  // Carousel block
  showDots?: boolean
  carouselAutoPlay?: boolean
  autoPlay?: boolean
  interval?: number

  // Quote block
  quote?: string
  author?: string
  quoteStyle?: 'minimal' | 'boxed' | 'accent' | 'card'

  // Divider block
  dividerStyle?: 'line' | 'dashed' | 'double' | 'dots' | 'stars' | 'wave' | 'gradient'
  spacing?: 'small' | 'medium' | 'large'

  // Links block
  links?: Array<{
    title: string
    url: string
    icon?: string
    iconUrl?: string
  }>

  // Audio block
  audioUrl?: string
  audioTitle?: string
  audioArtist?: string
  audioCoverUrl?: string
  audioAutoPlay?: boolean
  loop?: boolean
  volume?: number

  // Embed block
  embedUrl?: string
  embedType?: 'youtube' | 'spotify' | 'twitter' | 'vimeo' | 'soundcloud' | 'codepen' | 'roomlet' | 'generic'
  embedHtml?: string // For custom iframe HTML
  height?: number // Custom height in pixels
}

// Gallery Discovery types
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  position: number
  created_at: string
  updated_at: string
}

export interface PublishedSection {
  id: string
  title: string
  blocks: Block[]
  view_count: number
  published_at: string
  updated_at?: string
  is_nsfw: boolean
  creator: {
    username: string
    display_name?: string
    avatar_url?: string
  }
  category: {
    id: string
    name: string
    slug: string
    icon?: string
  }
}

export interface Report {
  id: string
  section_id: string
  reporter_user_id?: string
  reporter_ip?: string
  reason: 'spam' | 'harassment' | 'adult_content' | 'violence' | 'copyright'
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  admin_notes?: string
  created_at: string
  resolved_at?: string
}

// Tags types
export interface Tag {
  id: string
  name: string
  slug: string
  description?: string
  usage_count?: number
  created_at?: string
}

export interface TagWithCount extends Tag {
  published_section_count: number
}

// Featured Rotation types
export type RotationMode = 'time-based' | 'manual' | 'hybrid'

export interface FeaturedSection {
  id: string
  section_id: string
  featured_mode: RotationMode
  priority: number
  featured_at: string
  featured_until: string | null
  featured_by: string
  manual_boost_multiplier: number
  created_at: string
  updated_at: string
}

export interface SectionEngagement {
  id: string
  section_id: string
  date: string
  view_count: number
  unique_visitors: number
  avg_time_on_page: number
  created_at: string
  updated_at: string
}

export interface TimeBasedConfig {
  expiryHours: number
  fallbackToHighViews: boolean
}

export interface HybridConfig {
  viewCountWeight: number
  recencyWeight: number
  engagementWeight: number
  manualBoostMultiplier: number
}

export interface RotationConfig {
  mode: RotationMode
  timeBasedConfig?: TimeBasedConfig
  hybridConfig?: HybridConfig
}

export interface FeaturedOptions {
  limit?: number
  excludeIds?: string[]
}

export interface ManualCurationStrategy {
  fetchFeatured(options: FeaturedOptions): Promise<PublishedSection[]>
  addToFeatured(sectionId: string, priority?: number): Promise<void>
  removeFromFeatured(sectionId: string): Promise<void>
  reorderFeatured(sectionIds: string[]): Promise<void>
}

export interface SectionWithMetrics {
  section: PublishedSection
  normalizedViewCount: number
  recencyScore: number
  engagementRate: number
  hasManualBoost: boolean
}

// Feed API types
export interface FeedItem {
  id: string
  title: string // Now SEO-optimized with tags: "cool girls, art - Collection Title"
  section_url: string
  thumbnail_url: string
  images: string[] // All image URLs from the section
  image_count: number // Number of images
  tags: string[] // Tag names for SEO and filtering
  category: {
    id: string
    name: string
    slug: string
    icon?: string
  }
  creator: {
    username: string
    display_name: string
    avatar_url?: string
  }
  published_at: string
  is_nsfw: boolean
  view_count: number
}

export interface FeedResponse {
  items: FeedItem[]
  cursor?: string
  has_more: boolean
}

// Personalized Feed types
export interface ItemIndexEntry {
  id: string
  section_id: string
  block_id: string
  block_type: 'gallery' | 'image' | 'carousel'
  item_url: string
  upload_time: Date
  position: number
  is_nsfw: boolean
  caption?: string
  alt_text?: string
  created_at: Date
}

export interface PersonalizedFeedItem {
  // Item data
  id: string
  section_id: string
  block_id: string
  block_type: 'gallery' | 'image' | 'carousel'
  image_url: string
  upload_time: string // ISO 8601
  position: number
  caption?: string
  alt_text?: string
  is_nsfw: boolean

  // Where this item came from: a collection the user bookmarked, or a
  // discovery pick used to keep the feed from ever running dry.
  source: 'bookmarked' | 'discovery'

  // Per-image engagement
  like_count: number
  liked_by_me: boolean
  
  // Enriched metadata
  section: {
    id: string
    title: string
    url: string // /{username}/{section-slug}
  }
  creator: {
    username: string
    display_name: string
    avatar_url?: string
  }
  category: {
    id: string
    name: string
    slug: string
    icon?: string
  }
}

export interface PersonalizedFeedParams {
  limit?: number // Default: 50, Max: 100
  cursor?: string // Base64 {upload_time, id} for pagination
  since?: string // ISO 8601 - only items newer than this
  include_nsfw?: boolean // Override user's NSFW preference
}

export interface PersonalizedFeedResponse {
  items: PersonalizedFeedItem[]
  cursor?: string // Present if has_more = true
  has_more: boolean
  mode: 'personalized' | 'discovery'
  bookmark_count: number
}

/**
 * A collection suggested for bookmarking (shown on thin/empty feeds)
 */
export interface SuggestedCollection {
  id: string
  title: string
  url: string // /{username}/{section-slug}
  thumbnail_url: string
  bookmark_count: number
  creator: {
    username: string
    display_name: string
    avatar_url?: string
  }
  category: {
    id: string
    name: string
    slug: string
    icon?: string
  }
}
