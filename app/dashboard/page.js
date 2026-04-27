'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { C, sum, avg, dlt, fmt, Delta, KPI, Signal, Action, Sec, Grid, LineChart, BarChart, CHART_COLORS } from './components'

/* ─── GRAFICE TAB ──────────────────────────────────────────────────── */
const PRESETS = [
  { id:'combo',  label:'Sesiuni + Conv', metrics:[{field:'sessions',label:'Sesiuni',color:'#3B82C4'},{field:'conversions',label:'Conversii',color:'#D97706'}] },
  { id:'sess',   label:'Sesiuni',        metrics:[{field:'sessions',label:'Sesiuni',color:'#3B82C4'}] },
  { id:'new',    label:'Useri noi',      metrics:[{field:'newusers',label:'Useri noi',color:'#16A34A'}] },
  { id:'conv',   label:'Conversii',      metrics:[{field:'conversions',label:'Conversii',color:'#D97706'}] },
  { id:'eng',    label:'Engagement',     metrics:[{field:'engagement_rate',label:'Engagement',color:'#7C3AED',fmt:'pct'}] },
  { id:'dur',    label:'Durata sesiune', metrics:[{field:'average_session_duration',label:'Durata (s)',color:'#0891B2',fmt:'sec'}] },
]
const RANGES = [{label:'7 zile',days:7},{label:'14 zile',days:14},{label:'30 zile',days:30}]

function Btn({ active, onClick, children, navy }) {
  return (
    <button onClick={onClick} style={{
      padding:'5px 12px', fontSize:12, borderRadius:7, cursor:'pointer',
      border:`0.5px solid ${active?(navy?C.navy:C.blue):C.border}`,
      background:active?(navy?C.navy:'#EBF4FC'):'transparent',
      color:active?(navy?'#fff':C.blue):C.muted, fontWeight:active?500:400
    }}>{children}</button>
  )
}

function TabGrafice({ data }) {
  const [preset,setPreset] = useState('combo')
  const [range,setRange]   = useState(30)
  const daily = (data.daily?.current||[]).slice(-range)
  const gsc   = (data.gsc?.current||[]).slice(-range)
  const active = PRESETS.find(p=>p.id===preset)||PRESETS[0]
  return (
    <div>
      <Grid>
        <KPI label="Sesiuni" curr={sum(daily,'sessions')}/>
        <KPI label="Conversii" curr={sum(daily,'conversions')}/>
        <KPI label="Useri noi" curr={sum(daily,'newusers')}/>
        <KPI label="Eng rate" curr={avg(daily,'engagement_rate')} type="pct"/>
      </Grid>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10,alignItems:'center'}}>
        <span style={{fontSize:12,color:C.hint,marginRight:2}}>Metric:</span>
        {PRESETS.map(p=><Btn key={p.id} active={preset===p.id} onClick={()=>setPreset(p.id)}>{p.label}</Btn>)}
        <div style={{width:1,height:20,background:C.border,margin:'0 6px'}}/>
        <span style={{fontSize:12,color:C.hint}}>Interval:</span>
        {RANGES.map(r=><Btn key={r.days} active={range===r.days} onClick={()=>setRange(r.days)} navy>{r.label}</Btn>)}
      </div>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px',marginBottom:16}}>
        <h4 style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 14px'}}>{active.label} — ultimele {range} zile</h4>
        <LineChart data={daily} metrics={active.metrics} height={220}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px'}}>
          <h4 style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Clicks SEO organic</h4>
          <LineChart data={gsc} metrics={[{field:'organic_google_search_clicks',label:'Clicks',color:'#16A34A'},{field:'organic_google_search_impressions',label:'Impressions',color:'#BBF7D0'}]} height={160}/>
        </div>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px'}}>
          <h4 style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Pozitie medie SEO</h4>
          <LineChart data={gsc} metrics={[{field:'organic_google_search_average_position',label:'Pozitie',color:'#7C3AED',fmt:'dec1'}]} height={160} showLegend={false}/>
        </div>
      </div>
    </div>
  )
}

