export type LoginIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'username'; value: string }
  | { kind: 'invalid' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9_]{3,30}$/

/**
 * Decide whether the login field holds an email or a username.
 * Usernames can never contain "@", so the presence of one (not leading) means email.
 * A leading "@" is tolerated ("@alex" -> "alex").
 */
export function parseLoginIdentifier(raw: string): LoginIdentifier {
  const value = raw.trim()
  if (!value) return { kind: 'invalid' }

  if (value.includes('@') && !value.startsWith('@')) {
    const email = value.toLowerCase()
    return EMAIL_RE.test(email) ? { kind: 'email', value: email } : { kind: 'invalid' }
  }

  const username = value.replace(/^@/, '').toLowerCase()
  return USERNAME_RE.test(username) ? { kind: 'username', value: username } : { kind: 'invalid' }
}
