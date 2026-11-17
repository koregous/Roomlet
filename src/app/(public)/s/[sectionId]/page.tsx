import { getSupabaseClient } from '@/shared/lib/supabase'
import { notFound } from 'next/navigation'
import { getCategoryIcon } from '@/shared/lib/category-icons'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'
import type { Metadata } from 'next'
import SectionPageClient from './SectionPageClient'

export const revalidate = 0 // Force dynamic rendering

interface Props {
  params: { sectionId: string }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

export default async function FocusedSectionPage({ params }: Props) {
  const supabase = getSupabaseClient()

  // Fetch section with all related data
  const { data: section, error } = await supabase
    .from('sections')
    .select(`
      *,
      profiles!inner(id, username, display_name, avatar_url, bio),
      categories(id, name, slug, icon)
    `)
    .eq('id', params.sectionId)
    .eq('published', true)
    .single()

  if (error || !section) {
    notFound()
  }

  // Count creator's other published sections
  const { count: otherSectionsCount } = await supabase
    .from('sections')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', section.profile_id)
    .eq('published', true)
    .neq('id', params.sectionId)

  // Get the category icon component
  const CategoryIcon = section.categories ? getCategoryIcon(section.categories.slug) : null

  // Check if current user is admin
  const adminCheck = await checkAdminRole()
  const userIsAdmin = adminCheck.isAdmin

  return (
    <SectionPageClient
      section={section}
      categorySlug={section.categories?.slug || null}
      otherSectionsCount={otherSectionsCount}
      userIsAdmin={userIsAdmin}
    />
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = getSupabaseClient()

  const { data: section } = await supabase
    .from('sections')
    .select(`
      *,
      profiles!inner(username, display_name),
      categories(name, slug)
    `)
    .eq('id', params.sectionId)
    .single()

  if (!section) {
    return {
      title: 'Section Not Found',
    }
  }

  // Generate description from first text block
  const textBlock = section.blocks.find((b: any) => b.type === 'text')
  const description = textBlock?.content?.text
    ? textBlock.content.text.replace(/<[^>]*>/g, '').substring(0, 160)
    : `Check out ${section.title} by ${
        section.profiles.display_name || section.profiles.username
      }`

  // NSFW content should not be indexed by search engines
  const robotsDirective = section.is_nsfw 
    ? 'noindex, nofollow' 
    : 'index, follow'
  
  // Generate user-friendly URL for Open Graph
  const username = section.profiles.username
  const sectionSlug = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const canonicalUrl = `${SITE_URL}/${username}/${sectionSlug}`

  return {
    title: `${section.title} by ${
      section.profiles.display_name || section.profiles.username
    }`,
    description,
    robots: robotsDirective,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: section.title,
      description,
      url: canonicalUrl, // Use user-friendly URL instead of /s/{id}
      type: 'article',
      images: [
        {
          url: `${SITE_URL}/s/${params.sectionId}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: section.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: section.title,
      description,
      images: [`${SITE_URL}/s/${params.sectionId}/opengraph-image`],
    },
  }
}
