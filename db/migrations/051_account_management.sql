-- ============================================================================
-- Migration 051: Account management (username change + old-name redirects)
--
-- Until now usernames were frozen by the prevent_username_change() trigger.
-- This migration lets a username change happen ONLY through change_username(),
-- which is callable by the service role (i.e. our API route), never by the
-- browser. It adds:
--   * profiles.username_changed_at   -> drives the 30-day cooldown
--   * username_history               -> old name -> profile, reserved for 90 days
--   * change_username()              -> validated, atomic rename
--   * get_username_redirect()        -> lets /old-name redirect to /new-name
--   * create_profile_for_user()      -> now also refuses names that are on hold
--
-- Safe to re-run (idempotent).
-- ============================================================================
BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS username_history (
  old_username   TEXT PRIMARY KEY,
  profile_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reserved_until TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_username_history_profile ON username_history(profile_id);

-- RLS on with no policies: only the service role and SECURITY DEFINER functions can touch it.
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;

-- Rename is allowed only while change_username() has set this transaction-local flag.
CREATE OR REPLACE FUNCTION prevent_username_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username
     AND COALESCE(current_setting('app.allow_username_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Username can only be changed through the account settings'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Errors are raised with a stable prefix so the API route can map them to messages:
--   USERNAME_INVALID | USERNAME_SAME | USERNAME_TAKEN | USERNAME_RESERVED
--   USERNAME_COOLDOWN:<timestamp when the next change is allowed>
CREATE OR REPLACE FUNCTION change_username(
  p_user_id      UUID,
  p_new_username TEXT,
  p_cooldown     INTERVAL DEFAULT INTERVAL '30 days',
  p_hold         INTERVAL DEFAULT INTERVAL '90 days'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new     TEXT := LOWER(TRIM(p_new_username));
  v_profile profiles%ROWTYPE;
BEGIN
  IF v_new !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'USERNAME_INVALID';
  END IF;

  -- Lock the row so two concurrent renames of the same profile serialize.
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_profile.username = v_new THEN
    RAISE EXCEPTION 'USERNAME_SAME';
  END IF;

  IF v_profile.username_changed_at IS NOT NULL
     AND v_profile.username_changed_at > NOW() - p_cooldown THEN
    RAISE EXCEPTION 'USERNAME_COOLDOWN:%', (v_profile.username_changed_at + p_cooldown)::TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM reserved_usernames WHERE LOWER(username) = v_new) THEN
    RAISE EXCEPTION 'USERNAME_RESERVED';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE username = v_new) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  -- Someone else's recently released name is still on hold.
  IF EXISTS (
    SELECT 1 FROM username_history
    WHERE old_username = v_new AND profile_id <> v_profile.id AND reserved_until > NOW()
  ) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  -- Claiming the name clears any stale history row for it (own old name or an expired hold).
  DELETE FROM username_history WHERE old_username = v_new;

  INSERT INTO username_history (old_username, profile_id, reserved_until)
  VALUES (v_profile.username, v_profile.id, NOW() + p_hold)
  ON CONFLICT (old_username) DO UPDATE
    SET profile_id = EXCLUDED.profile_id,
        changed_at = NOW(),
        reserved_until = EXCLUDED.reserved_until;

  PERFORM set_config('app.allow_username_change', 'on', true);
  BEGIN
    UPDATE profiles
       SET username = v_new, username_changed_at = NOW()
     WHERE id = v_profile.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END;
  PERFORM set_config('app.allow_username_change', 'off', true);

  RETURN JSONB_BUILD_OBJECT(
    'profile_id', v_profile.id,
    'old_username', v_profile.username,
    'new_username', v_new
  );
END;
$$;

REVOKE ALL ON FUNCTION change_username(UUID, TEXT, INTERVAL, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION change_username(UUID, TEXT, INTERVAL, INTERVAL) TO service_role;

-- Public lookup used by /[username] to redirect an old name to the current one.
-- Returns NULL if the name is currently in use (a live profile always wins).
CREATE OR REPLACE FUNCTION get_username_redirect(p_old TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.username
    FROM username_history h
    JOIN profiles p ON p.id = h.profile_id
   WHERE h.old_username = LOWER(p_old)
     AND NOT EXISTS (SELECT 1 FROM profiles x WHERE x.username = LOWER(p_old))
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_username_redirect(TEXT) TO anon, authenticated, service_role;

-- Signup must not hand out a name that another user is still holding.
CREATE OR REPLACE FUNCTION create_profile_for_user(
  p_user_id UUID, p_username TEXT, p_display_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_clean_username TEXT;
BEGIN
  v_clean_username := LOWER(TRIM(p_username));
  IF v_clean_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Invalid username format: must be 3-30 characters, letters/numbers/underscores only'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE username = v_clean_username) THEN
    RAISE EXCEPTION 'Username already taken: %', v_clean_username USING ERRCODE = 'unique_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM username_history WHERE old_username = v_clean_username AND reserved_until > NOW()
  ) THEN
    RAISE EXCEPTION 'Username already taken: %', v_clean_username USING ERRCODE = 'unique_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a profile' USING ERRCODE = 'unique_violation';
  END IF;
  DELETE FROM username_history WHERE old_username = v_clean_username;
  INSERT INTO profiles (user_id, username, display_name)
  VALUES (p_user_id, v_clean_username, TRIM(COALESCE(p_display_name, v_clean_username)))
  RETURNING id INTO v_profile_id;
  RETURN v_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION create_profile_for_user(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_profile_for_user(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
