-- ============================================================================
-- Migration 048: Per-image likes + batch bookmark counts
--
-- 1. item_likes: one row per (image, user). Hangs off item_index.id, which is
--    now stable across gallery reorders (see syncItemIndex).
-- 2. item_index.like_count: denormalized counter kept in sync by a trigger so
--    feeds can read/sort it without aggregating.
-- 3. get_section_bookmark_counts(): batch version of get_section_bookmark_count.
--    The bookmarks table is RLS-restricted to the owner (or public bookmark
--    lists), so counting it from an anon/authenticated client undercounts.
--    This SECURITY DEFINER RPC returns aggregate counts only (no user info).
--
-- Safe to re-run (idempotent). Apply BEFORE deploying the matching app code.
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — item_likes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_likes (
  item_id    UUID NOT NULL REFERENCES item_index(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_item_likes_user
  ON item_likes(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- PART 2 — like_count on item_index + trigger
-- ----------------------------------------------------------------------------
ALTER TABLE item_index
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION update_item_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE item_index SET like_count = like_count + 1 WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE item_index SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_like_count ON item_likes;
CREATE TRIGGER trg_item_like_count
  AFTER INSERT OR DELETE ON item_likes
  FOR EACH ROW EXECUTE FUNCTION update_item_like_count();

-- ----------------------------------------------------------------------------
-- PART 3 — RLS
-- Users only ever see/modify their own likes. Public like totals come from
-- item_index.like_count (item_index is already publicly readable for approved,
-- published, visible sections).
-- ----------------------------------------------------------------------------
ALTER TABLE item_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own item likes" ON item_likes;
CREATE POLICY "Users read own item likes"
  ON item_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- WITH CHECK subquery runs through item_index RLS, so hidden/unapproved items
-- cannot be liked.
DROP POLICY IF EXISTS "Users like visible items" ON item_likes;
CREATE POLICY "Users like visible items"
  ON item_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND item_id IN (SELECT id FROM item_index)
  );

DROP POLICY IF EXISTS "Users remove own item likes" ON item_likes;
CREATE POLICY "Users remove own item likes"
  ON item_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON item_likes TO authenticated;

-- ----------------------------------------------------------------------------
-- PART 4 — Batch bookmark counts (aggregate only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_section_bookmark_counts(p_section_ids UUID[])
RETURNS TABLE (section_id UUID, bookmark_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.section_id, COUNT(*)::INTEGER AS bookmark_count
  FROM bookmarks b
  WHERE b.section_id = ANY(p_section_ids)
  GROUP BY b.section_id;
$$;

GRANT EXECUTE ON FUNCTION get_section_bookmark_counts(UUID[]) TO anon, authenticated;

COMMENT ON TABLE item_likes IS 'Per-image likes. Counts are denormalized into item_index.like_count by trigger.';

COMMIT;
