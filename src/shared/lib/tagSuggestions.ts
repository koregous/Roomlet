import { Section, Block, BlockType } from './types'

/**
 * Rule-based tag suggestion system
 * Analyzes section content and suggests relevant tags
 */

interface TagSuggestion {
  tag: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export function suggestTags(section: Section): string[] {
  const suggestions = new Set<string>()
  const allSuggestions: TagSuggestion[] = []

  // 1. Analyze block types
  const blockTypeTags = analyzeBlockTypes(section.blocks)
  allSuggestions.push(...blockTypeTags)

  // 2. Analyze text content
  const textTags = analyzeTextContent(section)
  allSuggestions.push(...textTags)

  // 3. Analyze structure patterns
  const structureTags = analyzeStructure(section)
  allSuggestions.push(...structureTags)

  // Sort by confidence and deduplicate
  const sorted = allSuggestions
    .sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 }
      return confOrder[a.confidence] - confOrder[b.confidence]
    })

  // Take high and medium confidence suggestions
  sorted.forEach(s => {
    if (s.confidence === 'high' || s.confidence === 'medium') {
      suggestions.add(s.tag)
    }
  })

  return Array.from(suggestions).slice(0, 8) // Max 8 suggestions
}

function analyzeBlockTypes(blocks: Block[]): TagSuggestion[] {
  const suggestions: TagSuggestion[] = []
  const blockCounts = new Map<BlockType, number>()

  // Count block types
  blocks.forEach(block => {
    blockCounts.set(block.type, (blockCounts.get(block.type) || 0) + 1)
  })

  // Gallery-heavy sections
  const galleryCount = (blockCounts.get('gallery') || 0) + (blockCounts.get('carousel') || 0)
  if (galleryCount >= 2) {
    suggestions.push({
      tag: 'Gallery',
      confidence: 'high',
      reason: 'Multiple gallery/carousel blocks'
    })
  }

  // Image-heavy
  const imageCount = (blockCounts.get('image') || 0) + galleryCount
  if (imageCount >= 3) {
    suggestions.push({
      tag: 'Photography',
      confidence: 'medium',
      reason: 'Multiple image blocks'
    })
  }

  // Audio content
  if (blockCounts.get('audio')) {
    suggestions.push({
      tag: 'Audio',
      confidence: 'high',
      reason: 'Contains audio blocks'
    })
  }

  // Text-heavy
  const textCount = blockCounts.get('text') || 0
  if (textCount >= 3 && imageCount <= 1) {
    suggestions.push({
      tag: 'Writing',
      confidence: 'medium',
      reason: 'Text-focused content'
    })
  }

  // Quote-heavy (aesthetic)
  if ((blockCounts.get('quote') || 0) >= 2) {
    suggestions.push({
      tag: 'Aesthetic',
      confidence: 'medium',
      reason: 'Multiple quote blocks'
    })
  }

  return suggestions
}

