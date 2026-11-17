import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { deleteCloudinaryAssets } from '@/shared/lib/cloudinary'
import { extractCloudinaryUrls } from '@/shared/lib/section-assets'
import { Section } from '@/shared/lib/types'
import { calculateBlocksStorage } from '@/shared/lib/section-storage'
import { decrementStorageUsage } from '@/shared/lib/storage-quota'
import { syncItemIndex } from '@/shared/lib/feed-item-extraction'
import { revalidatePath } from 'next/cache'

/**
 * PUT /api/sections/[id]
 * Update a section with automatic item index synchronization.
 * 
 * Flow:
 * 1. Verify user owns the section
 * 2. Update section in database
 * 3. Synchronize item_index table with new blocks
 * 4. Return success
 * 
 * Note: Item index synchronization errors are logged but don't block the update.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const supabase = await getSupabaseServerClient()

    // Check authentication
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
      .select('*, profiles!inner(user_id, username)')
      .eq('id', sectionId)
      .single()

    if (fetchError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Verify ownership
    const profileData = section.profiles as unknown as { user_id: string; username: string }
    if (profileData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own sections' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { title, blocks, visible, is_nsfw } = body

    // Update section in database
    const { data: updatedSection, error: updateError } = await supabase
      .from('sections')
      .update({
        ...(title !== undefined && { title }),
        ...(blocks !== undefined && { blocks }),
        ...(visible !== undefined && { visible }),
        ...(is_nsfw !== undefined && { is_nsfw }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sectionId)
      .select()
      .single()

    if (updateError || !updatedSection) {
      console.error(`[PUT /api/sections/${sectionId}] Update failed:`, updateError)
      return NextResponse.json(
        { error: `Failed to update section: ${updateError?.message}` },
        { status: 500 }
      )
    }

    const updatedData = updatedSection as unknown as Section

    // Synchronize item index (non-blocking on error)
    try {
      await syncItemIndex(
        updatedData.id,
        updatedData.blocks || [],
        updatedData.is_nsfw || false
      )
      console.log(`[PUT /api/sections/${sectionId}] Item index synchronized successfully`)
    } catch (syncError) {
      // Log but don't block the update
      console.error(
        `[PUT /api/sections/${sectionId}] Item index sync failed (non-blocking):`,
        syncError
      )
    }

    console.log(`[PUT /api/sections/${sectionId}] Section updated successfully by user ${user.id}`)

    // Revalidate relevant pages
    revalidatePath('/gallery')
    revalidatePath(`/s/${sectionId}`)
    if (profileData.username) {
      revalidatePath(`/${profileData.username}`)
    }

    return NextResponse.json({
      success: true,
      section: updatedData,
    })
  } catch (error) {
    console.error('[PUT /api/sections] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sections/[id]
 * Delete a section (user-owned only) with cascade deletion of Cloudinary assets.
 * 
 * Flow:
 * 1. Verify user owns the section
 * 2. Calculate storage used by section blocks
 * 3. Extract all Cloudinary URLs from blocks
 * 4. Delete assets from Cloudinary (best-effort)
 * 5. Delete section from database
 * 6. Decrement user's storage quota (best-effort)
 * 7. Return success even if some assets failed (logged for manual cleanup)
 * 
 * Note: Physical files may remain in R2 temporarily (orphaned), but quota is freed immediately.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const supabase = await getSupabaseServerClient()

    // Check authentication
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
      .select('*, profiles!inner(user_id, username)')
      .eq('id', sectionId)
      .single()

    if (fetchError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Verify ownership
    const profileData = section.profiles as unknown as { user_id: string; username: string }
    if (profileData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own sections' },
        { status: 403 }
      )
    }

    // Extract Cloudinary URLs and calculate storage from section blocks
    const sectionData = section as unknown as Section
    const cloudinaryUrls = extractCloudinaryUrls(sectionData)
    const storageBytes = calculateBlocksStorage(sectionData.blocks || [])

    console.log(
      `[DELETE /api/sections/${sectionId}] Found ${cloudinaryUrls.length} Cloudinary assets, ${storageBytes} bytes to free`
    )

    // Delete Cloudinary assets (best-effort, non-blocking)
    let deletionSummary = null
    if (cloudinaryUrls.length > 0) {
      deletionSummary = await deleteCloudinaryAssets(cloudinaryUrls)
      
      console.log(
        `[DELETE /api/sections/${sectionId}] Cloudinary deletion: ${deletionSummary.succeeded}/${deletionSummary.total} succeeded`
      )

      if (deletionSummary.failed > 0) {
        console.warn(
          `[DELETE /api/sections/${sectionId}] ${deletionSummary.failed} assets failed to delete:`,
          deletionSummary.results.filter((r) => !r.success)
        )
      }
    }

    // Delete section from database (regardless of Cloudinary result)
    const { error: deleteError } = await supabase
      .from('sections')
      .delete()
      .eq('id', sectionId)

    if (deleteError) {
      console.error(`[DELETE /api/sections/${sectionId}] Database deletion failed:`, deleteError)
      return NextResponse.json(
        { error: `Failed to delete section: ${deleteError.message}` },
        { status: 500 }
      )
    }

    // Decrement user's storage quota (best-effort, non-blocking)
    if (storageBytes > 0) {
      try {
        await decrementStorageUsage(user.id, storageBytes)
        console.log(
          `[DELETE /api/sections/${sectionId}] Freed ${storageBytes} bytes from user quota`
        )
      } catch (quotaError) {
        // Don't fail the deletion if quota update fails
        // Quota can be recalculated later if needed
        console.warn(
          `[DELETE /api/sections/${sectionId}] Failed to update quota:`,
          quotaError
        )
      }
    }

    console.log(`[DELETE /api/sections/${sectionId}] Section deleted successfully by user ${user.id}`)

    // Revalidate relevant pages
    revalidatePath('/gallery')
    revalidatePath(`/s/${sectionId}`)
    if (profileData.username) {
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
    console.error('[DELETE /api/sections] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
