import { NextResponse } from 'next/server'

export function proxy(request) {
  const { pathname } = request.nextUrl

  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  if (pathname === '/api/report' || pathname === '/api/sync' || pathname === '/api/weekly' || pathname.startsWith('/api/backlog') || pathname.startsWith('/api/platform')) {
    return NextResponse.next()
  }

  const sessionSecret = process.env.SESSION_SECRET
  const session = request.cookies.get('hp_session')
  if (!sessionSecret || !session || session.value !== sessionSecret) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
