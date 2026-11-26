import { extractMediaItems } from './feed-item-extraction'
import { Block } from './types'

const imageBlock: Block = {
  id: 'block-1',
  type: 'image',
  content: {
    image: {
      url: 'https://example.com/image1.jpg',
      caption: 'Test caption',
      alt: 'Test alt text'
    }
  },
  position: 0
}

// Test: Extract multiple images from Gallery block
const galleryBlock: Block = {
  id: 'block-2',
  type: 'gallery',
  content: {
    images: [
      { url: 'https://example.com/gallery1.jpg', caption: 'Gallery 1', altText: 'Alt 1' },
      { url: 'https://example.com/gallery2.jpg', caption: 'Gallery 2', altText: 'Alt 2' },
      { url: 'https://example.com/gallery3.jpg', caption: 'Gallery 3', altText: 'Alt 3' }
    ],
    columns: 3
  },
  position: 1
}

// Test: Extract multiple images from Carousel block
const carouselBlock: Block = {
  id: 'block-3',
  type: 'carousel',
  content: {
    images: [
      { url: 'https://example.com/carousel1.jpg', caption: 'Carousel 1', altText: 'Alt 1' },
      { url: 'https://example.com/carousel2.jpg', caption: 'Carousel 2', altText: 'Alt 2' }
    ],
    autoPlay: true
  },
  position: 2
}

// Test: Non-media block (should be ignored)
const textBlock: Block = {
  id: 'block-4',
  type: 'text',
  content: {
    text: 'This is a text block'
  },
  position: 3
}

// Run extraction
const testDate = new Date('2024-01-01T00:00:00Z')
const items = extractMediaItems(
  'section-123',
  [imageBlock, galleryBlock, carouselBlock, textBlock],
  testDate,
  false
)

console.log('Extracted items:', JSON.stringify(items, null, 2))
console.log('\n--- Test Results ---')
console.log(`Total items extracted: ${items.length}`)
console.log(`Expected: 6 (1 image + 3 gallery + 2 carousel)`)
console.log(`Result: ${items.length === 6 ? '✓ PASS' : '✗ FAIL'}`)

const imageItem = items.find(i => i.block_id === 'block-1')
console.log(`\nImage block extracted: ${imageItem ? '✓ PASS' : '✗ FAIL'}`)
if (imageItem) {
  console.log(`  - Position: ${imageItem.position === 0 ? '✓' : '✗'} (${imageItem.position})`)
  console.log(`  - Caption: ${imageItem.caption === 'Test caption' ? '✓' : '✗'} (${imageItem.caption})`)
  console.log(`  - Alt text: ${imageItem.alt_text === 'Test alt text' ? '✓' : '✗'} (${imageItem.alt_text})`)
}

const galleryItems = items.filter(i => i.block_id === 'block-2')
console.log(`\nGallery block extracted: ${galleryItems.length === 3 ? '✓ PASS' : '✗ FAIL'} (${galleryItems.length} items)`)
if (galleryItems.length === 3) {
  console.log(`  - Position numbering: ${galleryItems[0].position === 0 && galleryItems[1].position === 1 && galleryItems[2].position === 2 ? '✓' : '✗'}`)
  console.log(`  - Block type: ${galleryItems[0].block_type === 'gallery' ? '✓' : '✗'}`)
}

const carouselItems = items.filter(i => i.block_id === 'block-3')
console.log(`\nCarousel block extracted: ${carouselItems.length === 2 ? '✓ PASS' : '✗ FAIL'} (${carouselItems.length} items)`)
if (carouselItems.length === 2) {
  console.log(`  - Position numbering: ${carouselItems[0].position === 0 && carouselItems[1].position === 1 ? '✓' : '✗'}`)
  console.log(`  - Block type: ${carouselItems[0].block_type === 'carousel' ? '✓' : '✗'}`)
}

const allNsfwCorrect = items.every(i => i.is_nsfw === false)
console.log(`\nNSFW flag propagation: ${allNsfwCorrect ? '✓ PASS' : '✗ FAIL'}`)

const allSectionIdsCorrect = items.every(i => i.section_id === 'section-123')
console.log(`Section ID propagation: ${allSectionIdsCorrect ? '✓ PASS' : '✗ FAIL'}`)

const allUploadTimesCorrect = items.every(i => i.upload_time.getTime() === testDate.getTime())
console.log(`Upload time propagation: ${allUploadTimesCorrect ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n--- Testing NSFW flag ---')
const nsfwItems = extractMediaItems(
  'section-456',
  [imageBlock],
  testDate,
  true
)
console.log(`NSFW flag set correctly: ${nsfwItems[0].is_nsfw === true ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n--- Testing edge cases ---')
const emptyGallery: Block = {
  id: 'block-empty',
  type: 'gallery',
  content: { images: [] },
  position: 0
}
const emptyItems = extractMediaItems('section-789', [emptyGallery], testDate, false)
console.log(`Empty gallery handled: ${emptyItems.length === 0 ? '✓ PASS' : '✗ FAIL'}`)

const missingUrl: Block = {
  id: 'block-missing',
  type: 'gallery',
  content: { images: [{ url: '', caption: 'No URL' }] },
  position: 0
}
const missingUrlItems = extractMediaItems('section-999', [missingUrl], testDate, false)
console.log(`Missing URL skipped: ${missingUrlItems.length === 0 ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n--- All tests completed ---')