function analyzeTextContent(section: Section): TagSuggestion[] {
  const suggestions: TagSuggestion[] = []

  // Combine all text content
  const allText = [
    section.title,
    ...section.blocks
      .filter(b => b.type === 'text' || b.type === 'quote')
      .map(b => b.content.text || b.content.quote || '')
  ].join(' ').toLowerCase()

  // Keyword patterns (simple but effective)
  const patterns: Record<string, { keywords: string[], confidence: 'high' | 'medium' }> = {
    'Anime': { keywords: ['anime', 'manga', 'otaku', 'weeb', 'kawaii'], confidence: 'high' },
    'Gaming': { keywords: ['game', 'gaming', 'gamer', 'minecraft', 'roblox', 'fps'], confidence: 'high' },
    'Travel': { keywords: ['travel', 'journey', 'trip', 'adventure', 'explore', 'wanderlust'], confidence: 'high' },
    'Art': { keywords: ['art', 'artist', 'drawing', 'painting', 'illustration'], confidence: 'high' },
    'Tech': { keywords: ['code', 'coding', 'developer', 'programming', 'software', 'tech'], confidence: 'high' },
    'Design': { keywords: ['design', 'ui', 'ux', 'graphic', 'branding'], confidence: 'high' },
    'Fashion': { keywords: ['fashion', 'style', 'outfit', 'lookbook', 'streetwear'], confidence: 'high' },
    'Lifestyle': { keywords: ['lifestyle', 'daily', 'aesthetic', 'vibe', 'routine'], confidence: 'high' },
    'Portfolio': { keywords: ['portfolio', 'work', 'showcase', 'professional'], confidence: 'medium' },
    'Personal': { keywords: ['about me', 'my story', 'introduction', 'bio'], confidence: 'medium' },
    'Minimalist': { keywords: ['minimal', 'minimalist', 'simple', 'clean'], confidence: 'medium' },
    'Retro': { keywords: ['retro', 'vintage', 'nostalgia', '90s', '80s'], confidence: 'medium' },
    'Cyberpunk': { keywords: ['cyberpunk', 'cyber', 'neon', 'futuristic'], confidence: 'high' },
    'Nature': { keywords: ['nature', 'forest', 'mountain', 'ocean', 'wildlife'], confidence: 'medium' },
    'Creative': { keywords: ['creative', 'creativity', 'creation', 'maker'], confidence: 'medium' },
  }

  Object.entries(patterns).forEach(([tag, { keywords, confidence }]) => {
    const matches = keywords.filter(kw => allText.includes(kw))
    if (matches.length > 0) {
      suggestions.push({
        tag,
        confidence,
        reason: `Found keywords: ${matches.join(', ')}`
      })
    }
  })

  return suggestions
}

function analyzeStructure(section: Section): TagSuggestion[] {
  const suggestions: TagSuggestion[] = []
  const blockCount = section.blocks.length

  // Minimal sections
  if (blockCount <= 3) {
    suggestions.push({
      tag: 'Minimalist',
      confidence: 'low',
      reason: 'Simple structure'
    })
  }

  // Rich content
  if (blockCount >= 8) {
    suggestions.push({
      tag: 'Showcase',
      confidence: 'medium',
      reason: 'Rich, detailed content'
    })
  }

  // Has links block (likely portfolio or collection)
  const hasLinks = section.blocks.some(b => b.type === 'links')
  if (hasLinks) {
    suggestions.push({
      tag: 'Collection',
      confidence: 'medium',
      reason: 'Contains links block'
    })
  }

  return suggestions
}

/**
 * Get color-based tags from images (future enhancement)
 * This would require image analysis API (Cloudinary, etc.)
 */
export function analyzeImageColors(imageUrls: string[]): string[] {
  // Placeholder for future implementation
  // Could integrate with Cloudinary's auto-tagging or color analysis
  // For now, return empty array
  return []
}

/**
 * Popular tags for quick selection
 */
export const POPULAR_TAGS = [
  'Anime',
  'Gaming',
  'Fashion',
  'Art',
  'Photography',
  'Lifestyle',
  'Portfolio',
  'Minimalist',
  'Dark Theme',
  'Colorful',
  'Aesthetic',
  'Travel',
  'Tech',
  'Design',
  'Creative',
  'Retro',
  'Cyberpunk',
  'Nature',
  'Personal',
  'Collection',
  'Showcase'
]

/**
 * Tag categories for organized display
 */
export const TAG_CATEGORIES = {
  'Content Type': ['Portfolio', 'Gallery', 'Collection', 'Showcase', 'Personal'],
  'Theme': ['Anime', 'Gaming', 'Fashion', 'Art', 'Photography', 'Lifestyle', 'Travel', 'Tech', 'Design', 'Nature'],
  'Style': ['Minimalist', 'Dark Theme', 'Colorful', 'Aesthetic', 'Retro', 'Cyberpunk', 'Creative'],
  'Subject': ['Writing', 'Work']
}
