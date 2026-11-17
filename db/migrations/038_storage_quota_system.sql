-- Migration 038: Storage Quota System
-- Adds per-user storage tracking and quota enforcement (500MB free tier)

-- Add storage tracking column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0 NOT NULL;

-- Add index for storage queries
CREATE INDEX IF NOT EXISTS idx_profiles_storage_used 
ON profiles(storage_used_bytes DESC);

-- Add comment for documentation
COMMENT ON COLUMN profiles.storage_used_bytes IS 'Total storage used by this user across all sections in bytes. Updated on upload/delete. Free tier limit: 524288000 bytes (500MB).';

-- Create function to calculate user storage usage
-- This scans all R2 URLs in user sections and sums file sizes
CREATE OR REPLACE FUNCTION calculate_user_storage(p_user_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_bytes BIGINT := 0;
  section_record RECORD;
  block_record JSONB;
  image_record JSONB;
  file_size BIGINT;
BEGIN
  -- Find all sections owned by this user
  FOR section_record IN 
    SELECT s.id, s.blocks
    FROM sections s
    JOIN profiles p ON p.id = s.profile_id
    WHERE p.user_id::text = p_user_id
  LOOP
    -- Iterate through blocks in each section
    IF section_record.blocks IS NOT NULL THEN
      FOR block_record IN SELECT * FROM jsonb_array_elements(section_record.blocks)
      LOOP
        -- Handle different block types
        CASE block_record->>'type'
          
          -- Image block: single image with size
          WHEN 'image' THEN
            file_size := (block_record->'content'->'image'->>'size')::BIGINT;
            IF file_size IS NOT NULL THEN
              total_bytes := total_bytes + file_size;
            END IF;
          
          -- Gallery block: array of images
          WHEN 'gallery', 'carousel' THEN
            IF block_record->'content'->'images' IS NOT NULL THEN
              FOR image_record IN SELECT * FROM jsonb_array_elements(block_record->'content'->'images')
              LOOP
                file_size := (image_record->>'size')::BIGINT;
                IF file_size IS NOT NULL THEN
                  total_bytes := total_bytes + file_size;
                END IF;
              END LOOP;
            END IF;
          
          -- Audio block: single audio file
          WHEN 'audio' THEN
            file_size := (block_record->'content'->'audio'->>'size')::BIGINT;
            IF file_size IS NOT NULL THEN
              total_bytes := total_bytes + file_size;
            END IF;
          
          ELSE
            -- Unknown block type, skip
            NULL;
        END CASE;
      END LOOP;
    END IF;
  END LOOP;

  -- Also count profile images (avatar, banner, OG images)
  FOR section_record IN
    SELECT 
      p.avatar_url,
      p.banner_url,
      COALESCE(s.og_image_url, '') as og_image_url,
      COALESCE(s.og_banner_url, '') as og_banner_url
    FROM profiles p
    LEFT JOIN sections s ON s.profile_id = p.id
    WHERE p.user_id::text = p_user_id
  LOOP
    -- Profile images: estimate ~500KB each if present
    -- (Real size tracking requires querying R2 metadata)
    IF section_record.avatar_url IS NOT NULL AND section_record.avatar_url != '' THEN
      total_bytes := total_bytes + 500000; -- 500KB estimate
    END IF;
    IF section_record.banner_url IS NOT NULL AND section_record.banner_url != '' THEN
      total_bytes := total_bytes + 500000;
    END IF;
    IF section_record.og_image_url IS NOT NULL AND section_record.og_image_url != '' THEN
      total_bytes := total_bytes + 500000;
    END IF;
    IF section_record.og_banner_url IS NOT NULL AND section_record.og_banner_url != '' THEN
      total_bytes := total_bytes + 500000;
    END IF;
  END LOOP;

  RETURN total_bytes;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_user_storage(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_storage(TEXT) TO anon;

-- Create function to increment storage usage (called after uploads)
CREATE OR REPLACE FUNCTION increment_storage_usage(p_user_id TEXT, p_bytes BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used_bytes = storage_used_bytes + p_bytes
  WHERE user_id::text = p_user_id;
END;
$$;

-- Create function to decrement storage usage (called after deletions)
CREATE OR REPLACE FUNCTION decrement_storage_usage(p_user_id TEXT, p_bytes BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used_bytes = GREATEST(0, storage_used_bytes - p_bytes)
  WHERE user_id::text = p_user_id;
  
  -- Note: Using GREATEST to prevent negative values
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_storage_usage(TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_storage_usage(TEXT, BIGINT) TO authenticated;

-- Backfill storage usage for existing users
-- Run this AFTER migration to populate storage_used_bytes
-- Note: This is commented out because it may take time for large databases
-- Uncomment and run separately if needed

-- UPDATE profiles
-- SET storage_used_bytes = calculate_user_storage(user_id)
-- WHERE storage_used_bytes = 0;

