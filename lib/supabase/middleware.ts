import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public route prefixes — exact paths or path prefixes that don't require auth.
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback', // reserved for future OAuth/magic-link callbacks
]

const STATIC_PREFIXES = [
  '/_next/',
  '/favicon',
  '/household-wordmark',
  '/hh-logo',
]

function isPublic(pathname: string): boolean {
  if (STATIC_PREFIXES.some(p => pathname.startsWith(p))) return true
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  // Allow files with extensions (images, fonts, etc.) — middleware matcher
  // already excludes most static, but be defensive.
  if (/\.[a-zA-Z0-9]{2,5}$/.test(pathname)) return true
  return false
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getUser() is what actually validates the JWT with Supabase.
  // Do not skip this call — getSession() alone trusts the cookie.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated visitor on a protected route → redirect to /login
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated visitor on /login → bounce them to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
