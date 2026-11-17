-- ============================================================================
-- Migration 040: Remove Featured Sections System
-- Now that we have an approval/moderation system for publishing to gallery,
-- the manual featured_sections curation table is redundant.
-- Safe to re-run (idempotent).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1 — Drop the featured_sections table and all related objects
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS featured_sections CASCADE;

-- ----------------------------------------------------------------------------
-- PART 2 — Remove last_featured_at column from sections table
-- This column was only used by the featured sections system
-- ----------------------------------------------------------------------------
ALTER TABLE sections DROP COLUMN IF EXISTS last_featured_at;

-- ----------------------------------------------------------------------------
-- PART 3 — Clean up any orphaned functions related to featured content
-- (None exist in current schema, but adding for completeness)
-- ----------------------------------------------------------------------------
-- No functions to clean up - featured content was handled in service layer

COMMIT;
