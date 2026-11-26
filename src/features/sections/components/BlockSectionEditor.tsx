'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Trash2, Plus, AlertCircle, Globe, Link2, Check, Image as ImagesIcon, FolderOpen, ShieldAlert, Code, Sparkles } from 'lucide-react'
import { Section, Block } from '@/shared/lib/types'
import { SectionEdit } from '@/features/sections/hooks/useSections'
import { slugify } from '@/shared/lib/slug'
import BlockPicker from './BlockPicker'
import PublishDialog from './PublishDialog'
import EmbedCodeDialog from '@/shared/components/EmbedCodeDialog'
import ConfirmDialog from '@/shared/components/ConfirmDialog'
import SubmissionSuccessDialog from '@/shared/components/SubmissionSuccessDialog'
import { FileValidationDialog } from '@/shared/components/FileValidationDialog'
import { validateImageFile } from '@/shared/lib/image-compress'
import { useUploadWorker } from '@/shared/lib/uploadWorker'
import { useUploadQueue } from '@/shared/stores/uploadQueueStore'
import { useUploadQueueObserver } from '@/shared/hooks/useUploadQueueObserver'
import { useToast } from '@/shared/components/Toast'
import { insertUploadedGalleryImage, reorderGalleryImages } from '@/shared/lib/gallery-order'
import EmbedBlock from './blocks/EmbedBlock'
import { parseEmbedUrl, validateEmbedUrl, sanitizeIframe } from '@/shared/lib/embed-parser'

interface ImageDeleteState {
  blockId: string
  imageIndex: number
  mode?: 'delete' | 'edit'
  displayIdx?: number
}

interface Props {
  section: Section
  edit: SectionEdit
  isSaving: boolean
  isAutoSaving?: boolean
  justSaved?: boolean
  sectionIndex: number
  totalSections: number
  totalAudioBlocks: number
  profileId: string // Add profile ID for Cloudinary uploads
  username: string // Username for shareable links
  onUpdate: (updater: (prev: SectionEdit) => SectionEdit, options?: { skipAutoSave?: boolean }) => void
  onSave: () => void
  onDelete: () => void
  /** Omit both to hide the reorder arrows (e.g. when editing a single section on its own page) */
  onMoveSectionUp?: () => void
  onMoveSectionDown?: () => void
  uploadImage: (file: File) => Promise<string | null>
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export default function BlockSectionEditor({
  section,
  edit,
  isSaving,
  isAutoSaving = false,
  justSaved = false,
  sectionIndex,
  totalSections,
  totalAudioBlocks,
  profileId,
  username,
  onUpdate,
  onSave,
  onDelete,
  onMoveSectionUp,
  onMoveSectionDown,
  uploadImage,
  isCollapsed = false,
  onToggleCollapse,
}: Props) {
  // Only use local collapse state if no parent controller provided
  const [localCollapsed, setLocalCollapsed] = useState(false) // Default expanded when no controller
  const collapsed = onToggleCollapse ? isCollapsed : localCollapsed
  
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingBlockDelete, setConfirmingBlockDelete] = useState<string | null>(null)
  const [confirmingImageDelete, setConfirmingImageDelete] = useState<ImageDeleteState | null>(null)
  
