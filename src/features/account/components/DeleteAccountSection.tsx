'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { accountRequest } from '../api'
import SettingsCard, { FormError } from './SettingsCard'

interface Props {
  username: string
  isAdmin?: boolean
}

export default function DeleteAccountSection({ username, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nameMatches = confirmName.trim().toLowerCase() === username

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameMatches) return
    setError('')
    setBusy(true)

    const res = await accountRequest('/api/account', 'DELETE', { password, confirmUsername: confirmName })

    if (!res.ok) {
      setError(res.data.error ?? 'Could not delete your account')
      setBusy(false)
      return
    }

    // The server already removed the account; clear any leftover local session, then
    // do a full page load so no cached profile data survives in memory.
    try {
      await getSupabaseBrowserClient().auth.signOut({ scope: 'local' })
    } catch {
      // nothing to clean up
    }
    window.location.assign('/')
  }

  return (
    <SettingsCard
      danger
      title="Delete account"
      description="Permanently delete your account and everything on it. This cannot be undone."
    >
      {isAdmin ? (
        <p className="text-sm text-gray-400">
          Admin accounts can't be deleted from here. Remove the admin role first.
        </p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="ui-btn-secondary border-red-900 text-red-300 hover:bg-red-950/40">
          Delete my account...
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
            <li>Your profile, collections, and every uploaded file are deleted.</li>
            <li>Your bookmarks and likes are removed.</li>
            <li>Your profile link stops working, and <span className="text-white">@{username}</span> becomes available for anyone to claim.</li>
          </ul>

          <div>
            <label htmlFor="delete-confirm-name" className="ui-label">
              Type <span className="text-white font-medium">{username}</span> to confirm
            </label>
            <input
              id="delete-confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="ui-field"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div>
            <label htmlFor="delete-password" className="ui-label">Password</label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ui-field"
              autoComplete="current-password"
              required
            />
          </div>

          <FormError message={error} />

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || !nameMatches || !password}
              className="ui-btn bg-red-600 text-white hover:bg-red-500"
            >
              {busy ? 'Deleting...' : 'Permanently delete account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setConfirmName('')
                setPassword('')
                setError('')
              }}
              disabled={busy}
              className="ui-btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </SettingsCard>
  )
}
