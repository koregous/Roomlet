import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { notFound } from 'next/navigation'
import EmbedSectionClient from './EmbedSectionClient'
import { Section } from '@/shared/lib/types'

interface Props {
  params: { sectionId: string }
  searchParams: { theme?: 'light' | 'dark' }
}

export default async function EmbedSectionPage({ params, searchParams }: Props) {
  const supabase = await getSupabaseServerClient()

  const { data: sectionData, error } = await supabase
    .from('sections')
    .select(`
      *,
      profiles!inner(username, display_name, avatar_url)
    `)
    .eq('id', params.sectionId)
    .eq('published', true)
    .single()

  if (error || !sectionData) {
    notFound()
  }

  const section = sectionData as unknown as Section & {
    profiles: { username: string; display_name: string; avatar_url: string }
  }

  return (
    <EmbedSectionClient 
      section={section} 
      creator={section.profiles}
      theme={searchParams.theme || 'dark'}
    />
  )
}

// Allow this page to be embedded in iframes
export async function generateMetadata({ params }: Props) {
  return {
    other: {
      'X-Frame-Options': 'ALLOW-FROM *',
    },
  }
}
