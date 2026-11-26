'use client'

import { useState } from 'react'
import { emailSchema } from '@/shared/lib/validation/account-schemas'
import { accountRequest } from '../api'
import SettingsCard, { FormError, FormSuccess } from './SettingsCard'

interface Props {
  currentEmail: string
  pendingEmail?: string | null
  onRequested: (pendingEmail: string) => void
}

export default function EmailSection({ currentEmail, pendingEmail, onRequested }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please enter a valid email')
      return
    }

    setBusy(true)
    const res = await accountRequest('/api/account/email', 'POST', { email: parsed.data, password })
    setBusy(false)

    if (!res.ok) {
      setError(res.data.error ?? 'Could not change email')
      return
    }

    setSuccess(
      `We sent a confirmation link to ${parsed.data}. Your email changes after you confirm it. If asked, confirm the link sent to ${currentEmail} as well.`
    )
    setEmail('')
    setPassword('')
    onRequested(parsed.data)
  }

  return (
    <SettingsCard title="Email" description="Used to sign in and to send you important account emails.">
      <p className="text-sm text-gray-300 mb-4">
        Current email: <span className="text-white font-medium break-all">{currentEmail}</span>
      </p>

      {pendingEmail && !success && (
        <p className="text-sm text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2 mb-4">
          Waiting for you to confirm <span className="font-medium break-all">{pendingEmail}</span>. Check your inbox.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="new-email" className="ui-label">New email</label>
          <input
            id="new-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ui-field"
            placeholder="new@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="email-password" className="ui-label">Current password</label>
          <input
            id="email-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ui-field"
            autoComplete="current-password"
            required
          />
        </div>
        <FormError message={error} />
        <FormSuccess message={success} />
        <button type="submit" disabled={busy || !email || !password} className="ui-btn-primary">
          {busy ? 'Sending...' : 'Change email'}
        </button>
      </form>
    </SettingsCard>
  )
}
