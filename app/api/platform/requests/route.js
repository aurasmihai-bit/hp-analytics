import { NextResponse } from 'next/server'
import { fetchPlatformRequestAnalytics } from '../../../lib/platform'

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

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value
}

function parseRange(searchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (from || to) {
    if (!isIsoDate(from) || !isIsoDate(to)) throw new Error('from/to must be YYYY-MM-DD')
    if (from > to) throw new Error('from must be before to')
    return { start: from, end: to }
  }

  const days = Math.max(1, Math.min(Number(searchParams.get('days') || 90), 1095))
  const now = new Date()
  const end = now.toISOString().slice(0,10)
  const startDate = new Date(now - days * 864e5)
  return { start: startDate.toISOString().slice(0,10), end }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  let range
  try {
    range = parseRange(searchParams)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  try {
    const data = await fetchPlatformRequestAnalytics({
      start: range.start,
      end: range.end,
      limit: Number(searchParams.get('limit') || 1000),
    })
    return NextResponse.json({ ok: true, range, ...data })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Platform request analytics failed' }, { status: 500 })
  }
}
