export type GalleryImage = {
  url: string
  caption?: string
  altText?: string
}

type BatchSibling = {
  url: string
  queueIndex: number
}

/**
 * Insert a newly uploaded image so it stays with its batch, in file-selection order.
 * Uploads complete out of order; queueIndex is the position within the batch.
 * New batches are appended after images that are already in the gallery.
 */
export function insertUploadedGalleryImage(
  images: GalleryImage[],
  url: string,
  queueIndex: number,
  batchSiblings: BatchSibling[]
): GalleryImage[] {
  if (!url || images.some((img) => img.url === url)) {
    return images
  }

  const next = [...images]
  
  const siblingIndices = batchSiblings
    .map(s => next.findIndex(img => img.url === s.url))
    .filter(idx => idx !== -1)

  const batchStart = siblingIndices.length > 0 ? Math.min(...siblingIndices) : next.length

  const lowerAlreadyIn = batchSiblings.filter(
    (s) => s.queueIndex < queueIndex && next.some((img) => img.url === s.url)
  ).length

  const insertAt = Math.max(0, Math.min(batchStart + lowerAlreadyIn, next.length))
  next.splice(insertAt, 0, { url, caption: '' })
  return next
}

export function reorderGalleryImages<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}
