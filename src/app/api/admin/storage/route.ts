/**
 * GET /api/admin/storage
 * 
 * View storage usage statistics for all users (admin only)
 * 
 * Query params:
 * - limit: Number of users to return (default: 50)
 * - recalculate: User ID to recalculate storage for
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'
import { getAllUsersStorageStats, recalculateUserStorage, formatBytes } from '@/shared/lib/storage-quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // ── 1. Check admin authentication ────────────────────────────────
  const { isAdmin } = await checkAdminRole()
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  // ── 2. Check if recalculate requested ────────────────────────────
  const { searchParams } = new URL(request.url)
  const recalculateUserId = searchParams.get('recalculate')

  if (recalculateUserId) {
    try {
      const totalBytes = await recalculateUserStorage(recalculateUserId)
      return NextResponse.json({
        success: true,
        userId: recalculateUserId,
        storage: {
          bytes: totalBytes,
          formatted: formatBytes(totalBytes),
        },
      })
    } catch (error) {
      console.error('[admin/storage] Recalculation failed:', error)
      return NextResponse.json(
        { error: 'Failed to recalculate storage' },
        { status: 500 }
      )
    }
  }

  // ── 3. Get storage statistics ────────────────────────────────────
  try {
    const stats = await getAllUsersStorageStats()

    // Calculate total storage used across all users
    const totalUsed = stats.reduce((sum, user) => sum + user.used, 0)
    const avgUsed = stats.length > 0 ? totalUsed / stats.length : 0

    return NextResponse.json({
      users: stats,
      summary: {
        totalUsers: stats.length,
        totalUsed: totalUsed,
        totalUsedFormatted: formatBytes(totalUsed),
        avgUsed: Math.round(avgUsed),
        avgUsedFormatted: formatBytes(avgUsed),
        usersOver90Percent: stats.filter(u => u.percentage >= 90).length,
        usersOverLimit: stats.filter(u => u.percentage >= 100).length,
      },
    })
  } catch (error) {
    console.error('[admin/storage] Failed to get statistics:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve storage statistics' },
      { status: 500 }
    )
  }
}
