import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'

// POST /api/sections/[id]/tags - Add tags to a section
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sectionId = params.id
    const { tags } = await request.json()

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: 'Tags must be a non-empty array' },
        { status: 400 }
      )
    }

    // Verify user owns this section
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('profile_id')
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    if (section.profile_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this section' },
        { status: 403 }
      )
    }

    // Add tags using the helper function
    const results = []
    for (const tagName of tags) {
      const { data, error } = await supabase
        .rpc('add_tag_to_section', {
          section_uuid: sectionId,
          tag_name: tagName
        })

      if (error) {
        console.error(`Error adding tag "${tagName}":`, error)
      } else {
        results.push({ tag: tagName, tagId: data })
      }
    }

    return NextResponse.json({ 
      message: 'Tags added successfully',
      results 
    })
  } catch (error) {
    console.error('Add tags error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/sections/[id]/tags - Remove a tag from a section
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sectionId = params.id
    const { tagId } = await request.json()

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      )
    }

    // Verify user owns this section
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .select('profile_id')
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    if (section.profile_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this section' },
        { status: 403 }
      )
    }

    // Remove tag
    const { error } = await supabase
      .from('section_tags')
      .delete()
      .eq('section_id', sectionId)
      .eq('tag_id', tagId)

    if (error) {
      console.error('Remove tag error:', error)
      return NextResponse.json(
        { error: 'Failed to remove tag' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Tag removed successfully'
    })
  } catch (error) {
    console.error('Remove tag error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
