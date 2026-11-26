import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  danger?: boolean
  children: ReactNode
}

export default function SettingsCard({ title, description, danger, children }: Props) {
  return (
    <section className={`ui-card p-6 ${danger ? 'border-red-900/60' : ''}`}>
      <h2 className={`text-lg font-medium ${danger ? 'text-red-300' : 'text-white'}`}>{title}</h2>
      {description && <p className="text-sm text-gray-400 mt-1 mb-5">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </section>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-red-300 bg-red-950/60 border border-red-900 rounded-lg px-3 py-2">
      {message}
    </p>
  )
}

export function FormSuccess({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="status" className="text-sm text-emerald-300 bg-emerald-950/50 border border-emerald-900 rounded-lg px-3 py-2">
      {message}
    </p>
  )
}
