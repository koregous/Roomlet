-- ============================================================================
-- Migration 042b: Backfill Item Index from Existing Content
-- Populates Item_Index table with media items from existing published sections.
-- Extracts images/GIFs from Gallery, Image, and Carousel blocks.
-- Uses section.updated_at as upload_time for historical items.
-- Batch processing for performance on large datasets.
-- Safe to re-run (uses INSERT ... ON CONFLICT DO NOTHING).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — Extract and insert items from Image blocks
-- ----------------------------------------------------------------------------
-- Single images from Image blocks
INSERT INTO item_index (
  section_id,
  block_id,
  block_type,
  item_url,
  upload_time,
  position,
  is_nsfw,
  caption,
  alt_text
)
SELECT 
  s.id AS section_id,
  (block->>'id')::TEXT AS block_id,
  'image' AS block_type,
  (block->'content'->'image'->>'url')::TEXT AS item_url,
  COALESCE(s.updated_at, s.created_at) AS upload_time,
  0 AS position,
  COALESCE(s.is_nsfw, FALSE) AS is_nsfw,
  (block->'content'->'image'->>'caption')::TEXT AS caption,
  COALESCE(
    (block->'content'->'image'->>'alt')::TEXT,
    (block->'content'->'image'->>'altText')::TEXT
  ) AS alt_text
FROM sections s,
     jsonb_array_elements(s.blocks) AS block
WHERE s.published = TRUE
  AND s.approval_status = 'approved'
  AND block->>'type' = 'image'
  AND block->'content'->'image'->>'url' IS NOT NULL
  AND (block->'content'->'image'->>'url')::TEXT != ''
ON CONFLICT (section_id, block_id, item_url, position) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 2 — Extract and insert items from Gallery blocks
-- ----------------------------------------------------------------------------
-- Multiple images from Gallery blocks
INSERT INTO item_index (
  section_id,
  block_id,
  block_type,
  item_url,
  upload_time,
  position,
  is_nsfw,
  caption,
  alt_text
)
SELECT 
  s.id AS section_id,
  (block->>'id')::TEXT AS block_id,
  'gallery' AS block_type,
  (image->>'url')::TEXT AS item_url,
  COALESCE(s.updated_at, s.created_at) AS upload_time,
  (image_index - 1) AS position,
  COALESCE(s.is_nsfw, FALSE) AS is_nsfw,
  (image->>'caption')::TEXT AS caption,
  COALESCE(
    (image->>'alt')::TEXT,
    (image->>'altText')::TEXT
  ) AS alt_text
FROM sections s,
     jsonb_array_elements(s.blocks) AS block,
     jsonb_array_elements(block->'content'->'images') WITH ORDINALITY AS images(image, image_index)
WHERE s.published = TRUE
  AND s.approval_status = 'approved'
  AND block->>'type' = 'gallery'
  AND block->'content'->'images' IS NOT NULL
  AND (image->>'url')::TEXT IS NOT NULL
  AND (image->>'url')::TEXT != ''
ON CONFLICT (section_id, block_id, item_url, position) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 3 — Extract and insert items from Carousel blocks
-- ----------------------------------------------------------------------------
-- Multiple images from Carousel blocks
INSERT INTO item_index (
  section_id,
  block_id,
  block_type,
  item_url,
  upload_time,
  position,
  is_nsfw,
  caption,
  alt_text
)
SELECT 
  s.id AS section_id,
  (block->>'id')::TEXT AS block_id,
  'carousel' AS block_type,
  (image->>'url')::TEXT AS item_url,
  COALESCE(s.updated_at, s.created_at) AS upload_time,
  (image_index - 1) AS position,
  COALESCE(s.is_nsfw, FALSE) AS is_nsfw,
  (image->>'caption')::TEXT AS caption,
  COALESCE(
    (image->>'alt')::TEXT,
    (image->>'altText')::TEXT
  ) AS alt_text
FROM sections s,
     jsonb_array_elements(s.blocks) AS block,
     jsonb_array_elements(block->'content'->'images') WITH ORDINALITY AS images(image, image_index)
WHERE s.published = TRUE
  AND s.approval_status = 'approved'
  AND block->>'type' = 'carousel'
  AND block->'content'->'images' IS NOT NULL
  AND (image->>'url')::TEXT IS NOT NULL
  AND (image->>'url')::TEXT != ''
ON CONFLICT (section_id, block_id, item_url, position) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 4 — Display summary of backfill results
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  total_sections INT;
  total_items INT;
  image_blocks INT;
  gallery_blocks INT;
  carousel_blocks INT;
BEGIN
  -- Count sections processed
  SELECT COUNT(*) INTO total_sections
  FROM sections
  WHERE published = TRUE AND approval_status = 'approved';
  
  -- Count total items inserted
  SELECT COUNT(*) INTO total_items
  FROM item_index;
  
  -- Count items by block type
  SELECT COUNT(*) INTO image_blocks
  FROM item_index WHERE block_type = 'image';
  
  SELECT COUNT(*) INTO gallery_blocks
  FROM item_index WHERE block_type = 'gallery';
  
  SELECT COUNT(*) INTO carousel_blocks
  FROM item_index WHERE block_type = 'carousel';
  
  -- Output summary
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Item Index Backfill Complete';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Sections processed: %', total_sections;
  RAISE NOTICE 'Total items indexed: %', total_items;
  RAISE NOTICE '  - Image blocks: %', image_blocks;
  RAISE NOTICE '  - Gallery blocks: %', gallery_blocks;
  RAISE NOTICE '  - Carousel blocks: %', carousel_blocks;
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
