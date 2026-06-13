import { NextResponse } from 'next/server'
import { getLatestSnapshot, upsertSnapshot, isFresh, logSync, getTabDailyRows, upsertTabDailyRows } from '../../lib/supabase'
import { getOptionalEnv, requireEnv } from '../../lib/env'
import { fetchReportGa4Data, fetchReportGa4DailyData } from '../../lib/ga4'
import { fetchGscData, fetchGscDailyData } from '../../lib/gsc'
import { fetchPlatformRequestStats, fetchPlatformRequestDailyStats } from '../../lib/platform'

export const maxDuration = 60

const DEFAULT_GA4_ACCOUNT = '521779420'
const EXIT_ANALYSIS_SCHEMA_VERSION = 1

function getGa4Account() {
  return getOptionalEnv('GA4_ACCOUNT_ID') || DEFAULT_GA4_ACCOUNT
}

async function w(fields, from, to, filters) {
  const params = new URLSearchParams({ api_key: requireEnv('WINDSOR_API_KEY'), accounts: getGa4Account() })
  if (from && to) { params.set('date_from', from); params.set('date_to', to) }
  else params.set('date_preset', 'last_30dT')
  params.set('fields', fields.join(','))
  if (filters) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`https://connectors.windsor.ai/googleanalytics4?${params}`, { cache: 'no-store' })
  const text = await res.text()
  let d = null
  try { d = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(`Windsor ${res.status}: ${d?.error || text || res.statusText}`)
  if (d?.error) throw new Error(`Windsor: ${d.error}`)
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

function dateRange(days, now) {
  const currTo   = now.toISOString().slice(0,10)
  const currFrom = new Date(now - days * 864e5).toISOString().slice(0,10)
  const prevFrom = new Date(now - days * 2 * 864e5).toISOString().slice(0,10)
  const prevTo   = new Date(now - days * 864e5 - 864e5).toISOString().slice(0,10)
  return { currFrom, currTo, prevFrom, prevTo }
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value
}

function parseDays(value) {
  const raw = value || '30'
  if (!/^\d+$/.test(raw)) throw new Error('Invalid days parameter')
  const days = Number(raw)
  if (!Number.isInteger(days) || days < 1 || days > 1095) {
    throw new Error('days must be between 1 and 1095')
  }
  return days
}

function parseReportRange(searchParams, now) {
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam || toParam) {
    if (!fromParam || !toParam) throw new Error('Both from and to are required')
    if (!isIsoDate(fromParam) || !isIsoDate(toParam)) {
      throw new Error('from and to must be valid YYYY-MM-DD dates')
    }

    const fromDate = new Date(`${fromParam}T00:00:00.000Z`)
    const toDate = new Date(`${toParam}T00:00:00.000Z`)
    if (fromDate > toDate) throw new Error('from must be before or equal to to')

    const diffMs = toDate - fromDate
    const days = Math.round(diffMs / 864e5) + 1
    if (days > 1095) throw new Error('Custom date range is too large')

    const prevToDate = new Date(fromDate - 864e5)
    const prevFromDate = new Date(prevToDate - diffMs)
    return {
      days,
      currFrom: fromParam,
      currTo: toParam,
      prevFrom: prevFromDate.toISOString().slice(0,10),
      prevTo: prevToDate.toISOString().slice(0,10),
    }
  }

  const days = parseDays(searchParams.get('days'))
  return { days, ...dateRange(days, now) }
}

function settledRows(result, label, required = false) {
  if (result.status === 'fulfilled') return result.value || []
  if (required) {
    throw new Error(`${label} failed: ${result.reason?.message || result.reason}`)
  }
  console.warn(`${label} failed:`, result.reason?.message || result.reason)
  return []
}

function assertHasWindsorRows(groups) {
  const totalRows = groups.reduce((sum, rows) => sum + rows.length, 0)
  if (totalRows === 0) {
    throw new Error('Windsor returned no analytics rows. Check WINDSOR_API_KEY, GA4_ACCOUNT_ID, GA4 access, and the requested date range.')
  }
}

function sumField(rows, field) {
  return (rows || []).reduce((sum, row) => sum + Number(row[field] || 0), 0)
}

function hasUsefulReportMetrics(data) {
  const traffic = data?.traffic?.current || []
  const pages = data?.pages?.current || []
  const daily = data?.daily?.current || []
  return (
    sumField(traffic, 'sessions') > 0 ||
    sumField(traffic, 'conversions') > 0 ||
    sumField(pages, 'screen_page_views') > 0 ||
    sumField(daily, 'sessions') > 0
  )
}

function emptyGscData() {
  return { current: [], previous: [], queries: [], pages: [] }
}

function normalizeGscData(gsc) {
  return {
    current: Array.isArray(gsc?.current) ? gsc.current : [],
    previous: Array.isArray(gsc?.previous) ? gsc.previous : [],
    queries: Array.isArray(gsc?.queries) ? gsc.queries : [],
    pages: Array.isArray(gsc?.pages) ? gsc.pages : [],
  }
}

function hasUsefulGscData(gsc) {
  const normalized = normalizeGscData(gsc)
  return (
    sumField(normalized.current, 'organic_google_search_clicks') > 0 ||
    sumField(normalized.current, 'organic_google_search_impressions') > 0 ||
    sumField(normalized.previous, 'organic_google_search_clicks') > 0 ||
    sumField(normalized.previous, 'organic_google_search_impressions') > 0 ||
    normalized.queries.some(row =>
      Number(row.organic_google_search_clicks || 0) > 0 ||
      Number(row.organic_google_search_impressions || 0) > 0
    ) ||
    normalized.pages.some(row =>
      Number(row.organic_google_search_clicks || 0) > 0 ||
      Number(row.organic_google_search_impressions || 0) > 0
    )
  )
}

function weightedGscPosition(rows) {
  const weighted = (rows || []).reduce((sum, row) => {
    return sum + Number(row.organic_google_search_average_position || 0) * Number(row.organic_google_search_impressions || 0)
  }, 0)
  const impressions = sumField(rows, 'organic_google_search_impressions')
  return impressions > 0 ? weighted / impressions : null
}

function getSeoOpportunity(gsc) {
  const normalized = normalizeGscData(gsc)
  const queries = normalized.queries
    .filter(row => row.query && row.query !== '(not provided)')
    .map(row => ({
      ...row,
      clicks: Number(row.organic_google_search_clicks || 0),
      impressions: Number(row.organic_google_search_impressions || 0),
      ctr: Number(row.organic_google_search_click_through_rate || 0),
      position: Number(row.organic_google_search_average_position || 0),
    }))

  const nearTop = queries
    .filter(row => row.impressions >= 5 && row.position >= 4 && row.position <= 20)
    .sort((a, b) => (b.impressions - a.impressions) || (a.position - b.position))[0]

  const lowCtr = queries
    .filter(row => row.impressions >= 20 && row.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)[0]

  const topQuery = queries
    .sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions))[0]

  return { nearTop, lowCtr, topQuery }
}

function pageMatches(paths, row) {
  const path = String(row?.page_path || '')
  return paths.some(pattern => {
    if (pattern instanceof RegExp) return pattern.test(path)
    return path === pattern || path.startsWith(`${pattern}/`)
  })
}

function topGscPage(gsc) {
  const normalized = normalizeGscData(gsc)
  return [...normalized.pages]
    .map(row => ({
      ...row,
      path: row.page_path || row.page_url || '/',
      clicks: Number(row.organic_google_search_clicks || 0),
      impressions: Number(row.organic_google_search_impressions || 0),
      ctr: Number(row.organic_google_search_click_through_rate || 0),
      position: Number(row.organic_google_search_average_position || 0),
    }))
    .filter(row => row.impressions > 0)
    .sort((a, b) => (b.impressions - a.impressions) || (a.position - b.position))[0]
}

