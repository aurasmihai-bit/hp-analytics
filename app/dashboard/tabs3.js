'use client'
import { useEffect, useMemo, useState } from 'react'
import { C, sum, avg, dlt, fmt, fmtN, Delta, KPI, Signal, Sec, Grid, Card, LineChart, BarChart, PageLink } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'

const BACKLOG_STORE_KEY = 'hp_recommendation_backlog_v1'
const BACKLOG_STATUSES = [
  {id:'nou', label:'Nou', bg:C.softBlue, col:C.blue},
  {id:'in_lucru', label:'In lucru', bg:C.softAmber, col:C.amber},
  {id:'masurare', label:'Masurare', bg:C.softGreen, col:C.green},
  {id:'inchis', label:'Inchis', bg:C.softPanel, col:C.gray},
]
const BACKLOG_TYPES = {
  tracking: {label:'Bug tracking', owner:'Dev + Analytics', review:'7 zile', metric:'GA4 vs buyer_requests', col:C.red},
  growth: {label:'Growth experiments', owner:'Product/Growth', review:'14 zile', metric:'cereri si conv rate', col:C.blue},
  exit: {label:'Exit intent & funnel', owner:'Product/Growth', review:'7-14 zile', metric:'exit proxy si cereri', col:C.purple},
  traffic: {label:'Crestere trafic', owner:'Growth/Marketing', review:'14 zile', metric:'sesiuni si canal', col:C.teal},
  seo: {label:'SEO / Content', owner:'SEO/Content', review:'14-28 zile', metric:'impressions, clicks, pozitie', col:C.green},
  speed: {label:'Speed / UX', owner:'Dev + Product', review:'7 zile', metric:'bounce, durata, Web Vitals', col:C.amber},
}

