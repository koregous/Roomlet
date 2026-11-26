'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { Section, Block } from '@/shared/lib/types'
import { useToast } from '@/shared/components/Toast'
import { validateSectionTitle } from '@/shared/lib/content-moderation'

export type SectionEdit = {
  title: string
  blocks: Block[]
  visible: boolean
  is_nsfw?: boolean
}

const AUTO_SAVE_DELAY = 2000 // 2s debounce — gives batch uploads time to land before saving
const SAVED_INDICATOR_DURATION = 2000 // Show "Saved" for 2 seconds

// Stale-while-revalidate cache (client only, see useProfile.ts). Keyed by profile id.
let cachedSections: { profileId: string; sections: Section[]; edits: Record<string, SectionEdit> } | null = null

export function useSections(profileId: string | undefined) {
  const initial = cachedSections && cachedSections.profileId === profileId ? cachedSections : null
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? [])
  const [sectionEdits, setSectionEdits] = useState<Record<string, SectionEdit>>(initial?.edits ?? {})
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null)
  const [autoSaving, setAutoSaving] = useState<Record<string, boolean>>({})
  const [justSaved, setJustSaved] = useState<Record<string, boolean>>({})
  const supabase = getSupabaseBrowserClient()
  const { addToast } = useToast()

  const sectionsRef = useRef<Section[]>(sections)
  sectionsRef.current = sections

  // Keep ref to latest sectionEdits for auto-save
  const sectionEditsRef = useRef<Record<string, SectionEdit>>(sectionEdits)
  sectionEditsRef.current = sectionEdits

  const autoSaveTimers = useRef<Record<string, NodeJS.Timeout>>({})
  
  const savedIndicatorTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoSaveTimers.current).forEach(timer => clearTimeout(timer))
      Object.values(savedIndicatorTimers.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

  const loadSections = useCallback(
    async (id: string) => {
      const { data: sectionsData } = await supabase
        .from('sections')
        .select('*')
        .eq('profile_id', id)
        .order('position')

      if (sectionsData) {
        const typed = sectionsData as unknown as Section[]
        setSections(typed)
        sectionsRef.current = typed
        
        const edits: Record<string, SectionEdit> = {}
        typed.forEach((s) => {
          edits[s.id] = {
            title: s.title,
            blocks: s.blocks || [],
            visible: s.visible ?? true,
            is_nsfw: s.is_nsfw || false,
          }
        })
        setSectionEdits(edits)
        cachedSections = { profileId: id, sections: typed, edits }
      }
    },
    [supabase]
  )

  const updateSectionEdit = useCallback(
    (id: string, updater: (prev: SectionEdit) => SectionEdit, options?: { skipAutoSave?: boolean }) => {
      setSectionEdits((prev) => ({
        ...prev,
        [id]: updater(prev[id] || { title: '', blocks: [], visible: true, is_nsfw: false }),
      }))

      // Clear "Saved" indicator when editing
      setJustSaved((prev) => ({ ...prev, [id]: false }))
      if (savedIndicatorTimers.current[id]) {
        clearTimeout(savedIndicatorTimers.current[id])
        delete savedIndicatorTimers.current[id]
      }

      // Trigger auto-save unless explicitly skipped
      if (!options?.skipAutoSave) {
        // Clear existing timer for this section
        if (autoSaveTimers.current[id]) {
          clearTimeout(autoSaveTimers.current[id])
        }

        // Set new timer - use arrow function to capture latest state
        autoSaveTimers.current[id] = setTimeout(() => {
          performAutoSave(id)
        }, AUTO_SAVE_DELAY)
      }
    },
    []
  )

  // Separate function to perform auto-save (avoids stale closure)
  const performAutoSave = useCallback(async (id: string) => {
    const edits = sectionEditsRef.current[id]
    if (!edits) {
      console.warn('[useSections] No edits found for section:', id)
      return
    }

    // Snapshot the blocks we're about to save. We'll compare after the
    // async DB call to detect whether new images landed while we waited.
    const blocksSnapshotJSON = JSON.stringify(edits.blocks)

    console.log('[useSections] Auto-saving section:', id, edits)

    if (edits.title) {
      const titleValidation = validateSectionTitle(edits.title)
      if (!titleValidation.valid) {
        addToast(titleValidation.reason || 'Section title contains inappropriate language', 'error')
        return
      }
    }

    setAutoSaving((prev) => ({ ...prev, [id]: true }))

    const { error, data } = await supabase
      .from('sections')
      .update({
        title: edits.title,
        blocks: edits.blocks,
        visible: edits.visible,
        is_nsfw: edits.is_nsfw || false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      console.log('[useSections] Auto-save successful:', id)
      
      const savedData = data as unknown as Section

      // Check whether blocks changed while the DB round-trip was in-flight
      // (e.g. more images from a batch upload landed during the await).
      // If so, keep the newer local blocks — don't overwrite with the stale
      // DB response. Only sync metadata fields (title, visible, is_nsfw).
      setSectionEdits((prev) => {
        const current = prev[id]
        const currentBlocksJSON = JSON.stringify(current?.blocks)
        const blocksChangedDuringFlight = currentBlocksJSON !== blocksSnapshotJSON

        return {
          ...prev,
          [id]: {
            // Always take the DB's metadata (title/visible/nsfw are safe to sync)
            title: savedData.title,
            visible: savedData.visible ?? true,
            is_nsfw: savedData.is_nsfw || false,
            // Only take DB blocks if nothing changed locally during the save.
            // If uploads landed during the round-trip, keep the newer local blocks.
            blocks: blocksChangedDuringFlight
              ? (current?.blocks || savedData.blocks || [])
              : (savedData.blocks || []),
          },
        }
      })

      // Update sections list (sections[] entry) — used for display only, blocks
      // display comes from sectionEdits, so this is fine to sync from DB.
      setSections((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...savedData, blocks: s.blocks } : s
        )
        sectionsRef.current = next
        return next
      })

      // Synchronize item index (best-effort, don't block on failure)
      fetch(`/api/sections/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      }).catch((syncError) => {
        console.warn('[useSections] Failed to sync item index:', syncError)
      })

      setJustSaved((prev) => ({ ...prev, [id]: true }))
      
      // Hide "Saved" indicator after delay
      savedIndicatorTimers.current[id] = setTimeout(() => {
        setJustSaved((prev) => ({ ...prev, [id]: false }))
        delete savedIndicatorTimers.current[id]
      }, SAVED_INDICATOR_DURATION)
      
    } else if (error) {
      console.error('[useSections] Auto-save error:', error)
      addToast('Auto-save failed', 'error')
    }

    setAutoSaving((prev) => ({ ...prev, [id]: false }))
  }, [supabase, addToast])

  // Keep old autoSaveSection for backwards compatibility
  const autoSaveSection = useCallback((id: string) => {
    performAutoSave(id)
  }, [performAutoSave])

  const saveSection = useCallback(
    async (id: string, options?: { showToast?: boolean }) => {
      const edits = sectionEdits[id]
      if (!edits) return

      if (autoSaveTimers.current[id]) {
        clearTimeout(autoSaveTimers.current[id])
        delete autoSaveTimers.current[id]
      }

      if (edits.title) {
        const titleValidation = validateSectionTitle(edits.title)
        if (!titleValidation.valid) {
          addToast(titleValidation.reason || 'Section title contains inappropriate language', 'error')
          return
        }
      }

      setSavingSectionId(id)

      const { error, data } = await supabase
        .from('sections')
        .update({
          title: edits.title,
          blocks: edits.blocks,
          visible: edits.visible,
          is_nsfw: edits.is_nsfw || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (!error && data) {
        if (options?.showToast) {
          addToast('Section saved successfully!', 'success')
        }
        const savedData = data as unknown as Section
        setSectionEdits((prev) => ({
          ...prev,
          [id]: {
            title: savedData.title,
            blocks: savedData.blocks || [],
            visible: savedData.visible ?? true,
            is_nsfw: savedData.is_nsfw || false,
          },
        }))
        setSections((prev) => {
          const next = prev.map((s) => (s.id === id ? savedData : s))
          sectionsRef.current = next
          return next
        })

        // Synchronize item index (best-effort, don't block on failure)
        fetch(`/api/sections/${id}/sync`, {
          method: 'POST',
          credentials: 'include',
        }).catch((syncError) => {
          console.warn('[useSections] Failed to sync item index:', syncError)
        })
      } else if (error) {
        addToast('Failed to save section', 'error')
        console.error('[useSections] Save error:', error)
      }

      setSavingSectionId(null)
    },
    [sectionEdits, supabase, addToast]
  )

  const addSection = useCallback(
    async () => {
      if (!profileId) return

      // Check section limit before creating
      try {
        const response = await fetch('/api/sections/check-limit', {
          method: 'GET',
          credentials: 'include',
        })
        
        const result = await response.json()
        
        if (!result.allowed) {
          addToast(result.error || 'Section limit reached', 'error', 5000)
          return
        }
      } catch (error) {
        console.error('[useSections] Failed to check section limit:', error)
        // Continue anyway if check fails (don't block user)
      }

      const { error, data } = await supabase.from('sections').insert({
        profile_id: profileId,
        title: 'New Section',
        blocks: [],
        position: sectionsRef.current.length,
      }).select().single()

      if (!error && data) {
        addToast('Section added!', 'success')
        
        // Synchronize item index (best-effort, don't block on failure)
        try {
          await fetch(`/api/sections/${data.id}/sync`, {
            method: 'POST',
            credentials: 'include',
          })
        } catch (syncError) {
          console.warn('[useSections] Failed to sync item index:', syncError)
        }
        
        await loadSections(profileId)
      } else {
        addToast('Failed to add section', 'error')
      }
    },
    [profileId, supabase, addToast, loadSections]
  )

  const deleteSection = useCallback(
    async (sectionId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/sections/${sectionId}`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to delete section')
        }

        const result = await response.json()
        
        // Log Cloudinary deletion summary if available
        if (result.cloudinaryDeletion) {
          const { succeeded, failed, total } = result.cloudinaryDeletion
          console.log(
            `[useSections] Deleted ${succeeded}/${total} Cloudinary assets (${failed} failed)`
          )
        }

        addToast('Section deleted successfully!', 'success')
        if (profileId) await loadSections(profileId)
        return true
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to delete section'
        addToast(msg, 'error')
        console.error('[useSections] Delete error:', error)
        return false
      }
    },
    [profileId, addToast, loadSections]
  )

  const reorderSections = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return

      const reordered = [...sectionsRef.current]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)

      setSections(reordered)
      sectionsRef.current = reordered

      const updates = reordered.map((s, i) => ({ id: s.id, position: i }))

      const results = await Promise.all(
        updates.map(({ id, position }) =>
          supabase.from('sections').update({ position }).eq('id', id)
        )
      )

      const hasError = results.some((r: any) => r.error)
      if (hasError) {
        addToast('Failed to reorder sections', 'error')
        if (profileId) await loadSections(profileId)
      }
    },
    [supabase, addToast, profileId, loadSections]
  )

  const uploadGalleryImage = useCallback(
    async (file: File, sectionId: string) => {
      try {
        const { compressImage, validateImageFile, COMPRESSION_PRESETS } = await import(
          '@/shared/lib/image-compress'
        )

        const validation = validateImageFile(file)
        if (!validation.valid) {
          addToast(validation.error || 'Invalid file', 'error')
          return null
        }

        // Compress image before upload
        addToast('Compressing image...', 'info')
        const compressedFile = await compressImage(file, COMPRESSION_PRESETS.gallery)

        const formData = new FormData()
        formData.append('file', compressedFile)
        formData.append('sectionId', sectionId)

        const response = await fetch('/api/upload/gallery', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()
        addToast('Image uploaded successfully!', 'success')
        return data.url
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        addToast(`Failed to upload image: ${msg}`, 'error')
        return null
      }
    },
    [addToast]
  )

  return {
    sections,
    sectionEdits,
    savingSectionId,
    autoSaving,
    justSaved,
    loadSections,
    updateSectionEdit,
    saveSection,
    autoSaveSection,
    addSection,
    deleteSection,
    reorderSections,
    uploadGalleryImage,
  }
}
