'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { C, sum, dlt, fmtN, Action, Sec, Grid, KPI, Signal, Delta } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'
import { TabGrafice, TabSemnale, TabTrafic, TabSEO } from './tabs1'
import { TabPagini, TabFunnel } from './tabs2'
import { TabRecomandari, TabCerereNoua, TabConversii, TabCerereTracking } from './tabs3'

/* ─── PERIOD SELECTOR ──────────────────────────────────────────────── */
const PERIODS = [
  {label:'7Z',   days:7},
  {label:'14Z',  days:14},
  {label:'30Z',  days:30},
  {label:'60Z',  days:60},
  {label:'90Z',  days:90},
]

function PeriodBar({ days, customFrom, customTo, onDays, onCustom }) {
  const [showPicker, setShowPicker] = useState(false)
  const [from, setFrom] = useState(customFrom || '')
  const [to,   setTo]   = useState(customTo   || '')
  const isCustom = !!customFrom

  function applyCustom() {
    if (!from || !to || from > to) return
    setShowPicker(false)
    onCustom(from, to)
  }

  // Compute today and sensible max
  const today = new Date().toISOString().slice(0,10)
  const minDate = '2024-01-01'

  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',gap:4}}>
      <span style={{fontSize:11,color:C.hint,marginRight:2}}>Interval:</span>

      {/* Preset buttons */}
      {PERIODS.map(p=>(
        <button key={p.days} onClick={()=>{setShowPicker(false);onDays(p.days)}} style={{
          padding:'4px 9px',fontSize:11,borderRadius:6,cursor:'pointer',fontWeight:!isCustom&&days===p.days?500:400,
          border:`0.5px solid ${!isCustom&&days===p.days?C.navy:C.border}`,
          background:!isCustom&&days===p.days?C.navy:'transparent',
          color:!isCustom&&days===p.days?'#fff':C.muted,transition:'all .15s'
        }}>{p.label}</button>
      ))}

      {/* Custom button */}
      <button onClick={()=>setShowPicker(v=>!v)} style={{
        padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',fontWeight:isCustom?500:400,
        border:`0.5px solid ${isCustom||showPicker?C.blue:C.border}`,
        background:isCustom?'#EBF4FC':showPicker?'#F0F7FF':'transparent',
        color:isCustom||showPicker?C.blue:C.muted,display:'flex',alignItems:'center',gap:5,
        transition:'all .15s'
      }}>
        <span>📅</span>
        {isCustom ? `${customFrom} → ${customTo}` : 'Personalizat'}
      </button>

      {/* Dropdown picker */}
      {showPicker && (
        <div style={{
          position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:100,
          background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,
          padding:'16px',boxShadow:'0 8px 32px rgba(0,0,0,.12)',minWidth:280
        }}>
          <p style={{fontSize:12,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Interval personalizat</p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={{fontSize:11,color:C.hint,display:'block',marginBottom:4}}>De la</label>
              <input type="date" value={from} min={minDate} max={to||today}
                onChange={e=>setFrom(e.target.value)}
                style={{width:'100%',padding:'7px 10px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg,outline:'none',boxSizing:'border-box'}}
              />
            </div>
            <div>
              <label style={{fontSize:11,color:C.hint,display:'block',marginBottom:4}}>Pana la</label>
              <input type="date" value={to} min={from||minDate} max={today}
                onChange={e=>setTo(e.target.value)}
                style={{width:'100%',padding:'7px 10px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg,outline:'none',boxSizing:'border-box'}}
              />
            </div>
          </div>

          {/* Quick shortcuts */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {[
              {l:'Luna asta',    f:()=>{ const n=new Date(); return [new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10), today] }},
              {l:'Luna trecuta', f:()=>{ const n=new Date(); const f=new Date(n.getFullYear(),n.getMonth()-1,1); const t=new Date(n.getFullYear(),n.getMonth(),0); return [f.toISOString().slice(0,10),t.toISOString().slice(0,10)] }},
              {l:'T1 2026',      f:()=>['2026-01-01','2026-03-31']},
              {l:'T2 2026',      f:()=>['2026-04-01','2026-06-30']},
              {l:'Toata data',   f:()=>['2024-01-01',today]},
            ].map(s=>(
              <button key={s.l} onClick={()=>{ const [f,t]=s.f(); setFrom(f); setTo(t) }} style={{
                padding:'3px 9px',fontSize:11,borderRadius:5,cursor:'pointer',
                border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted
              }}>{s.l}</button>
            ))}
          </div>

          {from && to && from > to && (
            <p style={{fontSize:11,color:C.red,margin:'0 0 8px'}}>'De la' trebuie sa fie inainte de 'Pana la'</p>
          )}

          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowPicker(false)} style={{padding:'6px 14px',fontSize:12,borderRadius:7,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted}}>Anuleaza</button>
            <button onClick={applyCustom} disabled={!from||!to||from>to} style={{
              padding:'6px 14px',fontSize:12,fontWeight:500,borderRadius:7,cursor:'pointer',border:'none',
              background:from&&to&&from<=to?C.navy:'#ccc',color:'#fff'
            }}>Aplica</button>
          </div>
        </div>
      )}
    </div>
  )
}


function TabActiuni({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const pages=data.pages.current, queries=data.gsc.queries||[]
  const cc=sum(curr,'conversions'), cp=sum(prev,'conversions')
  const tracking=data.cerereTracking||[]
  const totalCereriNoi=tracking.reduce((s,d)=>s+(d.conversions_bravo_cerere_noua||0),0)
  const totalCump=tracking.reduce((s,d)=>s+(d.conversions_bun_venit_cumparator||0),0)
  const custConv=sum(data.conversions,'conversions_signup')+sum(data.conversions,'conversions_offer_accepted')+totalCereriNoi
  const h3=pages.find(p=>p.page_path==='/home3'), hp=pages.find(p=>p.page_path==='/')
  const reset=pages.find(p=>p.page_path==='/resetare-parola')
  const proprietati=pages.find(p=>p.page_path==='/proprietati')
  const vreau=pages.find(p=>p.page_path==='/vreau')
  const ceNou=pages.find(p=>p.page_path==='/cerere-noua')
  const cereriNou=pages.find(p=>p.page_path==='/cereri/nou')
  const cereri=pages.find(p=>p.page_path==='/cereri')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0
  const vreauR=vreau&&vreau.screen_page_views>0?vreau.conversions/vreau.screen_page_views*100:0
  const ceNouR=ceNou&&ceNou.screen_page_views>0?ceNou.conversions/ceNou.screen_page_views*100:0
  const homepageGapClosed=h3r>0&&hpr>0&&(h3r-hpr)<1.5
  const lowCtr=queries.filter(q=>(q.organic_google_search_impressions||0)>50&&(q.organic_google_search_click_through_rate||0)<0.03).sort((a,b)=>(b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=8).sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]
  const cereriViews=cereri?.screen_page_views||0
  const totalFormViews=(ceNou?.screen_page_views||0)+(vreau?.screen_page_views||0)+(cereriNou?.screen_page_views||0)
  const funnelRate=cereriViews>0?totalFormViews/cereriViews*100:0

  const actions=[]

  // 1. /cereri/nou tracking broken — persista
  if(cereriNou&&(cereriNou.conversions||0)===0&&(cereriNou.screen_page_views||0)>20) {
    actions.push({urgency:'urgent',
      title:`/cereri/nou: ${fmtN(cereriNou.screen_page_views)} views, ${Math.round(cereriNou.average_session_duration||0)}s, 0 conversii — Key Event inca nesetat`,
      body:'Problema persista. Userii completeaza formularul dar evenimentul nu se triggereaza. Pierdere directa de date.',
      fix:"Adauga la submit reusit pe /cereri/nou: gtag('event', 'conversions_bravo_cerere_noua', {page_source: 'cereri_nou'}). Verifica in GA4 DebugView. Durata: 5 minute."})
  }

  // 2. CTA pe /cereri — inca neluat
  if(funnelRate<15) {
    actions.push({urgency:'urgent',
      title:`Funnel /cereri → formulare: ${funnelRate.toFixed(0)}% — CTA inline inca lipseste`,
      body:`${fmtN(cereriViews)} vizite pe /cereri dar doar ${fmtN(totalFormViews)} (${funnelRate.toFixed(0)}%) ajung la formulare. Un card CTA dupa al 4-lea rezultat din grid poate dubla aceasta rata.`,
      fix:"Insereaza un card dark-navy dupa pozitia 4 din gridul de cereri cu textul: 'Nu gasesti ce cauti? Descrie ce vrei — agentii activi iti trimit oferte in 24h'. Ascunde pentru agentii logati. Efort: 30 minute."})
  }

  // 3. /proprietati — oportunitate noua identificata
  if(proprietati&&(proprietati.screen_page_views||0)>200&&(proprietati.conversions||0)===0) {
    actions.push({urgency:'urgent',
      title:`/proprietati: ${fmtN(proprietati.screen_page_views)} views, 0 conversii, ${Math.round((proprietati.bounce_rate||0)*100)}% bounce`,
      body:`A doua pagina ca trafic dar cu ZERO conversii. Userii ajung si pleaca fara nicio actiune — lipseste un CTA adecvat pentru tipul de user.`,
      fix:"Adauga CTA conditionat: Agent/Proprietar → 'Publica o proprietate' → /proprietati/nou. Cumparator → 'Adauga o cerere si primesti oferte' → /vreau. Doua reclame de 2 minute, impact estimat +50-100 conv/luna."})
  }

  // 4. /vreau vs /cerere-noua — redirect oportunitate
  if(vreauR>0&&ceNouR>0&&vreauR>ceNouR*2) {
    actions.push({urgency:'important',
      title:`/vreau (${vreauR.toFixed(1)}% conv) de ${(vreauR/Math.max(ceNouR,0.1)).toFixed(1)}x mai eficient decat /cerere-noua (${ceNouR.toFixed(1)}%)`,
      body:'Acelasi obiectiv, performante complet diferite. Traficul trimis spre /cerere-noua ar converti de 5x mai bine daca ar ajunge pe /vreau.',
      fix:"Schimba destinatia butonului '+ Cerere noua' din /cereri catre /vreau. Masoara conv rate timp de 14 zile. Daca se confirma, aplica peste tot."})
  }

  // 5. Homepage vs home3 — daca gap s-a inchis, felicitare + urmatorul pas
  if(homepageGapClosed) {
    actions.push({urgency:'luna asta',
      title:`Homepage / (${hpr.toFixed(1)}%) aproape de /home3 (${h3r.toFixed(1)}%) — gap inchis`,
      body:'Imbunatatirile pe homepage au dat rezultate. Gap-ul s-a redus sub 1.5pp. Focuseaza-te acum pe urmatoarea oportunitate: /proprietati si funnelul de cereri.',
      fix:"Monitorizeaza conv rate-ul homepage-ului saptamanal. Daca se stabilizeaza peste 7%, redirecteaza efortul spre /proprietati si CTA-ul pe /cereri."})
  } else if(h3r>hpr*1.5&&(h3?.screen_page_views||0)>20) {
    actions.push({urgency:'important',
      title:`/home3 (${h3r.toFixed(1)}%) inca mai bun decat homepage (${hpr.toFixed(1)}%) — gap de ${(h3r-hpr).toFixed(1)}pp`,
      body:'Gap exista inca. Copiaza elementele diferite de pe /home3 (CTA, copy, layout) pe homepage.',
      fix:'Identifica ce e diferit pe /home3 vs /. Aplica schimbarile pe homepage si monitorizeaza 14 zile.'})
  }

  // 6. /resetare-parola — daca inca are problema
  if(reset&&(reset.engagement_rate||0)<0.6&&(reset.screen_page_views||0)>10) {
    actions.push({urgency:'important',
      title:`/resetare-parola — engagement ${Math.round((reset.engagement_rate||0)*100)}% (emailul de reset a fost imbunatatit, verifica fluxul)`,
      body:`Am optimizat emailul de reset (expirare 30 min, CTA clar). Daca bounce-ul persista, problema e tehnica — linkul expira prea repede sau emailul ajunge in spam.`,
      fix:'Testeaza manual fluxul complet: solicita reset > verifica inbox + spam > apasa link > confirma ca functioneaza. Verifica in Supabase Auth logs timpul de expirare al token-ului.'})
  }

  // 7. SEO
  if(nearTop) {
    const q=nearTop.query&&nearTop.query!=='(not provided)'?`"${nearTop.query}"`:'un query identificat'
    actions.push({urgency:'important',
      title:`SEO: ${q} pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — aproape de top 3`,
      body:`${Math.round(nearTop.organic_google_search_impressions||0)} impressions. Urcare la top 3 poate dubla traficul organic.`,
      fix:'GSC > Performance > Queries > filtreaza pozitie 4-10 > click pe query > tab Pages. Pe acea pagina: adauga 200+ cuvinte relevante, imbunatateste H1 cu query-ul exact, adauga link-uri interne.'})
  } else {
    actions.push({urgency:'seo',
      title:'SEO: pozitie medie 83 — HomePitch nu apare pe queries relevante',
      body:'Cu 104 impressions si pozitia 83, practic nu exista vizibilitate organica. Nu exista continut optimizat pentru cum cauta oamenii in Romania.',
      fix:"Creeaza 3 pagini de continut in luna aceasta: 1) 'Cum sa cumperi un apartament in Bucuresti' 2) 'Agenti imobiliari Bucuresti' 3) 'Apartamente de vanzare Bucuresti'. Fiecare pagina bine optimizata aduce trafic pasiv pe termen lung."})
  }

  const cd=dlt(cc,cp)
  if(cd!==null&&cd<-20) actions.push({urgency:'urgent',
    title:`Conversii -${Math.abs(cd).toFixed(0)}% fata de perioada anterioara`,
    body:`${cc} conversii vs ${cp}. Scadere semnificativa — posibila problema tehnica.`,
    fix:'Verifica GA4 pentru erori JS. Verifica /cerere-noua, /vreau si /home3 pentru probleme.'})

  if(actions.length===0) actions.push({urgency:'luna asta',
    title:'Saptamana fara alerte majore',
    body:'Metricile sunt stabile. Focus pe continut SEO si optimizari de conversie.',
    fix:'Scrie 1 articol de continut targetand un query din GSC cu impressions mari.'})

  // Saptamana curenta ca referinta
  const weekLabel = new Date().toLocaleDateString('ro-RO',{day:'numeric',month:'long',year:'numeric'})

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <span style={{fontSize:11,color:C.hint}}>Actualizat: {weekLabel}</span>
        <div style={{display:'flex',gap:6}}>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'#FEF2F2',color:C.red}}>{actions.filter(a=>a.urgency==='urgent').length} urgente</span>
          <span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'#FFF7ED',color:C.amber}}>{actions.filter(a=>a.urgency==='important').length} importante</span>
        </div>
      </div>
      <Sec title={`${Math.min(actions.length,7)} actiuni prioritizate`}>
        {actions.slice(0,7).map((a,i)=><Action key={i} {...a}/>)}
      </Sec>
      <Sec title="Context metrici">
        <Grid>
          <KPI label="Conversii" curr={cc} prev={cp}/>
          <KPI label="Cereri noi (tracking)" curr={totalCereriNoi}/>
          <KPI label="/vreau rate" curr={vreauR} type="pctN"/>
          <KPI label="/ homepage rate" curr={hpr} type="pctN"/>
        </Grid>
      </Sec>
    </div>
  )
}


