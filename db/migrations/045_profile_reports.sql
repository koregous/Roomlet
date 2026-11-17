-- Migration 045: Profile Reports System
-- Allows users to report profiles for inappropriate content, backgrounds, etc.

-- Create profile_reports table
CREATE TABLE IF NOT EXISTS profile_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate_background', 'inappropriate_content', 'impersonation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reporter_ip TEXT,
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_profile_reports_reported_profile ON profile_reports(reported_profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_reports_reporter ON profile_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_reports_status ON profile_reports(status);
CREATE INDEX IF NOT EXISTS idx_profile_reports_created_at ON profile_reports(created_at DESC);

-- Composite index for checking duplicate reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_reports_unique 
  ON profile_reports(reported_profile_id, reporter_user_id) 
  WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE profile_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own reports
CREATE POLICY "Users can create profile reports"
  ON profile_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policy: Users can view their own reports
CREATE POLICY "Users can view their own profile reports"
  ON profile_reports
  FOR SELECT
  TO authenticated
  USING (reporter_user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policy: Admins can view all reports
CREATE POLICY "Admins can view all profile reports"
  ON profile_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update reports (resolve, dismiss, add notes)
CREATE POLICY "Admins can update profile reports"
  ON profile_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE profile_reports IS 'Reports submitted by users for profiles violating community guidelines';
COMMENT ON COLUMN profile_reports.reason IS 'Reason for report: spam, harassment, inappropriate_background, inappropriate_content, impersonation';
COMMENT ON COLUMN profile_reports.status IS 'Report status: pending, reviewed, resolved, dismissed';
