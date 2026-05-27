'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './login.css'

export default function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath: string
  initialError?: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [isPending, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return
    }
    startTransition(() => {
      router.push(nextPath || '/dashboard')
      router.refresh()
    })
  }

  return (
    <main className="login-shell">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />
      <div className="login-scan"  aria-hidden="true" />

      <span className="login-corner login-corner-tl" aria-hidden="true" />
      <span className="login-corner login-corner-tr" aria-hidden="true" />
      <span className="login-corner login-corner-bl" aria-hidden="true" />
      <span className="login-corner login-corner-br" aria-hidden="true" />

      <div className="login-card">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/household-wordmark-white.png" alt="HOUSEHOLD EST. 2011" className="login-wordmark" />
          <div className="login-sub">Financial Ops · Capsule 001</div>
        </div>

        <form className="login-form" onSubmit={onSubmit} autoComplete="on">
          <label className="login-field">
            <span className="login-label">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
            />
          </label>

          <label className="login-field">
            <span className="login-label">Passphrase</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={isPending}>
            {isPending ? 'Entering…' : '[ Enter the household ]'}
          </button>
        </form>

        <div className="login-footer">
          <span className="login-dot" />
          <span>SECURE CHANNEL</span>
        </div>
      </div>
    </main>
  )
}
