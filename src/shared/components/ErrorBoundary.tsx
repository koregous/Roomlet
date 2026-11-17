'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

/**
 * React error boundary for catching unhandled render errors.
 * Wrap page-level or section-level components to prevent full-page crashes.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Replace with a structured logger (e.g. Sentry) when available
    console.error('[ErrorBoundary] Caught error:', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-serif mb-4">Something went wrong</h2>
              <p className="text-gray-400 text-sm mb-6">
                An unexpected error occurred. Please refresh the page.
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, message: '' })
                  window.location.reload()
                }}
                className="px-6 py-2 bg-white text-black rounded hover:bg-gray-200 transition text-sm"
              >
                Reload page
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
