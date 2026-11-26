import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { createOnboardingSection } from '@/shared/constants/onboarding-template'

/**
 * POST /api/onboarding/setup
 * Creates the template welcome section for new users
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 3. Check if user already has sections (prevent duplicate templates)
    const { data: existingSections } = await supabase
      .from('sections')
      .select('id')
      .eq('profile_id', profile.id)
      .limit(1)

    if (existingSections && existingSections.length > 0) {
      return NextResponse.json(
        { error: 'Template already created', profile_id: profile.id, username: profile.username },
        { status: 200 }
      )
    }

    const templateSection = createOnboardingSection(profile.id)

    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .insert(templateSection)
      .select()
      .single()

    if (sectionError) {
      console.error('[onboarding/setup] Failed to create section:', sectionError)
      return NextResponse.json(
        { error: 'Failed to create welcome section' },
        { status: 500 }
      )
    }

    // 5. Sync item index for the new section (best-effort, don't block)
    try {
      await fetch(`${request.url.replace('/onboarding/setup', '')}/sections/${section.id}/sync`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (syncError) {
      console.warn('[onboarding/setup] Failed to sync item index:', syncError)
    }

    return NextResponse.json(
      {
        success: true,
        profile_id: profile.id,
        section_id: section.id,
        username: profile.username,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[onboarding/setup] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
