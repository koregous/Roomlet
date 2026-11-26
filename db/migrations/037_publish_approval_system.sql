 co-- Migration 037: Publish Approval System
-- Adds moderation queue functionality for content review before publication

-- Add approval status column to sections
ALTER TABLE sections 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' 
CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'));

-- Add fields for approval tracking
ALTER TABLE sections 
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create indexes for pending queue queries (fast lookups)
CREATE INDEX IF NOT EXISTS idx_sections_approval_status 
ON sections(approval_status) 
WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sections_submitted_at 
ON sections(submitted_at DESC) 
WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sections_reviewed_at 
ON sections(reviewed_at DESC) 
WHERE approval_status IN ('approved', 'rejected');

-- Update existing published sections to 'approved' status
-- This grandfathers in all current content
UPDATE sections 
SET 
  approval_status = 'approved', 
  reviewed_at = published_at 
WHERE published = true AND approval_status = 'draft';

-- Update RLS policies to require approval for public gallery visibility

-- Drop existing public gallery policy
DROP POLICY IF EXISTS "Public can view published sections" ON sections;

-- Create new policy requiring approval
CREATE POLICY "Public can view approved published sections"
ON sections FOR SELECT
TO public
USING (
  published = true 
  AND visible = true 
  AND approval_status = 'approved'
);

-- Users can see their own sections regardless of approval status
DROP POLICY IF EXISTS "Users can view own sections" ON sections;

CREATE POLICY "Users can view own sections"
ON sections FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Admins can see all sections regardless of status
DROP POLICY IF EXISTS "Admins can view all sections" ON sections;

CREATE POLICY "Admins can view all sections"
ON sections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Add comments for documentation
COMMENT ON COLUMN sections.approval_status IS 'Approval workflow: draft → pending (submitted) → approved/rejected. Only approved sections visible in public gallery.';
COMMENT ON COLUMN sections.submitted_at IS 'Timestamp when section was submitted for review (set when status changes to pending)';
COMMENT ON COLUMN sections.reviewed_at IS 'Timestamp when admin approved or rejected the section';
COMMENT ON COLUMN sections.reviewed_by IS 'Admin user ID who reviewed the section';
COMMENT ON COLUMN sections.rejection_reason IS 'User-facing explanation for why section was rejected';
COMMENT ON COLUMN sections.admin_notes IS 'Internal admin notes about the review decision (not shown to users)';

-- Grant necessary permissions
GRANT SELECT ON sections TO authenticated;
GRANT SELECT ON sections TO anon;
