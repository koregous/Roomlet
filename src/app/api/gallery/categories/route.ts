import { getSupabaseClient } from '@/shared/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = getSupabaseClient()

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('position')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
