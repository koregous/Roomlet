'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useToast } from '@/shared/components/Toast'
import { LoginErrorHandler } from '@/shared/components/LoginErrorHandler'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { addToast } = useToast()

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('')
      return true
    }
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    setEmailError(isValid ? '' : 'Please enter a valid email')
    return isValid
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    // Force-validate on submit regardless of touched state
    setEmailTouched(true)
    if (!validateEmail(email)) return

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      addToast(error.message, 'error')
      setLoading(false)
    } else {
      addToast('Successfully logged in!', 'success', 2000)
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Suspense fallback={null}>
        <LoginErrorHandler />
      </Suspense>
      <div className="max-w-md w-full border border-gray-800 p-10 rounded-lg bg-black">
        <h1 className="text-4xl font-serif text-center mb-2">Welcome Back</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Continue curating your collections</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                // Only live-validate after the user has already blurred once —
                // so fixing a typo clears the error instantly without
                // showing errors mid-typing on first entry.
                if (emailTouched) validateEmail(e.target.value)
              }}
              onBlur={() => {
                setEmailTouched(true)
                validateEmail(email)
              }}
              className={`w-full px-4 py-3 bg-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition ${
                emailTouched && emailError
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-800 focus:border-white'
              }`}
              placeholder="you@example.com"
              required
            />
            {emailTouched && emailError && (
              <p className="text-xs text-red-400 mt-1">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-white focus:outline-none transition pr-12"
                placeholder="••••••••"
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
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 flex gap-3 items-start">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (emailTouched && !!emailError) || !email || !password}
            className="w-full bg-white text-black py-3 font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-lg mt-6"
          >
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
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