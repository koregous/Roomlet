'use client'

/**
 * Next.js global error boundary — catches errors in the root layout.
 * Must be a Client Component and must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {error.digest ? `Error ID: ${error.digest}` : 'An unexpected error occurred.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
