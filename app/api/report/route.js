import { NextResponse } from 'next/server'
import { getLatestSnapshot, upsertSnapshot, isFresh, logSync, getTabDailyRows, upsertTabDailyRows } from '../../lib/supabase'
import { getOptionalEnv, requireEnv } from '../../lib/env'
import { fetchReportGa4Data, fetchReportGa4DailyData } from '../../lib/ga4'
import { fetchGscData, fetchGscDailyData } from '../../lib/gsc'
import { fetchPlatformRequestStats, fetchPlatformRequestDailyStats } from '../../lib/platform'

export const maxDuration = 60

const DEFAULT_GA4_ACCOUNT = '521779420'
const DEFAULT_PLATFORM_SUPABASE_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co'
const EXIT_ANALYSIS_SCHEMA_VERSION = 1
const REQUEST_FORM_EVENTS_SCHEMA_VERSION = 1
const CONCIERGE_TRAFFIC_SCHEMA_VERSION = 1
const HEADER_MENU_TEST_NAME = 'Header main menu'
const HOMEPAGE_VARIANTS = [
  { path:'/', label:'Homepage actual' },
  { path:'/home3', label:'/home3' },
  { path:'/invers', label:'/invers' },
  { path:'/simplu', label:'/simplu' },
  { path:'/platforma', label:'/platforma' },
]
const HEADER_MENU_VARIANTS = [
  { key:'control', label:'Meniu actual' },
  { key:'simplu', label:'Meniu pe intentie' },
  { key:'variant_c', label:'Varianta C' },
]

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

function normalizeAnalyticsPath(path) {
  const clean = String(path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '')
  return clean || '/'
}

function isExactPath(rowPath, targetPath) {
  return normalizeAnalyticsPath(rowPath) === normalizeAnalyticsPath(targetPath)
}

function isConciergePath(path) {
  const clean = normalizeAnalyticsPath(path)
  return clean === '/concierge'
}

function pageRowFor(pages, targetPath) {
  return (pages || []).find(row => isExactPath(row.page_path, targetPath)) || null
}

function rateFromViews(numerator, views) {
  return Number(views || 0) > 0 ? Number(numerator || 0) / Number(views || 0) * 100 : 0
}