async function fetchGscFromWindsor(currFrom, currTo, prevFrom, prevTo) {
  const [current, previous, queries, pages] = await Promise.allSettled([
    w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
    w(['date','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], prevFrom, prevTo),
    w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo),
    w(['page_path','organic_google_search_clicks','organic_google_search_impressions','organic_google_search_click_through_rate','organic_google_search_average_position'], currFrom, currTo, [['page_path','ncontains','/admin']]),
  ])

  return {
    current: settledRows(current, 'Current GSC from Windsor').sort((a,b)=>String(a.date || '').localeCompare(String(b.date || ''))),
    previous: settledRows(previous, 'Previous GSC from Windsor'),
    queries: settledRows(queries, 'GSC queries from Windsor'),
    pages: settledRows(pages, 'GSC pages from Windsor'),
  }
}

async function attachSearchConsoleData(data, currFrom, currTo, prevFrom, prevTo) {
  const existing = normalizeGscData(data.gsc)
  data.gsc = existing

  try {
    const direct = await fetchGscData({ currFrom, currTo, prevFrom, prevTo })
    if (hasUsefulGscData(direct)) {
      data.gsc = normalizeGscData(direct)
      data.gscSource = 'search_console'
      return data
    }
    console.warn('Search Console direct fetch returned no SEO rows')
  } catch (e) {
    console.warn('Search Console direct fetch failed:', e.message)
  }

  if (hasUsefulGscData(existing)) {
    data.gscSource = data.gscSource || 'windsor'
    return data
  }

  try {
    const fallback = await fetchGscFromWindsor(currFrom, currTo, prevFrom, prevTo)
    if (hasUsefulGscData(fallback)) {
      data.gsc = normalizeGscData(fallback)
      data.gscSource = 'windsor'
      return data
    }
    console.warn('Search Console Windsor fallback returned no SEO rows')
  } catch (e) {
    console.warn('Search Console Windsor fallback failed:', e.message)
  }

  data.gsc = existing || emptyGscData()
  data.gscSource = 'none'
  return data
}

async function attachPlatformRequestData(data, currFrom, currTo) {
  try {
    data.platformRequests = await fetchPlatformRequestStats({ start: currFrom, end: currTo })
  } catch (e) {
    console.warn('Platform request stats failed:', e.message)
  }
  return data
}

function addDaysIso(date, days) {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0,10)
}

function eachDate(start, end) {
  const dates = []
  for (let d = start; d <= end; d = addDaysIso(d, 1)) dates.push(d)
  return dates
}

function missingRanges(rows, start, end, refreshDate = null) {
  const existing = new Set((rows || []).map(row => row.data_date).filter(Boolean))
  if (refreshDate) existing.delete(refreshDate)
  const missing = eachDate(start, end).filter(date => !existing.has(date))
  const ranges = []
  for (const date of missing) {
    const last = ranges[ranges.length - 1]
    if (last && addDaysIso(last.end, 1) === date) last.end = date
    else ranges.push({ start: date, end: date })
  }
  return ranges
}

function mergeRanges(ranges) {
  const dates = new Set()
  ranges.forEach(range => {
    eachDate(range.start, range.end).forEach(date => dates.add(date))
  })
  const sorted = Array.from(dates).sort()
  const merged = []
  sorted.forEach(date => {
    const last = merged[merged.length - 1]
    if (last && addDaysIso(last.end, 1) === date) last.end = date
    else merged.push({ start: date, end: date })
  })
  return merged
}

function missingExitAnalysisRanges(rows, start, end) {
  const byDate = new Map((rows || []).map(row => [row.data_date, row]))
  const dates = eachDate(start, end).filter(date => {
    const payload = byDate.get(date)?.payload
    return !payload || payload.exitAnalysis?.schemaVersion !== EXIT_ANALYSIS_SCHEMA_VERSION
  })
  return mergeRanges(dates.map(date => ({ start: date, end: date })))
}

function emptyTabDay(date) {
  return {
    date,
    traffic: [],
    pages: [],
    conversions: [],
    daily: { current: [], byChannel: [] },
    gsc: { current: [], queries: [], pages: [] },
    cererePages: {
      daily: { cerereNoua: [], cereriNou: [], vreau: [] },
      byChannel: { cerereNoua: [], cereriNou: [], vreau: [] },
    },
    cerereTracking: [],
    exitAnalysis: {
      schemaVersion: EXIT_ANALYSIS_SCHEMA_VERSION,
      exitIntent: { rows: [] },
    },
    platformRequests: { count: 0, source: null, start: date, end: date },
  }
}

function mergeTabDay(date, ga4Day = {}, gscDay = {}, platformDay = null) {
  const day = emptyTabDay(date)
  return {
    ...day,
    ...ga4Day,
    gsc: {
      current: gscDay.current || [],
      queries: gscDay.queries || [],
      pages: gscDay.pages || [],
    },
    platformRequests: platformDay || day.platformRequests,
  }
}

async function fetchAndSaveTabDailyRange(start, end) {
  const [ga4ByDate, gscResult, platformResult] = await Promise.allSettled([
    fetchReportGa4DailyData({ propertyId: getGa4Account(), start, end }),
    fetchGscDailyData({ start, end }),
    fetchPlatformRequestDailyStats({ start, end }),
  ])

  if (ga4ByDate.status !== 'fulfilled') {
    throw new Error(`GA4 daily fetch failed: ${ga4ByDate.reason?.message || ga4ByDate.reason}`)
  }
  if (gscResult.status === 'rejected') {
    console.warn('GSC daily fetch failed:', gscResult.reason?.message || gscResult.reason)
  }
  if (platformResult.status === 'rejected') {
    console.warn('Platform daily fetch failed:', platformResult.reason?.message || platformResult.reason)
  }

  const ga4 = ga4ByDate.value || {}
  const gsc = gscResult.status === 'fulfilled' ? gscResult.value || {} : {}
  const platform = platformResult.status === 'fulfilled' ? platformResult.value || {} : {}
  const syncedAt = new Date().toISOString()
  const rows = eachDate(start, end).map(date => ({
    data_date: date,
    payload: mergeTabDay(date, ga4[date], gsc[date], platform[date]),
    sources: {
      ga4: 'google_analytics_data_api',
      gsc: gsc[date] ? 'search_console' : 'none',
      platform: platform[date]?.source || 'none',
    },
    synced_at: syncedAt,
  }))
  await upsertTabDailyRows(rows)
  return rows
}

function isMissingTabDataTable(error) {
  const message = String(error?.message || error)
  return (
    message.includes('hp_tab_data_daily') &&
    (
      message.includes('PGRST') ||
      message.includes('42P01') ||
      message.toLowerCase().includes('could not find') ||
      message.toLowerCase().includes('does not exist')
    )
  )
}

function weightedAverage(total, weighted, fallback = 0) {
  return total > 0 ? weighted / total : fallback
}

function aggregateBy(rows, keyFn, sumFields, weightedFields = []) {
  const groups = new Map()
  for (const row of rows || []) {
    const key = keyFn(row)
    if (!key) continue
    if (!groups.has(key)) {
      const initial = { ...row, __weights: {} }
      sumFields.forEach(field => { initial[field] = 0 })
      weightedFields.forEach(({ field }) => { initial[field] = 0 })
      groups.set(key, initial)
    }
    const acc = groups.get(key)
    sumFields.forEach(field => {
      acc[field] = Number(acc[field] || 0) + Number(row[field] || 0)
    })
    weightedFields.forEach(({ field, weight }) => {
      const w = Number(row[weight] || 0)
      acc.__weights[field] = (acc.__weights[field] || 0) + Number(row[field] || 0) * w
      acc.__weights[`${field}__weight`] = (acc.__weights[`${field}__weight`] || 0) + w
    })
  }
  return Array.from(groups.values()).map(row => {
    weightedFields.forEach(({ field }) => {
      row[field] = weightedAverage(row.__weights[`${field}__weight`] || 0, row.__weights[field] || 0, Number(row[field] || 0))
    })
    delete row.__weights
    return row
  })
}

function aggregateTraffic(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.traffic || []),
    row => row.session_default_channel_group,
    ['sessions', 'newusers', 'engaged_sessions', 'conversions'],
    [
      { field:'engagement_rate', weight:'sessions' },
      { field:'average_session_duration', weight:'sessions' },
    ]
  ).sort((a,b) => Number(b.sessions || 0) - Number(a.sessions || 0))
}

function aggregatePages(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.pages || []),
    row => row.page_path,
    ['screen_page_views', 'active_users', 'user_engagement_duration', 'conversions'],
    [
      { field:'bounce_rate', weight:'screen_page_views' },
      { field:'engagement_rate', weight:'screen_page_views' },
      { field:'average_session_duration', weight:'screen_page_views' },
    ]
  ).sort((a,b) => Number(b.screen_page_views || 0) - Number(a.screen_page_views || 0))
}

function aggregateConversions(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.conversions || []),
    row => row.session_default_channel_group,
    [
      'sessions',
      'conversions_signup',
      'conversions_offer_accepted',
      'conversions_bravo_cerere_noua',
      'conversions_bun_venit_agent',
      'conversions_bun_venit_cumparator',
      'conversions_bun_venit_proprietar',
    ]
  )
}

