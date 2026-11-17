'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert, AlertTriangle, ShieldX, Swords, Copyright } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { isAdminBrowser } from '@/shared/lib/admin'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ConfirmDialog from '@/shared/components/ConfirmDialog'

interface Report {
  id: string
  section_id: string
  reason: string
  status: string
  reporter_ip: string
  created_at: string
  sections?: {
    id: string
    title: string
    profiles: {
      username: string
      display_name: string | null
    }
  }
}

interface ConfirmAction {
  type: 'unpublish' | 'delete' | null
  sectionId: string | null
  reportId: string | null
  sectionTitle?: string
}

const REASON_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  spam: { label: 'Spam', icon: <ShieldAlert className="w-4 h-4" /> },
  harassment: { label: 'Harassment', icon: <AlertTriangle className="w-4 h-4" /> },
  adult_content: { label: 'Adult Content', icon: <ShieldX className="w-4 h-4" /> },
  violence: { label: 'Violence', icon: <Swords className="w-4 h-4" /> },
  copyright: { label: 'Copyright', icon: <Copyright className="w-4 h-4" /> },
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reviewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
  dismissed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    type: null,
    sectionId: null,
    reportId: null,
  })
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    checkAdminAccess()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchReports()
    }
  }, [filter, isAdmin])

  const checkAdminAccess = async () => {
    try {
      const admin = await isAdminBrowser()
      if (!admin) {
        router.push('/dashboard')
        return
      }
      setIsAdmin(true)
    } catch (error) {
      console.error('Failed to check admin access:', error)
      router.push('/dashboard')
    } finally {
      setChecking(false)
    }
  }

  const fetchReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          sections(
            id,
            title,
            profiles(username, display_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setReports(data as any || [])
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus, resolved_at: new Date().toISOString() })
        .eq('id', reportId)

      if (error) throw error
      fetchReports()
    } catch (error) {
      console.error('Failed to update report:', error)
    }
  }

  const unpublishSection = async (sectionId: string, reportId: string) => {
    try {
      const response = await fetch(`/api/admin/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish' }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Unpublish failed:', data)
        throw new Error(data.error || 'Failed to unpublish')
      }

      // Mark report as resolved
      await updateReportStatus(reportId, 'resolved')
      
      fetchReports()
    } catch (error: any) {
      console.error('Failed to unpublish section:', error)
      alert(`Failed to unpublish section: ${error.message}`)
    }
  }

  const deleteSection = async (sectionId: string, reportId: string) => {
    try {
      const response = await fetch(`/api/admin/sections/${sectionId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Delete failed:', data)
        throw new Error(data.error || 'Failed to delete')
      }

      // Mark report as resolved
      await updateReportStatus(reportId, 'resolved')

      fetchReports()
    } catch (error: any) {
      console.error('Failed to delete section:', error)
      alert(`Failed to delete section: ${error.message}`)
    }
  }

  const handleConfirmAction = () => {
    if (!confirmAction.sectionId || !confirmAction.reportId) return

    if (confirmAction.type === 'unpublish') {
      unpublishSection(confirmAction.sectionId, confirmAction.reportId)
    } else if (confirmAction.type === 'delete') {
      deleteSection(confirmAction.sectionId, confirmAction.reportId)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmAction.type !== null}
        onClose={() => setConfirmAction({ type: null, sectionId: null, reportId: null })}
        onConfirm={handleConfirmAction}
        title={
          confirmAction.type === 'unpublish'
            ? 'Unpublish Section'
            : 'Delete Section'
        }
        message={
          confirmAction.type === 'unpublish'
            ? `Are you sure you want to unpublish "${confirmAction.sectionTitle}"? It will be hidden from public view but can be republished later.`
            : `PERMANENTLY DELETE "${confirmAction.sectionTitle}"? This action cannot be undone. Consider unpublishing instead if you want to keep the content.`
        }
        confirmText={confirmAction.type === 'unpublish' ? 'Unpublish' : 'Delete'}
        variant={confirmAction.type === 'delete' ? 'danger' : 'warning'}
      />

      {checking ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-400">Checking permissions...</div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-white mb-2">
            Content Reports
          </h1>
          <p className="text-gray-400">
            Review and manage reported content
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['pending', 'reviewed', 'resolved', 'dismissed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No {filter !== 'all' ? filter : ''} reports
            </h3>
            <p className="text-gray-500">
              {filter === 'pending' ? 'All caught up!' : 'No reports found with this status'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-gray-400">
                        {REASON_LABELS[report.reason]?.icon || <AlertTriangle className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {REASON_LABELS[report.reason]?.label || report.reason}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(report.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {report.sections && (
                      <div className="mt-3 p-3 bg-black rounded border border-gray-800">
                        <div className="text-sm text-gray-400 mb-1">Reported Section:</div>
                        <Link
                          href={`/s/${report.section_id}`}
                          target="_blank"
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          {report.sections.title}
                        </Link>
                        <div className="text-sm text-gray-500 mt-1">
                          by @{report.sections.profiles.username}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[report.status]}`}>
                    {report.status}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {report.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateReportStatus(report.id, 'reviewed')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => updateReportStatus(report.id, 'dismissed')}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition text-sm"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: 'unpublish',
                            sectionId: report.section_id,
                            reportId: report.id,
                            sectionTitle: report.sections?.title || 'this section',
                          })
                        }
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
                      >
                        Unpublish Section
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: 'delete',
                            sectionId: report.section_id,
                            reportId: report.id,
                            sectionTitle: report.sections?.title || 'this section',
                          })
                        }
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                      >
                        Delete Section
                      </button>
                    </>
                  )}
                  
                  {report.status === 'reviewed' && (
                    <>
                      <button
                        onClick={() => updateReportStatus(report.id, 'resolved')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        Mark Resolved
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: 'unpublish',
                            sectionId: report.section_id,
                            reportId: report.id,
                            sectionTitle: report.sections?.title || 'this section',
                          })
                        }
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm"
                      >
                        Unpublish Section
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: 'delete',
                            sectionId: report.section_id,
                            reportId: report.id,
                            sectionTitle: report.sections?.title || 'this section',
                          })
                        }
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                      >
                        Delete Section
                      </button>
                    </>
                  )}

                  <Link
                    href={`/s/${report.section_id}`}
                    target="_blank"
                    className="px-4 py-2 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 rounded-lg transition text-sm"
                  >
                    View Section →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  )
}