/* ─── MAIN ─────────────────────────────────────────────────────────── */
const TABS=[
  {id:'semnale',   label:'Semnale'},
  {id:'grafice',   label:'Grafice'},
  {id:'trafic',    label:'Trafic'},
  {id:'seo',       label:'SEO'},
  {id:'pagini',    label:'Pagini'},
  {id:'funnel',    label:'Funnel'},
  {id:'cerere',    label:'Analiza LP cereri'},
  {id:'tracking',  label:'Tracking cereri'},
  {id:'conversii', label:'Conversii'},
  {id:'recomandari',label:'Recomandari'},
  {id:'actiuni',   label:'Actiuni'},
]

export default function Dashboard() {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState('semnale')
  const [days,setDays]=useState(30)
  const [customFrom,setCustomFrom]=useState(null)
  const [customTo,setCustomTo]=useState(null)

  const [syncing, setSyncing] = useState(false)

  const load=useCallback(async(d, from, to)=>{
    setLoading(true);setError('')
    try{
      let url
      if (from && to) url = `/api/report?from=${from}&to=${to}`
      else url = `/api/report?days=${d||days}`
      const res=await fetch(url)
      if(!res.ok) throw new Error(`${res.status}`)
      const j=await res.json()
      if(j.error) throw new Error(j.error)
      setData(j)
    }catch(e){setError('Eroare: '+e.message)}
    finally{setLoading(false)}
  },[days])

  async function forceSync() {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({days: days||30}) })
      await load(days, customFrom, customTo)
    } catch(e) { setError('Sync failed: '+e.message) }
    finally { setSyncing(false) }
  }

  const onDays=useCallback(d=>{
    setDays(d)
    setCustomFrom(null)
    setCustomTo(null)
    load(d, null, null)
  },[load])

  const onCustom=useCallback((from,to)=>{
    setCustomFrom(from)
    setCustomTo(to)
    setDays(null)
    load(null, from, to)
  },[load])

  useEffect(()=>{load(30)},[])

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'})
    window.location.href='/login'
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',gap:12,height:52,position:'sticky',top:0,zIndex:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:6,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12}}>H</div>
          <span style={{fontSize:14,fontWeight:500,color:C.text}}>HomePitch Analytics</span>
          {data&&<span style={{fontSize:11,color:C.hint}}>· {data.periodLabel}</span>}
          {data&&data._source&&(
            <span style={{
              fontSize:10,fontWeight:500,padding:'2px 7px',borderRadius:99,
              background: data._source==='cache'?'#EBF4FC': data._source==='stale_cache'?'#FFF7ED':'#F0FDF4',
              color: data._source==='cache'?C.blue: data._source==='stale_cache'?C.amber:C.green,
            }}>
              {data._source==='cache'?'⚡ cache': data._source==='stale_cache'?'⚠ cache vechi':'↓ live'}
              {data._cachedAt&&` · ${new Date(data._cachedAt).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}`}
            </span>
          )}
        </div>
        <div style={{flex:1}}/>
        {data&&<PeriodBar days={days} customFrom={customFrom} customTo={customTo} onDays={onDays} onCustom={onCustom}/>}
        <button onClick={()=>customFrom?load(null,customFrom,customTo):load(days)} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>↻</button>
        <button onClick={forceSync} disabled={syncing} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${syncing?C.border:C.blue}`,borderRadius:6,background:syncing?'transparent':'#EBF4FC',color:syncing?C.hint:C.blue,cursor:syncing?'not-allowed':'pointer'}} title="Forteaza sync din Windsor si salveaza in Supabase">{syncing?'sync...':'⬇ sync'}</button>
        <button onClick={logout} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>Iesi</button>
      </div>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',gap:0,overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'11px 13px',fontSize:12,fontWeight:t.id===tab?500:400,border:'none',
            borderBottom:`2px solid ${t.id===tab?C.blue:'transparent'}`,
            background:'transparent',color:t.id===tab?C.blue:C.muted,cursor:'pointer',whiteSpace:'nowrap',
            ...(t.id==='recomandari'?{color:t.id===tab?C.green:C.muted,borderBottomColor:t.id===tab?C.green:'transparent'}:{})
          }}>{t.id==='recomandari'?'★ '+t.label:t.label}</button>
        ))}
      </div>
      <div style={{maxWidth:940,margin:'0 auto',padding:'20px 16px'}}>
        {loading&&<div style={{textAlign:'center',padding:'80px 0',color:C.muted,fontSize:14}}>Se incarca datele din GA4 si GSC via Windsor.ai...</div>}
        {error&&<div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'16px 20px'}}><p style={{color:C.red,fontSize:14,margin:0}}>{error}</p></div>}
        {data&&!loading&&(<>
          {tab==='semnale'     &&<TabSemnale     data={data}/>}
          {tab==='grafice'     &&<TabGrafice     data={data}/>}
          {tab==='trafic'      &&<TabTrafic      data={data}/>}
          {tab==='seo'         &&<TabSEO         data={data}/>}
          {tab==='pagini'      &&<TabPagini      data={data}/>}
          {tab==='funnel'      &&<TabFunnel      data={data}/>}
          {tab==='cerere'      &&<TabCerereNoua      data={data}/>}
          {tab==='tracking'    &&<TabCerereTracking  data={data}/>}
          {tab==='conversii'   &&<TabConversii       data={data}/>}
          {tab==='recomandari' &&<TabRecomandari data={data}/>}
          {tab==='actiuni'     &&<TabActiuni     data={data}/>}
          <div style={{marginTop:36,paddingTop:14,borderTop:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:11,color:C.hint}}>
              Generat {new Date(data.generatedAt).toLocaleString('ro-RO')} 
              {' · '}
              {data._source==='cache'?`Cache Supabase (${new Date(data._cachedAt).toLocaleString('ro-RO')})`:
               data._source==='stale_cache'?`Cache vechi Supabase (${new Date(data._cachedAt).toLocaleString('ro-RO')})`:
               'Live din Windsor.ai → GA4 + GSC'}
              {' · '}{data.days} zile
            </span>
            <span style={{fontSize:11,color:C.hint}}>HomePitch.ro</span>
          </div>
        </>)}
      </div>
    </div>
  )
}
