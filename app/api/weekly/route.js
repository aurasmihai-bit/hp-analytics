import { NextResponse } from 'next/server'
import { getWeeklyReports, upsertWeeklyReport } from '../../lib/supabase'
import { getOptionalEnv, requireEnv } from '../../lib/env'
import { fetchWeeklyGa4Data } from '../../lib/ga4'
import { fetchGscSummary } from '../../lib/gsc'
import { fetchPlatformRequestStats } from '../../lib/platform'

const DEFAULT_GA4_ACCOUNT = '521779420'

function getGa4Account() {
  return getOptionalEnv('GA4_ACCOUNT_ID') || DEFAULT_GA4_ACCOUNT
}

async function w(fields, from, to, filters, account = getGa4Account()) {
  const params = new URLSearchParams({ api_key: requireEnv('WINDSOR_API_KEY'), date_from: from, date_to: to })
  if (account) params.set('accounts', account)
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
    throw new Error('Windsor returned no weekly analytics rows. Check WINDSOR_API_KEY, GA4_ACCOUNT_ID, GA4 access, and the requested week.')
  }
}

function numberValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + numberValue(row[field]), 0)
}

function getWeeklyTotals(data) {
  const traffic = data?.traffic || []
  const pages = data?.pages || []
  const tracking = data?.tracking || []
  const gsc = data?.gsc || {}
  const platformRequests = data?.platformRequests || {}
  return {
    sessions: sumField(traffic, 'sessions'),
    conversions: sumField(traffic, 'conversions'),
    newusers: sumField(traffic, 'newusers'),
    pageViews: sumField(pages, 'screen_page_views'),
    activeUsers: sumField(pages, 'active_users'),
    cereriNoi: sumField(tracking, 'conversions_bravo_cerere_noua'),
    platformCereriNoi: numberValue(platformRequests.count),
    gscClicks: numberValue(gsc.clicks),
    gscImpressions: numberValue(gsc.impressions),
  }
}

function hasUsefulWeeklyMetrics(data) {
  const totals = getWeeklyTotals(data)
  return Object.values(totals).some(value => value > 0)
}

function logWeeklyDataStats(start, end, data, source) {
  const traffic = data.traffic || []
  const pages = data.pages || []
  const tracking = data.tracking || []
  console.log('Weekly data stats', JSON.stringify({
    start,
    end,
    source,
    rows: {
      traffic: traffic.length,
      pages: pages.length,
      tracking: tracking.length,
    },
    keys: {
      traffic: Object.keys(traffic[0] || {}),
      pages: Object.keys(pages[0] || {}),
      tracking: Object.keys(tracking[0] || {}),
    },
    totals: getWeeklyTotals(data),
  }))
}

function parseLimit(value) {
  const raw = value || '12'
  if (!/^\d+$/.test(raw)) throw new Error('Invalid limit parameter')
  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1 || limit > 52) {
    throw new Error('limit must be between 1 and 52')
  }
  return limit
}

function parseOffsetWeeks(value) {
  const offset = Number(value || 0)
  if (!Number.isInteger(offset) || offset < 0 || offset > 260) {
    throw new Error('offsetWeeks must be an integer between 0 and 260')
  }
  return offset
}

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay() // 0=sun
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset - offsetWeeks * 7)
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0,10),
    end:   sunday.toISOString().slice(0,10),
  }
}

