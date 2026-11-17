/**
 * Instance verification
 * Prevents unauthorized deployments while keeping code public
 */

const AUTHORIZED_DOMAINS = [
  'roomlet.vercel.app',
  'roomlet.app',
  'roomlet.com',
  'localhost', // Allow local dev
]

/**
 * Checks if the current deployment is authorized.
 * This is a deterrent, not foolproof security.
 */
export function isAuthorizedInstance(): boolean {
  // Skip check in development
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // Check if running on authorized domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  
  return AUTHORIZED_DOMAINS.some((domain) => siteUrl.includes(domain))
}

/**
 * Middleware to block unauthorized instances
 */
export function requireAuthorizedInstance() {
  if (!isAuthorizedInstance()) {
    throw new Error(
      'Unauthorized deployment detected. This is a source-available project, not open-source. ' +
      'See LICENSE.md for usage terms. For commercial licensing: contact@roomlet.app'
    )
  }
}
