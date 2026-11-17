/***
 * Reserved usernames for Roomlet
 * ---------------------------------------------------------------
 * Prevents users from claiming names that would either break routing
 * (static Next.js routes) or enable impersonation (brands, staff roles,
 * Roomlet's own variants).
 *
 * Usage:
 *   import { isReservedUsername, validateUsername } from "./reservedUsernames";
 *
 *   const result = validateUsername("gallery");
 *   if (!result.valid) {
 *     // show result.reason to the user
 *   }
 */

import { containsProfanity } from './content-moderation';

// ── 1. Existing app routes ──────────────────────────────────────
// Any folder/page in your Next.js app dir that lives at the root level.
// Update this whenever you add a new top-level route.
const APP_ROUTES = [
  "gallery",
  "about",
  "login",
  "signup",
  "register",
  "settings",
  "dashboard",
  "help",
  "terms",
  "privacy",
  "pricing",
  "blog",
  "docs",
  "support",
  "explore",
  "search",
  "notifications",
  "messages",
  "api",
  "discover",
  "discover-list",
  "curators",
  "creators",
  "s", // section shortlink route
];

// ── 2. Roomlet's own brand + variants ───────────────────────────
// "roomlet" itself is NOT reserved-away — it's the live official account.
// These are the variants someone might use to impersonate it.
const ROOMLET_VARIANTS = [
  "koregous",
  "roomlet",
  "roomletofficial",
  "officialroomlet",
  "roomletteam",
  "roomlethq",
  "roomletapp",
  "roomletsupport",
  "roomletadmin",
  "getroomlet",
];

// ── 3. Major third-party brands (impersonation risk) ────────────
const THIRD_PARTY_BRANDS = [
  "facebook",
  "instagram",
  "google",
  "twitter",
  "x",
  "tiktok",
  "discord",
  "apple",
  "microsoft",
  "amazon",
  "netflix",
  "youtube",
  "linkedin",
  "snapchat",
  "reddit",
  "pinterest",
  "whatsapp",
  "telegram",
  "spotify",
  "twitch",
  "github",
  "slack",
  "zoom",
  "adobe",
  "samsung",
  "sony",
  "nvidia",
  "openai",
  "anthropic",
  "meta",
];

// ── 4. Payment / financial brands (common phishing targets) ─────
const FINANCIAL_BRANDS = [
  "paypal",
  "stripe",
  "venmo",
  "visa",
  "mastercard",
  "cashapp",
  "applepay",
  "googlepay",
  "revolut",
  "wise",
  
];

// ── 5. Role-based / authority-sounding terms ─────────────────────
const ROLE_TERMS = [
  "admin",
  "administrator",
  "staff",
  "moderator",
  "mod",
  "support",
  "security",
  "verified",
  "official",
  "team",
  "system",
  "root",
  "owner",
  "founder",
  "help",
  "contact",
];

// ── 6. Generic reserved / placeholder words ──────────────────────
const GENERIC_RESERVED = [
  "null",
  "undefined",
  "test",
  "user",
  "username",
  "anonymous",
  "guest",
  "unknown",
  "none",
  "deleted",
];

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set(
  [
    ...APP_ROUTES,
    ...ROOMLET_VARIANTS,
    ...THIRD_PARTY_BRANDS,
    ...FINANCIAL_BRANDS,
    ...ROLE_TERMS,
    ...GENERIC_RESERVED,
  ].map((name) => name.toLowerCase())
);

/**
 * Case-insensitive, whitespace-trimmed check against the reserved list.
 */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.trim().toLowerCase());
}

export interface UsernameValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Full validation: format rules + reserved-name check + profanity filter.
 * Call this in your signup/profile-update handler BEFORE inserting
 * into Supabase. Also enforce this at the DB level (see note below).
 */
export function validateUsername(raw: string): UsernameValidationResult {
  const username = raw.trim();

  if (username.length < 3 || username.length > 20) {
    return { valid: false, reason: "Username must be 3–20 characters long." };
  }

  // Alphanumeric + underscore only, matches most platform conventions.
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      reason: "Username can only contain letters, numbers, and underscores.",
    };
  }

  if (isReservedUsername(username)) {
    return {
      valid: false,
      reason: "This username is reserved and cannot be used.",
    };
  }

  // Check for profanity
  if (containsProfanity(username)) {
    return {
      valid: false,
      reason: "This username contains inappropriate language.",
    };
  }

  return { valid: true };
}

/**
 * ── Supabase note ──────────────────────────────────────────────
 * Client-side/server-function validation can be bypassed via direct
 * API calls. Back this up with a Postgres check, e.g. a BEFORE INSERT
 * trigger on your profiles table that re-runs the same reserved-list
 * check, or a CHECK constraint referencing a reserved_usernames table
 * you keep in sync with this file.
 */
