'use client'

import { useState, useCallback } from 'react'
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: ToastMessage[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

import { createContext, useContext } from 'react'

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36)
    setToasts((prev) => [...prev, { id, message, type, duration }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: ToastMessage[]
  removeToast: (id: string) => void
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const bgColor =
    toast.type === 'success'
      ? 'bg-green-900 border-green-700'
      : toast.type === 'error'
        ? 'bg-red-900 border-red-700'
        : toast.type === 'warning'
          ? 'bg-yellow-900 border-yellow-700'
          : 'bg-blue-900 border-blue-700'

  const textColor =
    toast.type === 'success'
      ? 'text-green-200'
      : toast.type === 'error'
        ? 'text-red-200'
        : toast.type === 'warning'
          ? 'text-yellow-200'
          : 'text-blue-200'

  const Icon =
    toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : toast.type === 'warning' ? AlertCircle : Info

  return (
    <div className={`${bgColor} border rounded-lg p-4 flex gap-3 items-start animate-slideIn shadow-lg`}>
      <Icon className={`${textColor} flex-shrink-0 mt-0.5`} size={20} />
      <p className={`${textColor} text-sm flex-1`}>{toast.message}</p>
      <button
        onClick={onClose}
        className={`${textColor} hover:opacity-70 transition flex-shrink-0`}
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}