/* ─── SEMNALE TAB ──────────────────────────────────────────────────── */
function TabSemnale({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const tc=sum(curr,'sessions'), tp=sum(prev,'sessions')
  const cc=sum(curr,'conversions'), cp=sum(prev,'conversions')
  const nc=sum(curr,'newusers'), np=sum(prev,'newusers')
  const gC=sum(data.gsc.current,'organic_google_search_clicks'), gP=sum(data.gsc.previous,'organic_google_search_clicks')
  const custConv=sum(data.conversions,'conversions_signup')+sum(data.conversions,'conversions_offer_accepted')+sum(data.conversions,'conversions_bravo_cerere_noua')
  const social=curr.find(r=>r.session_default_channel_group==='Organic Social')
  const socialP=prev.find(r=>r.session_default_channel_group==='Organic Social')
  const pages=data.pages.current
  const h3=pages.find(p=>p.page_path==='/home3'), hp=pages.find(p=>p.page_path==='/')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0

  const sigs=[]
  const sd=dlt(tc,tp)
  if(sd!==null) {
    if(sd>15) sigs.push({type:"positive",title:"Trafic +" + sd.toFixed(0) + "% fata de luna anterioara",body:tc.toLocaleString("ro") + " sesiuni vs " + tp.toLocaleString("ro")})
    else if(sd<-15) sigs.push({type:"negative",title:"Trafic -" + Math.abs(sd).toFixed(0) + "% fata de luna anterioara",body:tc.toLocaleString("ro") + " sesiuni vs " + tp.toLocaleString("ro") + ". Investigheaza sursa scaderii."})
  }
  if(social&&socialP) {
    const d2=dlt(social.sessions,socialP.sessions)
    if(d2!==null&&Math.abs(d2)>20) sigs.push({type:d2>0?"positive":"negative",title:"Social Media " + (d2>0?"+":"") + d2.toFixed(0) + "%",body:social.sessions + " sesiuni din social. " + (d2>0?"Identifica postul viral si replica formatul.":"Activitate in scadere — verifica frecventa postarilor.")})
  }
  const gD=dlt(gC,gP)
  if(gD!==null&&Math.abs(gD)>10) sigs.push({type:gD>0?'positive':'negative',title:`SEO organic ${gD>0?'(+)':'(-)'}${Math.abs(gD).toFixed(0)}% clicks organice`,body:`${Math.round(gC)} clicks vs ${Math.round(gP)} luna trecuta.`})
  if(custConv===0) sigs.push({type:'neutral',title:'Conversii custom = 0 — Key Events neconfigurate in GA4',body:'conversions_signup, conversions_offer_accepted si conversions_bravo_cerere_noua returneaza 0. GA4 Admin - Events - Mark as conversion.'})
  if(h3r>hpr*1.5&&(h3?.screen_page_views||0)>20) sigs.push({type:'positive',title:`/home3 converteste de ${(h3r/hpr).toFixed(1)}x mai bine decat homepage`,body:`/home3: ${h3r.toFixed(1)}% vs /: ${hpr.toFixed(1)}%. Testeaza /home3 ca homepage principal.`})
  if(sigs.length===0) sigs.push({type:'neutral',title:'Luna stabila — fara anomalii majore',body:`${tc.toLocaleString('ro')} sesiuni, ${cc} conversii GA4.`})

  return (
    <div>
      <Grid>
        <KPI label="Sesiuni" curr={tc} prev={tp}/>
        <KPI label="Useri noi" curr={nc} prev={np}/>
        <KPI label="Conversii GA4" curr={cc} prev={cp}/>
        <KPI label="Clicks SEO" curr={Math.round(gC)} prev={Math.round(gP)}/>
      </Grid>
      <Sec title="Semnalele lunii">
        {sigs.slice(0,4).map((s,i)=><Signal key={i} {...s}/>)}
      </Sec>
      <Sec title="Evolutie 30 zile — Sesiuni si Conversii">
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px'}}>
          <LineChart data={data.daily.current} metrics={[{field:'sessions',label:'Sesiuni',color:'#3B82C4'},{field:'conversions',label:'Conversii',color:'#D97706'}]} height={190}/>
        </div>
      </Sec>
    </div>
  )
}

/* ─── TRAFIC TAB ───────────────────────────────────────────────────── */
function TabTrafic({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const sorted=[...curr].sort((a,b)=>(b.sessions||0)-(a.sessions||0))
  const maxS=sorted[0]?.sessions||1
  return (
    <div>
      <Grid>
        {['Direct','Organic Social','Organic Search','Referral'].map(ch=>{
          const c=curr.find(r=>r.session_default_channel_group===ch)
          const p=prev.find(r=>r.session_default_channel_group===ch)
          return <KPI key={ch} label={ch} curr={c?.sessions||0} prev={p?.sessions||0}/>
        })}
      </Grid>
      <Sec title="Canale — sesiuni, engagement, conversii">
        {sorted.map(row=>{
          const ch=row.session_default_channel_group, p=prev.find(r=>r.session_default_channel_group===ch)
          const d=p?dlt(row.sessions,p.sessions):null, pct=Math.round(row.sessions/maxS*100)
          const convR=row.sessions>0?(row.conversions/row.sessions*100).toFixed(1)+'%':'—'
          const dCol=d===null?C.gray:d>0?C.green:C.red
          return (
            <div key={ch} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:500,color:C.text,width:140,flexShrink:0}}>{ch}</span>
                <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:6,overflow:'hidden'}}>
                  <div style={{width:`${pct}%`,height:6,borderRadius:99,background:C.blue}}/>
                </div>
                <span style={{fontSize:13,color:C.text,width:55,textAlign:'right',flexShrink:0}}>{row.sessions?.toLocaleString('ro')}</span>
                {d!==null&&<span style={{fontSize:11,fontWeight:500,color:dCol,width:42,textAlign:'right',flexShrink:0}}>{d>0?'+':''}{ d.toFixed(0)}%</span>}
              </div>
              <div style={{display:'flex',gap:20,fontSize:12,color:C.hint}}>
                <span>Conv: <strong style={{color:C.text}}>{convR}</strong></span>
                <span>Eng: <strong style={{color:C.text}}>{Math.round((row.engagement_rate||0)*100)}%</strong></span>
                <span>Dur: <strong style={{color:C.text}}>{Math.round(row.average_session_duration||0)}s</strong></span>
                {p&&<span>Prev: <strong style={{color:C.text}}>{p.sessions}</strong></span>}
              </div>
            </div>
          )
        })}
      </Sec>
      <Sec title="Conversii per canal">
        <BarChart data={sorted} labelField="session_default_channel_group" valueField="conversions" color={C.amber}/>
      </Sec>
    </div>
  )
}

