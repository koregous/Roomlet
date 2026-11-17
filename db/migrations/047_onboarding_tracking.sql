-- Migration 047: Onboarding Tracking
-- Add onboarding completion tracking to profiles table

-- Add onboarding fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create index for querying users who haven't completed onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON profiles(onboarding_completed) 
WHERE onboarding_completed = FALSE;

-- Add comment explaining the fields
COMMENT ON COLUMN profiles.onboarding_completed IS 'Tracks whether user has completed initial onboarding checklist';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when onboarding was marked complete';

-- Update existing users to have onboarding completed if they have:
-- 1. An avatar
-- 2. A bio
-- 3. At least one published section
UPDATE profiles p
SET 
  onboarding_completed = TRUE,
  onboarding_completed_at = NOW()
WHERE 
  onboarding_completed = FALSE
  AND avatar_url IS NOT NULL 
  AND bio IS NOT NULL 
  AND bio != ''
  AND EXISTS (
    SELECT 1 FROM sections s 
    WHERE s.profile_id = p.id 
    AND s.published = TRUE
    LIMIT 1
  );
