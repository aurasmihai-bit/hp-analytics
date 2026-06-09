import { NextResponse } from 'next/server'
import { requireEnv } from '../../lib/env'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let dashboardPassword, sessionSecret
  try {
    dashboardPassword = requireEnv('DASHBOARD_PASSWORD')
    sessionSecret = requireEnv('SESSION_SECRET')
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const password = body?.password

  if (typeof password !== 'string' || !password || password !== dashboardPassword) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('hp_session', sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
