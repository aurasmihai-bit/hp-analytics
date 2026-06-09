import { getOptionalEnv } from './env'
import { getGoogleAccessToken } from './google-auth'

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const DEFAULT_SITE_URL = 'sc-domain:homepitch.ro'

function getConfiguredSiteUrl() {
  return getOptionalEnv('GSC_SITE_URL') || DEFAULT_SITE_URL
}

function numberValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pathFromUrl(value) {
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search || ''}` || '/'
  } catch {
    return value || '/'
  }
}

async function querySearchAnalytics(accessToken, siteUrl, body) {
  const encodedSite = encodeURIComponent(siteUrl)
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`Search Console ${res.status}: ${payload?.error?.message || text}`)
  return payload.rows || []
}

function mapDateRows(rows) {
  return rows.map(row => ({
    date: row.keys?.[0] || '',
    organic_google_search_clicks: numberValue(row.clicks),
    organic_google_search_impressions: numberValue(row.impressions),
    organic_google_search_click_through_rate: numberValue(row.ctr),
    organic_google_search_average_position: numberValue(row.position),
  })).sort((a, b) => a.date.localeCompare(b.date))
}

function mapQueryRows(rows) {
  return rows.map(row => ({
    query: row.keys?.[0] || '(not provided)',
    organic_google_search_clicks: numberValue(row.clicks),
    organic_google_search_impressions: numberValue(row.impressions),
    organic_google_search_click_through_rate: numberValue(row.ctr),
    organic_google_search_average_position: numberValue(row.position),
  }))
}

function mapPageRows(rows) {
  return rows.map(row => ({
    page_path: pathFromUrl(row.keys?.[0]),
    page_url: row.keys?.[0] || '',
    organic_google_search_clicks: numberValue(row.clicks),
    organic_google_search_impressions: numberValue(row.impressions),
    organic_google_search_click_through_rate: numberValue(row.ctr),
    organic_google_search_average_position: numberValue(row.position),
  }))
}

function summaryFromRows(rows) {
  const clicks = rows.reduce((sum, row) => sum + numberValue(row.organic_google_search_clicks), 0)
  const impressions = rows.reduce((sum, row) => sum + numberValue(row.organic_google_search_impressions), 0)
  const weightedPosition = rows.reduce((sum, row) => sum + numberValue(row.organic_google_search_average_position) * numberValue(row.organic_google_search_impressions), 0)
  return {
    clicks,
    impressions,
    position: impressions > 0 ? weightedPosition / impressions : null,
  }
}

export async function fetchGscData({ currFrom, currTo, prevFrom, prevTo }) {
  const accessToken = await getGoogleAccessToken(GSC_SCOPE)
  const siteUrl = getConfiguredSiteUrl()
  const base = { searchType: 'web', rowLimit: 25000 }

  const [current, previous, queries, pages] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: currFrom, endDate: currTo, dimensions: ['date'] }),
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: prevFrom, endDate: prevTo, dimensions: ['date'] }),
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: currFrom, endDate: currTo, dimensions: ['query'], rowLimit: 1000 }),
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: currFrom, endDate: currTo, dimensions: ['page'], rowLimit: 1000 }),
  ])

  return {
    current: mapDateRows(current),
    previous: mapDateRows(previous),
    queries: mapQueryRows(queries),
    pages: mapPageRows(pages),
  }
}

export async function fetchGscSummary({ start, end }) {
  const accessToken = await getGoogleAccessToken(GSC_SCOPE)
  const siteUrl = getConfiguredSiteUrl()
  const rows = await querySearchAnalytics(accessToken, siteUrl, {
    startDate: start,
    endDate: end,
    dimensions: ['date'],
    searchType: 'web',
    rowLimit: 25000,
  })
  return summaryFromRows(mapDateRows(rows))
}

export async function fetchGscDailyData({ start, end }) {
  const accessToken = await getGoogleAccessToken(GSC_SCOPE)
  const siteUrl = getConfiguredSiteUrl()
  const base = { searchType: 'web', rowLimit: 25000 }

  const [dailyRows, queryRows, pageRows] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: start, endDate: end, dimensions: ['date'] }),
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: start, endDate: end, dimensions: ['date', 'query'] }),
    querySearchAnalytics(accessToken, siteUrl, { ...base, startDate: start, endDate: end, dimensions: ['date', 'page'] }),
  ])

  const days = {}
  const ensure = date => {
    if (!days[date]) days[date] = { current: [], queries: [], pages: [] }
    return days[date]
  }

  dailyRows.forEach(row => {
    const date = row.keys?.[0] || ''
    if (!date) return
    ensure(date).current.push({
      date,
      organic_google_search_clicks: numberValue(row.clicks),
      organic_google_search_impressions: numberValue(row.impressions),
      organic_google_search_click_through_rate: numberValue(row.ctr),
      organic_google_search_average_position: numberValue(row.position),
    })
  })

  queryRows.forEach(row => {
    const date = row.keys?.[0] || ''
    if (!date) return
    ensure(date).queries.push({
      date,
      query: row.keys?.[1] || '(not provided)',
      organic_google_search_clicks: numberValue(row.clicks),
      organic_google_search_impressions: numberValue(row.impressions),
      organic_google_search_click_through_rate: numberValue(row.ctr),
      organic_google_search_average_position: numberValue(row.position),
    })
  })

  pageRows.forEach(row => {
    const date = row.keys?.[0] || ''
    if (!date) return
    ensure(date).pages.push({
      date,
      page_path: pathFromUrl(row.keys?.[1]),
      page_url: row.keys?.[1] || '',
      organic_google_search_clicks: numberValue(row.clicks),
      organic_google_search_impressions: numberValue(row.impressions),
      organic_google_search_click_through_rate: numberValue(row.ctr),
      organic_google_search_average_position: numberValue(row.position),
    })
  })

  return days
}
