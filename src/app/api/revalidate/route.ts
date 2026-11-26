import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const RevalidateSchema = z.object({
  username: z.string().min(1).max(30),
})

// In-memory rate limiter: max 10 revalidations per user per minute.
// Sufficient for a single-server deployment. Replace with Upstash Redis
// when running multiple Vercel instances or when rate limiting is needed
// across restarts.
const revalidateHits = new Map<string, { count: number; resetAt: number }>()
const REVALIDATE_LIMIT = 10
const REVALIDATE_WINDOW_MS = 60_000

function checkRevalidateRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = revalidateHits.get(userId)

  if (!entry || now >= entry.resetAt) {
    revalidateHits.set(userId, { count: 1, resetAt: now + REVALIDATE_WINDOW_MS })
    return true
  }

  if (entry.count >= REVALIDATE_LIMIT) return false

  entry.count++
  return true
}

/**
 * POST /api/revalidate
 * Triggers on-demand ISR revalidation for a public profile page.
 * Called by the dashboard after every successful profile or section save.
 * Requires an authenticated session — users can only revalidate their own profile.
 * Rate limited to 10 calls per user per minute.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit before any further processing
  if (!checkRevalidateRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Too many revalidation requests. Try again in a minute.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RevalidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  // Verify the username belongs to the authenticated user
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .eq('username', parsed.data.username)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  revalidatePath(`/${parsed.data.username}`)

  return NextResponse.json({ revalidated: true, path: `/${parsed.data.username}` })
}
