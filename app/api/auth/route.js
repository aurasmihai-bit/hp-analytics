import { NextResponse } from 'next/server'

export async function POST(request) {
  const { password } = await request.json()

  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('hp_session', process.env.SESSION_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
