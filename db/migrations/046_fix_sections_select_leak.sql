-- ============================================================================
-- Migration 046: Fix RLS Policy to Enable Profile Freedom
-- ============================================================================
-- CRITICAL FIX: Separate profile visibility from gallery curation
-- 
-- Problem: The legacy RLS policy from migration 037 uses restrictive logic:
--   (published = true AND visible = true AND approval_status = 'approved')
-- This prevents users from building personal profiles without moderation.
--
-- Users should be able to:
-- 1. Build profile-only content (visible sections without publishing to gallery)
-- 2. Optionally submit content to gallery (requires published + approval)
--
-- This migration:
-- 1. Drops all overlapping/conflicting SELECT policies
-- 2. Creates a permissive policy for visible sections (profile freedom)
-- 3. Moves gallery curation filtering to application layer
-- ============================================================================

-- Drop all existing SELECT policies on sections (clean slate)
DROP POLICY IF EXISTS "sections_select" ON sections;
DROP POLICY IF EXISTS "sections_select_public" ON sections;
DROP POLICY IF EXISTS "Public can view published sections" ON sections;
DROP POLICY IF EXISTS "Public can view approved published sections" ON sections;
DROP POLICY IF EXISTS "Users can view own sections" ON sections;
DROP POLICY IF EXISTS "Admins can view all sections" ON sections;

-- Create single consolidated SELECT policy with proper gates
-- This policy enables two distinct use cases:
-- 1. Profile freedom: visible = true sections appear on personal profiles (no moderation)
-- 2. Gallery curation: published + approved sections appear in discovery feed (moderated)
--
-- Public users: See visible sections (for profiles) - application layer filters for gallery
-- Owners: See all their own sections regardless of status
-- Admins: See all sections for moderation
CREATE POLICY "sections_select_consolidated"
ON sections 
FOR SELECT
USING (
  -- Public: can see any visible section
  -- This allows profiles to show content without moderation
  -- Gallery filtering happens in application layer (published + approved)
  visible = true
  
  -- Owner: can see their own drafts/pending/rejected sections
  OR (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE id = sections.profile_id
    )
  )
  
  -- Admin: can see all sections for moderation queue
  -- Uses inline check to match migration 037 pattern
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Add documentation
COMMENT ON POLICY "sections_select_consolidated" ON sections IS 
  'Consolidated SELECT policy (migration 046): visible=true for profile freedom, published+approved filtering happens in app layer for gallery curation. Owners see all their sections. Admins see everything.';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this as an ANONYMOUS user to verify visible sections are accessible:
-- 
-- SELECT id, title, visible, published, approval_status
-- FROM sections
-- WHERE visible = true AND published = false;
--
-- Expected result: Rows visible (profile-only content accessible without moderation)
--
-- Run this to verify gallery filtering happens in application:
-- Gallery queries should add: .eq('published', true).eq('approval_status', 'approved')
--
-- Run this as the section OWNER to verify access:
-- Expected result: All your own sections visible regardless of status
-- ============================================================================

-- Rollback instructions (if needed):
-- This migration intentionally removes old policies.
-- To rollback, restore migration 037 policies manually or revert to migration 045.

