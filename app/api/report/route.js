import { NextResponse } from 'next/server'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY
const GA4_ACCOUNT = '521779420'

async function windsorFetch(fields, datePreset, filters) {
  const params = new URLSearchParams({
    api_key: WINDSOR_API_KEY || '',
    date_preset: datePreset,
    fields: fields.join(','),
    accounts: GA4_ACCOUNT,
  })
  if (filters) params.set('filters', JSON.stringify(filters))

  const url = `https://connectors.windsor.ai/googleanalytics4?${params}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Windsor error: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.data || data.result || [])
}

export async function GET() {
  try {
    const [
      currTrafficRes,
      prevTrafficRes,
      currPagesRes,
      prevPagesRes,
      currConvRes,
      currGSCRes,
      prevGSCRes,
      gscQueriesRes,
      gscPagesRes,
    ] = await Promise.allSettled([
      windsorFetch(
        ['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'],
        'last_7dT'
      ),
      windsorFetch(
        ['session_default_channel_group','sessions','newusers','engaged_sessions','engagement_rate','average_session_duration','conversions'],
        'last_14dT'
      ),
      windsorFetch(
        ['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'],
        'last_7dT',
        [['page_path','ncontains','/admin']]
      ),
      windsorFetch(
        ['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','conversions'],
        'last_14dT',
        [['page_path','ncontains','/admin']]
      ),
      windsorFetch(
        ['session_default_channel_group','sessions','conversions_signup','conversions_offer_accepted','conversions_bravo_cerere_noua','conversions_bun_venit_agent','conversions_bun_venit_cumparator','conversions_bun_venit_proprietar'],
        'last_7dT'
      ),
      windsorFetch(
        ['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'],
        'last_7dT'
      ),
      windsorFetch(
        ['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'],
        'last_14dT'
      ),
      windsorFetch(
        ['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'],
        'last_7dT'
      ),
      windsorFetch(
        ['page_path','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'],
        'last_7dT',
        [['page_path','ncontains','/admin']]
      ),
    ])

    const extract = r => r.status === 'fulfilled' ? (r.value || []) : []

    const cTraffic = extract(currTrafficRes)
    const p14Traffic = extract(prevTrafficRes)

    // Compute prev week = 14d totals minus current 7d
    const prevMap = {}
    for (const row of p14Traffic) {
      const key = row.session_default_channel_group
      if (!prevMap[key]) prevMap[key] = { ...row }
      else Object.keys(row).forEach(k => {
        if (k !== 'session_default_channel_group' && typeof row[k] === 'number')
          prevMap[key][k] = (prevMap[key][k] || 0) + row[k]
      })
    }
    for (const row of cTraffic) {
      const key = row.session_default_channel_group
      if (prevMap[key]) Object.keys(row).forEach(k => {
        if (k !== 'session_default_channel_group' && typeof row[k] === 'number')
          prevMap[key][k] = Math.max(0, (prevMap[key][k] || 0) - row[k])
      })
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekLabel = `${weekAgo.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – ${now.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}`

    return NextResponse.json({
      generatedAt: now.toISOString(),
      weekLabel,
      traffic: { current: cTraffic, previous: Object.values(prevMap) },
      pages: { current: extract(currPagesRes), previous: extract(prevPagesRes) },
      conversions: extract(currConvRes),
      gsc: {
        current: extract(currGSCRes),
        previous: extract(prevGSCRes),
        queries: extract(gscQueriesRes),
        pages: extract(gscPagesRes),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
