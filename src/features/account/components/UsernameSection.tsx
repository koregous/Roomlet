'use client'

import { useEffect, useRef, useState } from 'react'
import {
  USERNAME_COOLDOWN_DAYS,
  USERNAME_HOLD_DAYS,
  usernameSchema,
} from '@/shared/lib/validation/account-schemas'
import { accountRequest } from '../api'
import SettingsCard, { FormError, FormSuccess } from './SettingsCard'

interface Props {
  username: string
  changedAt?: string | null
  onChanged: (newUsername: string, changedAt: string) => void
}

type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'unavailable'; reason: string }

const DAY_MS = 24 * 60 * 60 * 1000

export default function UsernameSection({ username, changedAt, onChanged }: Props) {
  const [value, setValue] = useState('')
  const [password, setPassword] = useState('')
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const requestId = useRef(0)

  const nextAllowed = changedAt ? new Date(new Date(changedAt).getTime() + USERNAME_COOLDOWN_DAYS * DAY_MS) : null
  const locked = !!nextAllowed && nextAllowed.getTime() > Date.now()

  // Debounced availability check. Late responses for an older input are ignored.
  useEffect(() => {
    if (!value) {
      setAvailability({ state: 'idle' })
      return
    }
    const parsed = usernameSchema.safeParse(value)
    if (!parsed.success) {
      setAvailability({ state: 'unavailable', reason: parsed.error.issues[0]?.message ?? 'Invalid username' })
      return
    }
    if (parsed.data === username) {
      setAvailability({ state: 'unavailable', reason: 'That is already your username' })
      return
    }

    setAvailability({ state: 'checking' })
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const res = await accountRequest(`/api/account/username?u=${encodeURIComponent(parsed.data)}`, 'GET')
      if (id !== requestId.current) return
      if (res.ok && res.data.available) setAvailability({ state: 'available' })
      else setAvailability({ state: 'unavailable', reason: String(res.data.reason ?? res.data.error ?? 'Not available') })
    }, 400)

    return () => clearTimeout(timer)
  }, [value, username])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    setBusy(true)
    const res = await accountRequest('/api/account/username', 'POST', { username: value, password })
    setBusy(false)

    if (!res.ok) {
      setError(res.data.error ?? 'Could not change username')
      return
    }

    const newName = String(res.data.username)
    setSuccess(`You are now @${newName}. Your old link will keep redirecting to your new one.`)
    setValue('')
    setPassword('')
    onChanged(newName, new Date().toISOString())
  }

  return (
    <SettingsCard
      title="Username"
      description={`Your profile lives at /${username}. You can change it once every ${USERNAME_COOLDOWN_DAYS} days.`}
    >
      {locked && nextAllowed ? (
        <p className="text-sm text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2">
          You changed your username recently. You can change it again on{' '}
          <span className="font-medium">{nextAllowed.toLocaleDateString(undefined, { dateStyle: 'long' })}</span>.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="new-username" className="ui-label">New username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">@</span>
              <input
                id="new-username"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value.toLowerCase().trim())}
                className="ui-field pl-7"
                placeholder="new_username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
                required
              />
            </div>
            <p className="text-xs mt-1.5 min-h-[1rem]" aria-live="polite">
              {availability.state === 'checking' && <span className="text-gray-400">Checking...</span>}
              {availability.state === 'available' && <span className="text-emerald-400">Available</span>}
              {availability.state === 'unavailable' && <span className="text-red-400">{availability.reason}</span>}
            </p>
          </div>

          <div>
            <label htmlFor="username-password" className="ui-label">Current password</label>
            <input
              id="username-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ui-field"
              autoComplete="current-password"
              required
            />
          </div>

          <p className="text-xs text-gray-500">
            Your old username stays reserved for you for {USERNAME_HOLD_DAYS} days, and links to it will redirect to your new profile.
          </p>

          <FormError message={error} />
          <FormSuccess message={success} />
          <button
            type="submit"
            disabled={busy || availability.state !== 'available' || !password}
            className="ui-btn-primary"
          >
            {busy ? 'Saving...' : 'Change username'}
          </button>
        </form>
      )}

      {locked && success && <div className="mt-4"><FormSuccess message={success} /></div>}
    </SettingsCard>
  )
}
