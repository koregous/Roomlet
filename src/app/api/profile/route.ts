import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const PostProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores allowed'),
  display_name: z.string().max(100).optional(),
  // user_id is accepted but only used as a fallback — auth session takes precedence
  user_id: z.string().uuid().optional(),
})

const PatchProfileSchema = z.object({
  display_name: z.string().max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  theme: z.string().max(50).optional(),
})

export async function GET() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profile)
}

export async function POST(request: Request) {
const supabase = await getSupabaseServerClient()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PostProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { username, display_name, user_id } = parsed.data

  // Auth session takes precedence over body user_id
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const currentUserId = user?.id ?? user_id

  if (!currentUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Single RPC call — handles uniqueness, sanitisation, and duplicate checks
  // The RPC (create_profile_for_user) is SECURITY DEFINER and validates input
  const { data: profileId, error: rpcError } = await supabase.rpc(
    'create_profile_for_user',
    {
      p_user_id: currentUserId,
      p_username: username.toLowerCase(),
      p_display_name: display_name ?? username,
    }
  )

  if (rpcError) {
    // Surface structured errors from the RPC (unique_violation, invalid_parameter_value)
    if (rpcError.code === '23505' || rpcError.message?.includes('already taken')) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
    }
    if (rpcError.message?.includes('already has a profile')) {
      return NextResponse.json({ error: 'Profile already exists' }, { status: 409 })
    }
    if (rpcError.code === 'invalid_parameter_value') {
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }
    console.error('[POST /api/profile] RPC error:', rpcError)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  return NextResponse.json(
    { id: profileId, username: username.toLowerCase(), display_name: display_name ?? username },
    { status: 201 }
  )
}

export async function PATCH(request: Request) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profile)
}
