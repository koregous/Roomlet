'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useProfile } from '@/features/profile/hooks/useProfile'
import { useSections } from '@/features/sections/hooks/useSections'
import BlockSectionEditor from '@/features/sections/components/BlockSectionEditor'
import { slugify } from '@/shared/lib/slug'

/** Only allow same-site relative paths as a "back" target (no open redirects) */
function isSafeInternalPath(path: string | null): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}

/**
 * /dashboard/sections/[id]
 *
 * Edit a single section on its own page. The owner reaches it from the
 * "Edit this section" button on their profile, so they can add/delete/move
 * images without going through the full dashboard. Ownership is inherent:
 * only the signed-in user's own sections are loaded, and RLS enforces it on
 * every write.
 */
function EditSectionInner() {
  const params = useParams<{ id: string }>()
  const sectionId = String(params.id)
  const searchParams = useSearchParams()

  const { profile, loading, loadProfile } = useProfile()
  const {
    sections,
    sectionEdits,
    savingSectionId,
    autoSaving,
    justSaved,
    loadSections,
    updateSectionEdit,
    saveSection,
    deleteSection,
    uploadGalleryImage,
  } = useSections(profile?.id)

  const [sectionsLoaded, setSectionsLoaded] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    loadProfile().then(async (p) => {
      if (p?.id) await loadSections(p.id as string)
      setSectionsLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const section = sections.find((s) => s.id === sectionId)
  const edit = sectionEdits[sectionId]

  const isAnySaving = useMemo(
    () => Object.values(autoSaving).some(Boolean) || savingSectionId !== null,
    [autoSaving, savingSectionId]
  )

  // Audio blocks are limited across *all* of the user's sections
  const totalAudioBlocks = useMemo(
    () =>
      sections.reduce(
        (count, s) => count + s.blocks.filter((block) => block.type === 'audio').length,
        0
      ),
    [sections]
  )

  const fromParam = searchParams.get('from')
  const backHref = isSafeInternalPath(fromParam)
    ? fromParam
    : profile
      ? section
        ? `/${profile.username}?section=${slugify(section.title)}`
        : `/${profile.username}`
      : '/dashboard'

  // Revalidate the cached public profile so it shows the edits right away
  const revalidateProfile = async () => {
    if (!profile) return
    try {
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: profile.username }),
      })
    } catch {
      // best-effort: the profile still refreshes on its own within ~30s
    }
  }

  // Leave the page without losing edits. Auto-save is debounced and its timer is
  // cleared on unmount, so flush one save first. A full navigation (rather than a
  // client-side push) guarantees the profile is re-fetched, not served from the
  // router cache.
  const leave = async (href: string) => {
    if (leaving) return
    setLeaving(true)
    try {
      if (section && edit) await saveSection(section.id, { showToast: false })
      await revalidateProfile()
    } finally {
      window.location.assign(href)
    }
  }

  if (loading || !sectionsLoaded || leaving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-gray-800 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">{leaving ? 'Saving...' : 'Loading section...'}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Profile not found</p>
      </div>
    )
  }

  if (!section || !edit) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-300 mb-2">Section not found</p>
          <p className="text-sm text-gray-500 mb-6">
            It may have been deleted, or it doesn&apos;t belong to your account.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-white text-black hover:bg-gray-200 transition rounded-lg text-sm"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Auto-save indicator */}
      {isAnySaving && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-gray-300">Saving...</span>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={() => leave(backHref)}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={16} />
            Back to profile
          </button>

          <button
            onClick={() => leave('/dashboard')}
            className="text-sm text-gray-500 hover:text-white transition"
          >
            All sections &amp; profile settings
          </button>
        </div>

        <BlockSectionEditor
          section={section}
          edit={edit}
          isSaving={savingSectionId === section.id}
          isAutoSaving={autoSaving[section.id] || false}
          justSaved={justSaved[section.id] || false}
          sectionIndex={0}
          totalSections={1}
          totalAudioBlocks={totalAudioBlocks}
          profileId={profile.id}
          username={profile.username}
          onUpdate={(updater, options) => updateSectionEdit(section.id, updater, options)}
          onSave={() => saveSection(section.id, { showToast: true })}
          onDelete={async () => {
            const deleted = await deleteSection(section.id)
            if (deleted) {
              setLeaving(true)
              await revalidateProfile()
              window.location.assign(`/${profile.username}`)
            }
          }}
          uploadImage={(file) => uploadGalleryImage(file, section.id)}
        />
      </div>
    </div>
  )
}

// useSearchParams requires a Suspense boundary for statically rendered pages
export default function EditSectionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <EditSectionInner />
    </Suspense>
  )
}
