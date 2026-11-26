'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useProfile } from '@/features/profile/hooks/useProfile'
import { getSupabaseBrowserClient } from '@/shared/lib/supabase-browser'
import { useToast } from '@/shared/components/Toast'
import EmailSection from '@/features/account/components/EmailSection'
import UsernameSection from '@/features/account/components/UsernameSection'
import PasswordSection from '@/features/account/components/PasswordSection'
import DeleteAccountSection from '@/features/account/components/DeleteAccountSection'

export default function AccountSettingsPage() {
  const { profile, setProfile, loading } = useProfile()
  const { addToast } = useToast()
  const [email, setEmail] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  // getUser() asks the auth server, so new_email (a change waiting for confirmation) is current.
  useEffect(() => {
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null)
        setPendingEmail(data.user?.new_email ?? null)
      })
  }, [])

  if (loading || !profile || !email) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-6 animate-pulse" aria-busy="true">
          <div className="h-8 w-56 rounded bg-ink-raised" />
          <div className="h-48 rounded-xl bg-ink-raised border border-ink-line" />
          <div className="h-48 rounded-xl bg-ink-raised border border-ink-line" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-4">
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
          <h1 className="text-3xl font-serif">Account settings</h1>
          <p className="text-sm text-gray-400 mt-1">Signed in as @{profile.username}</p>
        </div>

        <EmailSection currentEmail={email} pendingEmail={pendingEmail} onRequested={setPendingEmail} />

        <UsernameSection
          username={profile.username}
          changedAt={profile.username_changed_at}
          onChanged={(newName, changedAt) => {
            setProfile({ ...profile, username: newName, username_changed_at: changedAt })
            addToast(`Username changed to @${newName}`, 'success')
          }}
        />

        <PasswordSection />

        <DeleteAccountSection username={profile.username} isAdmin={profile.is_admin} />
      </div>
    </div>
  )
}
