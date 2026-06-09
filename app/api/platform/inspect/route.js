import { NextResponse } from 'next/server'
import { inspectPlatformRequestFields } from '../../../lib/platform'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const sessionSecret = process.env.SESSION_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret)
  )
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 200)

  try {
    const inspection = await inspectPlatformRequestFields({ limit })
    return NextResponse.json({ ok: true, ...inspection })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Platform inspection failed' }, { status: 500 })
  }
}
