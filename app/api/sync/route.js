import { NextResponse } from 'next/server'

const SYNC_PERIODS = [30, 7, 14, 60, 90]

async function syncPeriod(request, days) {
  const base = `https://${request.headers.get('host')}`
  const res = await fetch(`${base}/api/report?days=${days}&refresh=1`, {
    headers: { cookie: request.headers.get('cookie') || '' }
  })
  if (!res.ok) throw new Error(`Report fetch failed for ${days}d: ${res.status}`)
  const data = await res.json()
  return { days, source: data._source }
}

// Vercel cron — GET
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET

  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const main = await syncPeriod(request, 30)
    SYNC_PERIODS.filter(d => d !== 30).forEach(d => syncPeriod(request, d).catch(() => {}))
    return NextResponse.json({ ok: true, ...main, syncedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Manual sync din dashboard — POST
export async function POST(request) {
  const isAuthorized = request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET
  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Sincronizeaza toate perioadele: 7, 14, 30, 60, 90 zile
    const results = await Promise.allSettled(
      SYNC_PERIODS.map(d => syncPeriod(request, d))
    )
    const summary = results.map((r, i) => ({
      days: SYNC_PERIODS[i],
      status: r.status === 'fulfilled' ? 'ok' : 'error',
    }))
    return NextResponse.json({ ok: true, periods: summary, syncedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
