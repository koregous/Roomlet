-- Migration 044: Profile NSFW and Premium Backgrounds
-- Adds profile-wide NSFW toggle and premium animated background support

-- ─── Profile NSFW Flag ──────────────────────────────────────────────────────

-- Add profile-wide NSFW flag
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for NSFW profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_nsfw 
ON profiles(is_nsfw) WHERE is_nsfw = TRUE;

-- Add comment
COMMENT ON COLUMN profiles.is_nsfw IS 'Profile-wide NSFW flag. When TRUE, entire profile is marked as NSFW and blurred for users with NSFW disabled. Separate from section-level NSFW flags.';

-- ─── Premium Background Columns ──────────────────────────────────────────────

-- Add background columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_background_url TEXT,
ADD COLUMN IF NOT EXISTS profile_background_type TEXT 
  CHECK (profile_background_type IN ('video', 'gif', 'image')),
ADD COLUMN IF NOT EXISTS background_is_nsfw BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS profile_background_poster_url TEXT;

-- Add indexes for background queries
CREATE INDEX IF NOT EXISTS idx_profiles_has_background 
ON profiles(profile_background_url) 
WHERE profile_background_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.profile_background_url IS 'Premium-only: URL to video/gif/image background for profile page. Counts toward user storage quota. Max 10MB, max 30s for video.';
COMMENT ON COLUMN profiles.profile_background_type IS 'Type of background: video, gif, or image. NULL if no background set.';
COMMENT ON COLUMN profiles.background_is_nsfw IS 'Whether profile background contains NSFW content. Separate from profile-wide is_nsfw. Both flags are checked for blur logic.';
COMMENT ON COLUMN profiles.profile_background_poster_url IS 'Thumbnail/poster frame URL for video backgrounds. Used for fast initial load and mobile fallback.';

-- ─── Helper Functions ────────────────────────────────────────────────────────

-- Function to check if user can upload background (premium only)
CREATE OR REPLACE FUNCTION can_upload_profile_background(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_premium, FALSE)
  FROM profiles
  WHERE user_id::text = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION can_upload_profile_background(TEXT) TO authenticated;

-- ─── Auto-Remove Background Trigger ──────────────────────────────────────────

-- Trigger to auto-remove background when premium expires
-- This ensures only premium users have backgrounds
CREATE OR REPLACE FUNCTION auto_remove_background_on_premium_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If is_premium changed from TRUE to FALSE, remove background
  IF OLD.is_premium = TRUE AND NEW.is_premium = FALSE THEN
    NEW.profile_background_url := NULL;
    NEW.profile_background_type := NULL;
    NEW.profile_background_poster_url := NULL;
    NEW.background_is_nsfw := FALSE;
    
    -- Log for debugging
    RAISE NOTICE 'Background auto-removed for user % (premium expired)', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_remove_background_on_premium_loss ON profiles;

CREATE TRIGGER trigger_remove_background_on_premium_loss
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.is_premium IS DISTINCT FROM NEW.is_premium)
EXECUTE FUNCTION auto_remove_background_on_premium_loss();

COMMENT ON TRIGGER trigger_remove_background_on_premium_loss ON profiles IS 
  'Automatically removes profile background when premium subscription ends. Ensures only premium users have backgrounds.';

-- ─── Notes ───────────────────────────────────────────────────────────────────

-- NSFW Logic:
-- - If profile.is_nsfw = TRUE, entire profile is blurred (including background)
-- - If profile.background_is_nsfw = TRUE, only background is blurred
-- - Both respect user's NSFW preferences (nsfwEnabled setting)

-- Premium Background Rules:
-- - Only premium users can upload backgrounds
-- - Max file size: 10MB
-- - Max video duration: 30 seconds
-- - Counts toward user's 10GB storage quota
-- - Automatically removed when premium expires (via trigger)
-- - Supported formats: MP4, WebM, GIF, JPG, PNG, WebP

-- To manually test background upload:
-- UPDATE profiles 
-- SET profile_background_url = 'https://example.com/bg.mp4',
--     profile_background_type = 'video',
--     background_is_nsfw = FALSE
-- WHERE user_id = 'USER_ID_HERE' AND is_premium = TRUE;

-- To manually test NSFW profile:
-- UPDATE profiles SET is_nsfw = TRUE WHERE user_id = 'USER_ID_HERE';

