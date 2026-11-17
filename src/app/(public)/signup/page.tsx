'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/shared/components/Toast'
import AvatarUploadDialog from '@/shared/components/AvatarUploadDialog'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'strong' | null>(null)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [createdUsername, setCreatedUsername] = useState<string>('')
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { addToast } = useToast()

  const validateUsername = (value: string) => {
    if (!value) {
      setUsernameError('')
      return true
    }
    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters')
      return false
    }
    if (value.length > 30) {
      setUsernameError('Username must be at most 30 characters')
      return false
    }
    if (!/^[a-z0-9_]+$/.test(value)) {
      setUsernameError('Only lowercase letters, numbers, and underscores allowed')
      return false
    }
    setUsernameError('')
    return true
  }

  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) {
      setPasswordStrength('weak')
    } else if (pwd.length < 10 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      setPasswordStrength('fair')
    } else {
      setPasswordStrength('strong')
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email || !password || !username) {
      setError('Please fill in all fields')
      return
    }

    if (!validateUsername(username)) return

    setLoading(true)

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      addToast(authError.message, 'error')
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Failed to create user account')
      addToast('Failed to create account', 'error')
      setLoading(false)
      return
    }

    // 2. Create the profile via the API route (single path — no client-side RPC fallback).
    //    The API calls the sanitised SECURITY DEFINER RPC and returns structured errors.
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: username.toLowerCase(),
        display_name: username,
        user_id: authData.user.id,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      const msg = result.error || 'Failed to create profile'
      setError(msg)
      addToast(msg, 'error')
      setLoading(false)
      return
    }

    // 3. Handle email confirmation flow
    if (!authData.session) {
      setSuccess('Account created! Check your email to verify your account.')
      addToast('Account created! Check your email', 'success')
      setLoading(false)
      setTimeout(() => router.push('/login'), 2000)
      return
    }

    // 4. Wait a moment for session to be fully established
    await new Promise(resolve => setTimeout(resolve, 500))

    // 5. Create template welcome section
    try {
      addToast('Setting up your profile...', 'info')
      
      // Get the current session token to pass to API
      const { data: { session } } = await supabase.auth.getSession()
      
      const setupResponse = await fetch('/api/onboarding/setup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      })

      const setupResult = await setupResponse.json()
      console.log('[Signup] Onboarding setup response:', setupResponse.status, setupResult)

      if (!setupResponse.ok) {
        console.warn('[Signup] Failed to create template section:', setupResult)
        addToast(`Template failed (${setupResponse.status}): ${setupResult.error || 'Unknown error'}`, 'error')
      } else {
        console.log('[Signup] Template section created successfully:', setupResult)
        addToast('Welcome section created!', 'success')
      }
    } catch (error) {
      console.error('[Signup] Error creating template section:', error)
      addToast(`Error setting up profile: ${error}`, 'error')
    }

    // 6. Show avatar upload dialog
    setCreatedUsername(result.username)
    setLoading(false)
    setShowAvatarDialog(true)
  }

  const handleAvatarUploadComplete = (avatarUrl: string) => {
    addToast('Profile photo set!', 'success')
    // Redirect to their public profile to see what they built
    router.push(`/${createdUsername}`)
    router.refresh()
  }

  const handleAvatarSkip = () => {
    // Still redirect to profile even if they skip
    addToast('Welcome to Roomlet!', 'success')
    router.push(`/${createdUsername}`)
    router.refresh()
  }

  return (
    <>
      <AvatarUploadDialog
        isOpen={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
        onUploadComplete={handleAvatarUploadComplete}
        onSkip={handleAvatarSkip}
      />

      <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="max-w-md w-full border border-gray-800 p-10 rounded-lg bg-black">
        <h1 className="text-4xl font-serif text-center mb-2">Create Account</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">Start showcasing your collections</p>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                const val = e.target.value.toLowerCase()
                setUsername(val)
                validateUsername(val)
              }}
              onBlur={() => validateUsername(username)}
              className={`w-full px-4 py-3 bg-black border rounded-lg text-white placeholder-gray-500 focus:outline-none transition ${
                usernameError ? 'border-red-500 focus:border-red-500' : 'border-gray-800 focus:border-white'
              }`}
              placeholder="yourname"
              required
            />
            {usernameError ? (
              <p className="text-xs text-red-400 mt-1">{usernameError}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Your profile: /{username || 'username'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-white focus:outline-none transition"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  checkPasswordStrength(e.target.value)
                }}
                className="w-full px-4 py-3 bg-black border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:border-white focus:outline-none transition pr-12"
                placeholder="••••••••"
                required
                minLength={6}
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
            <div className="mt-2 flex gap-2 items-center">
              <p className="text-xs text-gray-500">Strength:</p>
              <div className="flex gap-1">
                {(['weak', 'fair', 'strong'] as const).map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 w-4 rounded-full transition ${
                      passwordStrength &&
                      (['weak', 'fair', 'strong'] as const).indexOf(passwordStrength) >=
                        (['weak', 'fair', 'strong'] as const).indexOf(level)
                        ? level === 'weak'
                          ? 'bg-red-500'
                          : level === 'fair'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        : 'bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 flex gap-3 items-start">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-950 border border-green-800 rounded-lg px-4 py-3 flex gap-3 items-start">
              <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-green-200">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!usernameError || !email || !password || !username}
            className="w-full bg-white text-black py-3 font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-lg mt-6"
          >
            {loading ? 'Creating...' : 'Begin'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-white hover:text-gray-200 font-medium transition">
              Log in
            </Link>
          </p>
        </div>
      </div>
      </div>
    </>
  )
}
