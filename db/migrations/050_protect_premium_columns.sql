-- ============================================================================
-- Migration 050: Stop users from granting themselves premium
--
-- Problem: the policy "profiles_update_own" lets a signed-in user UPDATE any
-- column of their own profile row, and only is_admin had a guard trigger. From
-- the browser console a user could run
--     supabase.from('profiles').update({ is_premium: true })
-- and unlock premium features. The same applies to INSERT (a user may delete and
-- re-create their own profile row).
--
-- Fix: block changes to the billing columns unless the request comes from the
-- service role (or from the SQL editor / postgres, where auth.role() is NULL).
--
-- storage_used_bytes is intentionally NOT guarded here: the quota RPCs run in the
-- user's request context and must keep working. Treat quota as best-effort.
--
-- Safe to re-run (idempotent).
--
-- To verify after applying (should raise "insufficient_privilege"):
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<your user uuid>"}';
--   UPDATE profiles SET is_premium = TRUE WHERE user_id = '<your user uuid>';
--   ROLLBACK;
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION prevent_self_premium_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only requests made through the API as a normal user (or anonymously) are blocked.
  IF auth.role() IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.is_premium IS DISTINCT FROM FALSE
         OR NEW.stripe_customer_id IS NOT NULL
         OR NEW.stripe_subscription_id IS NOT NULL
         OR NEW.subscription_status IS NOT NULL
         OR NEW.subscription_start_date IS NOT NULL
         OR NEW.subscription_end_date IS NOT NULL THEN
        RAISE EXCEPTION 'Subscription fields can only be set by a service-role request'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSE
      IF NEW.is_premium IS DISTINCT FROM OLD.is_premium
         OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
         OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
         OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
         OR NEW.subscription_start_date IS DISTINCT FROM OLD.subscription_start_date
         OR NEW.subscription_end_date IS DISTINCT FROM OLD.subscription_end_date THEN
        RAISE EXCEPTION 'Subscription fields can only be changed by a service-role request'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_premium_update ON profiles;
CREATE TRIGGER profiles_prevent_self_premium_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_premium_changes();

DROP TRIGGER IF EXISTS profiles_prevent_self_premium_insert ON profiles;
CREATE TRIGGER profiles_prevent_self_premium_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_premium_changes();

COMMIT;
