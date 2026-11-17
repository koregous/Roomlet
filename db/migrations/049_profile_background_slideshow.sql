-- ============================================================================
-- Migration 049: Profile background slideshow
--
-- Premium profiles can now have up to 5 background images/GIFs that crossfade
-- as a slideshow (a single video is still supported, on its own).
--
-- Storage model:
--   profile_background_slides            JSONB array of {url, type, size}
--   profile_background_interval_seconds  seconds each slide is shown
--
-- The legacy single-background columns (profile_background_url/_type/_poster_url)
-- are kept and mirror slide #1, so existing code that only checks "does this
-- profile have a background" keeps working. Existing backgrounds are backfilled
-- as a one-slide slideshow.
--
-- Safe to re-run (idempotent). Apply BEFORE deploying the matching app code.
-- ============================================================================
BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_background_slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_background_interval_seconds SMALLINT NOT NULL DEFAULT 8;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_background_slides_valid') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_background_slides_valid
      CHECK (
        jsonb_typeof(profile_background_slides) = 'array'
        AND jsonb_array_length(profile_background_slides) <= 5
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_background_interval_valid') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_background_interval_valid
      CHECK (profile_background_interval_seconds BETWEEN 3 AND 60);
  END IF;
END $$;

-- Backfill: existing single backgrounds become a one-slide slideshow.
-- size is 0 because the original file size was never recorded.
UPDATE profiles
SET profile_background_slides = jsonb_build_array(
      jsonb_build_object(
        'url',  profile_background_url,
        'type', profile_background_type,
        'size', 0
      )
    )
WHERE profile_background_url IS NOT NULL
  AND profile_background_type IS NOT NULL
  AND jsonb_array_length(profile_background_slides) = 0;

-- When premium lapses, the background goes away (as before) - now including the slides.
CREATE OR REPLACE FUNCTION auto_remove_background_on_premium_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_premium = TRUE AND NEW.is_premium = FALSE THEN
    NEW.profile_background_url := NULL;
    NEW.profile_background_type := NULL;
    NEW.profile_background_poster_url := NULL;
    NEW.profile_background_slides := '[]'::jsonb;
    NEW.background_is_nsfw := FALSE;

    RAISE NOTICE 'Background auto-removed for user % (premium expired)', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN profiles.profile_background_slides IS 'Premium-only: ordered array of {url, type: image|gif|video, size} (max 5). Mirrors into profile_background_url/_type (slide #1). A video can only be used as a single slide.';
COMMENT ON COLUMN profiles.profile_background_interval_seconds IS 'Seconds each background slide is shown before crossfading to the next (3-60).';

COMMIT;