function aggregateDaily(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.daily?.current || []),
    row => row.date,
    ['sessions', 'newusers', 'conversions'],
    [
      { field:'engagement_rate', weight:'sessions' },
      { field:'average_session_duration', weight:'sessions' },
    ]
  ).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function aggregateDailyByChannel(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.daily?.byChannel || []),
    row => `${row.date}::${row.session_default_channel_group}`,
    ['sessions', 'conversions']
  ).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function aggregateGscDateRows(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.gsc?.current || []),
    row => row.date,
    ['organic_google_search_clicks', 'organic_google_search_impressions'],
    [
      { field:'organic_google_search_click_through_rate', weight:'organic_google_search_impressions' },
      { field:'organic_google_search_average_position', weight:'organic_google_search_impressions' },
    ]
  ).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function aggregateGscQueries(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.gsc?.queries || []),
    row => row.query,
    ['organic_google_search_clicks', 'organic_google_search_impressions'],
    [
      { field:'organic_google_search_click_through_rate', weight:'organic_google_search_impressions' },
      { field:'organic_google_search_average_position', weight:'organic_google_search_impressions' },
    ]
  ).sort((a,b) => Number(b.organic_google_search_impressions || 0) - Number(a.organic_google_search_impressions || 0))
}

function aggregateGscPages(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.gsc?.pages || []),
    row => row.page_path || row.page_url,
    ['organic_google_search_clicks', 'organic_google_search_impressions'],
    [
      { field:'organic_google_search_click_through_rate', weight:'organic_google_search_impressions' },
      { field:'organic_google_search_average_position', weight:'organic_google_search_impressions' },
    ]
  ).sort((a,b) => Number(b.organic_google_search_impressions || 0) - Number(a.organic_google_search_impressions || 0))
}

