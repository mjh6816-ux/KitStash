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

  // Handle password form submission (POST) - only if it looks like our password form
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('form')) {
      try {
        const formData = await request.formData()
        const submitted = formData.get('password') as string | null
        const redirectTo = (formData.get('redirect') as string | null) || '/'

        if (submitted === PASSWORD) {
          const response = NextResponse.redirect(new URL(redirectTo, request.url))
          response.cookies.set('kitstash_auth', '1', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 90, // 90 days
            path: '/',
          })
          return response
        } else {
          // Re-serve the form with error
          return new NextResponse(buildLoginForm(redirectTo, 'Incorrect password. Try again.'), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        }
      } catch (e) {
        return new NextResponse(buildLoginForm('/', 'Error processing login.'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }
    }
    // Not our password form POST (e.g. a server action POST from the app) - let it through
    // so that the unlock action can run and set the cookie.
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // For any other GET request (page loads etc.) without valid cookie: serve the inline login form.
  // This provides the gate entirely from the proxy without depending on a /login page route.
  if (request.method === 'GET') {
    const redirectTo = pathname + search
    return new NextResponse(buildLoginForm(redirectTo), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  // For non-GET (server actions etc.) without cookie: block with 401
  return new NextResponse('Authentication required', { status: 401 })
}

function buildLoginForm(redirectTo: string, errorMessage: string = '') {
  const errorHtml = errorMessage
    ? `<div style="color: #f87171; background: #450a0a; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 14px;">${errorMessage}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KitStash • Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-200 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
        <span class="text-3xl">🛠️</span>
      </div>
      <h1 class="text-3xl font-semibold tracking-tight">KitStash</h1>
      <p class="text-sm text-zinc-400 mt-1">Workbench access protected</p>
    </div>

    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      <h2 class="text-xl font-semibold mb-2">Enter password</h2>
      <p class="text-sm text-zinc-400 mb-6">This is a personal tool. Enter the shared password to continue.</p>

      <form method="POST" class="space-y-4">
        <input type="hidden" name="redirect" value="${redirectTo.replace(/"/g, '&quot;')}" />
        <div>
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            required
            autocomplete="current-password"
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        ${errorHtml}
        <button 
          type="submit"
          class="w-full bg-white text-zinc-950 font-medium py-3 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition text-sm"
        >
          Unlock Workbench
        </button>
      </form>
    </div>

    <p class="text-center text-[10px] text-zinc-500 mt-6">
      Protected with a simple password gate
    </p>
  </div>

  <script>
    // Optional: simple tailwind script if needed, but inline styles used for reliability
  </script>
</body>
</html>`
}


export const config = {
  matcher: [
    /*
     * Run proxy on all routes except static assets and internals.
     * The early returns inside handle skipping /login and setting 401 for non-page requests.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
