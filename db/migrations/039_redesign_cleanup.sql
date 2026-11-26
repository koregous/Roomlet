-- ============================================================================
-- Migration 037: Redesign cleanup
-- Run this on the LIVE, already-migrated (001-036) database.
-- For a fresh install instead, use SCHEMA_CANONICAL.sql.
-- Safe to re-run (idempotent).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — subcategories: gone either way
-- Migration 010 dropped this table; migration 030 references it again, which
-- would raise "relation does not exist" and (since 030 wraps itself in
-- BEGIN/COMMIT) roll back that entire migration. Whether or not that's what
-- happened on your DB, subcategories isn't part of the target design (tags
-- replaced it) — drop it if present and make sure sections has no dangling
-- column for it.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS subcategories CASCADE;
ALTER TABLE sections DROP COLUMN IF EXISTS subcategory_id;

-- ----------------------------------------------------------------------------
-- PART 2 — categories: converge to the intended final list regardless of
-- whether migration 030 actually committed on this database.
-- ----------------------------------------------------------------------------
INSERT INTO categories (name, slug, description, icon, position) VALUES
  ('Lifestyle', 'lifestyle', 'Daily aesthetics, food, fitness, home, and travel', '🌱', 7),
  ('Fashion', 'fashion', 'Outfits, style, lookbooks, and accessories', '👗', 8),
  ('Comics', 'comics', 'Comic books, manga, webcomics, and graphic novels', '📚', 9)
ON CONFLICT (slug) DO NOTHING;

-- Remap any sections still sitting on Music/Projects (no-ops if 030 already
-- did this, since those categories won't exist to match against)
UPDATE sections SET category_id = (SELECT id FROM categories WHERE slug = 'lifestyle')
  WHERE category_id = (SELECT id FROM categories WHERE slug = 'music');
UPDATE sections SET category_id = (SELECT id FROM categories WHERE slug = 'design')
  WHERE category_id = (SELECT id FROM categories WHERE slug = 'projects');

DELETE FROM categories WHERE slug IN ('music', 'projects');

-- Fix the Design/Fashion position collision (both landed on position 8) and
-- give every category a clean, sequential position
UPDATE categories SET position = 1 WHERE slug = 'gaming';
UPDATE categories SET position = 2 WHERE slug = 'art';
UPDATE categories SET position = 3 WHERE slug = 'photography';
UPDATE categories SET position = 4 WHERE slug = 'collections';
UPDATE categories SET position = 5 WHERE slug = 'writing';
UPDATE categories SET position = 6 WHERE slug = 'design';
UPDATE categories SET position = 7 WHERE slug = 'lifestyle';
UPDATE categories SET position = 8 WHERE slug = 'fashion';
UPDATE categories SET position = 9 WHERE slug = 'comics';

-- ----------------------------------------------------------------------------
-- PART 3 — bookmarks.user_id: point the FK at the column it's actually used
-- as. RLS (auth.uid() = user_id) and is_bookmarks_public() both treat this
-- column as a profiles.user_id value, but the FK required it to match
-- profiles.id — which meant every insert (auth.uid() as user_id) failed with
-- a foreign-key violation. Bookmarking has very likely never worked.
-- ----------------------------------------------------------------------------
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE bookmarks
  ADD CONSTRAINT bookmarks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- PART 4 — section_tags: fix both blockers on tagging your own section.
-- (a) RLS compared sections.profile_id (a profiles.id value) straight to
--     auth.uid() (a profiles.user_id value) — never matches.
-- (b) The table grant was SELECT-only, so INSERT/DELETE were rejected before
--     RLS was even evaluated.
-- ----------------------------------------------------------------------------
GRANT INSERT, DELETE ON section_tags TO authenticated;

DROP POLICY IF EXISTS "Users can view tags for own sections" ON section_tags;
CREATE POLICY "Users can view tags for own sections" ON section_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sections WHERE sections.id = section_tags.section_id
    AND sections.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));
DROP POLICY IF EXISTS "Users can add tags to own sections" ON section_tags;
CREATE POLICY "Users can add tags to own sections" ON section_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM sections WHERE sections.id = section_tags.section_id
    AND sections.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));
DROP POLICY IF EXISTS "Users can remove tags from own sections" ON section_tags;
CREATE POLICY "Users can remove tags from own sections" ON section_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM sections WHERE sections.id = section_tags.section_id
    AND sections.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

