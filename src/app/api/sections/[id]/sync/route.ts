import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { syncItemIndex } from '@/shared/lib/feed-item-extraction'
import { Section } from '@/shared/lib/types'

/**
 * POST /api/sections/[id]/sync
 * Synchronize the item index for a section
 * 
 * This endpoint is called after section creation or update to extract
 * media items from Gallery, Image, and Carousel blocks and index them
 * for the personalized bookmark feed feature.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const supabase = await getSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get section with ownership check
    const { data: section, error: fetchError } = await supabase
      .from('sections')
      .select('*, profiles!inner(user_id)')
      .eq('id', sectionId)
      .single()

    if (fetchError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Verify ownership
    const profileData = section.profiles as unknown as { user_id: string }
    if (profileData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only sync your own sections' },
        { status: 403 }
      )
    }

    const sectionData = section as unknown as Section
    await syncItemIndex(
      sectionData.id,
      sectionData.blocks || [],
      sectionData.is_nsfw || false
    )

    console.log(
      `[POST /api/sections/${sectionId}/sync] Successfully synchronized item index for user ${user.id}`
    )

    return NextResponse.json({
      success: true,
      message: 'Item index synchronized successfully',
      sectionId,
    })
  } catch (error) {
    console.error('[POST /api/sections/sync] Error:', error)
    
    // Don't fail hard - log error but return success
    // Synchronization can be retried later
    return NextResponse.json(
      {
        success: false,
        error: 'Synchronization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
