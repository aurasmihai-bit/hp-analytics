import { NextResponse } from 'next/server'

function base64UrlFromBytes(bytes) {
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(input) {
  const padded = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded + '='.repeat((4 - padded.length % 4) % 4))
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

async function signCrmSession(body, secret) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return base64UrlFromBytes(new Uint8Array(signature))
}

async function isCrmSessionAuthorized(request, secret) {
  const token = request.cookies.get('hp_crm_session')?.value
  if (!token || !secret) return false
  const [body, signature] = token.split('.')
  if (!body || !signature) return false
  const expected = await signCrmSession(body, secret)
  if (!safeEqual(signature, expected)) return false

  try {
    const payload = JSON.parse(decodeBase64Url(body))
    return Boolean(payload?.sub && payload?.username && Number(payload.exp || 0) >= Date.now())
  } catch {
    return false
  }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl

  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  if (pathname === '/api/report' || pathname === '/api/sync' || pathname === '/api/weekly' || pathname.startsWith('/api/backlog') || pathname.startsWith('/api/platform') || pathname.startsWith('/api/concierge')) {
    return NextResponse.next()
  }

  const sessionSecret = process.env.SESSION_SECRET
  const session = request.cookies.get('hp_session')
  const hasDashboardSession = !!sessionSecret && !!session && session.value === sessionSecret
  const hasCrmSession = await isCrmSessionAuthorized(request, sessionSecret)

  if (pathname.startsWith('/dashboard/concierge')) {
    return hasDashboardSession || hasCrmSession
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/login', request.url))
  }

  if (!hasDashboardSession) {
    return hasCrmSession
      ? NextResponse.redirect(new URL('/dashboard/concierge', request.url))
      : NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