function weightedMetric(rows, field, weightField = 'screen_page_views') {
  const weight = rows.reduce((sum, row) => sum + Number(row[weightField] || 0), 0)
  if (weight <= 0) return 0
  return rows.reduce((sum, row) => sum + Number(row[field] || 0) * Number(row[weightField] || 0), 0) / weight
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

function missingRequestFormEventRanges(rows, start, end) {
  const byDate = new Map((rows || []).map(row => [row.data_date, row]))
  const dates = eachDate(start, end).filter(date => {
    const payload = byDate.get(date)?.payload
    return !payload || payload.requestFormEvents?.schemaVersion !== REQUEST_FORM_EVENTS_SCHEMA_VERSION
  })
  return mergeRanges(dates.map(date => ({ start: date, end: date })))
}

function missingConciergeTrafficRanges(rows, start, end) {
  const byDate = new Map((rows || []).map(row => [row.data_date, row]))
  const dates = eachDate(start, end).filter(date => {
    const payload = byDate.get(date)?.payload
    return !payload || payload.conciergeTraffic?.schemaVersion !== CONCIERGE_TRAFFIC_SCHEMA_VERSION
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
    requestFormEvents: {
      schemaVersion: REQUEST_FORM_EVENTS_SCHEMA_VERSION,
      rows: [],
    },
    conciergeTraffic: {
      schemaVersion: CONCIERGE_TRAFFIC_SCHEMA_VERSION,
      rows: [],
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

function aggregateRequestFormRows(rows = []) {
  const aggregate = (keyFn, seedFn) => {
    const groups = new Map()
    rows.forEach(row => {
      const key = keyFn(row)
      if (!key) return
      if (!groups.has(key)) groups.set(key, seedFn(row))
      const acc = groups.get(key)
      acc.event_count = Number(acc.event_count || 0) + Number(row.event_count || 0)
      acc.active_users = Number(acc.active_users || 0) + Number(row.active_users || 0)
    })
    return Array.from(groups.values())
  }

  const events = aggregate(
    row => row.event_name,
    row => ({ event_name: row.event_name, event_count: 0, active_users: 0 })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  const pages = aggregate(
    row => row.page_path,
    row => ({ page_path: row.page_path || '/', event_count: 0, active_users: 0 })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  const devices = aggregate(
    row => row.device_category,
    row => ({ device_category: row.device_category || '(not set)', event_count: 0, active_users: 0 })
  ).sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))

  const timeline = aggregate(
    row => row.date,
    row => ({ date: row.date, event_count: 0, active_users: 0 })
  ).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

  return {
    schemaVersion: REQUEST_FORM_EVENTS_SCHEMA_VERSION,
    rows,
    events,
    pages,
    devices,
    timeline,
    totalEvents: rows.reduce((sum, row) => sum + Number(row.event_count || 0), 0),
    totalUsers: rows.reduce((sum, row) => sum + Number(row.active_users || 0), 0),
  }
}

function buildRequestFormEventsFromPayloads(payloads = []) {
  return aggregateRequestFormRows(payloads.flatMap(payload => payload.requestFormEvents?.rows || []))
}

function buildHomepageVariantAnalysisFromPayloads(currentPayloads = [], previousPayloads = [], currentPages = null, previousPages = null) {
  const currPages = currentPages || aggregatePages(currentPayloads)
  const prevPages = previousPages || aggregatePages(previousPayloads)
  const rows = HOMEPAGE_VARIANTS.map(variant => {
    const current = pageRowFor(currPages, variant.path) || {}
    const previous = pageRowFor(prevPages, variant.path) || {}
    const views = Number(current.screen_page_views || 0)
    const prevViews = Number(previous.screen_page_views || 0)
    const conversions = Number(current.conversions || 0)
    const prevConversions = Number(previous.conversions || 0)
    const bounce = Number(current.bounce_rate || 0)
    const duration = Number(current.average_session_duration || 0)
    const conversionRate = rateFromViews(conversions, views)
    const prevConversionRate = rateFromViews(prevConversions, prevViews)
    const estimatedExits = Math.round(views * bounce)

    return {
      ...variant,
      views,
      active_users: Number(current.active_users || 0),
      conversions,
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      previous_conversion_rate: parseFloat(prevConversionRate.toFixed(2)),
      bounce_rate: bounce,
      engagement_rate: Number(current.engagement_rate || 0),
      average_session_duration: duration,
      estimated_exits: estimatedExits,
      previous_views: prevViews,
      previous_conversions: prevConversions,
    }
  })

  const timelineMap = new Map()
  currentPayloads.forEach(payload => {
    const date = payload.date
    ;(payload.pages || []).forEach(page => {
      const variant = HOMEPAGE_VARIANTS.find(item => isExactPath(page.page_path, item.path))
      if (!variant) return
      const key = `${date}::${variant.path}`
      if (!timelineMap.has(key)) {
        timelineMap.set(key, { date, path: variant.path, label: variant.label, views: 0, conversions: 0 })
      }
      const acc = timelineMap.get(key)
      acc.views += Number(page.screen_page_views || 0)
      acc.conversions += Number(page.conversions || 0)
    })
  })
  const timeline = Array.from(timelineMap.values())
    .map(row => ({ ...row, conversion_rate: parseFloat(rateFromViews(row.conversions, row.views).toFixed(2)) }))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.path.localeCompare(b.path))

  const best = rows
    .filter(row => row.views > 0)
    .sort((a, b) => Number(b.conversion_rate || 0) - Number(a.conversion_rate || 0))[0] || null

  const recommendations = []
  const platforma = rows.find(row => row.path === '/platforma')
  const home3 = rows.find(row => row.path === '/home3')
  const simplu = rows.find(row => row.path === '/simplu')

  if (platforma && platforma.views > 0 && platforma.bounce_rate >= 0.35) {
    recommendations.push({
      type: 'negative',
      title: '/platforma are risc vizual si bounce peste prag',
      body: `Bounce ${Math.round(platforma.bounce_rate * 100)}%, durata ${Math.round(platforma.average_session_duration)}s. Deschide hero-ul, redu overlay-ul intunecat si muta dovada sociala/cererile active mai sus.`,
    })
  }
  if (platforma && platforma.views > 0 && platforma.conversion_rate < 3) {
    recommendations.push({
      type: 'neutral',
      title: 'CTA-ul de pe /platforma trebuie sa fie mai clar si mai luminos',
      body: `Conversie ${platforma.conversion_rate.toFixed(1)}%. Pastreaza un CTA principal portocaliu pe fundal deschis si un CTA secundar mai discret catre cereri active.`,
    })
  }
  if (best && best.path !== '/platforma') {
    recommendations.push({
      type: 'positive',
      title: `${best.label} este benchmark-ul curent`,
      body: `Are ${best.conversion_rate.toFixed(1)}% conversie. Compara structura above-the-fold, densitatea textului si contrastul cu /platforma.`,
    })
  }
  if (home3 && simplu && home3.views > 0 && simplu.views > 0) {
    recommendations.push({
      type: 'info',
      title: 'Pastreaza A/B testul cu variante diferite de claritate',
      body: 'Nu testa doar culoarea hero-ului. Variantele trebuie sa difere prin promisiune, CTA, dovada sociala si ordinea sectiunilor.',
    })
  }
  if (!rows.some(row => row.views > 0)) {
    recommendations.push({
      type: 'neutral',
      title: 'Nu exista inca date pentru variantele de homepage',
      body: 'Pastreaza rutele active si verifica daca Page Viewed se colecteaza pentru /home3, /invers, /simplu si /platforma.',
    })
  }

  return { schemaVersion: 1, variants: rows, timeline, bestVariant: best, recommendations }
}

function platformAbConfig() {
  const url = getOptionalEnv('PLATFORM_SUPABASE_URL') || DEFAULT_PLATFORM_SUPABASE_URL
  const key = getOptionalEnv('PLATFORM_SUPABASE_SERVICE_KEY') || getOptionalEnv('PLATFORM_SUPABASE_ANON_KEY')
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

async function platformAbFetch(path, params) {
  const config = platformAbConfig()
  if (!config) {
    throw new Error('Lipseste PLATFORM_SUPABASE_SERVICE_KEY in analytics pentru citirea evenimentelor A/B din HomePitch.')
  }
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
  const res = await fetch(`${config.url}/rest/v1/${path}?${qs}`, {
    cache: 'no-store',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) {
    throw new Error(`Platform Supabase ${res.status}: ${json?.message || text || res.statusText}`)
  }
  return Array.isArray(json) ? json : []
}

function eventDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function emptyHeaderVariant(key, label) {
  return {
    key,
    label,
    views: 0,
    clicks: 0,
    contact_clicks: 0,
    request_cta_clicks: 0,
    property_cta_clicks: 0,
    requests_created: 0,
    properties_created: 0,
    unique_sessions: 0,
    click_rate: 0,
    request_rate: 0,
    property_rate: 0,
    previous_request_rate: 0,
    previous_property_rate: 0,
    previous_views: 0,
  }
}

function summarizeHeaderMenuEvents(events = [], previousEvents = []) {
  const byVariant = new Map(HEADER_MENU_VARIANTS.map(v => [v.key, { ...emptyHeaderVariant(v.key, v.label), __sessions: new Set() }]))
  const previousByVariant = new Map(HEADER_MENU_VARIANTS.map(v => [v.key, { views: 0, requests_created: 0, properties_created: 0 }]))
  const timeline = new Map()

  const normalizeVariant = variant => HEADER_MENU_VARIANTS.some(v => v.key === variant) ? variant : 'control'

  events.forEach(row => {
    const variant = normalizeVariant(row.variant)
    const eventType = row.event_type
    const target = byVariant.get(variant)
    if (!target) return
    if (row.session_id) target.__sessions.add(row.session_id)
    if (eventType === 'header_menu_view') target.views += 1
    if (eventType === 'header_menu_click') target.clicks += 1
    if (eventType === 'cta_contact') target.contact_clicks += 1
    if (eventType === 'cta_create_request') target.request_cta_clicks += 1
    if (eventType === 'cta_add_property') target.property_cta_clicks += 1
    if (eventType === 'request_created' || eventType === 'guest_request_created') target.requests_created += 1
    if (eventType === 'property_created') target.properties_created += 1

    const date = eventDate(row.created_at)
    if (date) {
      const key = `${date}::${variant}`
      if (!timeline.has(key)) {
        timeline.set(key, {
          date,
          variant,
          label: target.label,
          views: 0,
          clicks: 0,
          requests_created: 0,
          properties_created: 0,
        })
      }
      const day = timeline.get(key)
      if (eventType === 'header_menu_view') day.views += 1
      if (eventType === 'header_menu_click') day.clicks += 1
      if (eventType === 'request_created' || eventType === 'guest_request_created') day.requests_created += 1
      if (eventType === 'property_created') day.properties_created += 1
    }
  })

  previousEvents.forEach(row => {
    const target = previousByVariant.get(normalizeVariant(row.variant))
    if (!target) return
    if (row.event_type === 'header_menu_view') target.views += 1
    if (row.event_type === 'request_created' || row.event_type === 'guest_request_created') target.requests_created += 1
    if (row.event_type === 'property_created') target.properties_created += 1
  })

  const variants = HEADER_MENU_VARIANTS.map(v => {
    const row = byVariant.get(v.key) || { ...emptyHeaderVariant(v.key, v.label), __sessions: new Set() }
    const prev = previousByVariant.get(v.key) || {}
    row.unique_sessions = row.__sessions.size
    row.click_rate = parseFloat(rateFromViews(row.clicks, row.views).toFixed(2))
    row.request_rate = parseFloat(rateFromViews(row.requests_created, row.views).toFixed(2))
    row.property_rate = parseFloat(rateFromViews(row.properties_created, row.views).toFixed(2))
    row.previous_views = prev.views || 0
    row.previous_request_rate = parseFloat(rateFromViews(prev.requests_created || 0, prev.views || 0).toFixed(2))
    row.previous_property_rate = parseFloat(rateFromViews(prev.properties_created || 0, prev.views || 0).toFixed(2))
    delete row.__sessions
    return row
  })

  const timelineRows = Array.from(timeline.values())
    .map(row => ({
      ...row,
      click_rate: parseFloat(rateFromViews(row.clicks, row.views).toFixed(2)),
      request_rate: parseFloat(rateFromViews(row.requests_created, row.views).toFixed(2)),
      property_rate: parseFloat(rateFromViews(row.properties_created, row.views).toFixed(2)),
    }))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.variant || '').localeCompare(String(b.variant || '')))

  const totalViews = variants.reduce((sum, row) => sum + row.views, 0)
  const totalRequests = variants.reduce((sum, row) => sum + row.requests_created, 0)
  const totalProperties = variants.reduce((sum, row) => sum + row.properties_created, 0)
  const bestRequestVariant = variants
    .filter(row => row.views >= 20)
    .sort((a, b) => b.request_rate - a.request_rate)[0] || null
  const bestPropertyVariant = variants
    .filter(row => row.views >= 20)
    .sort((a, b) => b.property_rate - a.property_rate)[0] || null

  const recommendations = []
  if (totalViews === 0) {
    recommendations.push({
      type: 'neutral',
      title: 'Testul de header nu are inca expuneri',
      body: 'Verifica daca migrarea Supabase este rulata si daca switch-ul din /admin/pagini este activ. Evenimentul de baza este header_menu_view.',
    })
  } else {
    const control = variants.find(v => v.key === 'control')
    const intent = variants.find(v => v.key === 'simplu')
    if (control && intent && control.views > 0 && intent.views > 0) {
      const intentShare = intent.views / Math.max(totalViews, 1) * 100
      if (Math.abs(intentShare - 50) > 15 && totalViews >= 80) {
        recommendations.push({
          type: 'neutral',
          title: 'Distributia nu este inca aproape de 50/50',
          body: `Varianta pe intentie are ${intentShare.toFixed(0)}% din expuneri. Daca ramane asa dupa trafic suficient, reseteaza asignarile A/B din admin.`,
        })
      }
      if (intent.request_rate > control.request_rate && intent.views >= 20) {
        recommendations.push({
          type: 'positive',
          title: 'Meniul pe intentie pare mai bun pentru cereri',
          body: `Rata cereri: ${intent.request_rate.toFixed(1)}% vs ${control.request_rate.toFixed(1)}%. Pastreaza testul pana strange suficient trafic si urmareste si proprietatile create.`,
        })
      }
      if (intent.click_rate < control.click_rate && intent.views >= 20) {
        recommendations.push({
          type: 'negative',
          title: 'Varianta noua primeste mai putine clickuri in header',
          body: `CTR header: ${intent.click_rate.toFixed(1)}% vs ${control.click_rate.toFixed(1)}%. Verifica ordinea itemilor si claritatea primelor doua actiuni.`,
        })
      }
    }
    if (totalRequests === 0 && totalProperties === 0 && totalViews >= 50) {
      recommendations.push({
        type: 'neutral',
        title: 'Exista expuneri, dar inca nu conversii finale',
        body: 'Urmareste daca clickurile merg spre /vreau si /proprietati/nou. Conversiile finale se citesc din request_created, guest_request_created si property_created.',
      })
    }
  }

  return {
    schemaVersion: 1,
    variants,
    timeline: timelineRows,
    summary: {
      totalViews,
      totalClicks: variants.reduce((sum, row) => sum + row.clicks, 0),
      totalRequests,
      totalProperties,
      bestRequestVariant,
      bestPropertyVariant,
    },
    recommendations,
  }
}

async function fetchHeaderMenuAbAnalysis(currFrom, currTo, prevFrom, prevTo) {
  try {
    const testParams = new URLSearchParams()
    testParams.set('select', 'id,name,enabled,traffic_percent,traffic_percent_c,url_control,url_variant,url_variant_c,selected_conversions,created_at,updated_at')
    testParams.set('name', `eq.${HEADER_MENU_TEST_NAME}`)
    testParams.set('order', 'created_at.desc')
    testParams.set('limit', '1')
    const tests = await platformAbFetch('ab_tests', testParams)
    const test = tests[0] || null
    if (!test) {
      return {
        schemaVersion: 1,
        setupIssue: 'Testul Header main menu nu exista in Supabase HomePitch.',
        variants: HEADER_MENU_VARIANTS.map(v => emptyHeaderVariant(v.key, v.label)),
        timeline: [],
        recommendations: [{
          type: 'neutral',
          title: 'Lipseste testul Header main menu',
          body: 'Ruleaza migrarea Supabase pentru A/B testul de header sau activeaza switch-ul din /admin/pagini.',
        }],
      }
    }

    const fetchEvents = async (from, to) => {
      const params = new URLSearchParams()
      params.set('select', 'variant,event_type,session_id,user_id,metadata,created_at')
      params.set('ab_test_id', `eq.${test.id}`)
      params.set('created_at', `gte.${new Date(`${from}T00:00:00.000Z`).toISOString()}`)
      params.append('created_at', `lte.${new Date(`${to}T23:59:59.999Z`).toISOString()}`)
      params.set('order', 'created_at.asc')
      params.set('limit', '50000')
      return platformAbFetch('ab_test_events', params)
    }

    const [events, previousEvents] = await Promise.all([
      fetchEvents(currFrom, currTo),
      fetchEvents(prevFrom, prevTo),
    ])
    return {
      ...summarizeHeaderMenuEvents(events, previousEvents),
      test: {
        id: test.id,
        name: test.name,
        enabled: Boolean(test.enabled),
        traffic_percent: Number(test.traffic_percent || 0),
        traffic_percent_c: Number(test.traffic_percent_c || 0),
        updated_at: test.updated_at,
      },
    }
  } catch (error) {
    return {
      schemaVersion: 1,
      setupIssue: error.message,
      variants: HEADER_MENU_VARIANTS.map(v => emptyHeaderVariant(v.key, v.label)),
      timeline: [],
      recommendations: [{
        type: 'negative',
        title: 'Nu pot citi datele A/B pentru header',
        body: error.message,
      }],
    }
  }
}

async function attachHeaderMenuAbAnalysis(data, currFrom, currTo, prevFrom, prevTo) {
  data.headerMenuTest = await fetchHeaderMenuAbAnalysis(currFrom, currTo, prevFrom, prevTo)
  return data
}

function aggregateConciergeRows(rows = []) {
  const aggregate = (keyFn, seedFn) => {
    const groups = new Map()
    rows.forEach(row => {
      const key = keyFn(row)
      if (!key) return
      if (!groups.has(key)) groups.set(key, { ...seedFn(row), __rows: [] })
      const acc = groups.get(key)
      acc.screen_page_views = Number(acc.screen_page_views || 0) + Number(row.screen_page_views || 0)
      acc.active_users = Number(acc.active_users || 0) + Number(row.active_users || 0)
      acc.conversions = Number(acc.conversions || 0) + Number(row.conversions || 0)
      acc.__rows.push(row)
    })
    return Array.from(groups.values()).map(group => {
      const rowsForGroup = group.__rows || []
      group.bounce_rate = weightedMetric(rowsForGroup, 'bounce_rate')
      group.engagement_rate = weightedMetric(rowsForGroup, 'engagement_rate')
      group.average_session_duration = weightedMetric(rowsForGroup, 'average_session_duration')
      group.user_engagement_duration = weightedMetric(rowsForGroup, 'user_engagement_duration')
      group.conversion_rate = parseFloat(rateFromViews(group.conversions, group.screen_page_views).toFixed(2))
      delete group.__rows
      return group
    }).sort((a, b) => Number(b.screen_page_views || 0) - Number(a.screen_page_views || 0))
  }

  const referrers = aggregate(
    row => row.page_referrer || '(direct)',
    row => ({ page_referrer: row.page_referrer || '(direct)', screen_page_views: 0, active_users: 0, conversions: 0 })
  )
  const sources = aggregate(
    row => row.session_source_medium || row.session_default_channel_group || '(not set)',
    row => ({
      session_source_medium: row.session_source_medium || '(not set)',
      session_default_channel_group: row.session_default_channel_group || '(not set)',
      screen_page_views: 0,
      active_users: 0,
      conversions: 0,
    })
  )
  const devices = aggregate(
    row => row.device_category || '(not set)',
    row => ({ device_category: row.device_category || '(not set)', screen_page_views: 0, active_users: 0, conversions: 0 })
  )
  const timeline = aggregate(
    row => row.date,
    row => ({ date: row.date, screen_page_views: 0, active_users: 0, conversions: 0 })
  ).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))

  return { referrers, sources, devices, timeline }
}

function buildConciergeTrafficAnalysisFromPayloads(currentPayloads = [], previousPayloads = [], currentPages = null, previousPages = null) {
  const rows = currentPayloads.flatMap(payload => payload.conciergeTraffic?.rows || [])
  const previousRows = previousPayloads.flatMap(payload => payload.conciergeTraffic?.rows || [])
  const currPages = currentPages || aggregatePages(currentPayloads)
  const prevPages = previousPages || aggregatePages(previousPayloads)
  const page = pageRowFor(currPages, '/concierge') || {}
  const prevPage = pageRowFor(prevPages, '/concierge') || {}
  const views = Number(page.screen_page_views || rows.reduce((sum, row) => sum + Number(row.screen_page_views || 0), 0))
  const prevViews = Number(prevPage.screen_page_views || previousRows.reduce((sum, row) => sum + Number(row.screen_page_views || 0), 0))
  const conversions = Number(page.conversions || rows.reduce((sum, row) => sum + Number(row.conversions || 0), 0))
  const prevConversions = Number(prevPage.conversions || previousRows.reduce((sum, row) => sum + Number(row.conversions || 0), 0))
  const bounceRate = Number(page.bounce_rate || weightedMetric(rows, 'bounce_rate'))
  const avgDuration = Number(page.average_session_duration || weightedMetric(rows, 'average_session_duration'))
  const engagementRate = Number(page.engagement_rate || weightedMetric(rows, 'engagement_rate'))
  const aggregated = aggregateConciergeRows(rows)
  const conversionRate = rateFromViews(conversions, views)
  const prevConversionRate = rateFromViews(prevConversions, prevViews)
  const topReferrer = aggregated.referrers[0] || null
  const topSource = aggregated.sources[0] || null

  const recommendations = []
  if (views === 0) {
    recommendations.push({
      type: 'neutral',
      title: 'Nu exista trafic pe /concierge in interval',
      body: 'Leaga CTA-urile din /bravo, paginile de cereri si articolele de ghid catre /concierge cu UTM-uri separate.',
    })
  } else {
    if (conversionRate < 2) {
      recommendations.push({
        type: 'negative',
        title: 'Conversia /concierge este sub prag',
        body: `Conversie ${conversionRate.toFixed(1)}%. Pune zona de selectare servicii si total estimat mai sus, cu CTA portocaliu/verde clar.`,
      })
    }
    if (bounceRate >= 0.4) {
      recommendations.push({
        type: 'negative',
        title: 'Bounce ridicat pe /concierge',
        body: `Bounce ${Math.round(bounceRate * 100)}%. Simplifica primul ecran: 6 servicii, pret, CTA, apoi detalii in accordion.`,
      })
    }
    if (avgDuration < 35 && conversionRate < 5) {
      recommendations.push({
        type: 'neutral',
        title: 'Userii nu apuca sa inteleaga valoarea serviciilor',
        body: `Durata medie ${Math.round(avgDuration)}s. Adauga 1 rand sub headline cu promisiunea: "alegi servicii punctuale, platesti doar ce ai nevoie".`,
      })
    }
    if (topReferrer && topReferrer.page_referrer === '(direct)') {
      recommendations.push({
        type: 'info',
        title: 'Referrer direct dominant',
        body: 'Adauga UTM-uri pe CTA-urile interne catre /concierge ca sa vezi exact ce pagina produce intent comercial.',
      })
    }
    if (topSource) {
      recommendations.push({
        type: 'info',
        title: `Sursa principala: ${topSource.session_source_medium}`,
        body: `Are ${Number(topSource.screen_page_views || 0).toLocaleString('ro')} views si ${topSource.conversion_rate.toFixed(1)}% conversie. Scaleaza doar sursele cu intent peste medie.`,
      })
    }
  }

  return {
    schemaVersion: CONCIERGE_TRAFFIC_SCHEMA_VERSION,
    rows,
    summary: {
      views,
      previous_views: prevViews,
      active_users: Number(page.active_users || rows.reduce((sum, row) => sum + Number(row.active_users || 0), 0)),
      conversions,
      previous_conversions: prevConversions,
      conversion_rate: parseFloat(conversionRate.toFixed(2)),
      previous_conversion_rate: parseFloat(prevConversionRate.toFixed(2)),
      bounce_rate: bounceRate,
      engagement_rate: engagementRate,
      average_session_duration: avgDuration,
      estimated_bounces: Math.round(views * bounceRate),
    },
    ...aggregated,
    recommendations,
    notes: {
      conversion: 'Conversia foloseste metricul GA4 conversions pentru pagina /concierge. Pentru lead-uri reale, verifica si CRM Concierge.',
      referrer: 'Referrerul vine din GA4 pageReferrer; cand lipseste sau e direct, folosim "(direct)".',
    },
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

function attachHomepageVariantAnalysis(data) {
  if (!data.homepageVariants) {
    data.homepageVariants = buildHomepageVariantAnalysisFromPayloads([], [], data.pages?.current || [], data.pages?.previous || [])
  }
  return data
}

function attachConciergeTrafficAnalysis(data) {
  if (!data.conciergeTraffic?.summary) {
    const payload = { conciergeTraffic: data.conciergeTraffic || { rows: [] } }
    data.conciergeTraffic = buildConciergeTrafficAnalysisFromPayloads([payload], [], data.pages?.current || [], data.pages?.previous || [])
  }
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
    requestFormEvents: buildRequestFormEventsFromPayloads(currentPayloads),
    exitAnalysis: buildExitAnalysisFromPayloads(currentPayloads, currentPages),
    homepageVariants: buildHomepageVariantAnalysisFromPayloads(currentPayloads, previousPayloads, currentPages, previousPages),
    conciergeTraffic: buildConciergeTrafficAnalysisFromPayloads(currentPayloads, previousPayloads, currentPages, previousPages),
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
    ...missingRequestFormEventRanges(initialRows, rangeStart, rangeEnd),
    ...missingConciergeTrafficRanges(initialRows, rangeStart, rangeEnd),
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
  const requestFormEvents = data.requestFormEvents || {}
  const requestFormEventRows = requestFormEvents.rows || []
  const requestFormEventCounts = (requestFormEvents.events || []).reduce((acc, row) => {
    acc[row.event_name] = Number(row.event_count || 0)
    return acc
  }, {})
  const formStartedEvents = Number(requestFormEventCounts['[Amplitude] Form Started'] || 0)
  const formStepCompletedEvents = Number(requestFormEventCounts['Form Step Completed'] || 0)
  const formValidationErrorEvents = Number(requestFormEventCounts['Form Validation Error'] || 0)
  const formAbandonedEvents = Number(requestFormEventCounts['Form Abandoned'] || 0)
  const requestCreatedEvents = Number(requestFormEventCounts['Request Created'] || 0)
  const requestFormEventTotal = Number(requestFormEvents.totalEvents || 0)
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

  if (requestFormEventTotal > 0) {
    insights.push({
      type: formAbandonedEvents > 0 || formValidationErrorEvents > 0 ? 'negative' : 'positive',
      tag: 'FORM',
      title: `Funnel formular: ${requestFormEventTotal.toLocaleString('ro')} evenimente interne`,
      body: `${formStepCompletedEvents.toLocaleString('ro')} step completions, ${formValidationErrorEvents.toLocaleString('ro')} erori validare, ${formAbandonedEvents.toLocaleString('ro')} abandonuri si ${requestCreatedEvents.toLocaleString('ro')} Request Created.`,
    })
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

  if (requestFormEventTotal === 0) {
    actions.push({
      urgency:'urgent',
      title:'Tracking formular cerere: evenimentele intermediare nu apar in raport',
      body:'Dashboard-ul nu vede inca Form Step Completed, Form Validation Error, Form Abandoned sau Request Created in sursa de analytics. Funnel-ul ramane orb pe pasii formularului.',
      fix:'Verifica in Amplitude/GA4 DebugView ca evenimentele custom sunt trimise din /vreau. Daca raman doar in Amplitude, adauga export sau mirror catre GA4 pentru dashboard.',
    })
  } else if (formValidationErrorEvents > 0 || formAbandonedEvents > 0) {
    actions.push({
      urgency:'urgent',
      title:`Funnel formular: ${formValidationErrorEvents} erori si ${formAbandonedEvents} abandonuri`,
      body:'Exista semnal explicit ca userii se blocheaza in interiorul formularului, nu doar intre pagini.',
      fix:"Segmenteaza dupa step in Amplitude. Prioritizeaza primul pas cu validare blocanta si afiseaza fallback: 'Salveaza cererea si continui mai tarziu'.",
    })
  }

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
      requestFormEventTotal,
      formStartedEvents,
      formStepCompletedEvents,
      formValidationErrorEvents,
      formAbandonedEvents,
      requestCreatedEvents,
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
    requestFormEvents: snap.request_form_events || { schemaVersion: REQUEST_FORM_EVENTS_SCHEMA_VERSION, rows: [] },
    homepageVariants: snap.homepage_variants,
    conciergeTraffic: snap.concierge_traffic || { schemaVersion: CONCIERGE_TRAFFIC_SCHEMA_VERSION, rows: [] },
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
      attachHomepageVariantAnalysis(data)
      attachConciergeTrafficAnalysis(data)
      await attachHeaderMenuAbAnalysis(data, currFrom, currTo, prevFrom, prevTo)
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
          attachHomepageVariantAnalysis(built)
          attachConciergeTrafficAnalysis(built)
          await attachHeaderMenuAbAnalysis(built, currFrom, currTo, prevFrom, prevTo)
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
          attachHomepageVariantAnalysis(built)
          attachConciergeTrafficAnalysis(built)
          await attachHeaderMenuAbAnalysis(built, currFrom, currTo, prevFrom, prevTo)
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
    attachHomepageVariantAnalysis(data)
    attachConciergeTrafficAnalysis(data)
    await attachHeaderMenuAbAnalysis(data, currFrom, currTo, prevFrom, prevTo)
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
