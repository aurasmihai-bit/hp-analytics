import { NextResponse } from 'next/server'

async function doSync(request, days = 30) {
  const base = `https://${request.headers.get('host')}`
  const res = await fetch(`${base}/api/report?days=${days}&refresh=1`, {
    headers: { cookie: request.headers.get('cookie') || '' }
  })
  if (!res.ok) throw new Error(`Report fetch failed: ${res.status}`)
  const data = await res.json()
  return { ok: true, source: data._source, days, syncedAt: new Date().toISOString() }
}

// Vercel cron trimite GET
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  // Verifica secret pt cron (sau session pt dashboard)
  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await doSync(request, 30)
    // Sync si 7 zile pentru grafice rapide
    doSync(request, 7).catch(() => {})
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const isAuthorized =
    request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const days = body.days || 30

  try {
    const result = await doSync(request, days)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
