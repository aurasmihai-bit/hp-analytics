import { NextResponse } from 'next/server'
import { getWeeklyReports, upsertWeeklyReport } from '../../lib/supabase'

const GA4 = '521779420'
const KEY  = process.env.WINDSOR_API_KEY || ''

async function w(fields, from, to, filters) {
  const params = new URLSearchParams({ api_key: KEY, accounts: GA4, date_from: from, date_to: to })
  params.set('fields', fields.join(','))
  if (filters) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`https://connectors.windsor.ai/googleanalytics4?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor ${res.status}`)
  const d = await res.json()
  return Array.isArray(d) ? d : (d.data || d.result || [])
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

function extractMetrics(data) {
  const sum = (arr, f) => arr.reduce((s,r) => s+(r[f]||0), 0)
  const get = (arr, ch) => arr.find(r=>r.session_default_channel_group===ch) || {}
  const curr = data.traffic || []
  const pages = data.pages || []
  const tracking = data.tracking || []
  const gsc = data.gsc || {}

  const getPage = path => pages.find(p=>p.page_path===path)
  const rate = p => p?.screen_page_views>0 ? +(p.conversions/p.screen_page_views*100).toFixed(2) : 0

  const cereri = getPage('/cereri')
  const ceNou  = getPage('/cerere-noua')
  const cereriNou = getPage('/cereri/nou')
  const vreau  = getPage('/vreau')
  const hp     = getPage('/')
  const h3     = getPage('/home3')

  const totalFormViews = (ceNou?.screen_page_views||0) + (vreau?.screen_page_views||0) + (cereriNou?.screen_page_views||0)
  const cereriViews = cereri?.screen_page_views || 0
  const funnelRate = cereriViews > 0 ? +(totalFormViews/cereriViews*100).toFixed(2) : 0

  const direct = get(curr, 'Direct')
  const social = get(curr, 'Organic Social')
  const search = get(curr, 'Organic Search')

  return {
    sessions:      Math.round(sum(curr,'sessions')),
    conversions:   Math.round(sum(curr,'conversions')),
    new_users:     Math.round(sum(curr,'newusers')),
    direct_sess:   Math.round(direct.sessions||0),
    direct_conv:   Math.round(direct.conversions||0),
    social_sess:   Math.round(social.sessions||0),
    social_conv:   Math.round(social.conversions||0),
    search_sess:   Math.round(search.sessions||0),
    search_conv:   Math.round(search.conversions||0),
    cereri_noi:    Math.round(sum(tracking,'conversions_bravo_cerere_noua')),
    bun_venit_c:   Math.round(sum(tracking,'conversions_bun_venit_cumparator')),
    bun_venit_a:   Math.round(sum(tracking,'conversions_bun_venit_agent')),
    bun_venit_p:   Math.round(sum(tracking,'conversions_bun_venit_proprietar')),
    gsc_clicks:    Math.round(gsc.clicks||0),
    gsc_impressions: Math.round(gsc.impressions||0),
    gsc_position:  gsc.position ? +gsc.position.toFixed(2) : null,
    homepage_rate: rate(hp),
    home3_rate:    rate(h3),
    vreau_rate:    rate(vreau),
    cenoua_rate:   rate(ceNou),
    cereri_views:  cereriViews,
    form_views:    totalFormViews,
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

  // /vreau vs /cerere-noua
  if (curr.vreau_rate > curr.cenoua_rate * 1.5) insights.push({ type:'info', title:`/vreau (${curr.vreau_rate}%) mult mai bun decat /cerere-noua (${curr.cenoua_rate}%)`, body:'Considera redirectul traficului spre /vreau.' })

  // Actiuni
  if (curr.cereri_noi < 2) actions.push({ urgency:'urgent', title:'Cereri noi sub 2 saptamana aceasta — verifica CTA pe /cereri', fix:'Insereaza card CTA dupa pozitia 4 din gridul de cereri.' })
  if (curr.funnel_rate < 10) actions.push({ urgency:'urgent', title:`Funnel /cereri: doar ${curr.funnel_rate}% progresie`, fix:'Card CTA inline dupa randul 2 din grid.' })
  if (curr.cereri_noi >= 0) actions.push({ urgency:'seo', title:'Creeaza o pagina de continut SEO luna aceasta', fix:"Prioritate: '/agenti-imobiliari-bucuresti' sau ghid 'Cum sa cumperi apartament Romania 2025'." })

  return { insights, actions }
}

// GET — cron zilnic luni SAU fetch istoricul
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '12')
  const generate = searchParams.get('generate') === '1'
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const hasSession = request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET

  // Cron luni dimineata — genereaza automat raportul saptamanii trecute
  if (isCron || generate) {
    if (!isCron && !hasSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
      const { start, end } = getWeekBounds(1) // saptamana trecuta completa
      const req = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
        body: JSON.stringify({ offsetWeeks: 1 }),
      })
      // Simuleaza POST intern
      const result = await handleGenerate(start, end, request)
      return NextResponse.json({ ok: true, generated: true, weekStart: start, ...result })
    } catch(e) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // Normal fetch — returneaza istoricul
  try {
    const reports = await getWeeklyReports(limit)
    return NextResponse.json({ reports: reports || [] })
  } catch (e) {
    return NextResponse.json({ reports: [], error: e.message })
  }
}

async function handleGenerate(start, end, request) {
  const [trafficR, pagesR, trackingR, gscR] = await Promise.allSettled([
    w(['session_default_channel_group','sessions','newusers','engagement_rate','average_session_duration','conversions'], start, end),
    w(['page_path','screen_page_views','active_users','engagement_rate','average_session_duration','bounce_rate','conversions'], start, end, [['page_path','ncontains','/admin']]),
    w(['date','conversions_bravo_cerere_noua','conversions_bun_venit_cumparator','conversions_bun_venit_agent','conversions_bun_venit_proprietar'], start, end),
    w(['organic_google_search_clicks','organic_google_search_impressions','organic_google_search_average_position'], start, end),
  ])

  const x = r => r.status === 'fulfilled' ? (r.value||[]) : []
  const gscRaw = x(gscR)
  const sumF = (arr, f) => arr.reduce((s,r) => s+(r[f]||0), 0)

  const rawData = {
    traffic:  x(trafficR),
    pages:    x(pagesR),
    tracking: x(trackingR),
    gsc: {
      clicks:      sumF(gscRaw,'organic_google_search_clicks'),
      impressions: sumF(gscRaw,'organic_google_search_impressions'),
      position:    gscRaw.length > 0 ? sumF(gscRaw,'organic_google_search_average_position')/gscRaw.length : null,
    },
  }

  const metrics = extractMetrics(rawData)

  // Fetch saptamana anterioara pentru comparatie
  let prevMetrics = null
  try {
    const prevReports = await getWeeklyReports(2)
    const prevWeek = getWeekBounds(1)
    const found = prevReports?.find(r => r.week_start !== start)
    if (found) prevMetrics = found
  } catch {}

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
  const isAuthorized = request.cookies.get('hp_session')?.value === process.env.SESSION_SECRET
  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const offsetWeeks = body.offsetWeeks || 0
  const { start, end } = getWeekBounds(offsetWeeks)

  try {
    const result = await handleGenerate(start, end, request)
    return NextResponse.json({ ok: true, weekStart: start, weekEnd: end, ...result })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
