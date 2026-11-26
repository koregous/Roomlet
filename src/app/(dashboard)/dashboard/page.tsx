'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, AlertCircle, ArrowUp, ArrowDown, LayoutGrid, LayoutList } from 'lucide-react'
import { useProfile } from '@/features/profile/hooks/useProfile'
import { useSections } from '@/features/sections/hooks/useSections'
import ProfileEditor from '@/features/profile/components/ProfileEditor'
import BlockSectionEditor from '@/features/sections/components/BlockSectionEditor'
import StorageQuotaWidget from '@/shared/components/StorageQuotaWidget'
import SectionLimitWidget from '@/shared/components/SectionLimitWidget'

export default function DashboardPage() {
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
    addSection,
    deleteSection,
    reorderSections,
    uploadGalleryImage,
  } = useSections(profile?.id)

  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const isAnySaving = useMemo(() => {
    return Object.values(autoSaving).some(saving => saving) || savingSectionId !== null
  }, [autoSaving, savingSectionId])

  const totalAudioBlocks = useMemo(() => {
    return sections.reduce((count, section) => {
      const audioBlocks = section.blocks.filter(block => block.type === 'audio')
      return count + audioBlocks.length
    }, 0)
  }, [sections])

  useEffect(() => {
    loadProfile().then((p) => {
      if (p?.id) loadSections(p.id as string)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleProfileSaved = () => {
    if (profile?.id) loadSections(profile.id as string)
  }

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const sortedSections = useMemo(() => {
    return sortOrder === 'newest' 
      ? [...sections].reverse() 
      : sections
  }, [sections, sortOrder])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-gray-800 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Profile not found</p>
          <button
            onClick={() => loadProfile().then((p) => { if (p?.id) loadSections(p.id as string) })}
            className="mt-4 ui-btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {isAnySaving && (
        <div className="fixed top-4 right-4 z-50 bg-ink-raised border border-ink-line rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 bg-accent rounded-full animate-pulse" />
            <span className="text-gray-300">Saving...</span>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <ProfileEditor profile={profile} onSaved={handleProfileSaved} />

        <div className="mt-6">
          <StorageQuotaWidget userId={profile.user_id} />
        </div>

        <div className="mt-3">
          <SectionLimitWidget userId={profile.user_id} currentCount={sections.length} />
        </div>

        <div className="ui-card p-6 sm:p-8 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h3 className="text-2xl font-serif">Sections</h3>
            
            {sections.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="ui-btn-secondary ui-btn-sm"
                  title={sortOrder === 'newest' ? 'Showing newest first' : 'Showing oldest first'}
                >
                  {sortOrder === 'newest' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                </button>

                {sections.length > 1 && (
                  <button
                    onClick={() => {
                      // Toggle between all expanded and all collapsed
                      if (collapsedSections.size === sections.length) {
                        // Currently all collapsed, expand all
                        setCollapsedSections(new Set())
                      } else {
                        // Some or all expanded, collapse all
                        setCollapsedSections(new Set(sections.map(s => s.id)))
                      }
                    }}
                    className="ui-btn-secondary ui-btn-sm"
                    title={collapsedSections.size === sections.length ? 'Expand all sections' : 'Collapse all sections'}
                  >
                    {collapsedSections.size === sections.length ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
                    {collapsedSections.size === sections.length ? 'Expand All' : 'Collapse All'}
                  </button>
                )}

                <button
                  onClick={() => addSection()}
                  className="ui-btn-primary"
                >
                  <Plus size={16} />
                  Add Section
                </button>
              </div>
            )}

            {sections.length === 0 && (
              <button
                onClick={() => addSection()}
                className="ui-btn-primary"
              >
                <Plus size={16} />
                Add Section
              </button>
            )}
          </div>

          {sections.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="mb-2">No sections yet</p>
              <p className="text-sm text-gray-600">Add a section to begin</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {sortedSections.map((section) => {
                  const edit = sectionEdits[section.id]
                  if (!edit) return null
                  
                  // Find the actual index in the original sections array (for reordering)
                  const originalIndex = sections.findIndex(s => s.id === section.id)
                  const isCollapsed = collapsedSections.has(section.id)
                  
                  return (
                    <BlockSectionEditor
                      key={section.id}
                      section={section}
                      edit={edit}
                      isSaving={savingSectionId === section.id}
                      isAutoSaving={autoSaving[section.id] || false}
                      justSaved={justSaved[section.id] || false}
                      sectionIndex={originalIndex}
                      totalSections={sections.length}
                      totalAudioBlocks={totalAudioBlocks}
                      profileId={profile.id}
                      username={profile.username}
                      onUpdate={(updater, options) => updateSectionEdit(section.id, updater, options)}
                      onSave={() => saveSection(section.id, { showToast: true })}
                      onDelete={() => deleteSection(section.id)}
                      onMoveSectionUp={() => reorderSections(originalIndex, originalIndex - 1)}
                      onMoveSectionDown={() => reorderSections(originalIndex, originalIndex + 1)}
                      uploadImage={(file) => uploadGalleryImage(file, section.id)}
                      isCollapsed={isCollapsed}
                      onToggleCollapse={() => toggleSectionCollapse(section.id)}
                    />
                  )
                })}
              </div>

              {/* Scroll to top button - shows when there are many sections */}
              {sections.length >= 3 && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={scrollToTop}
                    className="ui-btn-secondary"
                  >
                    <ArrowUp size={16} />
                    Back to Top
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}