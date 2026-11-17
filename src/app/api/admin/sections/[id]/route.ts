import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { deleteCloudinaryAssets } from '@/shared/lib/cloudinary'
import { extractCloudinaryUrls } from '@/shared/lib/section-assets'
import { Section } from '@/shared/lib/types'

/**
 * PATCH /api/admin/sections/[id]
 * Unpublish a section (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await request.json()
    const sectionId = params.id

    if (!action || !['unpublish', 'publish'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "unpublish" or "publish"' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    // Check admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Update section
    const { error } = await supabase
      .from('sections')
      .update({
        published: action === 'publish',
      })
      .eq('id', sectionId)

    if (error) {
      console.error('Failed to update section:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('User profile:', JSON.stringify(profile, null, 2))
      console.error('Section ID:', sectionId)
      return NextResponse.json(
        { error: `Failed to update section: ${error.message}` },
        { status: 500 }
      )
    }

    // Revalidate pages
    revalidatePath('/gallery')
    revalidatePath(`/s/${sectionId}`)

    return NextResponse.json({
      success: true,
      action,
      sectionId,
    })
  } catch (error) {
    console.error('Admin section update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/sections/[id]
 * Delete a section permanently (admin only) with cascade deletion of Cloudinary assets.
 * 
 * Flow:
 * 1. Verify admin access
 * 2. Extract all Cloudinary URLs from blocks
 * 3. Delete assets from Cloudinary (best-effort)
 * 4. Delete section from database
 * 5. Return success even if some assets failed (logged for manual cleanup)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const supabase = await getSupabaseServerClient()

    // Check admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get section details before deletion (including blocks for asset extraction)
    const { data: section } = await supabase
      .from('sections')
      .select('*, profiles!inner(username)')
      .eq('id', sectionId)
      .single()

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Extract Cloudinary URLs from section blocks
    const sectionData = section as unknown as Section
    const cloudinaryUrls = extractCloudinaryUrls(sectionData)

    console.log(
      `[ADMIN DELETE] Section ${sectionId}: Found ${cloudinaryUrls.length} Cloudinary assets to delete`
    )

    // Delete Cloudinary assets (best-effort, non-blocking)
    let deletionSummary = null
    if (cloudinaryUrls.length > 0) {
      deletionSummary = await deleteCloudinaryAssets(cloudinaryUrls)
      
      console.log(
        `[ADMIN DELETE] Section ${sectionId}: Cloudinary deletion ${deletionSummary.succeeded}/${deletionSummary.total} succeeded`
      )

      if (deletionSummary.failed > 0) {
        console.warn(
          `[ADMIN DELETE] Section ${sectionId}: ${deletionSummary.failed} assets failed to delete:`,
          deletionSummary.results.filter((r) => !r.success)
        )
      }
    }

    // Delete section (cascade will handle related data)
    const { error } = await supabase.from('sections').delete().eq('id', sectionId)

    if (error) {
      console.error('Failed to delete section:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('User profile:', JSON.stringify(profile, null, 2))
      console.error('Section ID:', sectionId)
      return NextResponse.json(
        { error: `Failed to delete section: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`[ADMIN] Section deleted: ${sectionId} by admin user ${user.id}`)

    // Revalidate pages
    revalidatePath('/gallery')
    if (section) {
      const profileData = section.profiles as unknown as { username: string }
      revalidatePath(`/${profileData.username}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Section deleted successfully',
      sectionId,
      cloudinaryDeletion: deletionSummary
        ? {
            total: deletionSummary.total,
            succeeded: deletionSummary.succeeded,
            failed: deletionSummary.failed,
          }
        : null,
    })
  } catch (error) {
    console.error('Admin section delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