  const [validationError, setValidationError] = useState<{
    error: string
    fileName?: string
    fileSize?: number
  } | null>(null)
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showEmbedDialog, setShowEmbedDialog] = useState(false)
  const [showSubmissionSuccess, setShowSubmissionSuccess] = useState(false)
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyLink = async () => {
    const sectionSlug = slugify(section.title)
    const sectionUrl = `${window.location.origin}/${username}/${sectionSlug}`
    
    try {
      await navigator.clipboard.writeText(sectionUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleUnpublish = async () => {
    setIsUnpublishing(true)
    try {
      console.log('Unpublishing section:', section.id)
      const response = await fetch(`/api/sections/publish?sectionId=${section.id}`, {
        method: 'DELETE'
      })

      console.log('Unpublish response status:', response.status)
      
      if (!response.ok) {
        const data = await response.json()
        console.error('Unpublish error:', data)
        throw new Error(data.error || 'Failed to unpublish')
      }

      const result = await response.json()
      console.log('Unpublish successful:', result)
      
      // Refresh the page to show updated state
      window.location.reload()
    } catch (err: any) {
      console.error('Unpublish exception:', err)
      alert(err.message || 'Failed to unpublish section. Check console for details.')
      setIsUnpublishing(false)
      setConfirmingUnpublish(false)
    }
  }

  // Handle republish (when already approved, just set published=true again)
  const [isPublishing, setIsPublishing] = useState(false)
  const handleRepublish = async () => {
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/sections/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: section.id })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to republish')
      }

      // Refresh to show updated state
      window.location.reload()
    } catch (err: any) {
      console.error('Republish error:', err)
      alert(err.message || 'Failed to republish section')
      setIsPublishing(false)
    }
  }

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      content: getDefaultContent(type),
      position: edit.blocks.length,
    }

    onUpdate((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }))
  }

  const removeBlock = (blockId: string) => {
    onUpdate((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }))
  }

  const updateBlock = (blockId: string, updates: Partial<Block>, options?: { skipAutoSave?: boolean }) => {
    onUpdate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
    }), options)
  }

  const moveBlockUp = (index: number) => {
    if (index === 0) return
    
    onUpdate((prev) => {
      const newBlocks = [...prev.blocks]
      ;[newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]]
      return {
        ...prev,
        blocks: newBlocks.map((b, i) => ({ ...b, position: i })),
      }
    })
  }

  const moveBlockDown = (index: number) => {
    onUpdate((prev) => {
      if (index === prev.blocks.length - 1) return prev
      
      const newBlocks = [...prev.blocks]
      ;[newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]]
      return {
        ...prev,
        blocks: newBlocks.map((b, i) => ({ ...b, position: i })),
      }
    })
  }

  const moveBlock = (fromIndex: number, toIndex: number) => {
    onUpdate((prev) => {
      const newBlocks = [...prev.blocks]
      const [movedBlock] = newBlocks.splice(fromIndex, 1)
      newBlocks.splice(toIndex, 0, movedBlock)
      return {
        ...prev,
        blocks: newBlocks.map((b, i) => ({ ...b, position: i })),
      }
    })
  }

  return (
    <>
      <FileValidationDialog
        isOpen={!!validationError}
        onClose={() => setValidationError(null)}
        error={validationError?.error || ''}
        fileName={validationError?.fileName}
        fileSize={validationError?.fileSize}
      />

      <div className="border border-ink-line rounded-lg overflow-hidden transition hover:border-gray-700">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-black flex-wrap sm:flex-nowrap">
        {/* Section reorder - hidden on mobile, and when the parent doesn't support reordering */}
        {onMoveSectionUp && onMoveSectionDown && (
          <div className="hidden sm:flex flex-col gap-0.5 shrink-0">
            <button
              onClick={onMoveSectionUp}
              disabled={sectionIndex === 0}
              className="p-0.5 text-gray-600 hover:text-white disabled:opacity-20 transition"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={onMoveSectionDown}
              disabled={sectionIndex === totalSections - 1}
              className="p-0.5 text-gray-600 hover:text-white disabled:opacity-20 transition"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 min-w-0 order-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm truncate block">
              {edit.title || section.title}
            </span>
            {isAutoSaving && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400 shrink-0">
                <div className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-pulse" />
                Saving...
              </span>
            )}
            {!isAutoSaving && justSaved && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 shrink-0">
                <Check size={12} />
                Saved
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{edit.blocks.length} blocks</span>
        </div>

        {/* Collapse toggle - always visible, prominent on mobile */}
        <button
          onClick={onToggleCollapse ? onToggleCollapse : () => setLocalCollapsed((c) => !c)}
          className="p-2 sm:p-1.5 text-gray-400 hover:text-white transition shrink-0 order-2 -mr-1 sm:mr-0"
          title={collapsed ? "Expand section" : "Collapse section"}
        >
          <ChevronDown
            size={20}
            className={`sm:w-4 sm:h-4 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>

        {/* Status indicators and actions - wrap on mobile */}
        <div className="flex items-center gap-2 sm:gap-3 order-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              edit.visible ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />

          {section.approval_status === 'pending' && (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded shrink-0">
              ⏳ Pending Review
            </span>
          )}
          {section.approval_status === 'approved' && section.published && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded shrink-0">
              <Globe size={10} />
              Published
            </span>
          )}
          {section.approval_status === 'rejected' && (
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded shrink-0">
              ✗ Rejected
            </span>
          )}

          {(!section.approval_status || section.approval_status === 'draft') && !section.published && (
            <button
              onClick={() => setShowPublishDialog(true)}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 shrink-0"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">Submit for Review</span>
            </button>
          )}
          
          {section.approval_status === 'rejected' && (
            <button
              onClick={() => setShowPublishDialog(true)}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 shrink-0"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">Resubmit</span>
            </button>
          )}
          
          {section.approval_status === 'pending' && (
            <span className="text-[10px] text-gray-500 shrink-0">Awaiting approval...</span>
          )}
          
          {section.approval_status === 'approved' && section.published && (
            <button
              onClick={() => setConfirmingUnpublish(true)}
              disabled={isUnpublishing}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">{isUnpublishing ? 'Unpublishing...' : 'Unpublish'}</span>
            </button>
          )}

          {section.approval_status === 'approved' && !section.published && (
            <button
              onClick={handleRepublish}
              disabled={isPublishing}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">{isPublishing ? 'Publishing...' : 'Republish'}</span>
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="p-1.5 text-gray-500 hover:text-white transition shrink-0"
            title="Copy shareable link"
          >
            {linkCopied ? <Check size={15} className="text-green-400" /> : <Link2 size={15} />}
          </button>

          {/* Embed button - only show for published sections */}
          {section.approval_status === 'approved' && section.published && (
            <button
              onClick={() => setShowEmbedDialog(true)}
              className="p-1.5 text-gray-500 hover:text-white transition shrink-0"
              title="Get embed code"
            >
              <Code size={15} />
            </button>
          )}

          {confirmingDelete ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 hidden sm:inline">Delete?</span>
              <button
                onClick={() => {
                  setConfirmingDelete(false)
                  onDelete()
                }}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:text-white rounded"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="p-1.5 text-gray-600 hover:text-red-400 transition shrink-0"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4 border-t border-ink-line/60">
          {section.approval_status === 'rejected' && section.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-400 mb-1">Section Rejected</h4>
                  <p className="text-sm text-gray-300">{section.rejection_reason}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Edit your section and click "Resubmit" to try again.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                Title
              </label>
              <input
                type="text"
                value={edit.title}
                onChange={(e) => onUpdate((prev) => ({ ...prev, title: e.target.value }))}
                className="ui-field"
              />
            </div>
            <div className="space-y-3 pt-6">
              <div className="flex items-center gap-2">
                <input
                  id={`visible-${section.id}`}
                  type="checkbox"
                  checked={edit.visible}
                  onChange={(e) => onUpdate((prev) => ({ ...prev, visible: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor={`visible-${section.id}`} className="text-sm text-gray-300">
                  Visible on profile
                </label>
              </div>
              
              {/* NSFW Toggle */}
              <div className="flex items-center gap-2">
                <input
                  id={`nsfw-${section.id}`}
                  type="checkbox"
                  checked={edit.is_nsfw || false}
                  onChange={(e) => onUpdate((prev) => ({ ...prev, is_nsfw: e.target.checked }))}
                  className="h-4 w-4 accent-red-500"
                />
                <label htmlFor={`nsfw-${section.id}`} className="text-sm text-red-400 flex items-center gap-1.5">
                  <ShieldAlert size={14} />
                  Mark as NSFW
                  <span className="text-xs text-gray-500">(18+ content)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase tracking-wide text-gray-500">Blocks</label>
              <button
                onClick={() => setShowBlockPicker(true)}
                className="flex items-center gap-2 text-sm px-4 py-2 bg-white text-black hover:bg-gray-200 rounded transition"
              >
                <Plus size={16} />
                Add Block
              </button>
            </div>

            {edit.blocks.length === 0 ? (
              <button
                onClick={() => setShowBlockPicker(true)}
                className="w-full py-12 text-sm text-gray-600 border-2 border-dashed border-ink-line hover:border-gray-700 hover:text-gray-400 rounded transition"
              >
                <Plus size={20} className="mx-auto mb-2" />
                Click to add your first block
              </button>
            ) : (
              <div className="space-y-3">
                {edit.blocks.map((block, idx) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={idx}
                    totalBlocks={edit.blocks.length}
                    sectionId={section.id}
                    profileId={profileId}
                    onUpdate={(updates, options) => updateBlock(block.id, updates, options)}
                    onRemove={() => removeBlock(block.id)}
                    onMoveUp={() => moveBlockUp(idx)}
                    onMoveDown={() => moveBlockDown(idx)}
                    onMove={(toIndex) => moveBlock(idx, toIndex)}
                    uploadImage={uploadImage}
                    onValidationError={setValidationError}
                    confirmingBlockDelete={confirmingBlockDelete}
                    setConfirmingBlockDelete={setConfirmingBlockDelete}
                    confirmingImageDelete={confirmingImageDelete}
                    setConfirmingImageDelete={setConfirmingImageDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Auto-save indicator - removed Save button, changes auto-save now */}
        </div>
      )}

      <BlockPicker
        isOpen={showBlockPicker}
        onClose={() => setShowBlockPicker(false)}
        onSelectBlock={addBlock}
        existingAudioBlocksCount={totalAudioBlocks}
      />

      <PublishDialog
        sectionId={section.id}
        section={section}
        isOpen={showPublishDialog}
        onClose={() => setShowPublishDialog(false)}
        onSuccess={(galleryUrl) => {
          setShowSubmissionSuccess(true)
        }}
      />

      <ConfirmDialog
        isOpen={confirmingUnpublish}
        title="Unpublish Section"
        message="Are you sure you want to unpublish this section from the gallery? It will no longer be visible to other users."
        confirmText="Unpublish"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleUnpublish}
        onCancel={() => setConfirmingUnpublish(false)}
        isLoading={isUnpublishing}
      />

      <SubmissionSuccessDialog
        isOpen={showSubmissionSuccess}
        onClose={() => setShowSubmissionSuccess(false)}
      />

      <EmbedCodeDialog
        isOpen={showEmbedDialog}
        onClose={() => setShowEmbedDialog(false)}
        sectionId={section.id}
        sectionTitle={section.title}
      />
    </div>
    </>
  )
}

// Block editor for each type with upload support
function BlockEditor({
  block,
  index,
  totalBlocks,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onMove,
  sectionId,
  profileId,
  uploadImage,
  onValidationError,
  confirmingBlockDelete,
  setConfirmingBlockDelete,
  confirmingImageDelete,
  setConfirmingImageDelete,
}: {
  block: Block
  index: number
  totalBlocks: number
  onUpdate: (updates: Partial<Block>, options?: { skipAutoSave?: boolean }) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMove: (toIndex: number) => void
  sectionId: string
  profileId: string
  uploadImage: (file: File) => Promise<string | null>
  onValidationError: (error: { error: string; fileName?: string; fileSize?: number }) => void
  confirmingBlockDelete: string | null
  setConfirmingBlockDelete: (id: string | null) => void
  confirmingImageDelete: ImageDeleteState | null
  setConfirmingImageDelete: (val: ImageDeleteState | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [galleryDragIndex, setGalleryDragIndex] = useState<number | null>(null)
  const [galleryOverIndex, setGalleryOverIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const blockRef = useRef(block)
  const imagesRef = useRef(block.content.images || [])
  const { queueFiles } = useUploadWorker()
  const { addToast } = useToast()

  blockRef.current = block

  useEffect(() => {
    imagesRef.current = block.content.images || []
  }, [block.content.images])

  const handleGalleryUploadComplete = useCallback(
    async (task: { id: string; url?: string; queueIndex: number; queuedAt: number; file?: File; sectionId: string; blockId: string; batchId: string }) => {
      const url = task.url
      if (!url) return

      const latestBlock = blockRef.current
      const { queue: liveQueue } = useUploadQueue.getState()
      const batchSiblings = liveQueue
        .filter(
          (t) =>
            t.batchId === task.batchId &&
            t.status === 'success' &&
            t.url
        )
        .map((t) => ({ url: t.url as string, queueIndex: t.queueIndex }))

      const nextImages = insertUploadedGalleryImage(
        imagesRef.current,
        url,
        task.queueIndex,
        batchSiblings
      )
      imagesRef.current = nextImages

      // Check if there are still unfinished tasks in this batch.
      // If so, suppress auto-save — we don't want the timer to fire while
      // images are still mid-upload. The last image will trigger auto-save naturally.
      const stillPending = liveQueue.filter(
        (t) =>
          t.batchId === task.batchId &&
          (t.status === 'queued' || t.status === 'validating' ||
           t.status === 'compressing' || t.status === 'uploading')
      ).length
      const isFinalInBatch = stillPending === 0

      onUpdate(
        { content: { ...latestBlock.content, images: nextImages } },
        isFinalInBatch ? undefined : { skipAutoSave: true }
      )

      console.log(
        `[BlockEditor] Image appended in batch order at queueIndex ${task.queueIndex}.`,
        isFinalInBatch ? 'Final image — auto-save will fire.' : `${stillPending} upload(s) still in flight — auto-save suppressed.`
      )
      
      // Generate OG thumbnail if section needs it
      // Don't use a ref guard - rely on DB check via needsOGThumbnail
      try {
        if (task.file) {
          const { needsOGThumbnail, generateAndUploadOGThumbnail } = await import('@/shared/lib/og-thumbnail')
          
          // Check if section needs OG thumbnail (DB query)
          const needs = await needsOGThumbnail(sectionId)
          if (needs) {
            console.log('[BlockEditor] Section needs OG thumbnail, generating from first image')
            const ogUrl = await generateAndUploadOGThumbnail(task.file, sectionId)
            if (ogUrl) {
              console.log('[BlockEditor] OG thumbnail generated successfully:', ogUrl)
              addToast('Preview image generated for social sharing', 'success')
            } else {
              console.warn('[BlockEditor] OG thumbnail generation returned null')
            }
          } else {
            console.log('[BlockEditor] Section already has OG thumbnail, skipping')
          }
        } else {
          console.warn('[BlockEditor] Could not find original file in queue for OG generation')
        }
      } catch (error) {
        console.error('[BlockEditor] Failed to generate OG thumbnail:', error)
        // Non-critical error, don't block the upload flow
      }
    },
    [onUpdate, sectionId, addToast]
  )

  // Watch upload queue for completed uploads and get upload stats
  const { getUploadStats } = useUploadQueueObserver({
    sectionId,
    blockId: block.id,
    onUploadComplete: handleGalleryUploadComplete,
    onUploadError: (error, fileName) => {
      addToast(`Failed to upload ${fileName}: ${error}`, 'error')
    },
  })

  const uploadStats = getUploadStats()

  const handleImageUpload = async (file: File) => {
    // Validate file BEFORE attempting upload
    const validation = validateImageFile(file)
    if (!validation.valid) {
      onValidationError({
        error: validation.error || 'Invalid file',
        fileName: file.name,
        fileSize: file.size,
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return null
    }

    setUploading(true)
    const url = await uploadImage(file)
    setUploading(false)
    return url
  }

  const handleSingleImageUpload = async (file: File) => {
    const url = await handleImageUpload(file)
    if (url) {
      onUpdate({ content: { ...block.content, image: { url, caption: '' } } })
    }
  }

  const handleMultipleImageUpload = async (files: FileList) => {
    // Use upload worker for gallery uploads - handles validation, compression, rate limiting
    const filesArray = Array.from(files)
    
    // Queue all files - they'll be processed by the upload worker
    // Images will be added to the block as they complete via useUploadQueueObserver
    await queueFiles(filesArray, sectionId, block.id, (fileName, error) => {
      onValidationError({
        error,
        fileName,
      })
    })
    
    addToast(`Queued ${filesArray.length} image(s) for upload`, 'info')
  }

  const isGalleryImageDrag = (e: { dataTransfer: DataTransfer }) =>
    Array.from(e.dataTransfer.types).includes('application/x-roomlet-gallery-image')

  return (
    <div
      onDragOver={(e) => {
        if (isGalleryImageDrag(e)) return
        if (!e.dataTransfer.types.includes('application/x-roomlet-block')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        if (isGalleryImageDrag(e)) return
        const draggedIndex = parseInt(e.dataTransfer.getData('application/x-roomlet-block'))
        if (!isNaN(draggedIndex) && draggedIndex !== index) {
          e.preventDefault()
          onMove(index)
        }
      }}
      className="border border-ink-line p-3 rounded space-y-2 hover:border-gray-700 transition"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/x-roomlet-block', index.toString())
              e.dataTransfer.setData('text/plain', index.toString())
            }}
            className="shrink-0 text-gray-600 text-xs flex flex-col items-center w-6 cursor-grab active:cursor-grabbing"
            title="Drag to reorder block"
          >
            <div className="text-[10px]">⠿</div>
            <div className="text-[8px] -mt-1">drag</div>
          </div>
          <span className="text-xs text-gray-500 uppercase">{block.type}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-20 transition"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalBlocks - 1}
            className="text-xs text-gray-500 hover:text-white disabled:opacity-20 transition"
            title="Move down"
          >
            ▼
          </button>
          
          {confirmingBlockDelete === block.id ? (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-gray-400">Remove?</span>
              <button
                onClick={() => {
                  onRemove()
                  setConfirmingBlockDelete(null)
                }}
                className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmingBlockDelete(null)}
                className="text-xs px-2 py-0.5 border border-gray-700 text-gray-400 hover:text-white rounded"
              >
                No
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setConfirmingBlockDelete(block.id)} 
              className="text-xs text-gray-500 hover:text-red-400 ml-2"
            >
              Remove Block
            </button>
          )}
        </div>
      </div>

      {block.type === 'text' && (
        <textarea
          value={block.content.text || ''}
          onChange={(e) => onUpdate({ content: { ...block.content, text: e.target.value } })}
          className="ui-field resize-none font-mono text-xs"
          rows={3}
          placeholder="Enter text (supports **bold**, *italic*, [links](url))"
        />
      )}

      {block.type === 'quote' && (
        <>
          <div className="mb-2">
            <label className="text-xs text-gray-500 block mb-1">Style</label>
            <select
              value={block.content.quoteStyle || 'minimal'}
              onChange={(e) =>
                onUpdate({ content: { ...block.content, quoteStyle: e.target.value as 'minimal' | 'boxed' | 'accent' | 'card' } })
              }
              className="ui-field"
            >
              <option value="minimal">Minimal (left border)</option>
              <option value="boxed">Boxed (centered)</option>
              <option value="accent">Accent (quote marks)</option>
              <option value="card">Card (elevated)</option>
            </select>
          </div>
          <textarea
            value={block.content.quote || ''}
            onChange={(e) => onUpdate({ content: { ...block.content, quote: e.target.value } })}
            className="ui-field resize-none"
            rows={2}
            placeholder="Quote text"
          />
          <input
            type="text"
            value={block.content.author || ''}
            onChange={(e) => onUpdate({ content: { ...block.content, author: e.target.value } })}
            className="ui-field"
            placeholder="Author (optional)"
          />
        </>
      )}

      {block.type === 'divider' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Style</label>
            <select
              value={block.content.dividerStyle || 'line'}
              onChange={(e) =>
                onUpdate({ content: { ...block.content, dividerStyle: e.target.value as 'line' | 'dashed' | 'double' | 'dots' | 'stars' | 'wave' | 'gradient' } })
              }
              className="ui-field"
            >
              <option value="line">Line</option>
              <option value="dashed">Dashed</option>
              <option value="double">Double Line</option>
              <option value="dots">Dots (• • •)</option>
              <option value="stars">Stars (⭐ ⭐ ⭐)</option>
              <option value="wave">Wave</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Spacing</label>
            <select
              value={block.content.spacing || 'medium'}
              onChange={(e) =>
                onUpdate({ content: { ...block.content, spacing: e.target.value as 'small' | 'medium' | 'large' } })
              }
              className="ui-field"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      )}

      {block.type === 'embed' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 block uppercase tracking-wide">Embed URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={block.content.embedUrl || ''}
                onChange={(e) => {
                  const url = e.target.value
                  onUpdate({ content: { ...block.content, embedUrl: url } })
                }}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-3 py-2 bg-black border border-ink-line text-white text-sm focus:border-white focus:outline-none"
              />
              <button
                onClick={() => {
                  const url = block.content.embedUrl
                  if (!url) {
                    addToast('Please enter a URL first', 'error')
                    return
                  }

                  const validation = validateEmbedUrl(url)
                  if (!validation.valid) {
                    addToast(validation.error || 'Invalid URL', 'error')
                    return
                  }

                  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : undefined
                  const result = parseEmbedUrl(url, siteOrigin)
                  
                  if (result) {
                    onUpdate({
                      content: {
                        ...block.content,
                        embedUrl: result.embedUrl,
                        embedType: result.type,
                        aspectRatio: result.aspectRatio as any || '16/9',
                      }
                    })
                    addToast(`Detected ${result.type} embed`, 'success')
                  } else {
                    addToast('Could not auto-detect embed type, using generic', 'info')
                    onUpdate({
                      content: {
                        ...block.content,
                        embedType: 'generic',
                      }
                    })
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-2"
              >
                <Sparkles size={14} />
                Auto-detect
              </button>
            </div>
            <p className="text-[10px] text-gray-600">
              Supports YouTube, Spotify, Twitter, Vimeo, SoundCloud, CodePen, and more
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1 uppercase tracking-wide">Aspect Ratio</label>
            <select
              value={block.content.aspectRatio || '16/9'}
              onChange={(e) =>
                onUpdate({ content: { ...block.content, aspectRatio: e.target.value as any } })
              }
              className="ui-field"
            >
              <option value="16/9">16:9 (Widescreen)</option>
              <option value="4/3">4:3 (Standard)</option>
              <option value="1/1">1:1 (Square)</option>
              <option value="auto">Auto (Custom Height)</option>
            </select>
          </div>

          {/* Custom Height (only for auto aspect ratio) */}
          {block.content.aspectRatio === 'auto' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1 uppercase tracking-wide">Height (px)</label>
              <input
                type="number"
                min="200"
                max="1000"
                step="50"
                value={block.content.height || 400}
                onChange={(e) =>
                  onUpdate({ content: { ...block.content, height: parseInt(e.target.value) || 400 } })
                }
                className="ui-field"
              />
            </div>
          )}

          <details className="border border-ink-line rounded p-3">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
              Advanced: Custom iframe HTML
            </summary>
            <div className="mt-3 space-y-2">
              <textarea
                value={block.content.embedHtml || ''}
                onChange={(e) => {
                  const html = e.target.value
                  // Basic sanitization
                  const sanitized = sanitizeIframe(html)
                  onUpdate({ content: { ...block.content, embedHtml: sanitized } })
                }}
                placeholder="<iframe src='...' width='100%' height='400'></iframe>"
                className="ui-field font-mono text-xs"
                rows={4}
              />
              <p className="text-[10px] text-gray-600">
                Paste custom iframe HTML. Will be sanitized for security.
              </p>
            </div>
          </details>

          <div className="border-t border-ink-line pt-3">
            <label className="text-xs text-gray-500 block mb-2 uppercase tracking-wide">Preview</label>
            <EmbedBlock block={block} isEditing={true} />
          </div>
        </div>
      )}

      {block.type === 'image' && (
        <div className="space-y-2">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('border-white', 'bg-gray-900/50')
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-white', 'bg-gray-900/50')
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('border-white', 'bg-gray-900/50')
              if (e.dataTransfer.files?.[0]) {
                handleSingleImageUpload(e.dataTransfer.files[0])
              }
            }}
            onClick={() => !block.content.image?.url && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              block.content.image?.url
                ? 'border-ink-line'
                : 'border-gray-700 hover:border-gray-600 cursor-pointer'
            }`}
          >
            {block.content.image?.url ? (
              <div className="space-y-2">
                <img
                  src={block.content.image.url}
                  alt="Preview"
                  className="w-full h-48 object-cover border border-ink-line rounded"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  disabled={uploading}
                  className="text-xs px-3 py-2 border border-gray-700 hover:border-white text-gray-300 hover:text-white disabled:opacity-50 rounded transition"
                >
                  {uploading ? 'Uploading...' : 'Change Image'}
                </button>
              </div>
            ) : (
              <div className="text-gray-500 text-xs">
                {uploading ? (
                  <span>Uploading...</span>
                ) : (
                  <>
                    <span className="block mb-1">Drag & drop an image here</span>
                    <span className="text-gray-600">or click to browse</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSingleImageUpload(e.target.files[0])
            }}
            className="hidden"
          />

          {block.content.image?.url && (
            <input
              type="text"
              value={block.content.image?.caption || ''}
              onChange={(e) =>
                onUpdate({
                  content: {
                    ...block.content,
                    image: { ...block.content.image!, caption: e.target.value },
                  },
                })
              }
              className="ui-field"
              placeholder="Caption (optional)"
            />
          )}

          {block.content.image?.url && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-400">Advanced: Edit URL</summary>
              <input
                type="url"
                value={block.content.image?.url || ''}
                onChange={(e) =>
                  onUpdate({ content: { ...block.content, image: { ...block.content.image!, url: e.target.value } } })
                }
                className="w-full mt-2 px-3 py-2 bg-black border border-ink-line text-white text-xs focus:border-white focus:outline-none rounded"
                placeholder="Image URL"
              />
            </details>
          )}
        </div>
      )}

      {block.type === 'gallery' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Columns</label>
              <select
                value={block.content.columns || 3}
                onChange={(e) =>
                  onUpdate({
                    content: { ...block.content, columns: Number(e.target.value) as 2 | 3 | 4 },
                  })
                }
                className="ui-field"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Aspect Ratio</label>
              <select
                value={block.content.aspectRatio || 'auto'}
                onChange={(e) =>
                  onUpdate({ content: { ...block.content, aspectRatio: e.target.value as any } })
                }
                className="ui-field"
              >
                <option value="auto">Auto</option>
                <option value="1/1">Square (1:1)</option>
                <option value="3/2">Landscape (3:2)</option>
                <option value="3/4">Portrait (3:4)</option>
                <option value="16/9">Wide (16:9)</option>
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('border-white', 'bg-gray-900/50')
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-white', 'bg-gray-900/50')
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.classList.remove('border-white', 'bg-gray-900/50')
              if (isGalleryImageDrag(e)) return
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleMultipleImageUpload(e.dataTransfer.files)
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg p-6 text-center cursor-pointer transition"
          >
            <div className="text-gray-500 text-xs">
              {uploadStats.active > 0 || uploadStats.pending > 0 ? (
                <span>Uploading {uploadStats.active + uploadStats.pending} image(s)...</span>
              ) : (
                <>
                  <span className="block mb-1">Drag & drop images here</span>
                  <span className="text-gray-600">or click to browse</span>
                </>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) handleMultipleImageUpload(e.target.files)
            }}
            className="hidden"
          />

          {(block.content.images?.length || 0) > 0 && (() => {
            const rawImgs = block.content.images || []

            const commitGalleryReorder = (fromIdx: number, toIdx: number) => {
              const newImages = reorderGalleryImages(rawImgs, fromIdx, toIdx)
              if (newImages === rawImgs) return
              imagesRef.current = newImages
              onUpdate({ content: { ...block.content, images: newImages } })
            }

            return (
              <>
                <p className="text-[11px] text-gray-500">Drag thumbnails to rearrange the gallery order</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {rawImgs.map((img, idx) => (
                    <div
                      key={`${img.url}-${idx}`}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('application/x-roomlet-gallery-image', idx.toString())
                        e.dataTransfer.setData('text/plain', `gallery:${idx}`)
                        setGalleryDragIndex(idx)
                      }}
                      onDragEnd={() => {
                        setGalleryDragIndex(null)
                        setGalleryOverIndex(null)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                        if (galleryOverIndex !== idx) setGalleryOverIndex(idx)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const fromIdx = galleryDragIndex ?? parseInt(
                          e.dataTransfer.getData('application/x-roomlet-gallery-image')
                        )
                        if (!isNaN(fromIdx)) {
                          commitGalleryReorder(fromIdx, idx)
                        }
                        setGalleryDragIndex(null)
                        setGalleryOverIndex(null)
                      }}
                      className={`relative aspect-square group cursor-grab active:cursor-grabbing ${
                        galleryOverIndex === idx && galleryDragIndex !== idx
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-black'
                          : ''
                      } ${galleryDragIndex === idx ? 'opacity-50' : ''}`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.caption || ''}
                        draggable={false}
                        className="w-full h-full object-cover rounded border border-ink-line group-hover:border-gray-600 transition pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmingImageDelete({ blockId: block.id, imageIndex: idx, mode: 'edit', displayIdx: idx })
                          }}
                          className="px-2 py-1 bg-white/90 hover:bg-white text-black text-xs rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmingImageDelete({ blockId: block.id, imageIndex: idx, mode: 'delete' })
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                        >
                          Delete
                        </button>
                      </div>
                      {img.caption && (
                        <div className="absolute bottom-1 left-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded truncate">
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {confirmingImageDelete?.blockId === block.id && confirmingImageDelete?.mode === 'edit' && (() => {
                  const storageIdx = confirmingImageDelete.imageIndex
                  const img = rawImgs[storageIdx]
                  if (!img) return null
                  return (
                    <div 
                      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                      onClick={() => setConfirmingImageDelete(null)}
                    >
                      <div 
                        className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-4 border-b border-ink-line flex items-center justify-between">
                          <h3 className="text-sm font-medium">Edit Image Caption</h3>
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="text-gray-500 hover:text-white text-xl leading-none"
                          >
                            ×
                          </button>
                        </div>
                        <div className="p-4 space-y-4">
                          <img 
                            src={img.url} 
                            alt="" 
                            className="w-full max-h-96 object-contain rounded bg-black"
                          />
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Caption</label>
                            <textarea
                              value={img.caption || ''}
                              onChange={(e) => {
                                const newImages = [...rawImgs]
                                newImages[storageIdx] = { ...img, caption: e.target.value }
                                imagesRef.current = newImages
                                onUpdate({ content: { ...block.content, images: newImages } })
                              }}
                              className="ui-field resize-none"
                              placeholder="Add a caption for this image..."
                              rows={3}
                            />
                          </div>
                          <div className="text-xs text-gray-500">
                            Position: {storageIdx + 1} of {rawImgs.length}
                          </div>
                        </div>
                        <div className="p-4 border-t border-ink-line flex justify-end">
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm rounded"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {confirmingImageDelete?.blockId === block.id && confirmingImageDelete?.mode === 'delete' && (() => {
                  const storageIdx = confirmingImageDelete.imageIndex
                  const img = rawImgs[storageIdx]
                  if (!img) return null
                  return (
                    <div 
                      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                      onClick={() => setConfirmingImageDelete(null)}
                    >
                      <div 
                        className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-4 border-b border-ink-line">
                          <h3 className="text-sm font-medium">Delete Image</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          <img 
                            src={img.url} 
                            alt="" 
                            className="w-full h-32 object-cover rounded"
                          />
                          <p className="text-sm text-gray-400">
                            Are you sure you want to delete this image? This action cannot be undone.
                          </p>
                        </div>
                        <div className="p-4 border-t border-ink-line flex justify-end gap-2">
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-sm rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const newImages = rawImgs.filter((_, i) => i !== storageIdx)
                              imagesRef.current = newImages
                              onUpdate({ content: { ...block.content, images: newImages } })
                              setConfirmingImageDelete(null)
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            )
          })()}

          {uploadStats.tasks.filter((t) => t.status !== 'success' && t.status !== 'error').length > 0 && (
            <div className="space-y-2">
              {uploadStats.tasks
                .filter((t) => t.status !== 'success' && t.status !== 'error')
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex gap-2 items-start border border-blue-800/50 bg-blue-900/10 p-2 rounded"
                  >
                    <div className="shrink-0 w-16 h-16 bg-gray-800 rounded animate-pulse flex items-center justify-center">
                      <ImagesIcon size={20} className="text-gray-600" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-gray-400">{task.fileName}</div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {task.status === 'queued' && 'Queued...'}
                        {task.status === 'validating' && 'Validating...'}
                        {task.status === 'compressing' && `Compressing... ${task.progress}%`}
                        {task.status === 'uploading' && `Uploading... ${task.progress}%`}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {block.type === 'carousel' && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={block.content.showDots ?? true}
                onChange={(e) =>
                  onUpdate({ content: { ...block.content, showDots: e.target.checked } })
                }
                className="h-3 w-3"
              />
              Show Dots
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={block.content.carouselAutoPlay ?? false}
                onChange={(e) =>
                  onUpdate({ content: { ...block.content, carouselAutoPlay: e.target.checked } })
                }
                className="h-3 w-3"
              />
              Auto Play
            </label>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="ui-btn-secondary ui-btn-sm"
          >
            {uploading ? 'Uploading...' : 'Add Images'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) handleMultipleImageUpload(e.target.files)
            }}
            className="hidden"
          />

          {(block.content.images?.length || 0) > 0 && (() => {
            const rawImgs = block.content.images || []

            return (
              <>
                <p className="text-[11px] text-gray-500 mb-2">Drag thumbnails to rearrange the carousel order</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {rawImgs.map((img, idx) => (
                    <div
                      key={`${img.url}-${idx}`}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('application/x-roomlet-gallery-image', idx.toString())
                        e.dataTransfer.setData('text/plain', `gallery:${idx}`)
                        setGalleryDragIndex(idx)
                      }}
                      onDragEnd={() => {
                        setGalleryDragIndex(null)
                        setGalleryOverIndex(null)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                        if (galleryOverIndex !== idx) setGalleryOverIndex(idx)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const fromIdx = galleryDragIndex ?? parseInt(
                          e.dataTransfer.getData('application/x-roomlet-gallery-image')
                        )
                        if (!isNaN(fromIdx)) {
                          const newImages = reorderGalleryImages(rawImgs, fromIdx, idx)
                          if (newImages !== rawImgs) {
                            imagesRef.current = newImages
                            onUpdate({ content: { ...block.content, images: newImages } })
                          }
                        }
                        setGalleryDragIndex(null)
                        setGalleryOverIndex(null)
                      }}
                      className={`relative aspect-square group cursor-grab active:cursor-grabbing ${
                        galleryOverIndex === idx && galleryDragIndex !== idx
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-black'
                          : ''
                      } ${galleryDragIndex === idx ? 'opacity-50' : ''}`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.caption || ''} 
                        draggable={false}
                        className="w-full h-full object-cover rounded border border-ink-line group-hover:border-gray-600 transition pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmingImageDelete({ blockId: block.id, imageIndex: idx, mode: 'edit', displayIdx: idx })
                          }}
                          className="px-2 py-1 bg-white/90 hover:bg-white text-black text-xs rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmingImageDelete({ blockId: block.id, imageIndex: idx, mode: 'delete' })
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                        >
                          Delete
                        </button>
                      </div>
                      {img.caption && (
                        <div className="absolute bottom-1 left-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded truncate">
                          {img.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {confirmingImageDelete?.blockId === block.id && confirmingImageDelete?.mode === 'edit' && (() => {
                  const idx = confirmingImageDelete.imageIndex
                  const img = rawImgs[idx]
                  return (
                    <div 
                      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                      onClick={() => setConfirmingImageDelete(null)}
                    >
                      <div 
                        className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-4 border-b border-ink-line flex items-center justify-between">
                          <h3 className="text-sm font-medium">Edit Image Caption</h3>
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="text-gray-500 hover:text-white text-xl leading-none"
                          >
                            ×
                          </button>
                        </div>
                        <div className="p-4 space-y-4">
                          <img 
                            src={img.url} 
                            alt="" 
                            className="w-full max-h-96 object-contain rounded bg-black"
                          />
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Caption</label>
                            <textarea
                              value={img.caption || ''}
                              onChange={(e) => {
                                const newImages = [...rawImgs]
                                newImages[idx] = { ...img, caption: e.target.value }
                                onUpdate({ content: { ...block.content, images: newImages } })
                              }}
                              className="ui-field resize-none"
                              placeholder="Add a caption for this image..."
                              rows={3}
                            />
                          </div>
                          <div className="text-xs text-gray-500">
                            Position: {idx + 1} of {rawImgs.length}
                          </div>
                        </div>
                        <div className="p-4 border-t border-ink-line flex justify-end">
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm rounded"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {confirmingImageDelete?.blockId === block.id && confirmingImageDelete?.mode === 'delete' && (() => {
                  const idx = confirmingImageDelete.imageIndex
                  const img = rawImgs[idx]
                  return (
                    <div 
                      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                      onClick={() => setConfirmingImageDelete(null)}
                    >
                      <div 
                        className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-4 border-b border-ink-line">
                          <h3 className="text-sm font-medium">Delete Image</h3>
                        </div>
                        <div className="p-4 space-y-3">
                          <img 
                            src={img.url} 
                            alt="" 
                            className="w-full h-32 object-cover rounded"
                          />
                          <p className="text-sm text-gray-400">
                            Are you sure you want to delete this image? This action cannot be undone.
                          </p>
                        </div>
                        <div className="p-4 border-t border-ink-line flex justify-end gap-2">
                          <button
                            onClick={() => setConfirmingImageDelete(null)}
                            className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-sm rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              const newImages = rawImgs.filter((_, i) => i !== idx)
                              onUpdate({ content: { ...block.content, images: newImages } })
                              setConfirmingImageDelete(null)
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            )
          })()}
        </div>
      )}

      {block.type === 'links' && (
        <div className="space-y-3">
          {(block.content.links || []).map((link, idx) => {
            const setLink = (patch: Partial<typeof link>) => {
              const newLinks = [...(block.content.links || [])]
              newLinks[idx] = { ...link, ...patch }
              onUpdate({ content: { ...block.content, links: newLinks } })
            }
            return (
              <div key={idx} className="ui-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Link {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newLinks = block.content.links?.filter((_, i) => i !== idx)
                      onUpdate({ content: { ...block.content, links: newLinks } })
                    }}
                    className="ui-btn-danger ui-btn-sm"
                    aria-label={`Remove link ${idx + 1}`}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="ui-label">Title</label>
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => setLink({ title: e.target.value })}
                      className="ui-field"
                      placeholder="e.g. My Instagram"
                    />
                  </div>
                  <div>
                    <label className="ui-label">URL</label>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => setLink({ url: e.target.value })}
                      className="ui-field"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className="ui-label">Icon <span className="text-gray-500 font-normal">(optional)</span></label>
                  <div className="flex items-center gap-3">
                    {/* Preview tile: shows the uploaded image, else the emoji, else a placeholder */}
                    <div className="h-10 w-10 shrink-0 rounded-lg border border-ink-line bg-ink-field flex items-center justify-center overflow-hidden text-lg">
                      {link.iconUrl ? (
                        <img src={link.iconUrl} alt="" className="h-full w-full object-cover" />
                      ) : link.icon ? (
                        <span>{link.icon}</span>
                      ) : (
                        <span className="text-gray-600 text-xs">None</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={link.icon || ''}
                      onChange={(e) => setLink({ icon: e.target.value })}
                      className="ui-field w-28"
                      placeholder="Emoji"
                      aria-label="Icon emoji"
                      maxLength={8}
                    />
                    <span className="text-xs text-gray-500">or</span>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const url = await handleImageUpload(file)
                            if (url) setLink({ iconUrl: url })
                          }
                        }
                        input.click()
                      }}
                      disabled={uploading}
                      className="ui-btn-secondary ui-btn-sm"
                    >
                      {uploading ? 'Uploading...' : 'Upload image'}
                    </button>
                    {link.iconUrl && (
                      <button
                        type="button"
                        onClick={() => setLink({ iconUrl: undefined })}
                        className="ui-btn-ghost ui-btn-sm"
                        aria-label="Remove uploaded icon"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => {
              const newLinks = [...(block.content.links || []), { title: '', url: '', icon: '' }]
              onUpdate({ content: { ...block.content, links: newLinks } })
            }}
            className="ui-btn-secondary w-full border-dashed"
          >
            + Add link
          </button>
        </div>
      )}

      {block.type === 'audio' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 block uppercase tracking-wide">Album Cover (optional)</label>
            
            {block.content.audioCoverUrl ? (
              <div className="flex gap-3 items-start">
                <img
                  src={block.content.audioCoverUrl}
                  alt="Cover preview"
                  className="w-20 h-20 object-cover border border-ink-line rounded shrink-0"
                />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="text-xs text-gray-400 break-all">{block.content.audioCoverUrl}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            setUploading(true)
                            const url = await uploadImage(file)
                            setUploading(false)
                            if (url) {
                              onUpdate({ content: { ...block.content, audioCoverUrl: url } })
                            }
                          }
                        }
                        input.click()
                      }}
                      disabled={uploading}
                      className="ui-btn-secondary ui-btn-sm"
                    >
                      Change
                    </button>
                    <button
                      onClick={() => onUpdate({ content: { ...block.content, audioCoverUrl: '' } })}
                      className="text-xs px-3 py-1 text-gray-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      setUploading(true)
                      const url = await uploadImage(file)
                      setUploading(false)
                      if (url) {
                        onUpdate({ content: { ...block.content, audioCoverUrl: url } })
                      }
                    }
                  }
                  input.click()
                }}
                disabled={uploading}
                className="w-full text-xs px-3 py-2 border border-gray-700 hover:border-white text-gray-300 hover:text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ImagesIcon className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Album Cover'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 block uppercase tracking-wide">Audio File</label>
            
            {block.content.audioUrl ? (
              <div className="space-y-2">
                <div className="p-3 bg-gray-900/50 border border-ink-line rounded text-xs text-gray-400 break-all">
                  {block.content.audioUrl}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'audio/*'
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) {
                          if (file.size > 12 * 1024 * 1024) {
                            alert('File too large. Maximum size: 12MB')
                            return
                          }

                          setUploading(true)
                          
                          try {
                            // Dynamic import to avoid SSR issues
                            const { uploadAudioToR2 } = await import('@/shared/lib/r2-upload-client')
                            
                            const url = await uploadAudioToR2(file, profileId, (progress) => {
                              console.log('Upload progress:', Math.round(progress) + '%')
                            })
                            
                            onUpdate({ content: { ...block.content, audioUrl: url } })
                          } catch (err) {
                            console.error('Audio upload failed:', err)
                            alert(err instanceof Error ? err.message : 'Failed to upload audio')
                          } finally {
                            setUploading(false)
                          }
                        }
                      }
                      input.click()
                    }}
                    disabled={uploading}
                    className="ui-btn-secondary ui-btn-sm"
                  >
                    {uploading ? 'Uploading...' : 'Change Audio'}
                  </button>
                  <button
                    onClick={() => onUpdate({ content: { ...block.content, audioUrl: '' } })}
                    className="text-xs px-3 py-1 text-gray-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={async () => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'audio/*'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      if (file.size > 12 * 1024 * 1024) {
                        alert('File too large. Maximum size: 12MB')
                        return
                      }

                      setUploading(true)
                      
                      try {
                        // Dynamic import to avoid SSR issues
                        const { uploadAudioToR2 } = await import('@/shared/lib/r2-upload-client')
                        
                        const url = await uploadAudioToR2(file, profileId, (progress) => {
                          console.log('Upload progress:', Math.round(progress) + '%')
                        })
                        
                        onUpdate({ content: { ...block.content, audioUrl: url } })
                      } catch (err) {
                        console.error('Audio upload failed:', err)
                        alert(err instanceof Error ? err.message : 'Failed to upload audio')
                      } finally {
                        setUploading(false)
                      }
                    }
                  }
                  input.click()
                }}
                disabled={uploading}
                className="w-full text-xs px-3 py-2 border border-gray-700 hover:border-white text-gray-300 hover:text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Audio File (MP3, WAV, etc.)'}
              </button>
            )}
          </div>

          <input
            type="text"
            value={block.content.audioTitle || ''}
            onChange={(e) => onUpdate({ content: { ...block.content, audioTitle: e.target.value } })}
            className="ui-field"
            placeholder="Track title (optional)"
          />
          <input
            type="text"
            value={block.content.audioArtist || ''}
            onChange={(e) => onUpdate({ content: { ...block.content, audioArtist: e.target.value } })}
            className="ui-field"
            placeholder="Artist name (optional)"
          />
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={block.content.audioAutoPlay || false}
                onChange={(e) => onUpdate({ content: { ...block.content, audioAutoPlay: e.target.checked } })}
                className="w-4 h-4"
              />
              Auto-play
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={block.content.loop || false}
                onChange={(e) => onUpdate({ content: { ...block.content, loop: e.target.checked } })}
                className="w-4 h-4"
              />
              Loop
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function getDefaultContent(type: Block['type']): Block['content'] {
  switch (type) {
    case 'text':
      return { text: '' }
    case 'quote':
      return { quote: '', author: '' }
    case 'image':
      return { image: { url: '', caption: '' } }
    case 'gallery':
      return { images: [], columns: 3, aspectRatio: 'auto' }
    case 'carousel':
      return { images: [], showDots: true }
    case 'links':
      return { links: [] }
    case 'audio':
      return { audioUrl: '', audioCoverUrl: '', audioTitle: '', audioArtist: '', audioAutoPlay: false, loop: false, volume: 0.7 }
    case 'divider':
      return {}
    case 'embed':
      return { embedUrl: '', embedType: 'generic', aspectRatio: '16/9', height: 400 }
    default:
      return {}
  }
}