function aggregatePageDaily(payloads, key) {
  return aggregateBy(
    payloads.flatMap(payload => payload.cererePages?.daily?.[key] || []),
    row => `${row.date}::${row.page_path}`,
    ['screen_page_views', 'conversions']
  ).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function aggregatePageChannel(payloads, key) {
  return aggregateBy(
    payloads.flatMap(payload => payload.cererePages?.byChannel?.[key] || []),
    row => `${row.session_default_channel_group}::${row.page_path}`,
    ['screen_page_views', 'active_users', 'conversions']
  )
}

function aggregateTracking(payloads) {
  return aggregateBy(
    payloads.flatMap(payload => payload.cerereTracking || []),
    row => row.date,
    [
      'conversions_bravo_cerere_noua',
      'conversions_bun_venit_cumparator',
      'conversions_bun_venit_agent',
      'conversions_bun_venit_proprietar',
    ]
  ).sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function aggregatePlatformRequests(payloads, start, end) {
  const rows = payloads.map(payload => payload.platformRequests).filter(Boolean)
  return {
    count: rows.reduce((sum, row) => sum + Number(row.count || 0), 0),
    source: rows.find(row => row.source)?.source || null,
    start,
    end,
  }
}

function exitRecommendation(path, row) {
  const bounce = Number(row.bounce_rate || 0)
  const duration = Number(row.average_session_duration || 0)
  if (path === '/cereri') return 'Adauga CTA catre /vreau imediat dupa filtre si in sticky mobile; masoara click_request_start.'
  if (path === '/vreau') return 'Verifica pasul unde se abandoneaza wizard-ul si salveaza progresul dupa fiecare pas.'
  if (path === '/cerere-noua' || path === '/cereri/nou') return 'Trimite traficul nou spre wizard-ul /vreau si pastreaza formularul lung pentru editare/advanced.'
  if (path === '/proprietati') return 'Segmenteaza CTA-ul: cumparatorii catre /vreau, agentii/proprietarii catre publicare proprietate.'
  if (path === '/' || path === '/home3') return 'Testeaza un CTA de intent: "Spune ce cauti si primesti oferte" above the fold.'
  if (path.includes('/cereri/')) return 'Pe detaliu cerere, fa mai vizibil CTA-ul pentru agenti: "Trimite oferta potrivita".'
  if (path.includes('/proprietati/')) return 'Pe detaliu proprietate, adauga fallback pentru cumparatori: "Nu e potrivita? Creeaza cererea ta".'
  if (bounce > 0.3 && duration < 30) return 'Bounce mare si timp mic: verifica relevanta landing page-ului si primul CTA.'
  if (bounce > 0.2) return 'Bounce peste prag: adauga urmatorul pas clar si testeaza copy-ul de deasupra foldului.'
  return 'Monitorizeaza pagina; riscul de exit este acceptabil pentru volumul curent.'
}

function buildExitPages(pages = []) {
  return [...pages]
    .filter(page => Number(page.screen_page_views || 0) >= 10)
    .map(page => {
      const views = Number(page.screen_page_views || 0)
      const bounceRate = Number(page.bounce_rate || 0)
      const conversions = Number(page.conversions || 0)
      const conversionRate = views > 0 ? conversions / views * 100 : 0
      const estimatedExits = Math.round(views * bounceRate)
      const shortVisitPenalty = Number(page.average_session_duration || 0) < 35 ? 1.2 : 1
      const conversionProtection = 1 - Math.min(conversionRate, 12) / 12
      const riskScore = estimatedExits * shortVisitPenalty * Math.max(conversionProtection, 0.2)
      return {
        page_path: page.page_path,
        screen_page_views: views,
        bounce_rate: bounceRate,
        engagement_rate: Number(page.engagement_rate || 0),
        average_session_duration: Number(page.average_session_duration || 0),
        conversions,
        conversion_rate: parseFloat(conversionRate.toFixed(2)),
        estimated_exits: estimatedExits,
        risk_score: parseFloat(riskScore.toFixed(1)),
        recommendation: exitRecommendation(page.page_path, page),
      }
    })
    .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
    .slice(0, 20)
}

function aggregateExitIntentRows(rows = []) {
  const aggregate = (keyFn, seedFn) => {
    const groups = new Map()
    rows.forEach(row => {
      const key = keyFn(row)
      if (!key) return
      if (!groups.has(key)) groups.set(key, seedFn(row))
      const acc = groups.get(key)
      acc.event_count = Number(acc.event_count || 0) + Number(row.event_count || 0)
      acc.active_users = Number(acc.active_users || 0) + Number(row.active_users || 0)
      if (acc.event_names && row.event_name) acc.event_names.add(row.event_name)
    })
    return Array.from(groups.values()).map(row => {
      if (row.event_names) {
        row.event_names = Array.from(row.event_names).sort()
        row.top_event = row.event_names[0] || null
      }
      return row
    })
  }

  const timeline = aggregate(
    row => row.date,
    row => ({ date: row.date, event_count: 0, active_users: 0 })
  ).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

  const events = aggregate(
    row => row.event_name,
    row => ({ event_name: row.event_name, event_count: 0, active_users: 0 })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  const pages = aggregate(
    row => row.page_path,
    row => ({ page_path: row.page_path || '/', event_count: 0, active_users: 0, event_names: new Set() })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  const cohorts = aggregate(
    row => `${row.new_vs_returning || '(not set)'}::${row.session_default_channel_group || '(not set)'}::${row.device_category || '(not set)'}`,
    row => ({
      new_vs_returning: row.new_vs_returning || '(not set)',
      session_default_channel_group: row.session_default_channel_group || '(not set)',
      device_category: row.device_category || '(not set)',
      event_count: 0,
      active_users: 0,
    })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  return {
    rows,
    events: events.slice(0, 20),
    pages: pages.slice(0, 20),
    cohorts: cohorts.slice(0, 20),
    timeline,
    totalEvents: rows.reduce((sum, row) => sum + Number(row.event_count || 0), 0),
    totalUsers: rows.reduce((sum, row) => sum + Number(row.active_users || 0), 0),
  }
}

function buildExitAnalysisFromPayloads(payloads = [], pages = []) {
  const rows = payloads.flatMap(payload => payload.exitAnalysis?.exitIntent?.rows || [])
  return {
    schemaVersion: EXIT_ANALYSIS_SCHEMA_VERSION,
    exitPages: buildExitPages(pages),
    exitIntent: aggregateExitIntentRows(rows),
    notes: {
      exitPages: 'GA4 Data API nu expune direct metricul Exits in raportul standard; folosim bounce rate, engagement, durata, views si conversii ca proxy de risc.',
      exitIntent: 'Evenimentele sunt detectate dupa nume care contin exit, intent, abandon, leave, beforeunload, page_close, close_page sau dropoff.',
    },
  }
}

function attachExitAnalysis(data) {
  const payload = { exitAnalysis: data.exitAnalysis || { exitIntent: { rows: [] } } }
  data.exitAnalysis = buildExitAnalysisFromPayloads([payload], data.pages?.current || [])
  return data
}

function composeFromTabDailyRows(rows, currFrom, currTo, prevFrom, prevTo) {
  const payloadFor = row => row.payload || emptyTabDay(row.data_date)
  const currentPayloads = rows.filter(row => row.data_date >= currFrom && row.data_date <= currTo).map(payloadFor)
  const previousPayloads = rows.filter(row => row.data_date >= prevFrom && row.data_date <= prevTo).map(payloadFor)
  const currentPages = aggregatePages(currentPayloads)
  const previousPages = aggregatePages(previousPayloads)

  return {
    traffic: {
      current: aggregateTraffic(currentPayloads),
      previous: aggregateTraffic(previousPayloads),
    },
    pages: {
      current: currentPages,
      previous: previousPages,
    },
    conversions: aggregateConversions(currentPayloads),
    daily: {
      current: aggregateDaily(currentPayloads),
      byChannel: aggregateDailyByChannel(currentPayloads),
    },
    gsc: {
      current: aggregateGscDateRows(currentPayloads),
      previous: aggregateGscDateRows(previousPayloads),
      queries: aggregateGscQueries(currentPayloads),
      pages: aggregateGscPages(currentPayloads),
    },
    gscSource: 'tab_data_daily',
    cererePages: {
      daily: {
        cerereNoua: aggregatePageDaily(currentPayloads, 'cerereNoua'),
        cereriNou: aggregatePageDaily(currentPayloads, 'cereriNou'),
        vreau: aggregatePageDaily(currentPayloads, 'vreau'),
      },
      byChannel: {
        cerereNoua: aggregatePageChannel(currentPayloads, 'cerereNoua'),
        cereriNou: aggregatePageChannel(currentPayloads, 'cereriNou'),
        vreau: aggregatePageChannel(currentPayloads, 'vreau'),
      },
    },
    cerereTracking: aggregateTracking(currentPayloads),
    exitAnalysis: buildExitAnalysisFromPayloads(currentPayloads, currentPages),
    platformRequests: aggregatePlatformRequests(currentPayloads, currFrom, currTo),
  }
}

async function buildFromTabDataCache({ currFrom, currTo, prevFrom, prevTo, forceRefresh }) {
  const rangeStart = prevFrom
  const rangeEnd = currTo
  const rangeDays = eachDate(rangeStart, rangeEnd).length
  if (rangeDays > 370) {
    throw new Error(`Tab daily cache skipped for ${rangeDays} days; using snapshot fallback`)
  }
  const initialRows = await getTabDailyRows(rangeStart, rangeEnd)
  const refreshDate = forceRefresh ? currTo : null
  const ranges = mergeRanges([
    ...missingRanges(initialRows, rangeStart, rangeEnd, refreshDate),
    ...missingExitAnalysisRanges(initialRows, rangeStart, rangeEnd),
  ])

  for (const range of ranges) {
    await fetchAndSaveTabDailyRange(range.start, range.end)
  }

  const rows = ranges.length ? await getTabDailyRows(rangeStart, rangeEnd) : initialRows
  const missingAfterFetch = missingRanges(rows, rangeStart, rangeEnd)
  if (missingAfterFetch.length) {
    throw new Error(`Tab daily cache incomplete: ${missingAfterFetch.map(r => `${r.start}:${r.end}`).join(', ')}`)
  }

  const newestSync = rows.reduce((max, row) => {
    const time = Date.parse(row.synced_at || row.updated_at || '')
    return Number.isFinite(time) && time > max ? time : max
  }, 0)

  return {
    data: composeFromTabDailyRows(rows, currFrom, currTo, prevFrom, prevTo),
    fetchedRanges: ranges,
    cachedAt: newestSync ? new Date(newestSync).toISOString() : null,
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

// ── Genereaza recomandari dinamice din date ─────────────────────────
function generateRecommendations(data) {
  const curr = data.traffic?.current || []
  const prev = data.traffic?.previous || []
  const pages = data.pages?.current || []
  const tracking = data.cerereTracking || []

  const sum = (arr, f) => arr.reduce((s,r) => s+(r[f]||0), 0)
  const dlt = (c,p) => p > 0 ? ((c-p)/p)*100 : null

  const totalSess = sum(curr,'sessions')
  const totalConv = sum(curr,'conversions')
  const totalSessPrev = sum(prev,'sessions')
  const totalConvPrev = sum(prev,'conversions')

  const social  = curr.find(r=>r.session_default_channel_group==='Organic Social')
  const organic = curr.find(r=>r.session_default_channel_group==='Organic Search')
  const direct  = curr.find(r=>r.session_default_channel_group==='Direct')
  const socialConvR  = social?.sessions>0  ? social.conversions/social.sessions*100   : 0
  const organicConvR = organic?.sessions>0 ? organic.conversions/organic.sessions*100 : 0
  const directConvR  = direct?.sessions>0  ? direct.conversions/direct.sessions*100   : 0

  const get = path => pages.find(p=>p.page_path===path)
  const rate = p => p?.screen_page_views>0 ? p.conversions/p.screen_page_views*100 : 0

  const h3 = get('/home3'), hp = get('/'), vreau = get('/vreau')
  const ceNou = get('/cerere-noua'), cereri = get('/cereri')
  const cereriNou = get('/cereri/nou'), proprietati = get('/proprietati')
  const reset = get('/resetare-parola')

  const h3r = rate(h3), hpr = rate(hp), vreauR = rate(vreau), ceNouR = rate(ceNou)
  const cereriViews = cereri?.screen_page_views || 0
  const totalFormViews = (ceNou?.screen_page_views||0)+(vreau?.screen_page_views||0)+(cereriNou?.screen_page_views||0)
  const funnelRate = cereriViews > 0 ? totalFormViews/cereriViews*100 : 0

  const platformCereriNoi = Number(data.platformRequests?.count || 0)
  const trackingCereriNoi = tracking.reduce((s,d)=>s+(d.conversions_bravo_cerere_noua||0),0)
  const totalCereriNoi = platformCereriNoi > 0 ? platformCereriNoi : trackingCereriNoi
  const cereriSource = platformCereriNoi > 0 ? 'platform' : trackingCereriNoi > 0 ? 'ga4' : 'none'
  const totalCump = tracking.reduce((s,d)=>s+(d.conversions_bun_venit_cumparator||0),0)
  const cereriConvRateValue = totalCump > 0 ? totalCereriNoi / totalCump * 100 : null
  const cereriConvRate = cereriConvRateValue !== null ? cereriConvRateValue.toFixed(0) : null
  const dailyRequestRate = totalCereriNoi / Math.max(data.days || tracking.length || 1, 1)
  const requestDailyTarget = 2
  const requestDailyGap = Math.max(0, requestDailyTarget - dailyRequestRate)
  const requestSessionRate = totalSess > 0 ? totalCereriNoi / totalSess * 100 : 0
  const requestSessionTargetRate = 2
  const buyerRequestTargetRate = 90

  const sessD = dlt(totalSess, totalSessPrev)
  const convD = dlt(totalConv, totalConvPrev)
  const gsc = normalizeGscData(data.gsc)
  const seoClicks = sum(gsc.current, 'organic_google_search_clicks')
  const seoClicksPrev = sum(gsc.previous, 'organic_google_search_clicks')
  const seoImpressions = sum(gsc.current, 'organic_google_search_impressions')
  const seoAvgPosition = weightedGscPosition(gsc.current) ?? weightedGscPosition(gsc.queries)
  const seoD = dlt(seoClicks, seoClicksPrev)
  const seo = getSeoOpportunity(gsc)
  const seoPage = topGscPage(gsc)

  const exitAnalysis = data.exitAnalysis || {}
  const exitPages = exitAnalysis.exitPages || []
  const exitIntent = exitAnalysis.exitIntent || {}
  const topExitRisk = exitPages[0]
  const totalExitIntentEvents = Number(exitIntent.totalEvents || 0)
  const topExitIntentPage = (exitIntent.pages || [])[0]
  const topExitIntentCohort = (exitIntent.cohorts || [])[0]
  const requestIntentPaths = ['/cereri', '/vreau', '/cerere-noua', '/cereri/nou']
  const topRequestExit = exitPages.find(row => pageMatches(requestIntentPaths, row))
  const speedCandidate = [...pages]
    .filter(page => Number(page.screen_page_views || 0) >= 20)
    .filter(page => !['/auth', '/login', '/logare', '/resetare-parola'].includes(page.page_path))
    .map(page => {
      const views = Number(page.screen_page_views || 0)
      const bounce = Number(page.bounce_rate || 0)
      const duration = Number(page.average_session_duration || 0)
      const conversions = Number(page.conversions || 0)
      const risk = views * Math.max(bounce, 0.05) * (duration < 35 ? 1.25 : 1) * (conversions === 0 ? 1.15 : 1)
      return { ...page, speed_risk: risk }
    })
    .filter(page => Number(page.bounce_rate || 0) >= 0.18 || Number(page.average_session_duration || 0) < 25)
    .sort((a, b) => Number(b.speed_risk || 0) - Number(a.speed_risk || 0))[0]
  const topChannel = [...curr].sort((a, b) => Number(b.sessions || 0) - Number(a.sessions || 0))[0]
  const directSessions = Number(direct?.sessions || 0)
  const organicSessions = Number(organic?.sessions || 0)
  const socialSessions = Number(social?.sessions || 0)
  const directShare = totalSess > 0 ? directSessions / totalSess * 100 : 0
  const organicShare = totalSess > 0 ? organicSessions / totalSess * 100 : 0

  const insights = []
  const actions  = []

  // ── INSIGHTS ─────────────────────────────────────────────────────
  // Trafic trend
  if (sessD !== null) {
    if (sessD > 15)      insights.push({ type:'positive', title:`Trafic +${sessD.toFixed(0)}% fata de perioada anterioara`, body:`${totalSess.toLocaleString('ro')} sesiuni vs ${totalSessPrev.toLocaleString('ro')}. Crestere solida.` })
    else if (sessD < -15) insights.push({ type:'negative', title:`Trafic -${Math.abs(sessD).toFixed(0)}% fata de perioada anterioara`, body:`${totalSess.toLocaleString('ro')} sesiuni vs ${totalSessPrev.toLocaleString('ro')}. Investigheaza sursa scaderii.` })
    else                 insights.push({ type:'neutral',  title:`Trafic stabil — ${totalSess.toLocaleString('ro')} sesiuni`, body:`Variatie de ${Math.abs(sessD).toFixed(0)}% fata de perioada anterioara.` })
  }

  // Social e cel mai eficient
  if (socialConvR > directConvR * 1.3)
    insights.push({ type:'info', tag:'PRIORITATE', title:`Social Media: ${socialConvR.toFixed(1)}% conv rate — cel mai eficient canal`, body:`De ${(socialConvR/Math.max(directConvR,0.1)).toFixed(1)}x mai eficient decat Direct. Cu ${(social?.sessions||0).toLocaleString('ro')} sesiuni din social, dublarea postari = dublarea conversiilor.` })

  // /vreau vs /cerere-noua
  if (vreauR > 0 && ceNouR > 0) {
    if (vreauR > ceNouR * 2)
      insights.push({ type:'positive', tag:'NOU', title:`/vreau (${vreauR.toFixed(1)}%) de ${(vreauR/Math.max(ceNouR,0.1)).toFixed(1)}x mai eficient decat /cerere-noua (${ceNouR.toFixed(1)}%)`, body:'Redirecteaza traficul spre /vreau sau copiaza structura sa pe /cerere-noua.' })
    else if (vreauR > 0)
      insights.push({ type:'neutral', title:`/vreau functioneaza — ${vreauR.toFixed(1)}% conv rate`, body:`Monitorizare in continuare. Target: 5% conv rate.` })
  }

  // Homepage gap
  const homepageGapClosed = h3r > 0 && hpr > 0 && (h3r - hpr) < 1.5
  if (homepageGapClosed)
    insights.push({ type:'positive', title:`Gap homepage inchis — / (${hpr.toFixed(1)}%) aproape de /home3 (${h3r.toFixed(1)}%)`, body:'Imbunatatirile pe homepage au dat rezultate. Focus pe urmatoarea oportunitate.' })
  else if (h3r > hpr * 1.5 && (h3?.screen_page_views||0) > 20)
    insights.push({ type:'neutral', title:`/home3 (${h3r.toFixed(1)}%) inca mai bun decat homepage (${hpr.toFixed(1)}%)`, body:'Copiaza elementele diferite de pe /home3 pe homepage.' })

  // /proprietati oportunitate
  if (proprietati && (proprietati.screen_page_views||0) > 200 && (proprietati.conversions||0) === 0)
    insights.push({ type:'negative', title:`/proprietati: ${(proprietati.screen_page_views||0).toLocaleString('ro')} views, 0 conversii`, body:`${Math.round((proprietati.bounce_rate||0)*100)}% bounce. Lipseste CTA pe tip user.` })

  // Cereri tracking
  if (totalCereriNoi > 0) {
    const sourceText = cereriSource === 'platform'
      ? `${cereriConvRate ? cereriConvRate+'% din cumparatorii inregistrati adauga cerere. ' : ''}Numarate direct din buyer_requests, deci nu depind de tracking-ul GA4.`
      : `${cereriConvRate ? cereriConvRate+'% din cumparatorii inregistrati adauga cerere. ' : ''}Tracking GA4.`
    insights.push({ type:'positive', title:`${totalCereriNoi} cereri noi adaugate`, body:`${sourceText} Ritm: ${dailyRequestRate.toFixed(2)}/zi.` })
    if (dailyRequestRate < requestDailyTarget) {
      insights.push({ type:'neutral', tag:'TARGET', title:`Ritm sub target: ${dailyRequestRate.toFixed(2)} cereri/zi vs ${requestDailyTarget}/zi`, body:`Mai lipsesc aproximativ ${(requestDailyGap * Math.max(data.days || 30, 1)).toFixed(0)} cereri pe interval pentru targetul curent. Prioritatea este cresterea conversiei din cumparatori activi, nu doar trafic nou.` })
    }
  }

  if (topExitRisk) {
    insights.push({
      type: Number(topExitRisk.bounce_rate || 0) >= 0.25 ? 'negative' : 'info',
      title:`Exit risk: ${topExitRisk.page_path} are ${topExitRisk.estimated_exits} exit proxy`,
      body:`${topExitRisk.screen_page_views.toLocaleString('ro')} views, ${Math.round(Number(topExitRisk.bounce_rate || 0) * 100)}% bounce, ${Math.round(Number(topExitRisk.average_session_duration || 0))}s durata medie. ${topExitRisk.recommendation}`,
    })
  }

  if (totalExitIntentEvents > 0) {
    insights.push({
      type:'negative',
      tag:'EXIT',
      title:`${totalExitIntentEvents.toLocaleString('ro')} evenimente exit intent explicite`,
      body: topExitIntentPage
        ? `Cele mai multe sunt pe ${topExitIntentPage.page_path} (${topExitIntentPage.event_count} events). Prioritizeaza paginile cu intent de cerere.`
        : 'Trackingul explicit de exit intent functioneaza; foloseste-l pentru follow-up si salvare progres.',
    })
  }

  if (topChannel && totalSess > 0) {
    insights.push({
      type:'info',
      title:`Canal principal: ${topChannel.session_default_channel_group} cu ${Number(topChannel.sessions || 0).toLocaleString('ro')} sesiuni`,
      body:`Direct reprezinta ${directShare.toFixed(0)}% din trafic, Organic Search ${organicShare.toFixed(0)}%. Recomandarile noi includ idei de crestere trafic pe canalele care au deja semnal.`,
    })
  }

  // /cereri/nou broken
  if (cereriNou && (cereriNou.conversions||0) === 0 && (cereriNou.screen_page_views||0) > 20)
    insights.push({ type:'negative', title:`/cereri/nou: ${cereriNou.screen_page_views} views, ${Math.round(cereriNou.average_session_duration||0)}s, 0 conversii — tracking broken`, body:'Key Event nesetat. Pierdere de date.' })

  // ── ACTIUNI ───────────────────────────────────────────────────────
  if (cereriNou && (cereriNou.conversions||0) === 0 && (cereriNou.screen_page_views||0) > 20)
    actions.push({ urgency:'urgent', title:`/cereri/nou: ${cereriNou.screen_page_views} views, 0 conversii — Key Event inca nesetat`, body:'Pierdere directa de date. Persista din saptamana anterioara.', fix:"Adauga la submit reusit pe /cereri/nou: gtag('event', 'conversions_bravo_cerere_noua', {page_source: 'cereri_nou'}). Verifica in GA4 DebugView. Durata: 5 minute." })

  if (funnelRate < 15)
    actions.push({ urgency:'urgent', title:`Funnel /cereri → formulare: ${funnelRate.toFixed(0)}% — CTA inline lipseste`, body:`${cereriViews.toLocaleString('ro')} vizite pe /cereri dar doar ${totalFormViews} (${funnelRate.toFixed(0)}%) ajung la formulare.`, fix:"Insereaza card dark-navy dupa pozitia 4 din gridul de cereri: 'Nu gasesti ce cauti? Descrie ce vrei — agentii activi iti trimit oferte in 24h'. Ascunde pentru agentii logati. Efort: 30 minute." })

  if (totalCereriNoi > 0 && dailyRequestRate < requestDailyTarget)
    actions.push({ urgency:'urgent', title:`Target cereri noi: ${dailyRequestRate.toFixed(2)}/zi vs ${requestDailyTarget}/zi`, body:`In perioada curenta sunt ${totalCereriNoi} cereri noi. Pentru targetul de ${requestDailyTarget}/zi lipsesc aproximativ ${(requestDailyGap * Math.max(data.days || 30, 1)).toFixed(0)} cereri pe interval.`, fix:"Lanseaza un sprint de 14 zile: toate CTA-urile principale pentru cumparatori duc catre /vreau, adauga CTA sticky pe mobile si afiseaza un reminder dupa login: 'Adauga cererea si primesti oferte de la agenti'. Masoara cereri/zi si buyer_requests." })

  if (totalCump > 0 && cereriConvRateValue !== null && cereriConvRateValue < buyerRequestTargetRate)
    actions.push({ urgency:'important', title:`Recupereaza cumparatorii fara cerere: ${cereriConvRate}% adauga cerere`, body:`Ai ${totalCump} inregistrari de cumparatori si ${totalCereriNoi} cereri noi. Target recomandat: ${buyerRequestTargetRate}% dintre cumparatori sa adauge o cerere in aceeasi sesiune sau in primele 24h.`, fix:"Dupa inregistrarea ca buyer, redirectioneaza direct catre /vreau cu profilul precompletat. Pentru cei care nu trimit cererea in 15 minute, trimite email/push: 'Spune-ne ce cauti si primesti oferte potrivite'. Masoara rata cumparatori→cerere 14 zile." })

  if (totalSess > 0 && requestSessionRate < requestSessionTargetRate)
    actions.push({ urgency:'important', title:`Cereri / sesiuni: ${requestSessionRate.toFixed(2)}% — conversie sub ${requestSessionTargetRate}%`, body:`Traficul existent nu este impins suficient spre actiunea de baza: cerere noua. Chiar si +0.5pp ar aduce cereri suplimentare fara buget media nou.`, fix:"Adauga un CTA contextual catre /vreau pe paginile cu intent: homepage, /cumparatori, /proprietati si pagini de listari. Text: 'Nu ai gasit proprietatea potrivita? Creeaza o cerere si primesti oferte'. Track-uieste click_to_request_start separat de submit." })

  if (topRequestExit)
    actions.push({
      urgency: Number(topRequestExit.risk_score || 0) >= 20 || Number(topRequestExit.bounce_rate || 0) >= 0.25 ? 'urgent' : 'important',
      title:`Exit intent pe ${topRequestExit.page_path}: ${topRequestExit.estimated_exits} exit proxy`,
      body:`Pagina este in fluxul de cereri si are ${Math.round(Number(topRequestExit.bounce_rate || 0) * 100)}% bounce. Asta poate bloca obiectivul de crestere a cererilor noi.`,
      fix:"Adauga un fallback de exit intent: 'Salveaza cererea si continui mai tarziu' + CTA catre /vreau. Pe mobile, afiseaza un CTA sticky dupa primul scroll si salveaza progresul formularului dupa fiecare pas.",
    })

  if (totalExitIntentEvents > 0 && topExitIntentPage)
    actions.push({
      urgency:'important',
      title:`Exit intent explicit: ${topExitIntentPage.page_path} cu ${topExitIntentPage.event_count} events`,
      body: topExitIntentCohort
        ? `Cohorta principala: ${topExitIntentCohort.new_vs_returning}, ${topExitIntentCohort.session_default_channel_group}, ${topExitIntentCohort.device_category}.`
        : 'Exista evenimente explicite de abandon/exit in GA4.',
      fix:"Creeaza un playbook pe eveniment: daca userul abandoneaza pagina de intent, trimite email/reminder cand exista date de contact; daca este anonim, afiseaza modal cu beneficiu scurt si buton 'continua cererea'.",
    })

  if (proprietati && (proprietati.screen_page_views||0) > 200 && (proprietati.conversions||0) === 0)
    actions.push({ urgency:'urgent', title:`/proprietati: ${(proprietati.screen_page_views||0).toLocaleString('ro')} views, 0 conversii, ${Math.round((proprietati.bounce_rate||0)*100)}% bounce`, body:'A doua pagina ca trafic fara niciun CTA activ.', fix:"Adauga CTA conditionat: Agent/Proprietar → 'Publica o proprietate' → /proprietati/nou. Cumparator → 'Adauga o cerere' → /vreau. Masoara uplift-ul 14 zile in GA4 si buyer_requests." })

  if (vreauR > 0 && ceNouR > 0 && vreauR > ceNouR * 2)
    actions.push({ urgency:'important', title:`/vreau (${vreauR.toFixed(1)}%) de ${(vreauR/Math.max(ceNouR,0.1)).toFixed(1)}x mai eficient decat /cerere-noua (${ceNouR.toFixed(1)}%)`, body:'Acelasi obiectiv, performante complet diferite.', fix:"Schimba destinatia butonului '+ Cerere noua' din /cereri catre /vreau. Masoara conv rate 14 zile." })

  if (!homepageGapClosed && h3r > hpr * 1.5 && (h3?.screen_page_views||0) > 20)
    actions.push({ urgency:'important', title:`/home3 (${h3r.toFixed(1)}%) inca mai bun decat homepage (${hpr.toFixed(1)}%)`, body:'Gap exista inca. Copiaza elementele diferite de pe /home3 pe /', fix:'Identifica ce e diferit pe /home3 vs /. Aplica pe homepage si monitorizeaza 14 zile.' })

  if (reset && (reset.engagement_rate||0) < 0.6 && (reset.screen_page_views||0) > 10)
    actions.push({ urgency:'important', title:`/resetare-parola — engagement ${Math.round((reset.engagement_rate||0)*100)}% (emailul imbunatatit, verifica daca bounce persista)`, body:'Am optimizat emailul de reset (expirare 30 min, CTA clar). Daca bounce-ul persista, problema e tehnica.', fix:'Testeaza manual: solicita reset > verifica inbox + spam > apasa link > confirma ca functioneaza. Verifica in Supabase Auth logs timpul de expirare.' })

  if (convD !== null && convD < -20)
    actions.push({ urgency:'urgent', title:`Conversii -${Math.abs(convD).toFixed(0)}% fata de perioada anterioara`, body:`${totalConv} conversii vs ${totalConvPrev}.`, fix:'Verifica GA4 pentru erori JS. Verifica /cerere-noua, /vreau si /home3.' })

  if (socialConvR > Math.max(organicConvR, directConvR, 0.5) * 1.2 && socialSessions > 0)
    actions.push({
      urgency:'luna asta',
      title:`Trafic: scaleaza Organic Social, canal cu ${socialConvR.toFixed(1)}% conv rate`,
      body:`Social aduce ${socialSessions.toLocaleString('ro')} sesiuni si converteste mai bine decat celelalte canale majore.`,
      fix:"Transforma cele mai bune 3 cereri active in postari scurte: buget, zona, timeline si CTA 'adauga si tu ce cauti'. Trimite aceleasi asseturi in Facebook Groups, LinkedIn si WhatsApp comunitati, cu UTM separat.",
    })
  else if (seoImpressions > 0 && organicShare < 35)
    actions.push({
      urgency:'luna asta',
      title:`Trafic: Organic Search are doar ${organicShare.toFixed(0)}% din sesiuni, dar ${seoImpressions.toLocaleString('ro')} impressions`,
      body:'Exista cerere in Search Console, dar traficul organic poate fi crescut prin pagini dedicate si linkare interna.',
      fix:"Creeaza 2 landing pages pe intent validat: una pentru cumparatori ('cereri cumparatori Bucuresti') si una pentru agenti ('leaduri imobiliare'). Leaga-le din homepage, /cereri si /abonamente.",
    })
  else
    actions.push({
      urgency:'luna asta',
      title:'Trafic: construieste distributie pentru cereri cu intent ridicat',
      body:`Canalul principal este ${topChannel?.session_default_channel_group || 'necunoscut'}, iar direct reprezinta ${directShare.toFixed(0)}% din trafic. Ai nevoie de trafic nou pe intent, nu doar reveniri directe.`,
      fix:"Publica saptamanal top 5 cereri active pe 3 canale: Facebook Groups, LinkedIn agenti si newsletter catre agenti. Fiecare card trebuie sa duca la /cereri si sa aiba CTA secundar catre /vreau.",
    })

  if (speedCandidate)
    actions.push({
      urgency:'important',
      title:`Speed/UX: ${speedCandidate.page_path} are bounce ${Math.round(Number(speedCandidate.bounce_rate || 0) * 100)}% si durata ${Math.round(Number(speedCandidate.average_session_duration || 0))}s`,
      body:`Pagina are ${Number(speedCandidate.screen_page_views || 0).toLocaleString('ro')} views si semnal de abandon rapid. Poate fi problema de viteza, layout above the fold sau CTA neclar.`,
      fix:"Ruleaza PageSpeed pe pagina, comprima imaginile above the fold, reduce scripturile third-party necritice si afiseaza CTA-ul principal fara layout shift. Dupa fix, compara bounce si durata pe 7 zile.",
    })
  else
    actions.push({
      urgency:'luna asta',
      title:'Speed: activeaza masurare Web Vitals pe paginile de conversie',
      body:'Raportul are proxy din bounce/durata, dar nu are inca LCP, CLS sau INP pentru diagnostic tehnic precis.',
      fix:"Trimite in GA4 eventuri web_vital_lcp, web_vital_cls si web_vital_inp pentru /, /cereri, /vreau, /cerere-noua si /proprietati. Adauga praguri: LCP < 2.5s, CLS < 0.1, INP < 200ms.",
    })

  if (seoD !== null && Math.abs(seoD) > 15)
    insights.push({ type: seoD > 0 ? 'positive' : 'negative', title:`SEO ${seoD > 0 ? '+' : '-'}${Math.abs(seoD).toFixed(0)}% clicks organice`, body:`${Math.round(seoClicks)} clicks vs ${Math.round(seoClicksPrev)} perioada anterioara. ${seoImpressions.toLocaleString('ro')} impressions in perioada curenta.` })

  if (seo.nearTop)
    actions.push({ urgency:'seo', title:`SEO: "${seo.nearTop.query}" la pozitia ${seo.nearTop.position.toFixed(1)} — oportunitate top 3`, body:`${Math.round(seo.nearTop.impressions)} impressions si ${Math.round(seo.nearTop.clicks)} clicks. Query-ul are deja semnal in Search Console, deci e mai bun decat o lista generica de keywords.`, fix:'Deschide pagina care rankeaza pentru query in GSC > Performance > Queries > Pages. Adauga 200-400 cuvinte relevante, H1/meta title cu intentul exact si 2-3 linkuri interne catre pagina.' })
  else if (seo.lowCtr)
    actions.push({ urgency:'seo', title:`SEO: "${seo.lowCtr.query}" are CTR ${((seo.lowCtr.ctr || 0) * 100).toFixed(1)}%`, body:`${Math.round(seo.lowCtr.impressions)} impressions cu CTR mic. Problema probabila este snippet-ul, nu lipsa de indexare.`, fix:'Rescrie title/meta description pentru click: include orasul, beneficiul concret si un CTA scurt. Verifica schimbarea dupa 14 zile in GSC.' })
  else if (seoImpressions > 0)
    actions.push({ urgency:'seo', title:`SEO: ${Math.round(seoImpressions).toLocaleString('ro')} impressions si ${Math.round(seoClicks)} clicks — construieste pe queries validate`, body:`Pozitie medie ${seoAvgPosition ? seoAvgPosition.toFixed(1) : '—'}. Exista semnal organic real; urmatorul pas este continut pe intenturile care deja apar in GSC.`, fix:"Prioritate: optimizeaza pagina cu cele mai multe impressions din GSC, apoi creeaza '/cum-functioneaza' si '/agenti-imobiliari-bucuresti' doar daca sunt sustinute de queries reale." })
  else
    actions.push({ urgency:'seo', title:'SEO: date GSC insuficiente pentru recomandare dinamica', body:'Search Console nu are inca enough impressions/clicks pe intervalul curent.', fix:'Pastreaza colectarea GSC activa si revino dupa 7-14 zile. Intre timp, publica o pagina evergreen: /cum-functioneaza.' })

  if (seoPage && seoPage.impressions >= 20)
    actions.push({
      urgency:'seo',
      title:`SEO pagina: ${seoPage.path} are ${Math.round(seoPage.impressions).toLocaleString('ro')} impressions`,
      body:`CTR ${((seoPage.ctr || 0) * 100).toFixed(1)}%, pozitie medie ${seoPage.position ? seoPage.position.toFixed(1) : '—'}. Pagina are deja semnal organic si merita optimizata inaintea continutului nou.`,
      fix:'Actualizeaza title/meta, adauga FAQ scurt cu intrebari reale, include linkuri catre /cereri si /vreau si verifica snippet-ul dupa 14 zile in Search Console.',
    })

  return {
    insights: insights.slice(0, 6),
    actions:  actions.slice(0, 16),
    generatedAt: new Date().toISOString(),
    summary: {
      totalSess, totalConv, totalSessPrev, totalConvPrev,
      socialConvR: parseFloat(socialConvR.toFixed(1)),
      vreauR: parseFloat(vreauR.toFixed(1)),
      ceNouR: parseFloat(ceNouR.toFixed(1)),
      hpr: parseFloat(hpr.toFixed(1)),
      h3r: parseFloat(h3r.toFixed(1)),
      funnelRate: parseFloat(funnelRate.toFixed(1)),
      totalCereriNoi,
      platformCereriNoi,
      trackingCereriNoi,
      cereriSource,
      cereriConvRate,
      dailyRequestRate: parseFloat(dailyRequestRate.toFixed(2)),
      requestDailyTarget,
      requestDailyGap: parseFloat(requestDailyGap.toFixed(2)),
      requestSessionRate: parseFloat(requestSessionRate.toFixed(2)),
      requestSessionTargetRate,
      buyerRequestTargetRate,
      seoClicks: Math.round(seoClicks),
      seoImpressions: Math.round(seoImpressions),
      seoAvgPosition: seoAvgPosition ? parseFloat(seoAvgPosition.toFixed(1)) : null,
      seoTopQuery: seo.topQuery?.query || null,
      seoTopPage: seoPage?.path || null,
      topExitPage: topExitRisk?.page_path || null,
      topExitRisk: topExitRisk ? Number(topExitRisk.risk_score || 0) : null,
      topExitEstimatedExits: topExitRisk ? Number(topExitRisk.estimated_exits || 0) : 0,
      topRequestExitPage: topRequestExit?.page_path || null,
      totalExitIntentEvents,
      topExitIntentPage: topExitIntentPage?.page_path || null,
      topExitIntentEvents: topExitIntentPage ? Number(topExitIntentPage.event_count || 0) : 0,
      speedRiskPage: speedCandidate?.page_path || null,
      speedRiskBounce: speedCandidate ? parseFloat((Number(speedCandidate.bounce_rate || 0) * 100).toFixed(0)) : null,
      speedRiskDuration: speedCandidate ? Math.round(Number(speedCandidate.average_session_duration || 0)) : null,
      topTrafficChannel: topChannel?.session_default_channel_group || null,
      directShare: parseFloat(directShare.toFixed(1)),
      organicShare: parseFloat(organicShare.toFixed(1)),
    }
  }
}

async function fetchFromWindsor(currFrom, currTo, prevFrom, prevTo) {
  const t = Date.now()
  const [r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17,r18] = await Promise.allSettled([
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
    w(['date','conversions_bravo_cerere_noua','conversions_bun_venit_cumparator','conversions_bun_venit_agent','conversions_bun_venit_proprietar'], currFrom, currTo),
  ])

  const curr30 = settledRows(r1, 'Current traffic', true)
  const prev30 = settledRows(r2, 'Previous traffic', true)
  const pages30 = settledRows(r3, 'Current pages', true)
  const pagesPrev = settledRows(r4, 'Previous pages', true)
  const conversions = settledRows(r5, 'Conversions')
  const dailyCurr = settledRows(r6, 'Daily traffic', true).sort((a,b)=>a.date.localeCompare(b.date))
  const gscCurr = settledRows(r7, 'Current GSC').sort((a,b)=>a.date.localeCompare(b.date))
  const gscPrev = settledRows(r8, 'Previous GSC')
  const gscQueries = settledRows(r9, 'GSC queries')
  const gscPages = settledRows(r10, 'GSC pages')
  const dailyByChannel = settledRows(r11, 'Daily by channel')
  const ceNouDaily = settledRows(r12, 'Cerere noua daily').filter(d=>d.page_path==='/cerere-noua').sort((a,b)=>a.date.localeCompare(b.date))
  const cereriNouDaily = settledRows(r13, 'Cereri nou daily').filter(d=>d.page_path==='/cereri/nou').sort((a,b)=>a.date.localeCompare(b.date))
  const vreauDaily = settledRows(r14, 'Vreau daily').filter(d=>d.page_path==='/vreau').sort((a,b)=>a.date.localeCompare(b.date))
  const cerereNouaByChannel = settledRows(r15, 'Cerere noua by channel')
  const cereriNouByChannel = settledRows(r16, 'Cereri nou by channel')
  const vreauByChannel = settledRows(r17, 'Vreau by channel')
  const cerereTracking = settledRows(r18, 'Cerere tracking').sort((a,b)=>a.date.localeCompare(b.date))

  assertHasWindsorRows([curr30, pages30, dailyCurr])

  const payload = {
    traffic:     { current: curr30, previous: subtractPrev(prev30.concat(curr30), curr30, 'session_default_channel_group') },
    pages:       { current: pages30, previous: pagesPrev },
    conversions,
    daily:       { current: dailyCurr, byChannel: dailyByChannel },
    gsc:         { current: gscCurr, previous: gscPrev, queries: gscQueries, pages: gscPages },
    cererePages: {
      daily: { cerereNoua: ceNouDaily, cereriNou: cereriNouDaily, vreau: vreauDaily },
      byChannel: { cerereNoua: cerereNouaByChannel, cereriNou: cereriNouByChannel, vreau: vreauByChannel },
    },
    cerereTracking,
  }

  // Genereaza recomandari dinamice
  payload.recommendations = generateRecommendations(payload)

  return { ...payload, _fetchMs: Date.now() - t }
}

function buildResponse(snap, label, days, now) {
  return {
    generatedAt:     now.toISOString(),
    periodLabel:     label,
    days,
    traffic:         snap.traffic,
    pages:           snap.pages,
    conversions:     snap.conversions,
    daily:           snap.daily,
    gsc:             snap.gsc,
    cererePages:     snap.cerere_pages,
    cerereTracking:  snap.cerere_tracking,
    platformRequests: snap.platform_requests,
    recommendations: snap.recommendations,
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === '1'
  const now = new Date()

  let days, currFrom, currTo, prevFrom, prevTo
  try {
    ;({ days, currFrom, currTo, prevFrom, prevTo } = parseReportRange(searchParams, now))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const label = `${new Date(currFrom).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${new Date(currTo).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}`

  // ── 1. Prefer daily tab-data cache; fetch only missing days ──────
  try {
    const cached = await buildFromTabDataCache({ currFrom, currTo, prevFrom, prevTo, forceRefresh })
    const data = cached.data
    if (hasUsefulReportMetrics(data)) {
      attachExitAnalysis(data)
      data.recommendations = generateRecommendations({ ...data, days })
      return NextResponse.json({
        generatedAt: now.toISOString(),
        periodLabel: label,
        days,
        ...data,
        _source: cached.fetchedRanges.length ? 'tab_db_incremental' : 'tab_db',
        _cachedAt: cached.cachedAt,
        _fetchedRanges: cached.fetchedRanges,
      })
    }
    console.warn('Tab daily cache has only zero report metrics; falling back')
  } catch (e) {
    if (isMissingTabDataTable(e)) {
      console.warn('Tab daily cache table missing; falling back to snapshots:', e.message)
    } else {
      console.warn('Tab daily cache unavailable; falling back to snapshots:', e.message)
    }
  }

  // ── 1. Try Supabase cache ────────────────────────────────────────
  if (!forceRefresh) {
    try {
      const snap = await getLatestSnapshot(days)
      if (snap && isFresh(snap)) {
        // Re-genereaza recomandari din datele din cache (dinamice la fiecare request)
        const built = buildResponse(snap, label, days, now)
        if (!hasUsefulGscData(built.gsc)) {
          await attachSearchConsoleData(built, currFrom, currTo, prevFrom, prevTo)
        } else {
          built.gsc = normalizeGscData(built.gsc)
          built.gscSource = 'cache'
        }
        if (built.traffic && built.pages) {
          await attachPlatformRequestData(built, currFrom, currTo)
          attachExitAnalysis(built)
          built.recommendations = generateRecommendations(built)
        }
        if (hasUsefulReportMetrics(built)) {
          return NextResponse.json({ ...built, _source:'cache', _cachedAt: snap.synced_at })
        }
        console.warn('Ignoring fresh all-zero Supabase cache; fetching live data')
      }
      // Cache vechi — returneaza dar cu warning
      if (snap) {
        const built = buildResponse(snap, label, days, now)
        if (!hasUsefulGscData(built.gsc)) {
          await attachSearchConsoleData(built, currFrom, currTo, prevFrom, prevTo)
        } else {
          built.gsc = normalizeGscData(built.gsc)
          built.gscSource = 'cache'
        }
        if (built.traffic && built.pages) {
          await attachPlatformRequestData(built, currFrom, currTo)
          attachExitAnalysis(built)
          built.recommendations = generateRecommendations(built)
        }
        if (hasUsefulReportMetrics(built)) {
          return NextResponse.json({ ...built, _source:'stale_cache', _cachedAt: snap.synced_at, _warning:'Date din cache mai vechi de 6h' })
        }
        console.warn('Ignoring stale all-zero Supabase cache; fetching live data')
      }
    } catch (e) {
      console.warn('Supabase cache miss:', e.message)
    }
  }

  // ── 2. Fetch from GA4 direct; use Windsor only as a fallback ─────
  const syncStart = Date.now()
  try {
    let source = 'ga4'
    let data
    try {
      data = await fetchReportGa4Data({ propertyId: getGa4Account(), currFrom, currTo, prevFrom, prevTo })
      await attachSearchConsoleData(data, currFrom, currTo, prevFrom, prevTo)
      await attachPlatformRequestData(data, currFrom, currTo)
    } catch (ga4Err) {
      console.warn('GA4 direct report fetch failed; using Windsor fallback:', ga4Err.message)
      source = 'windsor'
      data = await fetchFromWindsor(currFrom, currTo, prevFrom, prevTo)
      await attachSearchConsoleData(data, currFrom, currTo, prevFrom, prevTo)
      await attachPlatformRequestData(data, currFrom, currTo)
    }

    if (!hasUsefulReportMetrics(data)) {
      if (source === 'ga4') {
        console.warn('GA4 direct returned only zero report metrics; using Windsor fallback')
        source = 'windsor'
        data = await fetchFromWindsor(currFrom, currTo, prevFrom, prevTo)
        await attachSearchConsoleData(data, currFrom, currTo, prevFrom, prevTo)
        await attachPlatformRequestData(data, currFrom, currTo)
      } else {
        throw new Error('GA4 direct and Windsor returned only zero report metrics. Check GA4_ACCOUNT_ID and GOOGLE_SERVICE_ACCOUNT_JSON.')
      }
    }
    if (!hasUsefulReportMetrics(data)) {
      throw new Error('GA4 direct and Windsor returned only zero report metrics. Check GA4_ACCOUNT_ID and GOOGLE_SERVICE_ACCOUNT_JSON.')
    }

    attachExitAnalysis(data)
    data.recommendations = generateRecommendations({ ...data, days })

    // ── 3. Save to Supabase ────────────────────────────────────────
    try {
      await upsertSnapshot(currTo, days, {
        traffic:        data.traffic,
        pages:          data.pages,
        conversions:    data.conversions,
        daily:          data.daily,
        gsc:            data.gsc,
        cererePages:    data.cererePages,
        cerereTracking: data.cerereTracking,
        recommendations: data.recommendations,
      })
      await logSync({ period_days: days, date_from: currFrom, date_to: currTo, source, status:'ok', rows_saved:1, duration_ms: Date.now()-syncStart })
    } catch (dbErr) {
      console.warn('Supabase write failed:', dbErr.message)
    }

    return NextResponse.json({ generatedAt: now.toISOString(), periodLabel: label, days, ...data, _source:source })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
