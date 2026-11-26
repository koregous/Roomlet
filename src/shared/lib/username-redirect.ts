import { getSupabaseClient } from '@/shared/lib/supabase'

/**
 * If `username` used to belong to a profile that has since been renamed (and nobody
 * else owns the name now), return that profile's current username. Otherwise null.
 */
export async function resolveRenamedUsername(username: string): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('get_username_redirect', {
    p_old: username.toLowerCase(),
  })
  if (error || typeof data !== 'string' || !data) return null
  return data
}
