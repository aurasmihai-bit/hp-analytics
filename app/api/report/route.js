import { NextResponse } from 'next/server'
import { getLatestSnapshot, upsertSnapshot, isFresh, logSync } from '../../lib/supabase'

const GA4 = '521779420'
const KEY  = process.env.WINDSOR_API_KEY || ''

async function w(fields, from, to, filters) {
  const params = new URLSearchParams({ api_key: KEY, accounts: GA4 })
  if (from && to) { params.set('date_from', from); params.set('date_to', to) }
  else params.set('date_preset', 'last_30dT')
  params.set('fields', fields.join(','))
  if (filters) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`https://connectors.windsor.ai/googleanalytics4?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor ${res.status}`)
  const d = await res.json()
  return Array.isArray(d) ? d : (d.data || d.result || [])
}

function subtractPrev(all60, curr30, key) {
  const m = {}
  for (const r of all60) {
    const k = r[key]
    if (!m[k]) m[k] = { ...r }
    else Object.keys(r).forEach(f => { if (f !== key && typeof r[f] === 'number') m[k][f] = (m[k][f]||0)+r[f] })
  }
  for (const r of curr30) {
    const k = r[key]
    if (m[k]) Object.keys(r).forEach(f => { if (f !== key && typeof r[f] === 'number') m[k][f] = Math.max(0,(m[k][f]||0)-r[f]) })
  }
  return Object.values(m)
}

