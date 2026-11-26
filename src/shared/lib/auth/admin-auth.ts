/**
 * Admin Authorization Middleware
 * 
 * Provides utilities for verifying admin role from JWT tokens.
 * Used to protect admin API routes and operations.
 */

import { getSupabaseServerClient } from '@/shared/lib/supabase-server';

export interface AdminAuthResult {
  isAdmin: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Check if the current user has admin role
 * 
 * Checks both JWT app_metadata AND database profiles.is_admin for backwards compatibility.
 * Returns authorization result with user ID if admin.
 * 
 * @returns AdminAuthResult with isAdmin flag and userId
 */
export async function checkAdminRole(): Promise<AdminAuthResult> {
  const supabase = await getSupabaseServerClient();

  try {
    // Get current user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        isAdmin: false,
        userId: null,
        error: 'Not authenticated',
      };
    }

    // Check JWT app_metadata first (new system)
    const hasJWTRole = user.app_metadata?.role === 'admin';
    
    // Check database profiles.is_admin (legacy system)
    let hasDBRole = false;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)  // FIX: use user_id (profiles.user_id matches auth.uid())
      .single();
    
    if (profileError) {
      console.log('[AdminAuth] DB query error:', profileError);
    }
    
    hasDBRole = profile?.is_admin === true;

    // User is admin if EITHER check passes
    const isAdmin = hasJWTRole || hasDBRole;

    if (!isAdmin) {
      return {
        isAdmin: false,
        userId: user.id,
        error: 'Insufficient permissions - admin role required',
      };
    }

    return {
      isAdmin: true,
      userId: user.id,
    };
  } catch (error) {
    console.error('[AdminAuth] Error checking admin role:', error);
    return {
      isAdmin: false,
      userId: null,
      error: 'Authorization check failed',
    };
  }
}

/**
 * Verify admin role and throw error if not authorized
 * 
 * Convenience function that throws an error if user is not admin.
 * Use this in API routes that require admin access.
 * 
 * @throws Error if user is not authenticated or not admin
 * @returns userId of the authenticated admin
 */
export async function requireAdminRole(): Promise<string> {
  const result = await checkAdminRole();

  if (!result.isAdmin) {
    throw new Error(result.error || 'Admin access required');
  }

  return result.userId!;
}

/**
 * Get current user ID without admin check
 * 
 * Returns the current authenticated user's ID.
 * Useful for operations that need user context but don't require admin.
 * 
 * @returns userId or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id || null;
  } catch (error) {
    console.error('[AdminAuth] Error getting current user:', error);
    return null;
  }
}

/**
 * Check if a specific user ID has admin role
 * 
 * Queries the user's metadata from the database to check role.
 * Useful for server-side operations with a known user ID.
 * 
 * @param userId - User ID to check
 * @returns true if user has admin role
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();

  try {
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !user) {
      return false;
    }

    return user.app_metadata?.role === 'admin';
  } catch (error) {
    console.error('[AdminAuth] Error checking user admin status:', error);
    return false;
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string = 'Unauthorized',
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Create authorization error response for API routes
 * 
 * @param message - Error message
 * @returns Response object with 403 status
 */
export function unauthorizedResponse(message: string = 'Admin access required'): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: 'UNAUTHORIZED',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create unauthenticated error response for API routes
 * 
 * @param message - Error message
 * @returns Response object with 401 status
 */
export function unauthenticatedResponse(
  message: string = 'Authentication required'
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: 'UNAUTHENTICATED',
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
