'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleLogout() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="dash-logout"
      aria-label="Sign out"
    >
      {busy ? 'Exiting…' : '[ exit ]'}
    </button>
  )
}