async function fetchFromWindsor(currFrom, currTo, prevFrom, prevTo) {
  const t = Date.now()
  const [r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17] = await Promise.allSettled([
    w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], currFrom, currTo),
    w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], prevFrom, prevTo),
    w(['page_path','screen_page_views','active_users','bounce_rate','engagement_rate','average_session_duration','user_engagement_duration','conversions'], currFrom, currTo, [['page_path','ncontains','/admin']]),
    w(['page_path','screen_page_views','active_users','bounce_rate','engagement_rate','average_session_duration','user_engagement_duration','conversions'], prevFrom, prevTo, [['page_path','ncontains','/admin']]),
    w(['session_default_channel_group','sessions','conversions_signup','conversions_offer_accepted','conversions_bravo_cerere_noua','conversions_bun_venit_agent','conversions_bun_venit_cumparator','conversions_bun_venit_proprietar'], currFrom, currTo),
    w(['date','sessions','newusers','conversions','engagement_rate','average_session_duration'], currFrom, currTo),
    w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
    w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], prevFrom, prevTo),
    w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
    w(['page_path','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo, [['page_path','ncontains','/admin']]),
    w(['date','session_default_channel_group','sessions','conversions'], currFrom, currTo),
    w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','cerere-noua']]),
    w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','/cereri/nou']]),
    w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','/vreau']]),
    w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','cerere-noua']]),
    w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','/cereri/nou']]),
    w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','/vreau']]),
  ])

  const x = r => r.status === 'fulfilled' ? (r.value||[]) : []
  const curr30 = x(r1), prev30 = x(r2)
  const pages30 = x(r3), pagesPrev = x(r4)
  const dailyCurr = x(r6).sort((a,b) => a.date.localeCompare(b.date))
  const gscCurr = x(r7).sort((a,b) => a.date.localeCompare(b.date))
  const gscPrev = x(r8)
  const ceNouDaily = x(r12).filter(d=>d.page_path==='/cerere-noua').sort((a,b)=>a.date.localeCompare(b.date))
  const cereriNouDaily = x(r13).filter(d=>d.page_path==='/cereri/nou').sort((a,b)=>a.date.localeCompare(b.date))
  const vreauDaily = x(r14).filter(d=>d.page_path==='/vreau').sort((a,b)=>a.date.localeCompare(b.date))

  return {
    traffic:  { current: curr30, previous: subtractPrev(prev30.concat(curr30), curr30, 'session_default_channel_group') },
    pages:    { current: pages30, previous: pagesPrev },
    conversions: x(r5),
    daily:    { current: dailyCurr, byChannel: x(r11) },
    gsc:      { current: gscCurr, previous: gscPrev, queries: x(r9), pages: x(r10) },
    cererePages: {
      daily: { cerereNoua: ceNouDaily, cereriNou: cereriNouDaily, vreau: vreauDaily },
      byChannel: { cerereNoua: x(r15), cereriNou: x(r16), vreau: x(r17) },
    },
    _fetchMs: Date.now() - t,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'
  const now = new Date()

  let days, currFrom, currTo, prevFrom, prevTo

  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')

  if (fromParam && toParam) {
    currFrom = fromParam; currTo = toParam
    const diffMs = new Date(toParam) - new Date(fromParam)
    days = Math.round(diffMs / 864e5) + 1
    const prevToDate = new Date(new Date(fromParam) - 864e5)
    prevFrom = new Date(prevToDate - diffMs).toISOString().slice(0,10)
    prevTo   = prevToDate.toISOString().slice(0,10)
  } else {
    days     = parseInt(searchParams.get('days') || '30')
    currTo   = now.toISOString().slice(0,10)
    currFrom = new Date(now - days * 864e5).toISOString().slice(0,10)
    prevFrom = new Date(now - days * 2 * 864e5).toISOString().slice(0,10)
    prevTo   = new Date(now - days * 864e5 - 864e5).toISOString().slice(0,10)
  }

  const label = `${new Date(currFrom).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${new Date(currTo).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}`

  // ── 1. Try cache (Supabase) ──────────────────────────────────────
  if (!forceRefresh) {
    try {
      const snap = await getLatestSnapshot(days)
      if (snap && isFresh(snap)) {
        return NextResponse.json({
          ...buildResponse(snap, label, days, now),
          _source: 'cache',
          _cachedAt: snap.synced_at,
        })
      }
    } catch (e) {
      // Supabase unavailable — fall through to Windsor
      console.warn('Supabase cache miss:', e.message)
    }
  }

  // ── 2. Fetch from Windsor ────────────────────────────────────────
  const syncStart = Date.now()
  try {
    const data = await fetchFromWindsor(currFrom, currTo, prevFrom, prevTo)

    // ── 3. Save to Supabase ────────────────────────────────────────
    const snapshotDate = currTo
    try {
      await upsertSnapshot(snapshotDate, days, {
        traffic:     data.traffic,
        pages:       data.pages,
        conversions: data.conversions,
        daily:       data.daily,
        gsc:         data.gsc,
        cererePages: data.cererePages,
      })
      await logSync({
        period_days: days,
        date_from:   currFrom,
        date_to:     currTo,
        source:      'windsor',
        status:      'ok',
        rows_saved:  1,
        duration_ms: Date.now() - syncStart,
      })
    } catch (dbErr) {
      console.warn('Supabase write failed:', dbErr.message)
      // Continua — returneaza datele din Windsor chiar daca nu s-a salvat
    }

    return NextResponse.json({
      generatedAt:  now.toISOString(),
      periodLabel:  label,
      days,
      ...data,
      _source: 'windsor',
    })
  } catch (err) {
    // ── 4. Windsor failed — try stale cache ───────────────────────
    try {
      const snap = await getLatestSnapshot(days)
      if (snap) {
        return NextResponse.json({
          ...buildResponse(snap, label, days, now),
          _source: 'stale_cache',
          _cachedAt: snap.synced_at,
          _warning: 'Windsor indisponibil — date din cache (posibil mai vechi)',
        })
      }
    } catch {}

    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildResponse(snap, label, days, now) {
  return {
    generatedAt:  now.toISOString(),
    periodLabel:  label,
    days,
    traffic:      snap.traffic,
    pages:        snap.pages,
    conversions:  snap.conversions,
    daily:        snap.daily,
    gsc:          snap.gsc,
    cererePages:  snap.cerere_pages,
  }
}
