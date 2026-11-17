-- Migration 043: Premium Subscription Tracking
-- Adds columns to track premium subscription status

-- Add subscription tracking columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT, -- active, canceled, past_due, trialing, incomplete
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;

-- Add indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium 
ON profiles(is_premium) WHERE is_premium = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer 
ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
ON profiles(subscription_status) WHERE subscription_status IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.is_premium IS 'Whether user has active premium subscription. Set to TRUE when subscription_status = active.';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for billing and subscription management.';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Stripe subscription ID. Used to manage subscription via Stripe API.';
COMMENT ON COLUMN profiles.subscription_status IS 'Current subscription status from Stripe. Values: active, canceled, past_due, trialing, incomplete, incomplete_expired, unpaid.';
COMMENT ON COLUMN profiles.subscription_start_date IS 'When the premium subscription started (first payment).';
COMMENT ON COLUMN profiles.subscription_end_date IS 'When the subscription ends/ended. NULL for active subscriptions.';

-- Update storage quota for premium users
-- Premium users get 10GB (10737418240 bytes) instead of 500MB
-- This will be used in storage-quota.ts to determine user's limit
-- For now, we'll check is_premium flag in the app code

-- Helper function to check if user is premium
CREATE OR REPLACE FUNCTION is_user_premium(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_premium, FALSE)
  FROM profiles
  WHERE user_id::text = p_user_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_premium(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_premium(TEXT) TO anon;

-- Helper function to get user's storage quota based on premium status
CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id TEXT)
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE 
    WHEN COALESCE(is_premium, FALSE) THEN 10737418240  -- 10 GB for premium
    ELSE 524288000                                      -- 500 MB for free
  END
  FROM profiles
  WHERE user_id::text = p_user_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_storage_quota(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_storage_quota(TEXT) TO anon;

-- Helper function to get user's section limit based on premium status
CREATE OR REPLACE FUNCTION get_user_section_limit(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE 
    WHEN COALESCE(is_premium, FALSE) THEN 999999  -- Effectively unlimited for premium
    ELSE 50                                        -- 50 for free tier
  END
  FROM profiles
  WHERE user_id::text = p_user_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_section_limit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_section_limit(TEXT) TO anon;

-- Note: To manually grant premium to a user for testing:
-- UPDATE profiles SET is_premium = TRUE, subscription_status = 'active', subscription_start_date = NOW() WHERE user_id = 'USER_ID_HERE';
