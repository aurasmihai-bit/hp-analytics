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

function dateRange(days, now) {
  const currTo   = now.toISOString().slice(0,10)
  const currFrom = new Date(now - days * 864e5).toISOString().slice(0,10)
  const prevFrom = new Date(now - days * 2 * 864e5).toISOString().slice(0,10)
  const prevTo   = new Date(now - days * 864e5 - 864e5).toISOString().slice(0,10)
  return { currFrom, currTo, prevFrom, prevTo }
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

  const totalCereriNoi = tracking.reduce((s,d)=>s+(d.conversions_bravo_cerere_noua||0),0)
  const totalCump = tracking.reduce((s,d)=>s+(d.conversions_bun_venit_cumparator||0),0)
  const cereriConvRate = totalCump > 0 ? (totalCereriNoi/totalCump*100).toFixed(0) : null

  const sessD = dlt(totalSess, totalSessPrev)
  const convD = dlt(totalConv, totalConvPrev)

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
  if (totalCereriNoi > 0)
    insights.push({ type:'positive', title:`${totalCereriNoi} cereri noi adaugate (tracking activ din 28 apr)`, body:`${cereriConvRate ? cereriConvRate+'% din cumparatorii inregistrati adauga cerere. ' : ''}Ritm: ${(totalCereriNoi / Math.max(tracking.length, 1)).toFixed(2)}/zi.` })

  // /cereri/nou broken
  if (cereriNou && (cereriNou.conversions||0) === 0 && (cereriNou.screen_page_views||0) > 20)
    insights.push({ type:'negative', title:`/cereri/nou: ${cereriNou.screen_page_views} views, ${Math.round(cereriNou.average_session_duration||0)}s, 0 conversii — tracking broken`, body:'Key Event nesetat. Pierdere de date.' })

  // ── ACTIUNI ───────────────────────────────────────────────────────
  if (cereriNou && (cereriNou.conversions||0) === 0 && (cereriNou.screen_page_views||0) > 20)
    actions.push({ urgency:'urgent', title:`/cereri/nou: ${cereriNou.screen_page_views} views, 0 conversii — Key Event inca nesetat`, body:'Pierdere directa de date. Persista din saptamana anterioara.', fix:"Adauga la submit reusit pe /cereri/nou: gtag('event', 'conversions_bravo_cerere_noua', {page_source: 'cereri_nou'}). Verifica in GA4 DebugView. Durata: 5 minute." })

  if (funnelRate < 15)
    actions.push({ urgency:'urgent', title:`Funnel /cereri → formulare: ${funnelRate.toFixed(0)}% — CTA inline lipseste`, body:`${cereriViews.toLocaleString('ro')} vizite pe /cereri dar doar ${totalFormViews} (${funnelRate.toFixed(0)}%) ajung la formulare.`, fix:"Insereaza card dark-navy dupa pozitia 4 din gridul de cereri: 'Nu gasesti ce cauti? Descrie ce vrei — agentii activi iti trimit oferte in 24h'. Ascunde pentru agentii logati. Efort: 30 minute." })

  if (proprietati && (proprietati.screen_page_views||0) > 200 && (proprietati.conversions||0) === 0)
    actions.push({ urgency:'urgent', title:`/proprietati: ${(proprietati.screen_page_views||0).toLocaleString('ro')} views, 0 conversii, ${Math.round((proprietati.bounce_rate||0)*100)}% bounce`, body:'A doua pagina ca trafic fara niciun CTA activ.', fix:"Adauga CTA conditionat: Agent/Proprietar → 'Publica o proprietate' → /proprietati/nou. Cumparator → 'Adauga o cerere' → /vreau. Estimare: +50-100 conv/luna." })

  if (vreauR > 0 && ceNouR > 0 && vreauR > ceNouR * 2)
    actions.push({ urgency:'important', title:`/vreau (${vreauR.toFixed(1)}%) de ${(vreauR/Math.max(ceNouR,0.1)).toFixed(1)}x mai eficient decat /cerere-noua (${ceNouR.toFixed(1)}%)`, body:'Acelasi obiectiv, performante complet diferite.', fix:"Schimba destinatia butonului '+ Cerere noua' din /cereri catre /vreau. Masoara conv rate 14 zile." })

  if (!homepageGapClosed && h3r > hpr * 1.5 && (h3?.screen_page_views||0) > 20)
    actions.push({ urgency:'important', title:`/home3 (${h3r.toFixed(1)}%) inca mai bun decat homepage (${hpr.toFixed(1)}%)`, body:'Gap exista inca. Copiaza elementele diferite de pe /home3 pe /', fix:'Identifica ce e diferit pe /home3 vs /. Aplica pe homepage si monitorizeaza 14 zile.' })

  if (reset && (reset.engagement_rate||0) < 0.6 && (reset.screen_page_views||0) > 10)
    actions.push({ urgency:'important', title:`/resetare-parola — engagement ${Math.round((reset.engagement_rate||0)*100)}% (emailul imbunatatit, verifica daca bounce persista)`, body:'Am optimizat emailul de reset (expirare 30 min, CTA clar). Daca bounce-ul persista, problema e tehnica.', fix:'Testeaza manual: solicita reset > verifica inbox + spam > apasa link > confirma ca functioneaza. Verifica in Supabase Auth logs timpul de expirare.' })

  if (convD !== null && convD < -20)
    actions.push({ urgency:'urgent', title:`Conversii -${Math.abs(convD).toFixed(0)}% fata de perioada anterioara`, body:`${totalConv} conversii vs ${totalConvPrev}.`, fix:'Verifica GA4 pentru erori JS. Verifica /cerere-noua, /vreau si /home3.' })

  actions.push({ urgency:'seo', title:'SEO: pozitie medie 83 — creeaza continut pentru queries relevante', body:'HomePitch nu apare pe niciun query relevant. Prioritate: 3 pagini de continut in luna aceasta.', fix:"1) '/agenti-imobiliari-bucuresti' 2) '/cum-functioneaza' cu 800+ cuvinte 3) ghid 'Cum sa cumperi apartament in Romania 2025'. Fiecare pagina targeteaza si AI Search (ChatGPT, Perplexity)." })

  return {
    insights: insights.slice(0, 6),
    actions:  actions.slice(0, 7),
    generatedAt: new Date().toISOString(),
    summary: {
      totalSess, totalConv, totalSessPrev, totalConvPrev,
      socialConvR: parseFloat(socialConvR.toFixed(1)),
      vreauR: parseFloat(vreauR.toFixed(1)),
      ceNouR: parseFloat(ceNouR.toFixed(1)),
      hpr: parseFloat(hpr.toFixed(1)),
      h3r: parseFloat(h3r.toFixed(1)),
      funnelRate: parseFloat(funnelRate.toFixed(1)),
      totalCereriNoi, cereriConvRate,
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

  const x = r => r.status === 'fulfilled' ? (r.value||[]) : []
  const curr30 = x(r1), prev30 = x(r2)
  const pages30 = x(r3), pagesPrev = x(r4)
  const dailyCurr = x(r6).sort((a,b)=>a.date.localeCompare(b.date))
  const gscCurr = x(r7).sort((a,b)=>a.date.localeCompare(b.date))
  const gscPrev = x(r8)
  const ceNouDaily = x(r12).filter(d=>d.page_path==='/cerere-noua').sort((a,b)=>a.date.localeCompare(b.date))
  const cereriNouDaily = x(r13).filter(d=>d.page_path==='/cereri/nou').sort((a,b)=>a.date.localeCompare(b.date))
  const vreauDaily = x(r14).filter(d=>d.page_path==='/vreau').sort((a,b)=>a.date.localeCompare(b.date))
  const cerereTracking = x(r18).sort((a,b)=>a.date.localeCompare(b.date))

  const payload = {
    traffic:     { current: curr30, previous: subtractPrev(prev30.concat(curr30), curr30, 'session_default_channel_group') },
    pages:       { current: pages30, previous: pagesPrev },
    conversions: x(r5),
    daily:       { current: dailyCurr, byChannel: x(r11) },
    gsc:         { current: gscCurr, previous: gscPrev, queries: x(r9), pages: x(r10) },
    cererePages: {
      daily: { cerereNoua: ceNouDaily, cereriNou: cereriNouDaily, vreau: vreauDaily },
      byChannel: { cerereNoua: x(r15), cereriNou: x(r16), vreau: x(r17) },
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
    recommendations: snap.recommendations,
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
    days = parseInt(searchParams.get('days') || '30')
    ;({ currFrom, currTo, prevFrom, prevTo } = dateRange(days, now))
  }

  const label = `${new Date(currFrom).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})} – ${new Date(currTo).toLocaleDateString('ro-RO',{day:'numeric',month:'short',year:'numeric'})}`

  // ── 1. Try Supabase cache ────────────────────────────────────────
  if (!forceRefresh) {
    try {
      const snap = await getLatestSnapshot(days)
      if (snap && isFresh(snap)) {
        // Re-genereaza recomandari din datele din cache (dinamice la fiecare request)
        const built = buildResponse(snap, label, days, now)
        if (built.traffic && built.pages) {
          built.recommendations = generateRecommendations(built)
        }
        return NextResponse.json({ ...built, _source:'cache', _cachedAt: snap.synced_at })
      }
      // Cache vechi — returneaza dar cu warning
      if (snap) {
        const built = buildResponse(snap, label, days, now)
        if (built.traffic && built.pages) built.recommendations = generateRecommendations(built)
        return NextResponse.json({ ...built, _source:'stale_cache', _cachedAt: snap.synced_at, _warning:'Date din cache mai vechi de 6h' })
      }
    } catch (e) {
      console.warn('Supabase cache miss:', e.message)
    }
  }

  // ── 2. Fetch from Windsor ────────────────────────────────────────
  const syncStart = Date.now()
  try {
    const data = await fetchFromWindsor(currFrom, currTo, prevFrom, prevTo)

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
      await logSync({ period_days: days, date_from: currFrom, date_to: currTo, source:'windsor', status:'ok', rows_saved:1, duration_ms: Date.now()-syncStart })
    } catch (dbErr) {
      console.warn('Supabase write failed:', dbErr.message)
    }

    return NextResponse.json({ generatedAt: now.toISOString(), periodLabel: label, days, ...data, _source:'windsor' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
