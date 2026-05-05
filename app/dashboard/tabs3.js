'use client'
import { useState } from 'react'
import { C, sum, avg, dlt, fmt, fmtN, Delta, KPI, Signal, Action, Sec, Grid, Card, LineChart, BarChart, PageLink } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'

/* ─── RECOMANDARI ──────────────────────────────────────────────────── */
function TabRecomandari({ data }) {
  const curr=data.traffic.current, pages=data.pages.current
  const totalSess=sum(curr,'sessions'), totalConv=sum(curr,'conversions')
  const social=curr.find(r=>r.session_default_channel_group==='Organic Social')
  const organic=curr.find(r=>r.session_default_channel_group==='Organic Search')
  const direct=curr.find(r=>r.session_default_channel_group==='Direct')
  const socialConvR=social&&social.sessions>0?social.conversions/social.sessions*100:0
  const organicConvR=organic&&organic.sessions>0?organic.conversions/organic.sessions*100:0
  const h3=pages.find(p=>p.page_path==='/home3')
  const hp=pages.find(p=>p.page_path==='/')
  const simp=pages.find(p=>p.page_path==='/simplu')
  const cereri=pages.find(p=>p.page_path==='/cereri')
  const ceNou=pages.find(p=>p.page_path==='/cerere-noua')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0
  const cereriViews=cereri?.screen_page_views||0
  const ceNouViews=ceNou?.screen_page_views||0
  const funnelRate=cereriViews>0?ceNouViews/cereriViews*100:0
  const gscClicks=sum(data.gsc.current,'organic_google_search_clicks')
  const gscImpr=sum(data.gsc.current,'organic_google_search_impressions')
  const gscCtr=gscImpr>0?gscClicks/gscImpr*100:0
  const queries=data.gsc.queries||[]
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=10)
  const lowCtrQueries=queries.filter(q=>(q.organic_google_search_impressions||0)>30&&(q.organic_google_search_click_through_rate||0)<0.03)

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#1A2B4A 0%,#2d4a7a 100%)',borderRadius:12,padding:'20px 24px',marginBottom:24,color:'#fff'}}>
        <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(255,255,255,.6)',margin:'0 0 6px'}}>Analiza bazata pe date reale</p>
        <h2 style={{fontSize:18,fontWeight:500,margin:'0 0 6px'}}>Cum poti creste traficul si conversiile</h2>
        <p style={{fontSize:13,color:'rgba(255,255,255,.7)',margin:0}}>
          {fmtN(totalSess)} sesiuni analizate. Conv rate general: {totalSess>0?(totalConv/totalSess*100).toFixed(1):'0'}%
        </p>
      </div>

      <Sec title="Crestere trafic — oportunitate imediata">
        <Signal type="info" title="Organic Social converteste de 2x mai bine decat Direct" tag="PRIORITATE"
          body={`Social: ${socialConvR.toFixed(1)}% conv rate vs Direct: ${direct&&direct.sessions>0?(direct.conversions/direct.sessions*100).toFixed(1):0}%. Cu ${fmtN(social?.sessions||0)} sesiuni din social si ${socialConvR.toFixed(1)}% conv rate, e canalul tau cel mai eficient. Dubland volumul de social, conversiile cresc proportional.`}/>
        <Signal type="info" title={`Organic Search: ${organicConvR.toFixed(1)}% conv rate cu volum mic (${fmtN(organic?.sessions||0)} sesiuni)`} tag="SEO"
          body={`Searchul organic are conv rate ${organicConvR.toFixed(1)}% — cel mai bun canal. Dar genereaza doar ${Math.round((organic?.sessions||0)/totalSess*100)}% din trafic. ${nearTop.length} queries sunt pe pozitia 4-10 in Google — optimizand continutul pentru ele poti dubla traficul organic fara cost.`}/>
        {gscImpr>0&&<Signal type="neutral" title={`CTR organic ${gscCtr.toFixed(1)}% — ${Math.round(gscImpr)} impressions pierdute`}
          body={`La ${Math.round(gscImpr)} impressions si CTR ${gscCtr.toFixed(1)}%, pierzi ~${Math.round(gscImpr*(0.1-gscCtr/100))} clicks potentiali pe luna daca ai CTR 10%. ${lowCtrQueries.length} queries au impressions mari dar CTR sub 3% — optimizarea titlurilor poate aduce trafic gratuit imediat.`}/>}
      </Sec>

      <Sec title="Crestere conversii cerere noua — gap critic">
        <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:12,padding:'16px 20px',marginBottom:12}}>
          <div style={{display:'flex',gap:20,marginBottom:10,flexWrap:'wrap'}}>
            {[
              {label:'/cereri vizitat',val:fmtN(cereriViews),sub:'oameni intrati pe lista'},
              {label:'→ /cerere-noua',val:fmtN(ceNouViews),sub:`${funnelRate.toFixed(0)}% din /cereri`},
              {label:'Conv /cerere-noua',val:`${ceNou&&ceNou.screen_page_views>0?(ceNou.conversions/ceNou.screen_page_views*100).toFixed(1):0}%`,sub:'completeaza formularul'},
            ].map(i=>(
              <div key={i.label} style={{flex:1,minWidth:100}}>
                <p style={{fontSize:22,fontWeight:500,color:C.text,margin:'0 0 2px'}}>{i.val}</p>
                <p style={{fontSize:11,color:C.hint,margin:'0 0 1px'}}>{i.label}</p>
                <p style={{fontSize:11,color:C.muted,margin:0}}>{i.sub}</p>
              </div>
            ))}
          </div>
          <p style={{fontSize:13,color:C.red,margin:0,fontWeight:500}}>
            Problema: {Math.round(100-funnelRate)}% din userii care vad cererile NU ajung sa adauge o cerere noua.
          </p>
        </div>
        <Signal type="negative" title={`Drop masiv ${Math.round(100-funnelRate)}% intre /cereri si /cerere-noua`}
          body="Cel mai mare gap din funnel. Userii vad cererile existente dar nu sunt convinsi sa adauge propria cerere. Cauze probabile: CTA-ul pentru cerere noua nu e vizibil, nu inteleg beneficiul, sau nu sunt logati si fluxul e confuz."/>
        <Signal type="neutral" title="Durata pe /cerere-noua: 203s — formular prea lung sau confuz"
          body="3 minute si 23 secunde pe pagina formularului cu conv rate 1% = uzura mare. Fie formularul are prea multi pasi, fie campurile sunt neclare. Simplificarea formularului sau adaugarea unui progress indicator poate creste conversia cu 30-50%."/>
      </Sec>

      <Sec title="Actiuni concrete recomandate">
        <Action urgency="urgent" impact="Impact: mare" title="Adauga CTA proeminent pe /cereri: 'Adauga cererea ta'"
          body={`${fmtN(cereriViews)} useri/luna vad lista de cereri dar doar ${fmtN(ceNouViews)} (${funnelRate.toFixed(0)}%) ajung la formular. Un buton mare, sticky sau floating 'Adauga cererea ta' vizibil permanent pe /cereri poate creste acest procent la 20-30%, adaugand sute de cereri noi lunar.`}
          fix="Adauga un buton CTA 'Adauga cererea ta' fixed bottom pe /cereri pentru mobile si sticky top pentru desktop. Testeaza varianta cu mesaj de urgenta: 'Agentii din zona ta asteapta cereri — adauga-o acum'. Masoara conv rate /cereri > /cerere-noua."/>
        <Action urgency="urgent" impact="Impact: mare" title="Simplifica formularul /cerere-noua — max 4 campuri in pasul 1"
          body="203s pe formular cu 1% conv rate = formular prea complex. Oamenii abandoneaza. Best practice: primul pas cu maxim 4 campuri (tip proprietate, oras, buget, contact), restul optionale sau in pasul 2 dupa ce userul e deja angajat."
          fix="Redeseneaza /cerere-noua ca multi-step: Pasul 1 - tip, oras, buget (30 secunde). Pasul 2 - detalii optionale. Adauga progress bar '1 din 2'. Testeaza cu Google Optimize sau schimba direct si monitorizeaza conv rate timp de 2 saptamani."/>
        <Action urgency="urgent" impact="Impact: mare" title="Seteaza /home3 ca homepage — converteste de 2.4x mai bine"
          body={`/home3 are ${h3r.toFixed(1)}% conv rate vs ${hpr.toFixed(1)}% pe homepage (${(h3r/Math.max(hpr,0.1)).toFixed(1)}x mai eficient). Cu ${fmtN(hp?.screen_page_views||0)} vizite pe homepage lunar, schimbarea ar aduce ${Math.round((hp?.screen_page_views||0)*(h3r-hpr)/100)} conversii suplimentare/luna fara niciun cost de trafic.`}
          fix="In setarile serverului/CMS, seteaza /home3 ca pagina principala. Alternativ, fa un redirect 301 de la / catre /home3, sau copiaza elementele de pe /home3 (layout, copy, CTA) pe homepage. Monitorizeaza conv rate timp de 14 zile."/>
        <Action urgency="important" impact="Impact: mediu" title="Dubleaza frecventa postarilor pe Social Media"
          body={`Organic Social: ${socialConvR.toFixed(1)}% conv rate, ${fmtN(social?.sessions||0)} sesiuni. E canalul cu cel mai bun ROI pe conversii. Traficul social e volatile si depinde direct de frecventa si consistenta postarilor. Dublarea frecventei = dublu trafic de calitate inalta.`}
          fix="Creeaza un calendar editorial: 1 post/zi pe cel mai activ canal al tau. Foloseste formate care au convertit inainte (verifica GA4 Acquisition > Social). Adauga UTM parameters la linkurile din social pentru tracking precis in GA4."/>
        <Action urgency="important" impact="Impact: mediu" title={`SEO: optimizeaza pentru ${nearTop.length} queries din pozitia 4-10`}
          body={`Ai ${nearTop.length} queries aproape de top 3 in Google. O imbunatatire de 2-3 pozitii poate dubla sau tripla traficul pentru fiecare query. Organic Search are ${organicConvR.toFixed(1)}% conv rate — cel mai eficient canal cost-pe-conversie.`}
          fix={`In Google Search Console, identifica paginile care rankeaza pe pozitia 4-10. Pentru fiecare: adauga 200-300 cuvinte de continut relevant, imbunatateste H1/H2 sa includa query-ul exact, adauga link-uri interne din alte pagini. Prioritizeaza queries cu cele mai multe impressions.`}/>
        <Action urgency="seo" impact="Impact: rapid" title="Activeaza Key Events GA4 — acum zbori orb pe conversii custom"
          body="Fara conversions_signup, offer_accepted si bravo_cerere_noua configurate ca Key Events, nu stii ce canal aduce inregistrari reale vs bounce. Decizia de a investi mai mult in Social vs SEO nu poate fi bazata pe date."
          fix="GA4 Admin - Events - cauta 'conversions_signup' - toggle 'Mark as conversion'. Repeta pentru: conversions_offer_accepted, conversions_bravo_cerere_noua, conversions_bun_venit_agent, conversions_bun_venit_cumparator, conversions_bun_venit_proprietar. Durata: 5 minute."/>
      </Sec>

      <Sec title="Estimare impact implementare">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
          {[
            {label:'CTA pe /cereri',est:`+${Math.round(cereriViews*0.1)} cereri/luna`,col:C.red},
            {label:'Formular simplificat',est:'+30-50% conv rate',col:C.amber},
            {label:'/home3 ca homepage',est:`+${Math.round((hp?.screen_page_views||0)*(h3r-hpr)/100)} conv/luna`,col:C.green},
            {label:'Social x2',est:`+${fmtN(social?.sessions||0)} sesiuni/luna`,col:C.blue},
            {label:'SEO top 3',est:'+50-100% organic',col:C.purple},
          ].map(i=>(
            <div key={i.label} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
              <p style={{fontSize:11,color:C.hint,margin:'0 0 4px'}}>{i.label}</p>
              <p style={{fontSize:14,fontWeight:500,color:i.col,margin:0}}>{i.est}</p>
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
        <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'rgba(255,255,255,.5)',margin:'0 0 4px'}}>Analiza comparativa</p>
        <h2 style={{fontSize:16,fontWeight:500,margin:'0 0 4px'}}>Analiza LP cereri — 3 rute pentru cerere noua</h2>
        <p style={{fontSize:13,color:'rgba(255,255,255,.65)',margin:0}}>
          {fmtN(totalViews)} vizite totale · {fmtN(totalConv)} conversii GA4 · conv rate combinat {totalViews>0?(totalConv/totalViews*100).toFixed(1):0}%
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
              {p.convRate === Math.max(...paths.map(x=>x.convRate)) && p.convRate > 0 && (
                <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:'#F0FDF4',color:C.green}}>best</span>
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
                  <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:8,background:p.color,borderRadius:99,opacity:.7}}/>
                  </div>
                  <span style={{fontSize:11,color:C.muted,width:36,textAlign:'right'}}>{fmtN(p.views)}</span>
                </div>
                {/* Conv bar (scaled to 10% max) */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:10,color:C.hint,width:56,flexShrink:0}}>Conv GA4</span>
                  <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
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
                background:chartMode===v?'#EBF4FC':'transparent',
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
                      <div style={{background:'#ebebE4',borderRadius:99,height:5,overflow:'hidden',marginBottom:2}}>
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
        <Signal type={paths[2].convRate > paths[0].convRate ? 'positive' : 'neutral'}
          title={`/vreau are ${paths[2].convRate.toFixed(2)}% conv rate — ${paths[2].convRate > paths[0].convRate ? 'cel mai eficient' : 'sub asteptari'}`}
          body={`Cu ${fmtN(paths[2].views)} views si ${paths[2].conv} conversii, /vreau are cel mai bun raport. Dar volumul e mic — ${fmtN(paths[0].views)} views pe /cerere-noua vs ${fmtN(paths[2].views)} pe /vreau. Redirectand mai mult trafic spre /vreau ai putea creste conv rate combinat.`}
        />
        {paths[1].conv === 0 && (
          <Signal type="negative"
            title={`/cereri/nou — ${fmtN(paths[1].views)} views, 0 conversii GA4`}
            body="Aceasta pagina primeste trafic dar nu genereaza conversii trackate. Fie Key Event-ul nu e configurat pentru aceasta ruta, fie formularul are o problema tehnica. Verifica in GA4 daca evenimentul bravo_cerere_noua se triggereaza si de pe /cereri/nou."
          />
        )}
        <Signal type="info"
          title="Traficul combinat: 3 rute diferite pentru acelasi flux"
          body={`${fmtN(totalViews)} vizite totale pe cele 3 rute de cerere noua. Consolidarea intr-o singura ruta cu redirect 301 de pe /cerere-noua si /cereri/nou catre /vreau (cel mai eficient) ar putea imbunatati conv rate general si simplifica tracking-ul.`}
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
        <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13}}>
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
            background:catFilter===cat?'#EBF4FC':'transparent',
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
              background:C.card,border:`0.5px solid ${isOn?C.border:'#ebebE4'}`,borderRadius:10,
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

export { TabRecomandari, TabCerereNoua, TabConversii }
