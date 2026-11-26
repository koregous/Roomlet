'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PASSWORD_MIN, getPasswordStrength, newPasswordSchema } from '@/shared/lib/validation/account-schemas'
import { accountRequest } from '../api'
import SettingsCard, { FormError, FormSuccess } from './SettingsCard'

const STRENGTH_STYLE = {
  weak: { label: 'Weak', bar: 'w-1/3 bg-red-500' },
  fair: { label: 'Fair', bar: 'w-2/3 bg-amber-400' },
  strong: { label: 'Strong', bar: 'w-full bg-emerald-400' },
} as const

export default function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const strength = next ? STRENGTH_STYLE[getPasswordStrength(next)] : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const check = newPasswordSchema.safeParse(next)
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? 'Invalid password')
      return
    }
    if (next !== confirm) {
      setError('New passwords do not match')
      return
    }

    setBusy(true)
    const res = await accountRequest('/api/account/password', 'POST', {
      currentPassword: current,
      newPassword: next,
    })
    setBusy(false)

    if (!res.ok) {
      setError(res.data.error ?? 'Could not change password')
      return
    }

    setSuccess('Password updated. You were signed out of your other devices.')
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <SettingsCard title="Password" description={`Use at least ${PASSWORD_MIN} characters. Changing it signs you out of other devices.`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="current-password" className="ui-label">Current password</label>
          <input
            id="current-password"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="ui-field"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label htmlFor="new-password" className="ui-label">New password</label>
          <div className="relative">
            <input
              id="new-password"
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="ui-field pr-11"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              aria-label={show ? 'Hide passwords' : 'Show passwords'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-ink-field overflow-hidden">
                <div className={`h-full rounded-full transition-all ${strength.bar}`} />
              </div>
              <span className="text-xs text-gray-400">{strength.label}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className="ui-label">Confirm new password</label>
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="ui-field"
            autoComplete="new-password"
            required
          />
        </div>

        <FormError message={error} />
        <FormSuccess message={success} />
        <button type="submit" disabled={busy || !current || !next || !confirm} className="ui-btn-primary">
          {busy ? 'Updating...' : 'Change password'}
        </button>
      </form>
    </SettingsCard>
  )
}
