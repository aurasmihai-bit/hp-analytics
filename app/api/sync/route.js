import { NextResponse } from 'next/server'

export const maxDuration = 60

const SYNC_PERIODS = [30, 7, 14, 60, 90]

async function syncPeriod(request, days) {
  const base = request.nextUrl?.origin || `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`
  const authorization = request.headers.get('authorization')
  const res = await fetch(`${base}/api/report?days=${days}&refresh=1&skipAmplitude=1`, {
    headers: {
      cookie: request.headers.get('cookie') || '',
      ...(authorization ? { authorization } : {}),
    }
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(data?.error || `Report fetch failed for ${days}d: ${res.status}`)
  if (!data || typeof data !== 'object') throw new Error(`Report fetch failed for ${days}d: invalid JSON response`)
  if (data?.error) throw new Error(data.error)
  return { days, source: data._source }
}

function syncSummary(results) {
  const periods = results.map((r, i) => ({
    days: SYNC_PERIODS[i],
    status: r.status === 'fulfilled' ? 'ok' : 'error',
    ...(r.status === 'fulfilled'
      ? { source: r.value.source }
      : { error: r.reason?.message || String(r.reason) }),
  }))
  const failed = periods.filter(p => p.status === 'error')
  return { periods, failed }
}

async function syncPeriods(request) {
  const results = []
  for (const days of SYNC_PERIODS) {
    try {
      results.push({ status: 'fulfilled', value: await syncPeriod(request, days) })
    } catch (reason) {
      results.push({ status: 'rejected', reason })
    }
  }
  return results
}

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const sessionSecret = process.env.SESSION_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret)
  )
}

// Vercel cron — GET
export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const results = await syncPeriods(request)
    const { periods, failed } = syncSummary(results)
    return NextResponse.json(
      { ok: failed.length === 0, periods, syncedAt: new Date().toISOString() },
      { status: failed.length ? 500 : 200 }
    )
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Manual sync din dashboard — POST
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Sincronizeaza toate perioadele: 7, 14, 30, 60, 90 zile
    const results = await syncPeriods(request)
    const { periods, failed } = syncSummary(results)
    return NextResponse.json(
      { ok: failed.length === 0, periods, syncedAt: new Date().toISOString() },
      { status: failed.length ? 500 : 200 }
    )
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
