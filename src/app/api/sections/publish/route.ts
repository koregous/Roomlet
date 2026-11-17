import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  try {
    const { sectionId, categoryId } = await request.json()

    // Validate required fields
    if (!sectionId) {
      return NextResponse.json(
        { error: 'Missing required field: sectionId' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile (profiles.user_id = auth.users.id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Verify section ownership and get current state
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('profile_id, published, category_id, approval_status')
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Check if user owns this section (section.profile_id should match profile.id)
    if (section.profile_id !== profile.id) {
      return NextResponse.json(
        { error: 'You do not have permission to publish this section' },
        { status: 403 }
      )
    }

    // Determine which category to use
    let finalCategoryId = categoryId
    
    // If no categoryId provided (republishing), use existing category
    if (!finalCategoryId) {
      if (!section.category_id) {
        return NextResponse.json(
          { error: 'Category required. Section has no existing category.' },
          { status: 400 }
        )
      }
      finalCategoryId = section.category_id
    }

    // Verify category exists
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, slug')
      .eq('id', finalCategoryId)
      .single()

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    // Publish the section
    const publishedAt = section.published ? undefined : new Date().toISOString()
    const updateData: any = {
      published: true,
      category_id: finalCategoryId,
    }
    
    // Only update published_at if this is the first publish
    if (publishedAt) {
      updateData.published_at = publishedAt
    }

    const { error: updateError } = await supabase
      .from('sections')
      .update(updateData)
      .eq('id', sectionId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to publish section' },
        { status: 500 }
      )
    }

    // Get user's username for profile revalidation
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', profile.id)
      .single()

    // Revalidate relevant pages
    revalidatePath('/gallery')
    revalidatePath(`/gallery/${category.slug}`)
    revalidatePath(`/s/${sectionId}`)
    if (userProfile?.username) {
      revalidatePath(`/${userProfile.username}`)
    }

    return NextResponse.json({
      success: true,
      sectionId,
      publishedAt: publishedAt || section.published,
      galleryUrl: `/s/${sectionId}`,
    })
  } catch (error) {
    console.error('Publish section error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Missing sectionId parameter' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Verify section ownership
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('profile_id')
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Check if user owns this section (section.profile_id should match profile.id)
    if (section.profile_id !== profile.id) {
      return NextResponse.json(
        { error: 'You do not have permission to unpublish this section' },
        { status: 403 }
      )
    }

    // Unpublish the section
    const { error: updateError } = await supabase
      .from('sections')
      .update({
        published: false,
      })
      .eq('id', sectionId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to unpublish section' },
        { status: 500 }
      )
    }

    // Get user's username for profile revalidation
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', profile.id)
      .single()

    // Revalidate relevant pages
    revalidatePath('/gallery')
    revalidatePath(`/s/${sectionId}`)
    if (userProfile?.username) {
      revalidatePath(`/${userProfile.username}`)
    }

    return NextResponse.json({
      success: true,
      sectionId,
    })
  } catch (error) {
    console.error('Unpublish section error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
