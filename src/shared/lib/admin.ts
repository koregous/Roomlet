import { getSupabaseClient } from './supabase'
import { getSupabaseBrowserClient } from './supabase-browser'

/**
 * Check if the current user is an admin (server-side)
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = getSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)  // Fixed: should match user_id, not id
    .single()

  return data?.is_admin === true
}

/**
 * Check if the current user is an admin (client-side)
 */
export async function isAdminBrowser(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)  // Fixed: should match user_id, not id
    .single()

  return data?.is_admin === true
}

/**
 * Require admin access or redirect
 * Use this in server components
 */
export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error('Unauthorized: Admin access required')
  }
  return true
}
