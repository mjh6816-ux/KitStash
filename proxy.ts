import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PASSWORD = process.env.SITE_PASSWORD

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Always forward the pathname header so layouts and server components can use it for fallbacks etc.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-current-pathname', pathname)

  // If no password is configured, allow everything (dev or unprotected deploys)
  if (!PASSWORD) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  const authCookie = request.cookies.get('kitstash_auth')?.value

  // Cookie value is just a sentinel ("1"). We validated the real password at login time.
  if (authCookie === '1') {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // Allow the dedicated login gate page to render (proxy will have redirected here for unauth users)
  if (pathname === '/login' || pathname.startsWith('/login')) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // For unauthenticated GET requests (normal page loads), redirect to the login gate page.
  // This is lightweight at the Edge and preserves the intended destination via ?redirect=.
  if (request.method === 'GET') {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname + search)
    }
    return NextResponse.redirect(loginUrl)
  }

  // For non-GET (server actions, form posts, etc.) without valid cookie: block to prevent data access/changes.
  return new NextResponse('Authentication required', { status: 401 })
}

export const config = {
  matcher: [
    /*
     * Run proxy on all routes except static assets and internals.
     * Early returns handle the pw check, /login allowance (for the gate page), and redirects.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