/* ─── SEO TAB ──────────────────────────────────────────────────────── */
function TabSEO({ data }) {
  const curr=data.gsc.current, prev=data.gsc.previous
  const queries=data.gsc.queries||[], gscPages=data.gsc.pages||[]
  const cCl=sum(curr,'organic_google_search_clicks'), pCl=sum(prev,'organic_google_search_clicks')
  const cIm=sum(curr,'organic_google_search_impressions'), pIm=sum(prev,'organic_google_search_impressions')
  const cCtr=avg(curr,'organic_google_search_click_through_rate'), pCtr=avg(prev,'organic_google_search_click_through_rate')
  const cPos=avg(curr,'organic_google_search_average_position'), pPos=avg(prev,'organic_google_search_average_position')
  const insights=[]
  const gD=dlt(cCl,pCl)
  if(gD!==null&&Math.abs(gD)>10) insights.push({type:gD>0?'positive':'negative',title:`Clicks organice ${gD>0?'+':''}${gD.toFixed(0)}%`,body:`${Math.round(cCl)} clicks vs ${Math.round(pCl)} luna trecuta.`})
  const lowCtr=queries.filter(q=>(q.organic_google_search_impressions||0)>50&&(q.organic_google_search_click_through_rate||0)<0.03).sort((a,b)=>(b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  if(lowCtr) insights.push({type:'neutral',title:`CTR scazut: "${lowCtr.query||'(query)'}" — ${Math.round(lowCtr.organic_google_search_impressions)} impressions`,body:`CTR ${((lowCtr.organic_google_search_click_through_rate||0)*100).toFixed(1)}%. Optimizeaza titlul paginii si meta description.`})
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=10).sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]
  if(nearTop) insights.push({type:'neutral',title:`"${nearTop.query||'(query)'}" pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — fruct la indemana`,body:'Pe pagina 1 dar nu in top 3. O imbunatatire mica de continut poate dubla traficul.'})
  const topQ=[...queries].sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0)).slice(0,12)
  const topP=[...gscPages].sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0)).slice(0,10)
  return (
    <div>
      <Grid>
        <KPI label="Clicks organice" curr={Math.round(cCl)} prev={Math.round(pCl)}/>
        <KPI label="Impressions" curr={Math.round(cIm)} prev={Math.round(pIm)}/>
        <KPI label="CTR mediu" curr={cCtr} prev={pCtr} type="pct"/>
        <KPI label="Pozitie medie" curr={cPos} prev={pPos} type="dec1" inv/>
      </Grid>
      {insights.length>0&&<Sec title="Observatii SEO">{insights.map((s,i)=><Signal key={i} {...s}/>)}</Sec>}
      <Sec title="Evolutie clicks si impressions">
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px'}}>
          <LineChart data={curr} metrics={[{field:'organic_google_search_clicks',label:'Clicks',color:'#16A34A'},{field:'organic_google_search_impressions',label:'Impressions',color:'#BBF7D0'}]} height={180}/>
        </div>
      </Sec>
      {topQ.length>0&&(
        <Sec title="Top queries dupa clicks">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Query','Clicks','Impressions','CTR','Pozitie'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {topQ.map((q,i)=>{
                  const pos=q.organic_google_search_average_position||0
                  const ctr=((q.organic_google_search_click_through_rate||0)*100)
                  return <tr key={i} style={{borderBottom:`0.5px solid ${C.border}`}}>
                    <td style={{padding:'7px 8px',color:C.text,maxWidth:220}}>{q.query||'(not provided)'}</td>
                    <td style={{padding:'7px 8px',color:C.muted,fontWeight:500}}>{Math.round(q.organic_google_search_clicks||0)}</td>
                    <td style={{padding:'7px 8px',color:C.muted}}>{Math.round(q.organic_google_search_impressions||0)}</td>
                    <td style={{padding:'7px 8px',color:ctr<2?C.red:ctr>5?C.green:C.muted}}>{ctr.toFixed(1)}%</td>
                    <td style={{padding:'7px 8px',fontWeight:500,color:pos<=3?C.green:pos<=10?C.amber:C.red}}>{pos.toFixed(1)}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </Sec>
      )}
      {topP.length>0&&<Sec title="Top pagini organice"><BarChart data={topP} labelField="page_path" valueField="organic_google_search_clicks" color={C.green}/></Sec>}
    </div>
  )
}

