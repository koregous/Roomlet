'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useToast } from '@/shared/components/Toast'
import { LoginErrorHandler } from '@/shared/components/LoginErrorHandler'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message = data.error || 'Login failed. Please try again.'
        setError(message)
        addToast(message, 'error')
        setLoading(false)
        return
      }

      addToast('Successfully logged in!', 'success', 2000)
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Suspense fallback={null}>
        <LoginErrorHandler />
      </Suspense>
      <div className="ui-card max-w-md w-full p-8 sm:p-10">
        <h1 className="text-4xl font-serif text-center mb-2">Welcome Back</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Continue curating your collections</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="identifier" className="ui-label">
              Email or username
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="ui-field py-2.5"
              placeholder="you@example.com or username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="ui-label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-field py-2.5 pr-12"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 flex gap-3 items-start"
            >
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !identifier.trim() || !password}
            className="ui-btn-primary w-full py-3 mt-2"
          >
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-ink-line">
          <p className="text-center text-gray-500 text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="text-white hover:text-gray-200 font-medium transition">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
