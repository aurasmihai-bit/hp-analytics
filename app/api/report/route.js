import { NextResponse } from 'next/server'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY
const GA4_ACCOUNT = '521779420'

async function w(fields, datePreset, filters) {
  const params = new URLSearchParams({
    api_key: WINDSOR_API_KEY || '',
    date_preset: datePreset,
    fields: fields.join(','),
    accounts: GA4_ACCOUNT,
  })
  if (filters) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`https://connectors.windsor.ai/googleanalytics4?${params}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Windsor ${res.status}`)
  const d = await res.json()
  return Array.isArray(d) ? d : (d.data || d.result || [])
}

export async function GET() {
  try {
    const [
      r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11
    ] = await Promise.allSettled([
      // 1. Traffic current 30d by channel
      w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], 'last_30dT'),
      // 2. Traffic prev 60d (subtract 30d to get prev period)
      w(['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'], 'last_60dT'),
      // 3. Pages current 30d
      w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'], 'last_30dT', [['page_path','ncontains','/admin']]),
      // 4. Pages prev 60d
      w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'], 'last_60dT', [['page_path','ncontains','/admin']]),
      // 5. Custom conversions by channel 30d
      w(['session_default_channel_group','sessions','conversions_signup','conversions_offer_accepted','conversions_bravo_cerere_noua','conversions_bun_venit_agent','conversions_bun_venit_cumparator','conversions_bun_venit_proprietar'], 'last_30dT'),
      // 6. Daily timeseries 30d (for charts)
      w(['date','sessions','newusers','conversions','engagement_rate','average_session_duration'], 'last_30dT'),
      // 7. Daily timeseries 60d (for prev period charts)
      w(['date','sessions','newusers','conversions','engagement_rate','average_session_duration'], 'last_60dT'),
      // 8. GSC daily current
      w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], 'last_30dT'),
      // 9. GSC daily prev
      w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], 'last_60dT'),
      // 10. GSC queries
      w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], 'last_30dT'),
      // 11. GSC pages
      w(['page_path','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], 'last_30dT', [['page_path','ncontains','/admin']]),
    ])

    const x = r => r.status === 'fulfilled' ? (r.value || []) : []

    const curr30 = x(r1)
    const all60  = x(r2)

    // Compute prev 30d = 60d totals - current 30d
    const prevMap = {}
    for (const row of all60) {
      const k = row.session_default_channel_group
      if (!prevMap[k]) prevMap[k] = { ...row }
      else Object.keys(row).forEach(f => {
        if (f !== 'session_default_channel_group' && typeof row[f] === 'number')
          prevMap[k][f] = (prevMap[k][f]||0) + row[f]
      })
    }
    for (const row of curr30) {
      const k = row.session_default_channel_group
      if (prevMap[k]) Object.keys(row).forEach(f => {
        if (f !== 'session_default_channel_group' && typeof row[f] === 'number')
          prevMap[k][f] = Math.max(0, (prevMap[k][f]||0) - row[f])
      })
    }

    // Pages prev
    const pages30  = x(r3)
    const pagesAll = x(r4)
    const pagesPrevMap = {}
    for (const row of pagesAll) {
      const k = row.page_path
      if (!pagesPrevMap[k]) pagesPrevMap[k] = { ...row }
      else Object.keys(row).forEach(f => {
        if (f !== 'page_path' && typeof row[f] === 'number')
          pagesPrevMap[k][f] = (pagesPrevMap[k][f]||0) + row[f]
      })
    }
    for (const row of pages30) {
      const k = row.page_path
      if (pagesPrevMap[k]) Object.keys(row).forEach(f => {
        if (f !== 'page_path' && typeof row[f] === 'number')
          pagesPrevMap[k][f] = Math.max(0, (pagesPrevMap[k][f]||0) - row[f])
      })
    }

    // Daily series: split 60d into curr (last 30) and prev (first 30)
    const daily60 = x(r7).sort((a,b) => a.date.localeCompare(b.date))
    const midpoint = daily60.length > 0 ? daily60[Math.floor(daily60.length/2)]?.date : null
    const dailyCurr = x(r6).sort((a,b) => a.date.localeCompare(b.date))
    const dailyPrev = midpoint ? daily60.filter(d => d.date < midpoint) : []

    // GSC series
    const gscDaily60 = x(r9).sort((a,b) => a.date.localeCompare(b.date))
    const gscCurr = x(r8).sort((a,b) => a.date.localeCompare(b.date))
    const gscPrev = midpoint ? gscDaily60.filter(d => d.date < midpoint) : []

    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const label = `${monthAgo.toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${now.toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}`

    return NextResponse.json({
      generatedAt: now.toISOString(),
      periodLabel: label,
      traffic: { current: curr30, previous: Object.values(prevMap) },
      pages:   { current: pages30, previous: Object.values(pagesPrevMap) },
      conversions: x(r5),
      daily: { current: dailyCurr, previous: dailyPrev },
      gsc: {
        current: gscCurr,
        previous: gscPrev,
        queries: x(r10),
        pages: x(r11),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
