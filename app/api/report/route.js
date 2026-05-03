import { NextResponse } from 'next/server'

const GA4 = '521779420'
const KEY  = process.env.WINDSOR_API_KEY || ''

async function w(fields, from, to, filters) {
  const params = new URLSearchParams({ api_key: KEY, accounts: GA4 })
  if (from && to) {
    params.set('date_from', from)
    params.set('date_to', to)
  } else {
    params.set('date_preset', 'last_30dT')
  }
  params.set('fields', fields.join(','))
  if (filters) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`https://connectors.windsor.ai/googleanalytics4?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor ${res.status}`)
  const d = await res.json()
  return Array.isArray(d) ? d : (d.data || d.result || [])
}

function subtractPeriods(all, curr, key) {
  const prevMap = {}
  for (const row of all) {
    const k = row[key]
    if (!prevMap[k]) prevMap[k] = { ...row }
    else Object.keys(row).forEach(f => {
      if (f !== key && typeof row[f] === 'number') prevMap[k][f] = (prevMap[k][f]||0) + row[f]
    })
  }
  for (const row of curr) {
    const k = row[key]
    if (prevMap[k]) Object.keys(row).forEach(f => {
      if (f !== key && typeof row[f] === 'number') prevMap[k][f] = Math.max(0, (prevMap[k][f]||0) - row[f])
    })
  }
  return Object.values(prevMap)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const days  = parseInt(searchParams.get('days') || '30')
  const now   = new Date()
  const currTo   = now.toISOString().slice(0,10)
  const currFrom = new Date(now - days * 864e5).toISOString().slice(0,10)
  const prevFrom = new Date(now - days * 2 * 864e5).toISOString().slice(0,10)
  const prevTo   = new Date(now - days * 864e5 - 864e5).toISOString().slice(0,10)

  try {
    const [r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17] = await Promise.allSettled([
      w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], currFrom, currTo),
      w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], prevFrom, prevTo),
      w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'], currFrom, currTo, [['page_path','ncontains','/admin']]),
      w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'], prevFrom, prevTo, [['page_path','ncontains','/admin']]),
      w(['session_default_channel_group','sessions','conversions_signup','conversions_offer_accepted','conversions_bravo_cerere_noua','conversions_bun_venit_agent','conversions_bun_venit_cumparator','conversions_bun_venit_proprietar'], currFrom, currTo),
      w(['date','sessions','newusers','conversions','engagement_rate','average_session_duration'], currFrom, currTo),
      w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
      w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], prevFrom, prevTo),
      w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
      w(['page_path','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo, [['page_path','ncontains','/admin']]),
      w(['date','session_default_channel_group','sessions','conversions'], currFrom, currTo),
      // Cerere pages daily
      w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','cerere-noua']]),
      w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','/cereri/nou']]),
      w(['date','page_path','screen_page_views','conversions'], currFrom, currTo, [['page_path','contains','/vreau']]),
      // Cerere pages by channel
      w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','cerere-noua']]),
      w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','/cereri/nou']]),
      w(['session_default_channel_group','page_path','screen_page_views','active_users','conversions'], currFrom, currTo, [['page_path','contains','/vreau']]),
    ])

    const x = r => r.status === 'fulfilled' ? (r.value||[]) : []

    const curr30 = x(r1), prev30 = x(r2)
    const pages30 = x(r3), pagesPrev = x(r4)
    const dailyCurr = x(r6).sort((a,b)=>a.date.localeCompare(b.date))
    const gscCurr = x(r7).sort((a,b)=>a.date.localeCompare(b.date))
    const gscPrev = x(r8)
    const dailyCh = x(r11)

    // Cerere pages daily — merge into unified daily arrays
    const ceNouDaily = x(r12).filter(d=>d.page_path==='/cerere-noua').sort((a,b)=>a.date.localeCompare(b.date))
    const cereriNouDaily = x(r13).filter(d=>d.page_path==='/cereri/nou').sort((a,b)=>a.date.localeCompare(b.date))
    const vreauDaily = x(r14).filter(d=>d.page_path==='/vreau').sort((a,b)=>a.date.localeCompare(b.date))

    const label = `${new Date(currFrom).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${new Date(currTo).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}`

    return NextResponse.json({
      generatedAt: now.toISOString(),
      periodLabel: label,
      days,
      traffic:  { current: curr30, previous: prev30 },
      pages:    { current: pages30, previous: pagesPrev },
      conversions: x(r5),
      daily:    { current: dailyCurr, byChannel: dailyCh },
      gsc:      { current: gscCurr, previous: gscPrev, queries: x(r9), pages: x(r10) },
      cererePages: {
        daily: {
          cerereNoua: ceNouDaily,
          cereriNou:  cereriNouDaily,
          vreau:      vreauDaily,
        },
        byChannel: {
          cerereNoua: x(r15),
          cereriNou:  x(r16),
          vreau:      x(r17),
        },
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
