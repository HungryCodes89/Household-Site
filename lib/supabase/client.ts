import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client. Use inside Client Components only.
// Reads from NEXT_PUBLIC_* env vars (exposed to client by Next.js).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