-- The usage_count trigger runs as the tagging user, who only has SELECT on
-- tags, so it silently blocked the same operations from a different angle.
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ----------------------------------------------------------------------------
-- PART 5 — rotation_config: self-documented in its own table comment as
-- "[DEPRECATED] No longer used. Featured content uses single manual curation
-- strategy." Confirmed via introspection that nothing references it — the
-- only two constraints on it are its own primary key and its own CHECK on
-- `mode`, no incoming foreign keys from anywhere else.
-- IMPORTANT: Must drop BEFORE is_user_admin() because its RLS policies depend on that function.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS rotation_config CASCADE;

-- ----------------------------------------------------------------------------
-- PART 6 — one correct is_admin() helper, replacing is_user_admin() (wrong
-- column, and unused — every real policy already inlined its own EXISTS
-- check instead of calling it) and the ~5 duplicated inline checks.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM profiles p WHERE p.user_id = check_user_id), false);
$$;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated, anon;
DROP FUNCTION IF EXISTS is_user_admin(UUID);

DROP POLICY IF EXISTS "Admins can view all reports" ON reports;
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update reports" ON reports;
CREATE POLICY "Admins can update reports" ON reports FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update any section" ON sections;
CREATE POLICY "Admins can update any section" ON sections FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can delete any section" ON sections;
CREATE POLICY "Admins can delete any section" ON sections FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_insert_featured" ON featured_sections;
CREATE POLICY "admin_insert_featured" ON featured_sections FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_update_featured" ON featured_sections;
CREATE POLICY "admin_update_featured" ON featured_sections FOR UPDATE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_delete_featured" ON featured_sections;
CREATE POLICY "admin_delete_featured" ON featured_sections FOR DELETE TO authenticated USING (is_admin());

-- ----------------------------------------------------------------------------
-- PART 7 — stop a user granting themselves admin through the ordinary
-- "update own profile" policy. Direct SQL (SQL Editor / migrations, which
-- carry no JWT context) is unaffected — only a request bearing a non
-- service-role JWT is blocked from touching this column.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_self_admin_escalation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'is_admin can only be changed by a service-role request'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_prevent_self_admin_escalation ON profiles;
CREATE TRIGGER profiles_prevent_self_admin_escalation
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_self_admin_escalation();

-- ----------------------------------------------------------------------------
-- PART 8 — collapse three near-identical "touch updated_at" functions
-- (update_updated_at_column, update_featured_sections_timestamp, and the
-- rules file's set_updated_at) into one. Defined here too, in case the
-- rules file was never actually applied to this database.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS sections_set_updated_at ON sections;
CREATE TRIGGER sections_set_updated_at BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_featured_sections_updated_at ON featured_sections;
CREATE TRIGGER trg_featured_sections_updated_at BEFORE UPDATE ON featured_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_featured_sections_timestamp() CASCADE;

-- ----------------------------------------------------------------------------
-- PART 9 — collapse the two view-increment functions into one implementation;
-- both names stay callable in case app code uses either.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_section_views(section_uuid UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE sections SET view_count = COALESCE(view_count, 0) + 1, last_viewed_at = NOW()
  WHERE id = section_uuid RETURNING view_count INTO new_count;
  RETURN new_count;
END;
$$;
CREATE OR REPLACE FUNCTION increment_view_count(section_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT increment_section_views(section_id);
$$;

-- ----------------------------------------------------------------------------
-- PART 10 — featured_sections.featured_by: NOT NULL made "ON DELETE SET NULL"
-- unreachable (that action would itself violate the NOT NULL constraint).
-- Make the real behavior explicit: block deleting a profile that has
-- featured content, rather than leaving a dead ON DELETE clause.
-- ----------------------------------------------------------------------------
ALTER TABLE featured_sections DROP CONSTRAINT IF EXISTS featured_sections_featured_by_fkey;
ALTER TABLE featured_sections
  ADD CONSTRAINT featured_sections_featured_by_fkey
  FOREIGN KEY (featured_by) REFERENCES profiles(user_id);

-- ----------------------------------------------------------------------------
-- PART 11 — drop the one index that's a strict subset of a newer one.
-- (published, category_id) and (published, view_count) are NOT touched —
-- different enough leading columns that we didn't want to guess.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_sections_published_date;  -- superseded by idx_sections_published_feed (029)

COMMIT;