function actionKey(action, index) {
  const base = String(action.title || action.fix || index)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${action.urgency || 'item'}-${base || index}`
}

function classifyAction(action) {
  const text = `${action.urgency || ''} ${action.title || ''} ${action.body || ''} ${action.fix || ''}`.toLowerCase()
  if (text.includes('exit') || text.includes('abandon') || text.includes('salveaza progres') || text.includes('fallback') || text.includes('modal')) return 'exit'
  if (text.includes('speed') || text.includes('web vitals') || text.includes('lcp') || text.includes('cls') || text.includes('inp') || text.includes('pagespeed')) return 'speed'
  if (text.includes('trafic') || text.includes('organic social') || text.includes('distributie') || text.includes('facebook groups') || text.includes('newsletter')) return 'traffic'
  if (text.includes('seo') || text.includes('gsc') || text.includes('query') || text.includes('search console')) return 'seo'
  if (text.includes('ga4') || text.includes('tracking') || text.includes('key event') || text.includes('resetare-parola') || text.includes('/cereri/nou')) return 'tracking'
  return 'growth'
}

function metricForAction(action, type, summary) {
  const title = String(action.title || '').toLowerCase()
  if (type === 'tracking') {
    const gap = Math.max(0, (summary.platformCereriNoi || 0) - (summary.trackingCereriNoi || 0))
    return gap > 0 ? `${gap} cereri neatribuite GA4` : BACKLOG_TYPES.tracking.metric
  }
  if (type === 'seo') {
    return summary.seoImpressions ? `${fmtN(summary.seoImpressions)} impressions` : BACKLOG_TYPES.seo.metric
  }
  if (type === 'exit') {
    if (summary.totalExitIntentEvents) return `${fmtN(summary.totalExitIntentEvents)} exit intent events`
    if (summary.topExitEstimatedExits) return `${fmtN(summary.topExitEstimatedExits)} exit proxy`
    return BACKLOG_TYPES.exit.metric
  }
  if (type === 'traffic') {
    return summary.topTrafficChannel ? `${summary.topTrafficChannel} · ${fmtN(summary.totalSess)} sesiuni` : BACKLOG_TYPES.traffic.metric
  }
  if (type === 'speed') {
    return summary.speedRiskPage ? `${summary.speedRiskPage} · ${summary.speedRiskBounce}% bounce` : BACKLOG_TYPES.speed.metric
  }
  if (title.includes('/vreau')) return '/vreau flux activ'
  if (title.includes('/cereri')) return `funnel ${summary.funnelRate || 0}%`
  if (title.includes('target cereri') || title.includes('cereri noi')) return `${summary.dailyRequestRate || 0}/${summary.requestDailyTarget || 2} cereri/zi`
  if (title.includes('cumparatorii fara cerere') || title.includes('cumparatori')) return `${summary.cereriConvRate || 0}% buyer→cerere`
  if (title.includes('cereri / sesiuni')) return `${summary.requestSessionRate || 0}% cereri/sesiuni`
  return BACKLOG_TYPES.growth.metric
}

function readBacklogStore() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(BACKLOG_STORE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeBacklogStore(next) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BACKLOG_STORE_KEY, JSON.stringify(next))
}

function stateTime(state) {
  const time = Date.parse(state?.updatedAt || '')
  return Number.isFinite(time) ? time : 0
}

function mergeBacklogStates(localState, cloudState) {
  const merged = {}
  const ids = new Set([...Object.keys(localState || {}), ...Object.keys(cloudState || {})])
  ids.forEach(id => {
    const local = localState?.[id]
    const cloud = cloudState?.[id]
    if (!local) merged[id] = cloud
    else if (!cloud) merged[id] = local
    else merged[id] = stateTime(local) > stateTime(cloud) ? local : cloud
  })
  return merged
}

function serializeBacklogState(state) {
  const sorted = {}
  Object.keys(state || {}).sort().forEach(id => {
    sorted[id] = state[id]
  })
  return JSON.stringify(sorted)
}

function backlogMetadata(item) {
  if (!item) return {}
  return {
    type: item.type,
    title: item.title,
    body: item.body,
    fix: item.fix,
    metric: item.metric,
    urgency: item.urgency,
  }
}

async function saveBacklogToCloud(items, stateMap) {
  const payloadItems = Object.entries(stateMap || {}).map(([id, state]) => {
    const item = items.find(i => i.id === id)
    return { id, state, metadata: backlogMetadata(item) }
  })
  if (!payloadItems.length) return {}

  const res = await fetch('/api/backlog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: payloadItems }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'Nu am putut salva backlog-ul in cloud.')
    error.setupRequired = !!data.setupRequired
    throw error
  }
  return data.items || {}
}

function verifyBacklogItem(item, summary) {
  const title = String(item.title || '').toLowerCase()
  const fix = String(item.fix || '').toLowerCase()
  const text = `${title} ${fix}`
  const platformCereri = Number(summary.platformCereriNoi || 0)
  const ga4Cereri = Number(summary.trackingCereriNoi || 0)
  const trackingCoverage = platformCereri > 0 ? ga4Cereri / platformCereri : ga4Cereri > 0 ? 1 : 0
  const funnelRate = Number(summary.funnelRate || 0)
  const vreauR = Number(summary.vreauR || 0)
  const dailyRequestRate = Number(summary.dailyRequestRate || 0)
  const requestDailyTarget = Number(summary.requestDailyTarget || 2)
  const requestSessionRate = Number(summary.requestSessionRate || 0)
  const requestSessionTargetRate = Number(summary.requestSessionTargetRate || 2)
  const buyerToRequestRate = Number(summary.cereriConvRate || 0)
  const buyerRequestTargetRate = Number(summary.buyerRequestTargetRate || 90)
  const seoPosition = Number(summary.seoAvgPosition || 0)
  const seoImpressions = Number(summary.seoImpressions || 0)
  const seoClicks = Number(summary.seoClicks || 0)
  const topExitRisk = Number(summary.topExitRisk || 0)
  const topExitEstimatedExits = Number(summary.topExitEstimatedExits || 0)
  const totalExitIntentEvents = Number(summary.totalExitIntentEvents || 0)
  const totalSess = Number(summary.totalSess || 0)
  const totalSessPrev = Number(summary.totalSessPrev || 0)
  const speedRiskPage = summary.speedRiskPage
  const speedRiskBounce = Number(summary.speedRiskBounce || 0)

  if (item.type === 'tracking' || text.includes('key event') || text.includes('ga4')) {
    if (platformCereri > 0 && trackingCoverage >= 0.8) {
      return {
        ok: true,
        title: 'Confirmat: GA4 acopera majoritatea cererilor reale',
        detail: `${ga4Cereri}/${platformCereri} cereri apar in GA4. Diferenta e in limita acceptabila pentru raportare.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: GA4 inca pierde cereri reale',
      detail: platformCereri > 0
        ? `Platforma are ${platformCereri} cereri, dar GA4 vede ${ga4Cereri}. Verifica eventul bravo_cerere_noua pe /vreau si payload-ul gtag.`
        : 'Nu exista inca destule cereri reale ca sa confirm verificarea. Ruleaza sync dupa ce apar cereri noi.',
      suggestions: ['Testeaza submit pe /vreau in GA4 DebugView.', 'Verifica daca eventul se trimite dupa raspunsul de succes din backend, nu doar la click.'],
    }
  }

  if (item.type === 'exit') {
    if (topExitRisk > 0 && topExitRisk < 8 && totalExitIntentEvents === 0) {
      return {
        ok: true,
        title: 'Confirmat: riscul de exit este sub prag',
        detail: `Top exit risk este ${topExitRisk.toFixed(1)}, fara evenimente explicite de exit intent in perioada curenta.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: exit intent ramane peste prag',
      detail: topExitEstimatedExits > 0
        ? `Top exit risk este ${topExitRisk.toFixed(1)} si exista ${topExitEstimatedExits} exit proxy. Evenimente explicite: ${totalExitIntentEvents}.`
        : `Evenimente explicite exit intent: ${totalExitIntentEvents}. Ai nevoie de inca o perioada de masurare dupa implementare.`,
      suggestions: ['Verifica daca modalul/fallback-ul apare doar pe intent real, nu imediat dupa intrarea in pagina.', 'Masoara click pe CTA-ul de salvare/continuare ca event separat.', 'Compara bounce si cereri noi dupa 7-14 zile.'],
    }
  }

  if (item.type === 'traffic') {
    if (totalSessPrev > 0 && totalSess >= totalSessPrev * 1.08) {
      return {
        ok: true,
        title: 'Confirmat: traficul a crescut fata de perioada anterioara',
        detail: `${totalSess.toLocaleString('ro')} sesiuni vs ${totalSessPrev.toLocaleString('ro')} anterior.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: traficul nu a crescut suficient',
      detail: totalSessPrev > 0
        ? `${totalSess.toLocaleString('ro')} sesiuni vs ${totalSessPrev.toLocaleString('ro')} anterior. Pragul de confirmare este +8%.`
        : 'Nu exista perioada anterioara suficienta pentru confirmare.',
      suggestions: ['Pastreaza UTM separat pentru fiecare canal testat.', 'Compara traficul pe canal, nu doar totalul.', 'Leaga campania de cereri noi, nu doar de sessions.'],
    }
  }

  if (item.type === 'speed') {
    if (!speedRiskPage) {
      return {
        ok: true,
        title: 'Confirmat: nu mai exista pagina cu proxy major de speed/UX',
        detail: 'Raportul nu mai gaseste o pagina cu volum relevant, bounce ridicat si durata scurta.',
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: exista inca risc speed/UX',
      detail: `${speedRiskPage} ramane pagina de risc, cu ${speedRiskBounce || 0}% bounce.`,
      suggestions: ['Ruleaza PageSpeed pe pagina indicata.', 'Verifica imagini above the fold si scripturi third-party.', 'Adauga eventuri Web Vitals pentru confirmare tehnica: LCP, CLS, INP.'],
    }
  }

  if (text.includes('/cereri') && text.includes('cta') && !text.includes('/cereri/nou')) {
    if (funnelRate >= 15) {
      return {
        ok: true,
        title: 'Confirmat: funnelul /cereri catre formular a trecut de 15%',
        detail: `Funnel curent: ${funnelRate.toFixed(1)}%.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: funnelul /cereri ramane sub prag',
      detail: `Funnel curent: ${funnelRate.toFixed(1)}%. Pragul minim pentru confirmare este 15%.`,
      suggestions: ['Verifica daca CTA-ul apare above the fold si dupa primele rezultate.', 'Masoara click pe CTA separat, nu doar vizita formular.'],
    }
  }

  if (text.includes('target cereri') || text.includes('2 cereri/zi')) {
    if (dailyRequestRate >= requestDailyTarget) {
      return {
        ok: true,
        title: 'Confirmat: ritmul de cereri a atins targetul',
        detail: `Ritm curent: ${dailyRequestRate.toFixed(2)} cereri/zi, target ${requestDailyTarget}/zi.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: ritmul de cereri este sub target',
      detail: `Ritm curent: ${dailyRequestRate.toFixed(2)} cereri/zi, target ${requestDailyTarget}/zi.`,
      suggestions: ['Verifica daca CTA-urile principale duc catre /vreau.', 'Masoara separat click_to_request_start si submit-ul final.', 'Ruleaza testul minim 14 zile sau pana ai 100+ sesiuni pe paginile cu CTA.'],
    }
  }

  if (text.includes('cumparatorii fara cerere') || (text.includes('cumparatori') && text.includes('cerere'))) {
    if (buyerToRequestRate >= buyerRequestTargetRate) {
      return {
        ok: true,
        title: 'Confirmat: rata cumparatori catre cerere a trecut pragul',
        detail: `Rata curenta: ${buyerToRequestRate.toFixed(0)}%, target ${buyerRequestTargetRate}%.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: cumparatorii inregistrati inca nu trimit destule cereri',
      detail: `Rata curenta: ${buyerToRequestRate.toFixed(0)}%, target ${buyerRequestTargetRate}%.`,
      suggestions: ['Redirect dupa signup direct catre /vreau cu date precompletate.', 'Trimite reminder la 15 minute pentru buyerii fara cerere.', 'Verifica daca formularul pastreaza progresul cand userul revine.'],
    }
  }

  if (text.includes('cereri / sesiuni')) {
    if (requestSessionRate >= requestSessionTargetRate) {
      return {
        ok: true,
        title: 'Confirmat: conversia sesiuni catre cereri a trecut pragul',
        detail: `Rata curenta: ${requestSessionRate.toFixed(2)}%, target ${requestSessionTargetRate}%.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: cererile raportate la sesiuni sunt sub prag',
      detail: `Rata curenta: ${requestSessionRate.toFixed(2)}%, target ${requestSessionTargetRate}%.`,
      suggestions: ['Verifica pozitia CTA-urilor catre /vreau pe paginile cu intent.', 'Masoara click_to_request_start separat de submit.', 'Compara rata pe mobile vs desktop inainte de urmatorul sprint.'],
    }
  }

  if (text.includes('/vreau') || text.includes('/cerere-noua')) {
    if (vreauR >= 3) {
      return {
        ok: true,
        title: 'Confirmat: /vreau ramane fluxul activ masurabil',
        detail: `/vreau are ${vreauR.toFixed(1)}% conv rate. Rutele vechi se folosesc doar ca audit/redirect.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: performanta /vreau nu a ajuns la prag',
      detail: `/vreau are ${vreauR.toFixed(1)}% conv rate. Pragul pentru confirmare este /vreau >= 3%.`,
      suggestions: ['Verifica daca butoanele principale trimit spre /vreau.', 'Pastreaza masurarea 14 zile sau pana ai minim 100 views pe ruta activa.'],
    }
  }

  if (item.type === 'seo') {
    if (seoPosition > 0 && seoPosition <= 3 && seoClicks > 0) {
      return {
        ok: true,
        title: 'Confirmat: query-ul SEO a ajuns in top 3',
        detail: `Pozitie medie ${seoPosition.toFixed(1)}, ${seoClicks} clicks, ${seoImpressions} impressions.`,
      }
    }
    return {
      ok: false,
      title: 'Nu e confirmat: SEO are nevoie de mai mult progres',
      detail: seoImpressions > 0
        ? `Pozitie medie curenta ${seoPosition ? seoPosition.toFixed(1) : '—'}, ${seoClicks} clicks, ${seoImpressions} impressions. Confirmarea cere top 3 si clicks masurabile.`
        : 'Nu exista impressions suficiente in GSC pentru verificare.',
      suggestions: ['Verifica pagina asociata query-ului in GSC > Queries > Pages.', 'Asteapta 14-28 zile dupa publicarea modificarilor si re-ruleaza sync.'],
    }
  }

  return {
    ok: false,
    title: 'Nu pot confirma automat aceasta recomandare',
    detail: 'Recomandarea nu are inca o regula de verificare clara in dashboard.',
    suggestions: ['Defineste un KPI de confirmare: cereri, conv rate, CTR, pozitie SEO sau coverage GA4.'],
  }
}

function BacklogCard({ item, state, onChange, onVerify }) {
  const meta = BACKLOG_TYPES[item.type]
  const status = BACKLOG_STATUSES.find(s => s.id === (state.status || 'nou')) || BACKLOG_STATUSES[0]
  const owner = state.owner || meta.owner
  const ignored = !!state.ignored
  const verification = state.verification
  const verifyOk = verification?.ok === true
  return (
    <div style={{background:C.card,border:`0.5px solid ${verifyOk?C.green:verification&&!verifyOk?C.red:C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:10,opacity:ignored?0.58:1}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:99,background:status.bg,color:status.col,flexShrink:0}}>{status.label}</span>
        <span style={{fontSize:13,fontWeight:600,color:ignored?C.hint:C.text,lineHeight:1.35,flex:1,textDecoration:ignored?'line-through':'none'}}>{item.title}</span>
      </div>
      {item.body && <p style={{fontSize:12,color:C.muted,lineHeight:1.5,margin:'0 0 10px',textDecoration:ignored?'line-through':'none'}}>{item.body}</p>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        <label style={{display:'block'}}>
          <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:3,textTransform:'uppercase',letterSpacing:'.04em'}}>Status</span>
          <select value={state.status || 'nou'} onChange={e=>onChange(item.id,{status:e.target.value},item)} style={{width:'100%',padding:'6px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg,fontFamily:'inherit'}}>
            {BACKLOG_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label style={{display:'block'}}>
          <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:3,textTransform:'uppercase',letterSpacing:'.04em'}}>Owner</span>
          <input value={owner} onChange={e=>onChange(item.id,{owner:e.target.value},item)} style={{width:'100%',boxSizing:'border-box',padding:'6px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg,fontFamily:'inherit'}}/>
        </label>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        <button onClick={()=>onVerify(item)} disabled={ignored} style={{
          padding:'6px 10px',fontSize:11,fontWeight:600,borderRadius:7,cursor:ignored?'not-allowed':'pointer',
          border:`0.5px solid ${verifyOk?C.green:C.border}`,
          background:verifyOk?C.softGreen:C.input,color:verifyOk?C.green:C.text,fontFamily:'inherit'
        }}>{verifyOk ? '✓ Implementat confirmat' : 'Am implementat'}</button>
        <button onClick={()=>onChange(item.id,{ignored:!ignored},item)} style={{
          padding:'6px 10px',fontSize:11,fontWeight:600,borderRadius:7,cursor:'pointer',
          border:`0.5px solid ${ignored?C.gray:C.border}`,
          background:ignored?C.softPanel:C.input,color:ignored?C.gray:C.muted,fontFamily:'inherit'
        }}>{ignored ? 'Reactiveaza' : 'Ignora recomandarea'}</button>
      </div>
      {verification && (
        <div style={{background:verifyOk?C.softGreen:C.softRed,border:`0.5px solid ${verifyOk?C.green:C.red}`,borderRadius:8,padding:'9px 10px',marginBottom:10}}>
          <p style={{fontSize:12,fontWeight:700,color:verifyOk?C.green:C.red,margin:'0 0 4px'}}>{verification.title}</p>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:0}}>{verification.detail}</p>
          {!verifyOk && verification.suggestions?.length > 0 && (
            <ul style={{margin:'7px 0 0 18px',padding:0,color:C.muted,fontSize:12,lineHeight:1.45}}>
              {verification.suggestions.map((suggestion,i)=><li key={i}>{suggestion}</li>)}
            </ul>
          )}
          {verification.checkedAt && <p style={{fontSize:10,color:C.hint,margin:'7px 0 0'}}>Verificat: {new Date(verification.checkedAt).toLocaleString('ro-RO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
        <div style={{background:C.softPanel,borderRadius:7,padding:'7px 8px'}}>
          <p style={{fontSize:10,color:C.hint,margin:'0 0 2px'}}>Metric</p>
          <p style={{fontSize:12,fontWeight:500,color:meta.col,margin:0}}>{item.metric}</p>
        </div>
        <div style={{background:C.softPanel,borderRadius:7,padding:'7px 8px'}}>
          <p style={{fontSize:10,color:C.hint,margin:'0 0 2px'}}>Review</p>
          <p style={{fontSize:12,fontWeight:500,color:C.text,margin:0}}>{meta.review}</p>
        </div>
      </div>
      {item.fix && (
        <div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:9}}>
          <p style={{fontSize:10,fontWeight:600,color:C.green,margin:'0 0 3px'}}>Actiune concreta</p>
          <p style={{fontSize:12,color:ignored?C.hint:C.text,lineHeight:1.45,margin:0,textDecoration:ignored?'line-through':'none'}}>{item.fix}</p>
        </div>
      )}
      {state.updatedAt && <p style={{fontSize:10,color:C.hint,margin:'8px 0 0'}}>Actualizat: {new Date(state.updatedAt).toLocaleString('ro-RO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>}
    </div>
  )
}

/* ─── RECOMANDARI ──────────────────────────────────────────────────── */
function TabRecomandari({ data, onRegenerate, regenerating }) {
  const rec = data.recommendations || {}
  const insights = rec.insights || []
  const actions  = rec.actions  || []
  const s = rec.summary || {}
  const generatedAt = rec.generatedAt
  const cereriLabel = s.cereriSource === 'platform' ? 'cereri noi reale' : 'cereri noi trackate'
  const backlogItems = useMemo(() => actions.map((action, index) => {
    const type = classifyAction(action)
    return {
      ...action,
      id: actionKey(action, index),
      type,
      metric: metricForAction(action, type, s),
    }
  }), [actions, s])
  const [backlogState, setBacklogState] = useState({})
  const [cloudState, setCloudState] = useState({ status:'loading', message:'Se incarca backlog-ul cloud' })

  useEffect(() => {
    let cancelled = false

    async function loadBacklog() {
      const localState = readBacklogStore()
      setBacklogState(localState)

      try {
        const res = await fetch('/api/backlog', { cache:'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const error = new Error(data.error || 'Backlog cloud indisponibil')
          error.setupRequired = !!data.setupRequired
          throw error
        }

        const remoteState = data.items || {}
        const merged = mergeBacklogStates(localState, remoteState)
        if (cancelled) return

        setBacklogState(merged)
        writeBacklogStore(merged)
        setCloudState({ status:'synced', message:'Backlog sincronizat in cloud' })

        if (serializeBacklogState(merged) !== serializeBacklogState(remoteState)) {
          await saveBacklogToCloud(backlogItems, merged)
          if (!cancelled) setCloudState({ status:'synced', message:'Backlog local migrat in cloud' })
        }
      } catch (error) {
        if (!cancelled) {
          setCloudState({
            status: error.setupRequired ? 'setup' : 'local',
            message: error.setupRequired ? 'Tabela cloud lipseste' : 'Backlog salvat local pana revine cloud-ul',
          })
        }
      }
    }

    loadBacklog()
    return () => { cancelled = true }
  }, [backlogItems])

  async function persistBacklogChange(item, nextItemState) {
    setCloudState({ status:'saving', message:'Se salveaza in cloud' })
    try {
      await saveBacklogToCloud([item], { [item.id]: nextItemState })
      setCloudState({ status:'synced', message:'Backlog sincronizat in cloud' })
    } catch (error) {
      setCloudState({
        status: error.setupRequired ? 'setup' : 'local',
        message: error.setupRequired ? 'Tabela cloud lipseste' : 'Backlog salvat local; cloud indisponibil',
      })
    }
  }

  function updateBacklogItem(id, patch, item) {
    const nextItemState = {
      ...(backlogState[id] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    const next = {
      ...backlogState,
      [id]: nextItemState,
    }
    setBacklogState(next)
    writeBacklogStore(next)
    if (item) {
      persistBacklogChange(item, nextItemState)
    } else {
      setCloudState({
        status:'local',
        message:'Backlog salvat local; lipseste itemul pentru sincronizare',
      })
    }
  }

  function cloudBadge() {
    const config = {
      loading: { label:'Cloud...', bg:C.softBlue, col:C.blue },
      saving: { label:'Se salveaza', bg:C.softAmber, col:C.amber },
      synced: { label:'Cloud sync', bg:C.softGreen, col:C.green },
      setup: { label:'Cloud setup', bg:C.softRed, col:C.red },
      local: { label:'Local fallback', bg:C.softPanel, col:C.gray },
    }[cloudState.status] || { label:'Backlog', bg:C.softPanel, col:C.gray }
    return {
      ...config,
      title: cloudState.message,
    }
  }

  function cloudNotice() {
    if (cloudState.status !== 'setup' && cloudState.status !== 'local') return null
    return (
      <div style={{background:cloudState.status==='setup'?C.softRed:C.softAmber,border:`0.5px solid ${cloudState.status==='setup'?C.red:C.amber}`,borderRadius:10,padding:'10px 12px',marginBottom:12}}>
        <p style={{fontSize:12,fontWeight:700,color:cloudState.status==='setup'?C.red:C.amber,margin:'0 0 3px'}}>{cloudState.message}</p>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:0}}>
          Statusurile raman disponibile pe acest device. Dupa aplicarea tabelei `hp_action_backlog`, ele se sincronizeaza automat in Supabase.
        </p>
      </div>
    )
  }

  function handleVerifyItem(item) {
    const result = verifyBacklogItem(item, s)
    updateBacklogItem(item.id, {
      verification: {
        ...result,
        checkedAt: new Date().toISOString(),
      },
      ...(result.ok ? { status:'masurare' } : {}),
    }, item)
  }

  const backlogCloudBadge = cloudBadge()

  if (!insights.length && !actions.length) {
    return (
      <div style={{textAlign:"center",padding:"60px 20px",color:C.hint}}>
        <p style={{fontSize:14,marginBottom:8}}>Recomandarile se genereaza la urmatorul sync.</p>
        <p style={{fontSize:12}}>Poti genera recomandari noi din datele recente salvate in baza de date.</p>
        {onRegenerate && (
          <button onClick={onRegenerate} disabled={regenerating} style={{marginTop:14,padding:'9px 13px',border:'none',borderRadius:8,background:regenerating?C.gray:C.green,color:'#fff',fontSize:12,fontWeight:700,cursor:regenerating?'not-allowed':'pointer'}}>
            {regenerating ? 'Se genereaza...' : 'Genereaza recomandari noi'}
          </button>
        )}
      </div>
    )
  }
  const fmtDate = d => d ? new Date(d).toLocaleString("ro-RO",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}) : "—"
  const trackingGap = Math.max(0, (s.platformCereriNoi || 0) - (s.trackingCereriNoi || 0))
  const impactItems = [
    {label:"Target cereri/zi", est:(s.dailyRequestRate || 0) >= (s.requestDailyTarget || 2) ? `${s.dailyRequestRate}/zi atins` : `${s.dailyRequestRate || 0}/${s.requestDailyTarget || 2}/zi`, col:(s.dailyRequestRate || 0) >= (s.requestDailyTarget || 2) ? C.green : C.amber},
    {label:"Cumparatori → cerere", est:s.cereriConvRate ? `${s.cereriConvRate}% vs target ${s.buyerRequestTargetRate || 90}%` : "date insuficiente", col:Number(s.cereriConvRate || 0) >= (s.buyerRequestTargetRate || 90) ? C.green : C.amber},
    trackingGap > 0
      ? {label:"GA4 vs platforma", est:trackingGap + " cereri neatribuite GA4", col:C.red}
      : {label:"Tracking cereri", est:(s.trackingCereriNoi || 0) + " cereri in GA4", col:(s.trackingCereriNoi || 0)>0?C.green:C.hint},
    {label:"CTA inline pe /cereri", est:(s.funnelRate || 0) < 15 ? "ridica funnelul peste 15%" : "optimizare marginala", col:(s.funnelRate || 0) < 15 ? C.amber : C.green},
    {label:"Exit intent", est:(s.totalExitIntentEvents || 0) > 0 ? fmtN(s.totalExitIntentEvents) + " events" : (s.topExitEstimatedExits || 0) > 0 ? fmtN(s.topExitEstimatedExits) + " exit proxy" : "risc redus", col:(s.totalExitIntentEvents || 0) > 0 || (s.topExitRisk || 0) >= 12 ? C.red : C.green},
    {label:"Funnel formular", est:(s.requestFormEventTotal || 0) > 0 ? `${fmtN(s.formStepCompletedEvents || 0)} pasi · ${fmtN(s.formAbandonedEvents || 0)} abandon` : "evenimente lipsa", col:(s.requestFormEventTotal || 0) > 0 ? C.blue : C.amber},
    {label:"SEO Search Console", est:(s.seoImpressions || 0) > 0 ? fmtN(s.seoImpressions) + " impressions validate" : "date insuficiente", col:(s.seoImpressions || 0) > 0 ? C.green : C.hint},
    {label:"Speed / UX", est:s.speedRiskPage ? s.speedRiskPage + " · " + (s.speedRiskBounce || 0) + "% bounce" : "fara proxy major", col:s.speedRiskPage ? C.amber : C.green},
    {label:"Canal performant", est:(s.socialConvR || 0) > 0 ? "Social " + s.socialConvR + "% conv" : "testeaza canal nou", col:(s.socialConvR || 0) > 10 ? C.green : C.blue},
  ]
  const openItems = backlogItems.filter(item => (backlogState[item.id]?.status || 'nou') !== 'inchis').length
  const measuringItems = backlogItems.filter(item => backlogState[item.id]?.status === 'masurare').length

  return (
    <div>
      <div style={{background:"linear-gradient(135deg,#1A2B4A 0%,#2d4a7a 100%)",borderRadius:12,padding:"18px 22px",marginBottom:20,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:"rgba(255,255,255,.55)",margin:"0 0 4px"}}>Actualizate la incarcare si la sync</p>
            <h2 style={{fontSize:17,fontWeight:500,margin:"0 0 4px"}}>Recomandari bazate pe date reale</h2>
            <p style={{fontSize:12,color:"rgba(255,255,255,.65)",margin:0}}>
              {fmtN(s.totalSess)} sesiuni · Conv rate: {s.totalSess>0?(s.totalConv/s.totalSess*100).toFixed(1):"0"}%
              {s.totalCereriNoi > 0 && " · " + s.totalCereriNoi + " " + cereriLabel}
            </p>
          </div>
          <div style={{display:'grid',gap:8,justifyItems:'end',flexShrink:0}}>
            {generatedAt && (
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,.4)",margin:"0 0 2px"}}>Ultima generare</p>
                <p style={{fontSize:11,color:"rgba(255,255,255,.7)",margin:0}}>{fmtDate(generatedAt)}</p>
              </div>
            )}
            {onRegenerate && (
              <button onClick={onRegenerate} disabled={regenerating} title="Recalculeaza recomandarile din datele recente din baza de date si reimprospateaza ziua curenta" style={{
                padding:'8px 11px',border:'0.5px solid rgba(255,255,255,.28)',borderRadius:8,
                background:regenerating?'rgba(255,255,255,.12)':'rgba(255,255,255,.18)',
                color:'#fff',fontSize:12,fontWeight:700,cursor:regenerating?'not-allowed':'pointer',
                boxShadow:'0 8px 18px rgba(0,0,0,.12)'
              }}>
                {regenerating ? 'Se genereaza...' : 'Genereaza recomandari noi'}
              </button>
            )}
          </div>
        </div>
        {s.totalSess > 0 && (
          <div style={{display:"flex",gap:16,marginTop:14,paddingTop:12,borderTop:"0.5px solid rgba(255,255,255,.15)",flexWrap:"wrap"}}>
            {[
              {l:"Social conv rate", v:s.socialConvR+"%", highlight: s.socialConvR > 25},
              {l:"/vreau conv rate",  v:s.vreauR+"%",     highlight: s.vreauR > 3},
              {l:"Buyer → cerere",    v:(s.cereriConvRate || 0)+"%", highlight: Number(s.cereriConvRate || 0) >= (s.buyerRequestTargetRate || 90)},
              {l:"Cereri / zi",       v:(s.dailyRequestRate || 0), highlight: Number(s.dailyRequestRate || 0) >= (s.requestDailyTarget || 2)},
              {l:"Homepage rate",    v:s.hpr+"%",         highlight: false},
              {l:"Funnel /cereri",   v:s.funnelRate+"%",  highlight: s.funnelRate > 15},
            ].map(i=>(
              <div key={i.l} style={{minWidth:80}}>
                <p style={{fontSize:10,color:"rgba(255,255,255,.45)",margin:"0 0 1px"}}>{i.l}</p>
                <p style={{fontSize:16,fontWeight:600,color:i.highlight?"#86EFAC":"#fff",margin:0}}>{i.v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sec title={insights.length + " semnale identificate"}>
        {insights.map((s,i) => <Signal key={i} {...s}/>)}
      </Sec>

      <Sec title={`Backlog recomandari (${openItems} active)`}
        right={
          <div style={{display:"flex",gap:5,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <span title={backlogCloudBadge.title} style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:backlogCloudBadge.bg,color:backlogCloudBadge.col,fontWeight:600}}>
              {backlogCloudBadge.label}
            </span>
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:C.softBlue,color:C.blue,fontWeight:600}}>
              {backlogItems.length} total
            </span>
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:C.softGreen,color:C.green,fontWeight:600}}>
              {measuringItems} in masurare
            </span>
          </div>
        }>
        {cloudNotice()}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,alignItems:'start'}}>
          {Object.entries(BACKLOG_TYPES).map(([type, meta]) => {
            const items = backlogItems.filter(item => item.type === type)
            return (
              <div key={type}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:meta.col,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:C.text}}>{meta.label}</span>
                  <span style={{fontSize:11,color:C.hint}}>{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div style={{border:`0.5px dashed ${C.border}`,borderRadius:10,padding:'16px 12px',fontSize:12,color:C.hint,textAlign:'center'}}>Niciun item</div>
                ) : (
                  items.map(item => (
                    <BacklogCard
                      key={item.id}
                      item={item}
                      state={backlogState[item.id] || {}}
                      onChange={updateBacklogItem}
                      onVerify={handleVerifyItem}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      </Sec>

      <Sec title="Estimare impact">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          {impactItems.map(i=>(
            <div key={i.label} style={{background:C.card,border:"0.5px solid "+C.border,borderRadius:10,padding:"12px 14px"}}>
              <p style={{fontSize:11,color:C.hint,margin:"0 0 4px"}}>{i.label}</p>
              <p style={{fontSize:13,fontWeight:500,color:i.col,margin:0}}>{i.est}</p>
            </div>
          ))}
        </div>
      </Sec>
    </div>
  )
}



/* ─── CERERE NOUA — COMPARATIE ─────────────────────────────────────── */
function TabCerereNoua({ data }) {
  const pages = data.pages.current
  const cp = data.cererePages || {}
  const daily = cp.daily || {}
  const byCh  = cp.byChannel || {}

  // Aggregate totals for each path
  const paths = CERERE_PAGES.map(p => {
    const pg = pages.find(x => x.page_path === p.path)
    const d  = {
      cerereNoua: daily.cerereNoua || [],
      cereriNou:  daily.cereriNou  || [],
      vreau:      daily.vreau      || [],
    }[p.path === '/cerere-noua' ? 'cerereNoua' : p.path === '/cereri/nou' ? 'cereriNou' : 'vreau']
    const ch = {
      cerereNoua: byCh.cerereNoua || [],
      cereriNou:  byCh.cereriNou  || [],
      vreau:      byCh.vreau      || [],
    }[p.path === '/cerere-noua' ? 'cerereNoua' : p.path === '/cereri/nou' ? 'cereriNou' : 'vreau']
    const views = pg?.screen_page_views || sum(d,'screen_page_views')
    const conv  = pg?.conversions       || sum(d,'conversions')
    const eng   = pg?.engagement_rate   || 0
    const dur   = pg?.average_session_duration || 0
    const users = pg?.active_users || 0
    const convRate = views > 0 ? conv/views*100 : 0
    return { ...p, views, conv, eng, dur, users, convRate, daily: d, byChannel: ch }
  })

  const maxViews = Math.max(...paths.map(p=>p.views), 1)
  const totalViews = paths.reduce((s,p)=>s+p.views, 0)
  const totalConv  = paths.reduce((s,p)=>s+p.conv, 0)
  const activePath = paths.find(p => p.path === '/vreau') || paths[2]
  const legacyPaths = paths.filter(p => p.path !== '/vreau')
  const legacyViews = legacyPaths.reduce((s, p) => s + p.views, 0)
  const activeConvRate = activePath.views > 0 ? activePath.conv / activePath.views * 100 : 0

  // Build unified daily chart — align dates
  const allDates = [...new Set([
    ...paths[0].daily.map(d=>d.date),
    ...paths[1].daily.map(d=>d.date),
    ...paths[2].daily.map(d=>d.date),
  ])].sort()

  const chartData = allDates.map(date => {
    const row = { date }
    paths.forEach((p,i) => {
      const key = ['cerereNoua','cereriNou','vreau'][i]
      const found = p.daily.find(d=>d.date===date)
      row[`views_${i}`]  = found?.screen_page_views || 0
      row[`conv_${i}`]   = found?.conversions       || 0
    })
    return row
  })

  const [chartMode, setChartMode] = useState('views')

  return (
    <div>
      {/* Intro */}
      <div style={{background:'linear-gradient(135deg,#1A2B4A,#2d4a7a)',borderRadius:12,padding:'16px 20px',marginBottom:20,color:'#fff'}}>
        <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(255,255,255,.5)',margin:'0 0 4px'}}>Flux activ + trafic legacy</p>
        <h2 style={{fontSize:16,fontWeight:500,margin:'0 0 4px'}}>Analiza formular cereri — /vreau este ruta activa</h2>
        <p style={{fontSize:13,color:'rgba(255,255,255,.65)',margin:0}}>
          /vreau: {fmtN(activePath.views)} vizite · {fmtN(activePath.conv)} conversii GA4 · conv rate {activeConvRate.toFixed(1)}%.
          {legacyViews > 0 ? ` Rute vechi monitorizate separat: ${fmtN(legacyViews)} vizite.` : ' Rutele vechi nu au trafic pe interval.'}
        </p>
      </div>

      {/* KPI cards per path */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        {paths.map((p,i) => (
          <div key={p.path} style={{
            background:C.card,border:`2px solid ${p.color}22`,borderRadius:12,
            padding:'14px 16px',position:'relative',overflow:'hidden'
          }}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:p.color,borderRadius:'12px 12px 0 0'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <PageLink path={p.path} style={{fontFamily:'monospace',fontSize:13,fontWeight:600,color:p.color}}>
                /{p.label}
              </PageLink>
              <span style={{
                fontSize:10,
                fontWeight:600,
                padding:'1px 6px',
                borderRadius:99,
                background:p.status === 'active' ? C.softGreen : C.softAmber,
                color:p.status === 'active' ? C.green : C.amber,
              }}>
                {p.status === 'active' ? 'activ' : 'legacy'}
              </span>
              {p.convRate === Math.max(...paths.map(x=>x.convRate)) && p.convRate > 0 && (
                <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:C.softGreen,color:C.green}}>best</span>
              )}
            </div>
            <p style={{fontSize:11,color:C.hint,margin:'0 0 10px',lineHeight:1.4}}>{p.description}</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {l:'Views',v:fmtN(p.views)},
                {l:'Useri unici',v:fmtN(p.users)},
                {l:'Conversii GA4',v:fmtN(p.conv),bold:true,col:p.conv>0?C.green:C.hint},
                {l:'Conv rate',v:p.convRate.toFixed(2)+'%',bold:true,col:p.convRate>2?C.green:p.convRate>0?C.amber:C.red},
                {l:'Engagement',v:Math.round(p.eng*100)+'%',col:p.eng>0.9?C.green:p.eng>0.7?C.amber:C.red},
                {l:'Durata medie',v:Math.round(p.dur)+'s'},
              ].map(m=>(
                <div key={m.l}>
                  <p style={{fontSize:10,color:C.hint,margin:'0 0 1px',textTransform:'uppercase',letterSpacing:'.04em'}}>{m.l}</p>
                  <p style={{fontSize:14,fontWeight:m.bold?600:400,color:m.col||C.text,margin:0}}>{m.v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Visual comparison bar */}
      <Sec title="Comparatie vizuala — volum si eficienta">
        <Card style={{padding:'16px 20px'}}>
          {paths.map((p,i) => {
            const pct = p.views/maxViews*100
            const share = totalViews > 0 ? p.views/totalViews*100 : 0
            return (
              <div key={p.path} style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:5}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:p.color,flexShrink:0}}/>
                  <PageLink path={p.path} style={{fontSize:12,fontFamily:'monospace',fontWeight:500,color:p.color}}>/{p.label}</PageLink>
                  <span style={{fontSize:11,color:C.hint}}>{share.toFixed(0)}% din trafic</span>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:12,fontWeight:500,color:p.convRate>2?C.green:p.convRate>0?C.amber:C.red}}>
                    {p.convRate.toFixed(2)}% conv rate
                  </span>
                </div>
                {/* Views bar */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:10,color:C.hint,width:56,flexShrink:0}}>Views</span>
                  <div style={{flex:1,background:C.softPanel,borderRadius:99,height:8,overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:8,background:p.color,borderRadius:99,opacity:.7}}/>
                  </div>
                  <span style={{fontSize:11,color:C.muted,width:36,textAlign:'right'}}>{fmtN(p.views)}</span>
                </div>
                {/* Conv bar (scaled to 10% max) */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,color:C.hint,width:56,flexShrink:0}}>Conv GA4</span>
                  <div style={{flex:1,background:C.softPanel,borderRadius:99,height:8,overflow:'hidden'}}>
                    <div style={{width:`${Math.min(p.convRate*5,100)}%`,height:8,background:p.conv>0?C.green:C.border,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:11,color:p.conv>0?C.green:C.hint,width:36,textAlign:'right',fontWeight:p.conv>0?500:400}}>{p.conv}</span>
                </div>
              </div>
            )
          })}
        </Card>
      </Sec>

      {/* Daily chart */}
      <Sec title="Evolutie zilnica"
        right={
          <div style={{display:'flex',gap:4}}>
            {[['views','Views'],['conv','Conversii']].map(([v,l])=>(
              <button key={v} onClick={()=>setChartMode(v)} style={{
                padding:'3px 10px',fontSize:11,borderRadius:6,cursor:'pointer',
                border:`0.5px solid ${chartMode===v?C.blue:C.border}`,
                background:chartMode===v?C.softBlue:'transparent',
                color:chartMode===v?C.blue:C.muted,fontWeight:chartMode===v?500:400
              }}>{l}</button>
            ))}
          </div>
        }>
        <Card>
          <LineChart
            data={chartData}
            metrics={paths.map((p,i)=>({
              field: `${chartMode}_${i}`,
              label: '/'+p.label,
              color: p.color,
            }))}
            height={200}
          />
        </Card>
      </Sec>

      {/* By channel */}
      <Sec title="Trafic per canal — de unde vin userii pe fiecare pagina">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {paths.map((p,i) => (
            <div key={p.path}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:p.color}}/>
                <PageLink path={p.path} style={{fontSize:12,fontFamily:'monospace',fontWeight:500,color:p.color}}>/{p.label}</PageLink>
              </div>
              {p.byChannel.length === 0 ? (
                <p style={{fontSize:12,color:C.hint}}>Nu exista date</p>
              ) : (
                [...p.byChannel].sort((a,b)=>(b.screen_page_views||0)-(a.screen_page_views||0)).map(ch=>{
                  const pct = p.views>0?ch.screen_page_views/p.views*100:0
                  const chConvRate = ch.screen_page_views>0?ch.conversions/ch.screen_page_views*100:0
                  return (
                    <div key={ch.session_default_channel_group} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                        <span style={{fontSize:11,color:C.text}}>{ch.session_default_channel_group}</span>
                        <span style={{fontSize:11,color:C.muted}}>{fmtN(ch.screen_page_views)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{background:C.softPanel,borderRadius:99,height:5,overflow:'hidden',marginBottom:2}}>
                        <div style={{width:`${pct}%`,height:5,background:p.color,borderRadius:99,opacity:.7}}/>
                      </div>
                      {ch.conversions > 0 && (
                        <p style={{fontSize:10,color:C.green,margin:0,fontWeight:500}}>{ch.conversions} conv · {chConvRate.toFixed(1)}% rate</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </Sec>

      {/* Insights */}
      <Sec title="Observatii si recomandari">
        <Signal type={activeConvRate > 0 ? 'positive' : 'neutral'}
          title={`/vreau este fluxul activ — ${activeConvRate.toFixed(2)}% conv rate`}
          body={`Cu ${fmtN(activePath.views)} views si ${activePath.conv} conversii GA4, acesta este singurul flux folosit pentru analiza formularului curent. Cererile reale se valideaza separat din buyer_requests, nu din traficul pe rutele legacy.`}
        />
        {legacyViews > 0 && (
          <Signal type="info"
            title={`Trafic legacy ramas: ${fmtN(legacyViews)} vizite pe rute vechi`}
            body="Aceste vizite pot veni din istoric GA4, linkuri vechi, bookmark-uri, indexari sau redirecturi fara 301. Nu inseamna ca userii mai trimit cereri prin pagina veche; inseamna ca merita verificat ca rutele vechi duc spre /vreau."
          />
        )}
        <Signal type="info"
          title="Interpretare corecta"
          body="In acest tab, /vreau este formularul activ. /cerere-noua si /cereri/nou raman in raport doar ca audit pentru trafic ratacit, ca sa nu pierdem vizite venite din linkuri vechi sau rezultate indexate."
        />
      </Sec>
    </div>
  )
}

/* ─── CONVERSII CONFIG ─────────────────────────────────────────────── */
function TabConversii({ data }) {
  const pages = data.pages.current
  const traffic = data.traffic.current

  // State: which conversions are active
  const initActive = () => {
    const s = {}
    CONV_DEFINITIONS.forEach(c => { s[c.id] = c.defaultOn })
    return s
  }
  const [active, setActive] = useState(initActive)
  const [catFilter, setCatFilter] = useState('Toate')

  const toggle = id => setActive(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleAll = on => { const s = {}; CONV_DEFINITIONS.forEach(c => { s[c.id] = on }); setActive(s) }

  // Compute totals for each conversion
  const getVal = conv => {
    if (conv.isPageView) {
      const p = pages.find(pg => pg.page_path === conv.page)
      return p ? Math.round(p.screen_page_views || 0) : 0
    }
    const field = conv.id
    return Math.round(data.conversions.reduce((s,r) => s+(r[field]||0), 0))
  }

  // Weighted conversion score (active only)
  const totalScore = CONV_DEFINITIONS
    .filter(c => active[c.id])
    .reduce((s, c) => s + getVal(c) * c.value, 0)

  const activeConvs = CONV_DEFINITIONS.filter(c => active[c.id])
  const totalConvCount = activeConvs.reduce((s,c) => s + getVal(c), 0)

  const totalSess = sum(traffic, 'sessions')
  const weightedRate = totalSess > 0 ? totalScore / totalSess : 0

  const filtered = CONV_DEFINITIONS.filter(c => catFilter === 'Toate' || c.category === catFilter)

  const catColors = {
    'Inregistrare': C.blue, 'Cereri': C.amber, 'Oferte': C.green,
    'Proprietati': C.purple, 'Engagement': C.teal, 'CRM': C.gray, 'Monetizare': C.red
  }

  return (
    <div>
      {/* Header stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,marginBottom:20}}>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Conversii active</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalConvCount.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>{activeConvs.length} tipuri activate</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Scor ponderat</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalScore.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>valoare x frecventa</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Conv rate ponderat</p>
          <p style={{fontSize:22,fontWeight:500,color:C.green,margin:0}}>{weightedRate.toFixed(1)}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>scor per sesiune</p>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
          <p style={{fontSize:11,color:C.hint,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'.05em'}}>Sesiuni perioada</p>
          <p style={{fontSize:22,fontWeight:500,color:C.text,margin:0}}>{totalSess.toLocaleString('ro')}</p>
          <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>total sesiuni</p>
        </div>
      </div>

      {/* Alert Key Events */}
      {CONV_DEFINITIONS.filter(c => !c.isPageView && active[c.id] && getVal(c) === 0).length > 0 && (
        <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13}}>
          <strong style={{color:C.red}}>Atentie: </strong>
          <span style={{color:C.muted}}>
            {CONV_DEFINITIONS.filter(c => !c.isPageView && active[c.id] && getVal(c) === 0).map(c=>c.label).join(', ')} returneaza 0 — Key Events neconfigurate in GA4.
          </span>
        </div>
      )}

      {/* Controls */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
        <span style={{fontSize:12,color:C.hint}}>Categorie:</span>
        {['Toate',...CATEGORIES].map(cat=>(
          <button key={cat} onClick={()=>setCatFilter(cat)} style={{
            padding:'4px 10px',fontSize:12,borderRadius:6,cursor:'pointer',
            border:`0.5px solid ${catFilter===cat?(catColors[cat]||C.blue):C.border}`,
            background:catFilter===cat?C.softBlue:'transparent',
            color:catFilter===cat?(catColors[cat]||C.blue):C.muted,fontWeight:catFilter===cat?500:400
          }}>{cat}</button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>toggleAll(true)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted}}>Activeaza toate</button>
        <button onClick={()=>toggleAll(false)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted}}>Dezactiveaza toate</button>
      </div>

      {/* Conversions list */}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {filtered.map(conv => {
          const val = getVal(conv)
          const isOn = active[conv.id]
          const catCol = catColors[conv.category] || C.blue
          const convRate = totalSess > 0 ? (val / totalSess * 100) : 0
          return (
            <div key={conv.id} style={{
              background:C.card,border:`0.5px solid ${isOn?C.border:C.softPanel}`,borderRadius:10,
              padding:'12px 14px',display:'flex',alignItems:'center',gap:12,
              opacity:isOn?1:0.5,transition:'opacity .15s'
            }}>
              {/* Toggle */}
              <button onClick={()=>toggle(conv.id)} style={{
                width:36,height:20,borderRadius:99,border:'none',cursor:'pointer',flexShrink:0,
                background:isOn?C.blue:'#d0d0c8',position:'relative',transition:'background .2s'
              }}>
                <div style={{
                  width:14,height:14,borderRadius:'50%',background:'#fff',position:'absolute',
                  top:3,left:isOn?19:3,transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'
                }}/>
              </button>

              {/* Icon + category */}
              <span style={{fontSize:18,flexShrink:0}}>{conv.icon}</span>

              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:500,color:isOn?C.text:C.muted}}>{conv.label}</span>
                  <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:catCol+'20',color:catCol}}>{conv.category}</span>
                  {conv.isPageView && <span style={{fontSize:10,color:C.hint,padding:'1px 5px',border:`0.5px solid ${C.border}`,borderRadius:4}}>page view</span>}
                </div>
                <p style={{fontSize:12,color:C.hint,margin:'2px 0 0'}}>{conv.description}
                  {conv.page && <> · <PageLink path={conv.page} style={{fontSize:11,fontFamily:'monospace',color:C.blue}}>{conv.page}</PageLink></>}
                </p>
              </div>

              {/* Value */}
              <div style={{textAlign:'right',flexShrink:0}}>
                <p style={{fontSize:18,fontWeight:500,color:isOn&&val>0?C.green:C.hint,margin:0}}>{val.toLocaleString('ro')}</p>
                <p style={{fontSize:11,color:C.hint,margin:'1px 0 0'}}>{convRate.toFixed(2)}% rate</p>
              </div>

              {/* Weight */}
              <div style={{textAlign:'right',flexShrink:0,width:50}}>
                <p style={{fontSize:11,color:C.hint,margin:0}}>val.</p>
                <p style={{fontSize:13,fontWeight:500,color:C.muted,margin:0}}>{conv.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown by category */}
      <div style={{marginTop:20}}>
        <Sec title="Conversii per categorie (active)">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
            {CATEGORIES.map(cat => {
              const catConvs = CONV_DEFINITIONS.filter(c=>c.category===cat&&active[c.id])
              const catTotal = catConvs.reduce((s,c)=>s+getVal(c),0)
              const col = catColors[cat]||C.blue
              if(catConvs.length===0) return null
              return (
                <div key={cat} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:col}}/>
                    <span style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{cat}</span>
                  </div>
                  <p style={{fontSize:22,fontWeight:500,color:catTotal>0?col:C.hint,margin:'0 0 2px'}}>{catTotal.toLocaleString('ro')}</p>
                  <p style={{fontSize:11,color:C.hint,margin:0}}>{catConvs.length} tipuri</p>
                </div>
              )
            })}
          </div>
        </Sec>
      </div>
    </div>
  )
}

/* ─── ACTIUNI ──────────────────────────────────────────────────────── */

/* ─── TAB CERERE TRACKING ──────────────────────────────────────────── */
export function TabCerereTracking({ data }) {
  const allDates = data.cerereTracking || []
  const requestEvents = data.requestFormEvents || {}
  const formEvents = requestEvents.events || []
  const formEventCount = name => Number(formEvents.find(row => row.event_name === name)?.event_count || 0)
  const formStarted = formEventCount('[Amplitude] Form Started')
  const formSubmitted = formEventCount('[Amplitude] Form Submitted')
  const formSteps = formEventCount('Form Step Completed')
  const formErrors = formEventCount('Form Validation Error')
  const formAbandoned = formEventCount('Form Abandoned')
  const requestCreated = formEventCount('Request Created')

  const ga4Cereri     = allDates.reduce((s,d) => s+(d.conversions_bravo_cerere_noua||0), 0)
  const platformCereri = Number(data.platformRequests?.count || 0)
  const totalCereri   = platformCereri > 0 ? platformCereri : ga4Cereri
  const cereriSource  = platformCereri > 0 ? 'platform' : 'ga4'
  const trackingGap   = platformCereri > 0 ? Math.max(0, platformCereri - ga4Cereri) : 0
  const totalCump     = allDates.reduce((s,d) => s+(d.conversions_bun_venit_cumparator||0), 0)
  const totalAgent    = allDates.reduce((s,d) => s+(d.conversions_bun_venit_agent||0), 0)
  const totalProp     = allDates.reduce((s,d) => s+(d.conversions_bun_venit_proprietar||0), 0)
  const totalInreg    = totalCump + totalAgent + totalProp

  // Days with at least 1 cerere
  const activeDays    = allDates.filter(d => (d.conversions_bravo_cerere_noua||0) > 0).length
  const totalDays     = data.days || allDates.length || 1
  const avgPerDay     = (totalCereri / totalDays).toFixed(2)

  // Conversion rate: cereri / inregistrari cumparatori
  const convRate = totalCump > 0 ? (totalCereri / totalCump * 100).toFixed(0) : null

  // Find first day with data
  const firstDay = allDates.find(d => (d.conversions_bravo_cerere_noua||0) > 0)
  const daysSinceFirst = firstDay
    ? Math.round((new Date() - new Date(firstDay.date)) / 864e5)
    : null

  return (
    <div>
      {/* Header KPIs */}
      <Grid>
        <KPI label={cereriSource === 'platform' ? 'Cereri reale' : 'Cereri GA4'} curr={totalCereri}
          sub={cereriSource === 'platform' ? 'din buyer_requests' : activeDays > 0 ? `${activeDays} zile cu activitate` : 'tracking GA4'}/>
        <KPI label="Cereri GA4" curr={ga4Cereri}
          sub={trackingGap > 0 ? `${trackingGap} lipsa vs platforma` : daysSinceFirst ? `de acum ${daysSinceFirst} zile` : '—'}/>
        <KPI label="Medie / zi" curr={parseFloat(avgPerDay)} type="dec1"
          sub={`${totalDays} zile analizate`}/>
        <KPI label="Inregistrari cumparatori" curr={totalCump}/>
      </Grid>

      <Sec title="Evenimente formular /vreau">
        {(requestEvents.totalEvents || 0) === 0 ? (
          <Signal
            type="neutral"
            title="Evenimentele intermediare nu apar inca in raport"
            body="Dashboard-ul asteapta Form Step Completed, Form Validation Error, Form Abandoned si Request Created. Daca evenimentele sunt doar in Amplitude, trebuie export/mirror catre sursa citita de analytics."
          />
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:8}}>
            {[
              ['Start formular', formStarted, C.blue],
              ['Pasi finalizati', formSteps, C.purple],
              ['Erori validare', formErrors, C.red],
              ['Abandon', formAbandoned, C.amber],
              ['Submit form', formSubmitted, C.green],
              ['Request Created', requestCreated, C.green],
            ].map(([label, value, col]) => (
              <div key={label} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:11,color:C.hint,margin:'0 0 5px'}}>{label}</p>
                <p style={{fontSize:22,fontWeight:600,color:value>0?col:C.hint,margin:0}}>{fmtN(value)}</p>
              </div>
            ))}
          </div>
        )}
      </Sec>

      {trackingGap > 0 && (
        <Signal type="negative"
          title={`${trackingGap} cereri reale nu apar in GA4`}
          body={`Platforma are ${platformCereri} cereri in buyer_requests, dar GA4 vede ${ga4Cereri}. Datele de business sunt corecte, insa atribuirea pe sursa/canal ramane incompleta pana cand evenimentul bravo_cerere_noua este trimis consecvent.`}
        />
      )}

      {/* Alert daca date putine */}
      {totalCereri < 10 && (
        <Signal type="neutral"
          title={`${totalCereri} cereri noi — implementat recent, baseline in formare`}
          body={`Key Event-ul a fost activat recent. Datele de mai jos reflecta primele zile de tracking. Revino dupa 2-4 saptamani pentru tendinte relevante. Obiectiv realist: 2-3 cereri/zi in 60 zile.`}
        />
      )}

      {convRate && (
        <Signal
          type={parseInt(convRate) > 50 ? 'positive' : parseInt(convRate) > 20 ? 'neutral' : 'negative'}
          title={`${convRate}% din cumparatorii inregistrati adauga si o cerere`}
          body={`${totalCereri} cereri (${cereriSource === 'platform' ? 'platforma' : 'GA4'}) din ${totalCump} inregistrari cumparatori GA4. ${parseInt(convRate) < 50 ? 'Potential de crestere: dupa inregistrare, redirecteaza userul direct catre formularul de cerere.' : 'Rata buna — mai mult de jumatate din cumparatori adauga cerere.'}`}
        />
      )}

      {/* Grafic zilnic principal */}
      <Sec title="Cereri noi adaugate — evolutie zilnica GA4">
        <Card>
          {allDates.length > 0 ? (
            <LineChart
              data={allDates}
              metrics={[
                {field:'conversions_bravo_cerere_noua', label:'Cereri noi', color:'#3B82C4'},
                {field:'conversions_bun_venit_cumparator', label:'Inregistrari cumparatori', color:'#16A34A'},
                {field:'conversions_bun_venit_agent', label:'Inregistrari agenti', color:'#D97706'},
              ]}
              height={220}
            />
          ) : (
            <div style={{padding:'40px 0',textAlign:'center',color:C.hint,fontSize:13}}>
              Nu exista date zilnice pentru perioada selectata.<br/>
              <span style={{fontSize:11,marginTop:4,display:'block'}}>Cererile reale sunt citite din platforma; graficul zilnic depinde de tracking-ul GA4.</span>
            </div>
          )}
        </Card>
      </Sec>

      {/* Grafic bar: cereri pe zi (mai usor de citit pentru volum mic) */}
      {allDates.length > 0 && (
        <Sec title="Cereri noi per zi — detaliu">
          <Card style={{padding:'12px 16px'}}>
            {(() => {
              const withCereri = allDates.filter(d => (d.conversions_bravo_cerere_noua||0) > 0)
              if (withCereri.length === 0) return (
                <p style={{fontSize:13,color:C.hint,textAlign:'center',padding:'20px 0'}}>
                  Nicio cerere adaugata in perioada selectata.
                </p>
              )
              const maxV = Math.max(...withCereri.map(d => d.conversions_bravo_cerere_noua||0), 1)
              return withCereri.map((d,i) => {
                const v = d.conversions_bravo_cerere_noua || 0
                const pct = v / maxV * 100
                const dt = new Date(d.date)
                const dayLabel = dt.toLocaleDateString('ro-RO', {weekday:'short', day:'numeric', month:'short'})
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:11,color:C.muted,width:100,flexShrink:0,fontFamily:'monospace'}}>{dayLabel}</span>
                    <div style={{flex:1,background:C.softPanel,borderRadius:99,height:10,overflow:'hidden'}}>
                      <div style={{width:`${pct}%`,height:10,background:C.blue,borderRadius:99}}/>
                    </div>
                    <span style={{fontSize:14,fontWeight:600,color:C.blue,width:20,textAlign:'right',flexShrink:0}}>{v}</span>
                  </div>
                )
              })
            })()}
          </Card>
        </Sec>
      )}

      {/* Inregistrari per tip */}
      <Sec title="Inregistrari per tip de cont">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
          {[
            {label:'Cumparatori',val:totalCump,col:C.blue,icon:'👤'},
            {label:'Agenti',val:totalAgent,col:C.amber,icon:'🏢'},
            {label:'Proprietari',val:totalProp,col:C.green,icon:'🏠'},
          ].map(item=>(
            <div key={item.label} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
              <div style={{fontSize:20,marginBottom:4}}>{item.icon}</div>
              <div style={{fontSize:22,fontWeight:500,color:item.val>0?item.col:C.hint}}>{item.val}</div>
              <div style={{fontSize:11,color:C.hint,marginTop:2}}>{item.label}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* Target si ritm */}
      <Sec title="Proiectie si target">
        <Card>
          {(() => {
            const dailyRate = totalCereri / totalDays
            const proj7  = Math.round(dailyRate * 7)
            const proj30 = Math.round(dailyRate * 30)
            const target7  = 14  // 2/zi
            const target30 = 60  // 2/zi
            return (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                  {[
                    {label:'Ritm actual /zi',val:dailyRate.toFixed(2),sub:'pe tot intervalul'},
                    {label:'Proiectie 7 zile',val:proj7,sub:`target: ${target7}`,ok:proj7>=target7},
                    {label:'Proiectie 30 zile',val:proj30,sub:`target: ${target30}`,ok:proj30>=target30},
                  ].map((it,i)=>(
                    <div key={i} style={{textAlign:'center',padding:'10px',background:it.ok===true?C.softGreen:it.ok===false?C.softRed:C.softPanel,borderRadius:8}}>
                      <div style={{fontSize:20,fontWeight:600,color:it.ok===true?C.green:it.ok===false?C.red:C.text}}>{it.val}</div>
                      <div style={{fontSize:11,color:C.hint,marginTop:2}}>{it.label}</div>
                      <div style={{fontSize:10,color:it.ok===true?C.green:it.ok===false?C.red:C.hint,marginTop:1}}>{it.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,borderTop:`0.5px solid ${C.border}`,paddingTop:10}}>
                  <strong style={{color:C.text}}>Target recomandat:</strong> 2 cereri/zi = 60/luna = 720/an.
                  La ritmul actual de <strong>{dailyRate.toFixed(2)}/zi</strong> ({cereriSource === 'platform' ? 'cereri reale din platforma' : 'tracking GA4'}),
                  {dailyRate < 2
                    ? ` esti sub target. Implementeaza CTA inline pe /cereri si redirecteaza cumparatorii catre formular imediat dupa inregistrare.`
                    : ` esti pe track. Mentine ritmul si monitorizeaza saptamanal.`}
                </div>
              </div>
            )
          })()}
        </Card>
      </Sec>
    </div>
  )
}

export { TabRecomandari, TabCerereNoua, TabConversii }