function hasValidCronAuth(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`
}

function hasValidSession(request) {
  const sessionSecret = process.env.SESSION_SECRET
  return !!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret
}

function normalizePath(path) {
  const clean = String(path || '').replace(/\/$/, '')
  return clean || '/'
}

function getCereriNoiCount(tracking, pages) {
  const keyEventTotal = sumField(tracking, 'conversions_bravo_cerere_noua')
  if (keyEventTotal > 0) return keyEventTotal

  const cererePaths = new Set(['/vreau'])
  return pages
    .filter(p => cererePaths.has(normalizePath(p.page_path)))
    .reduce((s, p) => s + numberValue(p.conversions), 0)
}

function getCereriNoiMetric(data, tracking, pages) {
  const platformCount = numberValue(data.platformRequests?.count)
  if (platformCount > 0) return platformCount
  return getCereriNoiCount(tracking, pages)
}

function extractMetrics(data) {
  const get = (arr, ch) => arr.find(r=>r.session_default_channel_group===ch) || {}
  const curr = data.traffic || []
  const pages = data.pages || []
  const tracking = data.tracking || []
  const gsc = data.gsc || {}

  const getPage = path => pages.find(p=>p.page_path===path)
  const metric = (row, field) => numberValue(row?.[field])
  const rate = p => metric(p, 'screen_page_views') > 0 ? +(metric(p, 'conversions')/metric(p, 'screen_page_views')*100).toFixed(2) : 0

  const cereri = getPage('/cereri')
  const ceNou  = getPage('/cerere-noua')
  const cereriNou = getPage('/cereri/nou')
  const vreau  = getPage('/vreau')
  const hp     = getPage('/')
  const h3     = getPage('/home3')

  const totalFormViews = metric(vreau, 'screen_page_views')
  const legacyFormViews = metric(ceNou, 'screen_page_views') + metric(cereriNou, 'screen_page_views')
  const cereriViews = metric(cereri, 'screen_page_views')
  const funnelRate = cereriViews > 0 ? +(totalFormViews/cereriViews*100).toFixed(2) : 0

  const direct = get(curr, 'Direct')
  const social = get(curr, 'Organic Social')
  const search = get(curr, 'Organic Search')

  return {
    sessions:      Math.round(sumField(curr,'sessions')),
    conversions:   Math.round(sumField(curr,'conversions')),
    new_users:     Math.round(sumField(curr,'newusers')),
    direct_sess:   Math.round(numberValue(direct.sessions)),
    direct_conv:   Math.round(numberValue(direct.conversions)),
    social_sess:   Math.round(numberValue(social.sessions)),
    social_conv:   Math.round(numberValue(social.conversions)),
    search_sess:   Math.round(numberValue(search.sessions)),
    search_conv:   Math.round(numberValue(search.conversions)),
    cereri_noi:    Math.round(getCereriNoiMetric(data, tracking, pages)),
    bun_venit_c:   Math.round(sumField(tracking,'conversions_bun_venit_cumparator')),
    bun_venit_a:   Math.round(sumField(tracking,'conversions_bun_venit_agent')),
    bun_venit_p:   Math.round(sumField(tracking,'conversions_bun_venit_proprietar')),
    gsc_clicks:    Math.round(numberValue(gsc.clicks)),
    gsc_impressions: Math.round(numberValue(gsc.impressions)),
    gsc_position:  gsc.position ? +gsc.position.toFixed(2) : null,
    homepage_rate: rate(hp),
    home3_rate:    rate(h3),
    vreau_rate:    rate(vreau),
    cereri_views:  cereriViews,
    form_views:    totalFormViews,
    legacy_form_views: legacyFormViews,
    funnel_rate:   funnelRate,
  }
}

function generateWeeklyInsights(curr, prev) {
  const pct = (c, p) => p > 0 ? +((c-p)/p*100).toFixed(1) : null
  const insights = []
  const actions  = []

  // Trafic
  const sessD = pct(curr.sessions, prev?.sessions)
  if (sessD !== null) {
    if (sessD > 15) insights.push({ type:'positive', title:`Trafic +${sessD}% vs saptamana anterioara`, body:`${curr.sessions.toLocaleString('ro')} sesiuni vs ${prev.sessions.toLocaleString('ro')}.` })
    else if (sessD < -15) insights.push({ type:'negative', title:`Trafic -${Math.abs(sessD)}% vs saptamana anterioara`, body:`${curr.sessions.toLocaleString('ro')} sesiuni vs ${prev.sessions.toLocaleString('ro')}. Investigheaza.` })
    else insights.push({ type:'neutral', title:`Trafic stabil — ${curr.sessions.toLocaleString('ro')} sesiuni`, body:`Variatie de ${Math.abs(sessD)}% vs saptamana anterioara.` })
  }

  // Social conv rate
  const socialR = curr.social_sess > 0 ? +(curr.social_conv/curr.social_sess*100).toFixed(1) : 0
  const directR = curr.direct_sess > 0 ? +(curr.direct_conv/curr.direct_sess*100).toFixed(1) : 0
  if (socialR > directR * 1.2) insights.push({ type:'info', tag:'CANAL', title:`Social: ${socialR}% conv rate vs Direct: ${directR}%`, body:`Social e de ${(socialR/Math.max(directR,0.1)).toFixed(1)}x mai eficient. Creste frecventa postari.` })

  // Cereri noi
  const cereriD = pct(curr.cereri_noi, prev?.cereri_noi)
  if (curr.cereri_noi > 0) {
    if (cereriD !== null && cereriD > 0) insights.push({ type:'positive', title:`Cereri noi +${cereriD}% — ${curr.cereri_noi} aceasta saptamana`, body:`vs ${prev?.cereri_noi||0} saptamana trecuta. Ritm in crestere.` })
    else insights.push({ type:'neutral', title:`${curr.cereri_noi} cereri noi adaugate`, body:`Target: 14/saptamana (2/zi). Ritm actual: ${(curr.cereri_noi/7).toFixed(1)}/zi.` })
  } else {
    insights.push({ type:'negative', title:'0 cereri noi saptamana aceasta', body:'Nicio cerere adaugata. Verifica tracking + CTA pe /cereri.' })
  }

  // Funnel
  if (curr.funnel_rate < 15) insights.push({ type:'negative', title:`Funnel /cereri → formulare: ${curr.funnel_rate}%`, body:`${curr.cereri_views.toLocaleString('ro')} views pe /cereri, doar ${curr.form_views} ajung la formulare. CTA inline lipseste.` })

  // Homepage rate
  if (curr.homepage_rate > 8) insights.push({ type:'positive', title:`Homepage: ${curr.homepage_rate}% conv rate — performanta excelenta`, body:'Peste target de 8%. Mentine.' })
  else if (curr.homepage_rate < 5) insights.push({ type:'negative', title:`Homepage: ${curr.homepage_rate}% conv rate sub asteptari`, body:'Target: 8%+. Verifica CTA-urile.' })

  if (curr.legacy_form_views > 20) insights.push({ type:'info', title:`${curr.legacy_form_views} views pe rute vechi de cerere`, body:'Fluxul activ este /vreau. Verifica redirect 301 si linkurile interne vechi.' })

  // Actiuni
  if (curr.cereri_noi < 2) actions.push({ urgency:'urgent', title:'Cereri noi sub 2 saptamana aceasta — verifica CTA pe /cereri', fix:'Insereaza card CTA dupa pozitia 4 din gridul de cereri.' })
  if (curr.funnel_rate < 10) actions.push({ urgency:'urgent', title:`Funnel /cereri: doar ${curr.funnel_rate}% progresie`, fix:'Card CTA inline dupa randul 2 din grid.' })
  if (curr.cereri_noi >= 0) actions.push({ urgency:'seo', title:'Creeaza o pagina de continut SEO luna aceasta', fix:"Prioritate: '/agenti-imobiliari-bucuresti' sau ghid 'Cum sa cumperi apartament Romania 2025'." })

  return { insights, actions }
}

// GET — cron zilnic luni SAU fetch istoricul
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const generate = searchParams.get('generate') === '1'
  const wantsHistory = searchParams.has('limit') && !generate
  const isCron = hasValidCronAuth(request)
  const hasSession = hasValidSession(request)

  if (!isCron && !hasSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Cron luni dimineata — genereaza automat raportul saptamanii trecute
  if ((isCron && !wantsHistory) || generate) {
    try {
      const { start, end } = getWeekBounds(1) // saptamana trecuta completa
      const result = await handleGenerate(start, end, request)
      return NextResponse.json({ ok: true, generated: true, weekStart: start, ...result })
    } catch(e) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Normal fetch — returneaza istoricul
  try {
    const limit = parseLimit(searchParams.get('limit'))
    const reports = await getWeeklyReports(limit)
    return NextResponse.json({ reports: reports || [] })
  } catch (e) {
    if (e.message?.startsWith('Invalid limit') || e.message?.startsWith('limit must')) {
      return NextResponse.json({ reports: [], error: e.message }, { status: 400 })
    }
    return NextResponse.json({ reports: [], error: e.message }, { status: 500 })
  }
}

async function fetchWeeklyData(start, end, account) {
  const [trafficR, pagesR, trackingR, gscR] = await Promise.allSettled([
    w(['session_default_channel_group','sessions','newusers','engagement_rate','average_session_duration','conversions'], start, end, null, account),
    w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','bounce_rate','conversions'], start, end, [['page_path','ncontains','/admin']], account),
    w(['date','conversions_bravo_cerere_noua','conversions_bun_venit_cumparator','conversions_bun_venit_agent','conversions_bun_venit_proprietar'], start, end, null, account),
    w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_average_position'], start, end, null, account),
  ])

  const traffic = settledRows(trafficR, 'Weekly traffic', true)
  const pages = settledRows(pagesR, 'Weekly pages', true)
  const tracking = settledRows(trackingR, 'Weekly tracking')
  const gscRaw = settledRows(gscR, 'Weekly GSC')
  assertHasWindsorRows([traffic, pages])
  const rawData = {
    traffic,
    pages,
    tracking,
    gsc: {
      clicks:      sumField(gscRaw,'organic_google_search_clicks'),
      impressions: sumField(gscRaw,'organic_google_search_impressions'),
      position:    gscRaw.length > 0 ? sumField(gscRaw,'organic_google_search_average_position')/gscRaw.length : null,
    },
  }
  return rawData
}

async function handleGenerate(start, end, request) {
  const configuredAccount = getGa4Account()
  let rawData
  try {
    rawData = await fetchWeeklyGa4Data({ propertyId: configuredAccount, start, end })
    logWeeklyDataStats(start, end, rawData, 'ga4-direct')
  } catch (ga4Err) {
    console.warn('Weekly GA4 direct fetch failed; using Windsor fallback:', ga4Err.message)
  }

  if (!hasUsefulWeeklyMetrics(rawData)) {
    let fallbackData = await fetchWeeklyData(start, end, configuredAccount)
    logWeeklyDataStats(start, end, fallbackData, configuredAccount ? 'windsor-configured-account' : 'windsor-all-accounts')
    if (hasUsefulWeeklyMetrics(fallbackData)) rawData = fallbackData
  }

  if (configuredAccount && !hasUsefulWeeklyMetrics(rawData)) {
    try {
      const fallbackData = await fetchWeeklyData(start, end, null)
      logWeeklyDataStats(start, end, fallbackData, 'windsor-all-accounts-fallback')
      if (hasUsefulWeeklyMetrics(fallbackData)) rawData = fallbackData
    } catch (e) {
      console.warn('Weekly all-accounts Windsor fallback failed:', e.message)
    }
  }

  if (!hasUsefulWeeklyMetrics(rawData)) {
    throw new Error('GA4 direct and Windsor fallback returned only zero weekly metrics. Check GA4_ACCOUNT_ID and GOOGLE_SERVICE_ACCOUNT_JSON before saving this weekly report.')
  }

  try {
    rawData.gsc = await fetchGscSummary({ start, end })
  } catch (e) {
    console.warn('Weekly Search Console direct fetch failed:', e.message)
  }

  try {
    rawData.platformRequests = await fetchPlatformRequestStats({ start, end })
    console.log('Weekly platform request stats', JSON.stringify(rawData.platformRequests))
  } catch (e) {
    console.warn('Weekly platform request stats failed:', e.message)
  }

  const metrics = extractMetrics(rawData)

  // Fetch saptamana anterioara pentru comparatie
  let prevMetrics = null
  try {
    const prevReports = await getWeeklyReports(2)
    const found = prevReports?.find(r => r.week_start !== start)
    if (found) prevMetrics = found
  } catch (e) {
    console.warn('Previous weekly report lookup failed:', e.message)
  }

  const { insights, actions } = generateWeeklyInsights(metrics, prevMetrics)

  const payload = {
    ...metrics,
    sessions_prev:   prevMetrics?.sessions || null,
    conv_prev:       prevMetrics?.conversions || null,
    cereri_noi_prev: prevMetrics?.cereri_noi || null,
    insights,
    actions,
    summary: {
      weekLabel: `${new Date(start).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${new Date(end).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}`,
      generatedAt: new Date().toISOString(),
    },
  }

  await upsertWeeklyReport(start, end, payload)
  return { metrics, insights, actions }
}

// POST — genereaza si salveaza raportul manual
export async function POST(request) {
  if (!hasValidSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  let offsetWeeks
  try {
    offsetWeeks = parseOffsetWeeks(body.offsetWeeks)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
  const { start, end } = getWeekBounds(offsetWeeks)

  try {
    const result = await handleGenerate(start, end, request)
    return NextResponse.json({ ok: true, weekStart: start, weekEnd: end, ...result })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
