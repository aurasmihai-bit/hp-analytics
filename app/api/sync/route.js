import { NextResponse } from 'next/server'
import { pushGscToHomePitch } from '../../lib/gsc-push'

export const maxDuration = 60

// Un singur backfill pe intervalul cel mai lung: 90 de zile + 90 anterioare acopera si
// perioadele de 7/14/30/60 de zile, care se compun apoi din acelasi cache zilnic.
// Inainte rulau 5 perioade la rand in aceeasi limita de 60 s si se opreau la timeout.
const SYNC_BACKFILL_DAYS = 90

async function syncBackfill(request) {
  const base = request.nextUrl?.origin || `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`
  const authorization = request.headers.get('authorization')
  const res = await fetch(`${base}/api/report?days=${SYNC_BACKFILL_DAYS}&refresh=1&skipAmplitude=1&backfillOnly=1`, {
    headers: {
      cookie: request.headers.get('cookie') || '',
      ...(authorization ? { authorization } : {}),
    }
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(data?.error || `Backfill failed: ${res.status}`)
  if (!data || typeof data !== 'object') throw new Error('Backfill failed: invalid JSON response')
  if (data?.error) throw new Error(data.error)
  return {
    days: SYNC_BACKFILL_DAYS,
    source: data._source,
    fetchedRanges: data._fetchedRanges || [],
    refreshedDates: data._refreshedDates || [],
    pendingReferralBackfillDays: data._pendingReferralBackfillDays || 0,
  }
}

async function runBackfill(request) {
  try {
    return { status: 'ok', ...(await syncBackfill(request)) }
  } catch (e) {
    return { status: 'error', days: SYNC_BACKFILL_DAYS, error: e?.message || String(e) }
  }
}

// Push zilnic GSC -> HomePitch; erorile apar in raspuns, dar nu pica sincronizarea.
async function runGscPush() {
  try {
    return await pushGscToHomePitch()
  } catch (e) {
    return { ok: false, error: e?.message || 'Push-ul GSC a eșuat.' }
  }
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
    // Push-ul GSC nu depinde de cache, deci ruleaza in paralel si nu mai asteapta backfill-ul.
    const [backfill, gscPush] = await Promise.all([runBackfill(request), runGscPush()])
    const ok = backfill.status === 'ok'
    return NextResponse.json(
      { ok, backfill, gscPush, syncedAt: new Date().toISOString() },
      { status: ok ? 200 : 500 }
    )
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Manual sync din dashboard — POST
export async function POST(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const backfill = await runBackfill(request)
    const ok = backfill.status === 'ok'
    return NextResponse.json(
      { ok, backfill, syncedAt: new Date().toISOString() },
      { status: ok ? 200 : 500 }
    )
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