/* ─── PAGINI TAB ───────────────────────────────────────────────────── */
function TabPagini({ data }) {
  const curr=data.pages.current
  const [sortBy,setSortBy]=useState('views')
  const HL=['/home3','/simplu','/']
  const sorted=[...curr].sort((a,b)=>{
    if(sortBy==='views') return (b.screen_page_views||0)-(a.screen_page_views||0)
    if(sortBy==='conv')  return (b.conversions/Math.max(b.screen_page_views,1))-(a.conversions/Math.max(a.screen_page_views,1))
    return (b.engagement_rate||0)-(a.engagement_rate||0)
  }).slice(0,20)
  const lowEng=curr.filter(p=>(p.screen_page_views||0)>=20&&(p.engagement_rate||0)<0.80).sort((a,b)=>a.engagement_rate-b.engagement_rate).slice(0,5)
  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
        <span style={{fontSize:12,color:C.hint}}>Sorteaza:</span>
        {[['views','Views'],['conv','Conv rate'],['eng','Engagement']].map(([v,l])=>(
          <Btn key={v} active={sortBy===v} onClick={()=>setSortBy(v)}>{l}</Btn>
        ))}
      </div>
      <Sec title="Top pagini">
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
              {['Pagina','Views','Users','Eng%','Conv%','Durata'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {sorted.map(p=>{
                const conv=p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
                const isHL=HL.includes(p.page_path)
                return <tr key={p.page_path} style={{borderBottom:`0.5px solid ${C.border}`,background:isHL?'#F0F9FF':'transparent'}}>
                  <td style={{padding:'7px 8px',color:isHL?C.blue:C.text,fontFamily:'monospace',fontSize:11}}>{isHL?'* ':''}{p.page_path}</td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{(p.screen_page_views||0).toLocaleString('ro')}</td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{p.active_users||0}</td>
                  <td style={{padding:'7px 8px',color:(p.engagement_rate||0)<0.8?C.red:C.muted,fontWeight:(p.engagement_rate||0)<0.8?500:400}}>{Math.round((p.engagement_rate||0)*100)}%</td>
                  <td style={{padding:'7px 8px',color:conv>5?C.green:conv>2?C.blue:C.muted,fontWeight:conv>5?500:400}}>{conv.toFixed(1)}%</td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{Math.round(p.average_session_duration||0)}s</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Sec>
      {lowEng.length>0&&<Sec title="Pagini cu engagement scazut">
        {lowEng.map(p=><div key={p.page_path} style={{display:'flex',gap:12,padding:'8px 12px',background:'#FEF2F2',borderRadius:8,marginBottom:6,fontSize:13}}>
          <span style={{fontFamily:'monospace',fontSize:11,flex:1}}>{p.page_path}</span>
          <span style={{color:C.red,fontWeight:500}}>{Math.round((p.engagement_rate||0)*100)}%</span>
          <span style={{color:C.muted}}>{p.screen_page_views} views</span>
        </div>)}
      </Sec>}
      <Sec title="Top pagini dupa conversii"><BarChart data={curr.filter(p=>(p.conversions||0)>0)} labelField="page_path" valueField="conversions" color={C.amber} maxBars={10}/></Sec>
    </div>
  )
}

/* ─── FUNNEL TAB ───────────────────────────────────────────────────── */
function TabFunnel({ data }) {
  const curr=data.traffic.current, pages=data.pages.current
  const totalSess=sum(curr,'sessions'), totalConv=sum(curr,'conversions')
  const get=path=>pages.find(p=>p.page_path===path)
  const h3=get('/home3'),simp=get('/simplu'),hp=get('/'),login=get('/login'),ceNou=get('/cerere-noua')
  const convs=data.conversions
  const signup=sum(convs,'conversions_signup'), offers=sum(convs,'conversions_offer_accepted'), cereri=sum(convs,'conversions_bravo_cerere_noua')
  const ag=sum(convs,'conversions_bun_venit_agent'), cum=sum(convs,'conversions_bun_venit_cumparator'), prop=sum(convs,'conversions_bun_venit_proprietar')
  const custTotal=signup+offers+cereri+ag+cum+prop
  const rate=p=>p&&p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
  const landingViews=(h3?.screen_page_views||0)+(simp?.screen_page_views||0)+(hp?.screen_page_views||0)
  const steps=[
    {label:'Sesiuni totale',v:totalSess,pct:100,col:C.blue},
    {label:'Landing pages (/, /home3, /simplu)',v:landingViews,pct:totalSess>0?landingViews/totalSess*100:0,col:C.blue},
    {label:'/cerere-noua vizitat',v:ceNou?.screen_page_views||0,pct:totalSess>0?(ceNou?.screen_page_views||0)/totalSess*100:0,col:C.amber},
    {label:'/login vizitat',v:login?.screen_page_views||0,pct:totalSess>0?(login?.screen_page_views||0)/totalSess*100:0,col:C.amber},
    {label:'Conversii GA4 totale',v:totalConv,pct:totalSess>0?totalConv/totalSess*100:0,col:C.green},
  ]
  const hpr=rate(hp)
  return (
    <div>
      <Sec title="Funnel principal">
        {steps.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontSize:12,color:C.muted,width:270,flexShrink:0}}>{s.label}</span>
            <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
              <div style={{width:`${Math.min(100,s.pct)}%`,height:8,borderRadius:99,background:s.col}}/>
            </div>
            <span style={{fontSize:13,fontWeight:500,color:C.text,width:55,textAlign:'right'}}>{s.v.toLocaleString('ro')}</span>
            <span style={{fontSize:11,color:C.hint,width:36,textAlign:'right'}}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </Sec>
      <Sec title="Conv rate landing pages">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[{label:'/home3',page:h3,hl:true},{label:'/simplu',page:simp,hl:true},{label:'/ homepage',page:hp,hl:false}].map(p=>{
            const r2=rate(p.page), better=p.hl&&r2>hpr
            return <div key={p.label} style={{background:better?'#F0FDF4':C.card,border:`0.5px solid ${better?'#86EFAC':C.border}`,borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
              <p style={{fontSize:24,fontWeight:500,color:r2>5?C.green:C.text,margin:'0 0 4px'}}>{r2.toFixed(1)}%</p>
              <p style={{fontSize:11,color:C.hint,margin:0}}>{p.label}</p>
              <p style={{fontSize:11,color:C.hint,margin:'2px 0 0'}}>{p.page?.screen_page_views||0} views</p>
            </div>
          })}
        </div>
      </Sec>
      <Sec title="Conversii custom (Key Events)">
        {custTotal===0?(
          <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'14px 16px'}}>
            <p style={{fontSize:13,color:C.red,margin:0}}>Toate conversiile custom returneaza 0. GA4 Admin - Events - Mark as conversion: conversions_signup, conversions_offer_accepted, conversions_bravo_cerere_noua, bun_venit_agent/cumparator/proprietar.</p>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
            {[['Sign-ups',signup],['Oferte acc.',offers],['Cereri noi',cereri],['Agent',ag],['Cumparator',cum],['Proprietar',prop]].map(([l,v])=>(
              <div key={l} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px',textAlign:'center'}}>
                <p style={{fontSize:22,fontWeight:500,color:v>0?C.green:C.hint,margin:'0 0 4px'}}>{v}</p>
                <p style={{fontSize:11,color:C.hint,margin:0}}>{l}</p>
              </div>
            ))}
          </div>
        )}
      </Sec>
    </div>
  )
}

/* ─── ACTIUNI TAB ──────────────────────────────────────────────────── */
function TabActiuni({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const pages=data.pages.current, queries=data.gsc.queries||[]
  const cc=sum(curr,'conversions'), cp=sum(prev,'conversions')
  const custConv=sum(data.conversions,'conversions_signup')+sum(data.conversions,'conversions_offer_accepted')+sum(data.conversions,'conversions_bravo_cerere_noua')
  const h3=pages.find(p=>p.page_path==='/home3'), hp=pages.find(p=>p.page_path==='/')
  const reset=pages.find(p=>p.page_path==='/resetare-parola')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0
  const lowCtr=queries.filter(q=>(q.organic_google_search_impressions||0)>100&&(q.organic_google_search_click_through_rate||0)<0.03).sort((a,b)=>(b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=8).sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]

  const actions=[]
  if(custConv===0) actions.push({urgency:'urgent',title:'Activeaza conversiile custom in GA4 — zbori orb',body:'conversions_signup, conversions_offer_accepted si conversions_bravo_cerere_noua returneaza 0. Fara aceste date nu stii cati useri se inregistreaza sau cate cereri si oferte sunt create zilnic.',fix:'GA4 Admin - Events - cauta "conversions_signup" > toggle "Mark as conversion". Repeta pentru offer_accepted, bravo_cerere_noua, bun_venit_agent/cumparator/proprietar. Durata: 5 minute.'})
  if(h3r>hpr*1.5&&(h3?.screen_page_views||0)>20) actions.push({urgency:'urgent',title:`/home3 converteste de ${(h3r/hpr).toFixed(1)}x mai bine decat homepage`,body:`/home3: ${h3r.toFixed(1)}% conv rate vs /: ${hpr.toFixed(1)}%. Cu acelasi trafic ai putea obtine de ${(h3r/hpr).toFixed(1)}x mai multe conversii fara niciun cost suplimentar.`,fix:'Seteaza /home3 ca homepage principal pentru 2 saptamani si monitorizeaza conv rate. Sau analizeaza ce e diferit pe /home3 (copy, CTA, layout) si aplica acele elemente pe /.'})
  if(lowCtr) actions.push({urgency:'important',title:`SEO: "${lowCtr.query||'query'}" — ${Math.round(lowCtr.organic_google_search_impressions)} impressions, CTR ${((lowCtr.organic_google_search_click_through_rate||0)*100).toFixed(1)}%`,body:`Multi oameni vad HomePitch pentru acest query dar nu dau click. Titlul paginii sau meta description nu sunt suficient de convingatoare.`,fix:`In GSC gaseste pagina care apare pentru acest query. Rescrie titlul sa contina beneficiul principal si sa fie sub 60 caractere. Adauga meta description cu un CTA clar. Monitorizeaza CTR timp de 2 saptamani.`})
  if(nearTop) actions.push({urgency:'important',title:`SEO: "${nearTop.query||'query'}" pe pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — fruct la indemana`,body:`Esti pe pagina 1 dar nu in top 3 pentru acest query. O imbunatatire mica poate dubla sau tripla traficul organic.`,fix:`Pe pagina care rankeaza pentru acest query: adauga mai mult continut relevant, imbunatateste H1/H2 sa includa query-ul exact, adauga link-uri interne din pagini cu autoritate mai mare.`})
  if(reset&&(reset.engagement_rate||0)<0.6&&(reset.screen_page_views||0)>10) actions.push({urgency:'important',title:`/resetare-parola — engagement ${Math.round((reset.engagement_rate||0)*100)}% (posibil broken)`,body:`${reset.screen_page_views} vizite dar ${Math.round((1-(reset.engagement_rate||0))*100)}% bounce imediat. Posibil emailul nu ajunge sau linkul e expirat.`,fix:'Testeaza manual fluxul complet: solicita reset > verifica ca emailul ajunge in max 2 minute > verifica ca linkul functioneaza si nu expira prematur.'})
  const cd=dlt(cc,cp)
  if(cd!==null&&cd<-20) actions.push({urgency:'urgent',title:`Conversii -${Math.abs(cd).toFixed(0)}% fata de luna anterioara`,body:`${cc} conversii vs ${cp}. Scadere semnificativa — posibila problema tehnica sau calitate mai slaba a traficului.`,fix:'Verifica in GA4 pagini cu trafic crescut si conversii zero. Verifica /cerere-noua si /home3 pentru erori JS.'})
  if(actions.length===0) actions.push({urgency:'luna asta',title:'Luna fara alerte — focus pe crestere organica',body:'Metricile sunt stabile. Moment bun pentru investit in continut SEO si optimizari de conversie pe termen lung.',fix:'Adauga 2-3 pagini de continut targetand queries din GSC cu impressions mari si CTR scazut.'})

  return (
    <div>
      <Sec title={`${Math.min(actions.length,5)} actiuni prioritizate`}>
        {actions.slice(0,5).map((a,i)=><Action key={i} {...a}/>)}
      </Sec>
      <Sec title="Context metrici">
        <Grid>
          <KPI label="Conversii luna" curr={cc} prev={cp}/>
          <KPI label="Conv custom" curr={custConv}/>
          <KPI label="/home3 conv rate" curr={h3r} type="pctN"/>
          <KPI label="/ conv rate" curr={hpr} type="pctN"/>
        </Grid>
      </Sec>
    </div>
  )
}

/* ─── MAIN ─────────────────────────────────────────────────────────── */
const TABS = [
  {id:'semnale',label:'Semnale'},
  {id:'grafice', label:'Grafice'},
  {id:'trafic',  label:'Trafic'},
  {id:'seo',     label:'SEO'},
  {id:'pagini',  label:'Pagini'},
  {id:'funnel',  label:'Funnel'},
  {id:'actiuni', label:'Actiuni'},
]

export default function Dashboard() {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState('semnale')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/report')
      if(!res.ok) throw new Error(`${res.status}`)
      const d=await res.json()
      if(d.error) throw new Error(d.error)
      setData(d)
    }catch(e){setError('Eroare: '+e.message)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{load()},[load])

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'})
    window.location.href='/login'
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 20px',display:'flex',alignItems:'center',height:52,position:'sticky',top:0,zIndex:10}}>
        <div style={{width:26,height:26,borderRadius:6,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12,marginRight:10}}>H</div>
        <span style={{fontSize:14,fontWeight:500,color:C.text}}>HomePitch Analytics</span>
        {data&&<span style={{fontSize:11,color:C.hint,marginLeft:10}}>{data.periodLabel}</span>}
        <div style={{flex:1}}/>
        <button onClick={load} style={{padding:'5px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer',marginRight:6}}>Reload</button>
        <button onClick={logout} style={{padding:'5px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>Iesi</button>
      </div>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 20px',display:'flex',gap:2,overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'11px 14px',fontSize:12,fontWeight:500,border:'none',
            borderBottom:`2px solid ${tab===t.id?C.blue:'transparent'}`,
            background:'transparent',color:tab===t.id?C.blue:C.muted,cursor:'pointer',whiteSpace:'nowrap'
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{maxWidth:920,margin:'0 auto',padding:'24px 16px'}}>
        {loading&&<div style={{textAlign:'center',padding:'80px 0',color:C.muted,fontSize:14}}>Se incarca datele din GA4 si GSC via Windsor.ai...</div>}
        {error&&<div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'16px 20px'}}><p style={{color:C.red,fontSize:14,margin:0}}>{error}</p></div>}
        {data&&!loading&&(<>
          {tab==='semnale'&&<TabSemnale data={data}/>}
          {tab==='grafice'&&<TabGrafice data={data}/>}
          {tab==='trafic' &&<TabTrafic  data={data}/>}
          {tab==='seo'    &&<TabSEO     data={data}/>}
          {tab==='pagini' &&<TabPagini  data={data}/>}
          {tab==='funnel' &&<TabFunnel  data={data}/>}
          {tab==='actiuni'&&<TabActiuni data={data}/>}
          <div style={{marginTop:40,paddingTop:16,borderTop:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:C.hint}}>Generat {new Date(data.generatedAt).toLocaleString('ro-RO')} | Windsor.ai - GA4 + GSC</span>
            <span style={{fontSize:11,color:C.hint}}>HomePitch.ro</span>
          </div>
        </>)}
      </div>
    </div>
  )
}
