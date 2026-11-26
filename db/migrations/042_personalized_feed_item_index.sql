-- ============================================================================
-- Migration 042: Personalized Feed Item Index
-- Creates the Item_Index table for efficient item-level feed queries.
-- Extracts individual media items from Gallery, Image, and Carousel blocks
-- with their upload timestamps for chronological feed generation.
-- Safe to re-run (idempotent).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — Create item_index table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('gallery', 'image', 'carousel')),
  item_url TEXT NOT NULL,
  upload_time TIMESTAMPTZ NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  
  -- Denormalized fields for efficient filtering (avoid joins)
  is_nsfw BOOLEAN NOT NULL DEFAULT FALSE,
  caption TEXT,
  alt_text TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraint: Unique combination of section + block + URL + position
  CONSTRAINT item_index_unique_item UNIQUE(section_id, block_id, item_url, position)
);

-- ----------------------------------------------------------------------------
-- PART 2 — Create performance indexes
-- ----------------------------------------------------------------------------
-- Composite index for personalized feed queries (by bookmarked sections)
CREATE INDEX IF NOT EXISTS idx_item_index_section_time 
  ON item_index(section_id, upload_time DESC, id DESC);

-- Primary index for chronological feed ordering
CREATE INDEX IF NOT EXISTS idx_item_index_upload_time 
  ON item_index(upload_time DESC, id DESC);

-- Index for filtering by section
CREATE INDEX IF NOT EXISTS idx_item_index_section_id 
  ON item_index(section_id);

-- Partial index for non-NSFW content (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_item_index_safe_content 
  ON item_index(upload_time DESC, id DESC) 
  WHERE is_nsfw = FALSE;

-- ----------------------------------------------------------------------------
-- PART 3 — Enable RLS and create policies
-- ----------------------------------------------------------------------------
ALTER TABLE item_index ENABLE ROW LEVEL SECURITY;

-- Public can read items from published, approved, visible sections
DROP POLICY IF EXISTS "Public can read approved section items" ON item_index;
CREATE POLICY "Public can read approved section items"
  ON item_index FOR SELECT
  USING (
    section_id IN (
      SELECT id FROM sections 
      WHERE published = TRUE 
        AND approval_status = 'approved' 
        AND visible = TRUE
    )
  );

-- ----------------------------------------------------------------------------
-- PART 4 — Grant permissions
-- ----------------------------------------------------------------------------
GRANT SELECT ON item_index TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- PART 5 — Add table comments
-- ----------------------------------------------------------------------------
COMMENT ON TABLE item_index IS 'Pre-extracted index of individual media items from section blocks for efficient feed queries';
COMMENT ON COLUMN item_index.section_id IS 'Foreign key to sections table with CASCADE DELETE';
COMMENT ON COLUMN item_index.block_id IS 'Block UUID from sections.blocks JSONB array';
COMMENT ON COLUMN item_index.block_type IS 'Type of block: gallery, image, or carousel';
COMMENT ON COLUMN item_index.item_url IS 'Direct URL to the image or GIF';
COMMENT ON COLUMN item_index.upload_time IS 'Timestamp when this item was added to the section';
COMMENT ON COLUMN item_index.position IS 'Position within multi-item blocks (0-indexed)';
COMMENT ON COLUMN item_index.is_nsfw IS 'Denormalized NSFW flag from parent section for efficient filtering';
COMMENT ON COLUMN item_index.caption IS 'Image caption from block content';
COMMENT ON COLUMN item_index.alt_text IS 'Alt text from block content for accessibility';

COMMIT;
