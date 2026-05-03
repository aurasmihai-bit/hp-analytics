'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { C, COLORS, sum, avg, dlt, fmt, fmtN, Delta, KPI, Signal, Action, Sec, Grid, Card, LineChart, BarChart, PageLink, BASE_URL } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'

/* ─── PERIOD SELECTOR ──────────────────────────────────────────────── */
const PERIODS = [
  {label:'7 zile',  days:7},
  {label:'14 zile', days:14},
  {label:'30 zile', days:30},
  {label:'60 zile', days:60},
  {label:'90 zile', days:90},
]

function PeriodBar({ days, onChange }) {
  return (
    <div style={{display:'flex',gap:4,alignItems:'center',marginLeft:'auto'}}>
      <span style={{fontSize:11,color:C.hint,marginRight:4}}>Interval:</span>
      {PERIODS.map(p=>(
        <button key={p.days} onClick={()=>onChange(p.days)} style={{
          padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',fontWeight:days===p.days?500:400,
          border:`0.5px solid ${days===p.days?C.navy:C.border}`,
          background:days===p.days?C.navy:'transparent',
          color:days===p.days?'#fff':C.muted
        }}>{p.label}</button>
      ))}
    </div>
  )
}

/* ─── GRAFICE ──────────────────────────────────────────────────────── */
const PRESETS = [
  {id:'combo', label:'Sesiuni + Conv', metrics:[{field:'sessions',label:'Sesiuni',color:'#3B82C4'},{field:'conversions',label:'Conversii',color:'#D97706'}]},
  {id:'sess',  label:'Sesiuni',        metrics:[{field:'sessions',label:'Sesiuni',color:'#3B82C4'}]},
  {id:'new',   label:'Useri noi',      metrics:[{field:'newusers',label:'Useri noi',color:'#16A34A'}]},
  {id:'conv',  label:'Conversii',      metrics:[{field:'conversions',label:'Conversii',color:'#D97706'}]},
  {id:'eng',   label:'Engagement',     metrics:[{field:'engagement_rate',label:'Engagement',color:'#7C3AED',fmt:'pct'}]},
  {id:'dur',   label:'Durata',         metrics:[{field:'average_session_duration',label:'Durata (s)',color:'#0891B2',fmt:'sec'}]},
]

function Chip({ active, onClick, navy, children }) {
  return <button onClick={onClick} style={{padding:'5px 12px',fontSize:12,borderRadius:7,cursor:'pointer',fontWeight:active?500:400,border:`0.5px solid ${active?(navy?C.navy:C.blue):C.border}`,background:active?(navy?C.navy:'#EBF4FC'):'transparent',color:active?(navy?'#fff':C.blue):C.muted}}>{children}</button>
}

function TabGrafice({ data }) {
  const [preset,setPreset]=useState('combo')
  const daily=data.daily?.current||[]
  const gsc=data.gsc?.current||[]
  const active=PRESETS.find(p=>p.id===preset)||PRESETS[0]
  return (
    <div>
      <Grid>
        <KPI label="Sesiuni totale" curr={sum(daily,'sessions')}/>
        <KPI label="Conversii" curr={sum(daily,'conversions')}/>
        <KPI label="Useri noi" curr={sum(daily,'newusers')}/>
        <KPI label="Eng rate" curr={avg(daily,'engagement_rate')} type="pct"/>
      </Grid>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
        <span style={{fontSize:12,color:C.hint}}>Metric:</span>
        {PRESETS.map(p=><Chip key={p.id} active={preset===p.id} onClick={()=>setPreset(p.id)}>{p.label}</Chip>)}
      </div>
      <Card style={{marginBottom:16}}>
        <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 14px'}}>{active.label}</p>
        <LineChart data={daily} metrics={active.metrics} height={220}/>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Clicks SEO organic</p>
          <LineChart data={gsc} metrics={[{field:'organic_google_search_clicks',label:'Clicks',color:'#16A34A'},{field:'organic_google_search_impressions',label:'Impressions',color:'#BBF7D0'}]} height={160}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Pozitie medie SEO</p>
          <LineChart data={gsc} metrics={[{field:'organic_google_search_average_position',label:'Pozitie',color:'#7C3AED',fmt:'dec1'}]} height={160} showLegend={false}/>
        </Card>
      </div>
    </div>
  )
}

/* ─── SEMNALE ──────────────────────────────────────────────────────── */
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
  const cereriPage=pages.find(p=>p.page_path==='/cereri')
  const ceNouPage=pages.find(p=>p.page_path==='/cerere-noua')
  const funnelDrop=cereriPage&&ceNouPage?((ceNouPage.screen_page_views/cereriPage.screen_page_views)*100):null
  const sigs=[]
  const sd=dlt(tc,tp)
  if(sd!==null){
    if(sd>15) sigs.push({type:'positive',title:`Trafic +${sd.toFixed(0)}% fata de perioada anterioara`,body:`${fmtN(tc)} sesiuni vs ${fmtN(tp)}.`})
    else if(sd<-15) sigs.push({type:'negative',title:`Trafic -${Math.abs(sd).toFixed(0)}% fata de perioada anterioara`,body:`${fmtN(tc)} sesiuni vs ${fmtN(tp)}. Investigheaza sursa scaderii.`})
    else sigs.push({type:'neutral',title:`Trafic stabil — ${fmtN(tc)} sesiuni`,body:`Variatie de ${Math.abs(sd).toFixed(0)}% fata de perioada anterioara.`})
  }
  if(social&&socialP){
    const d2=dlt(social.sessions,socialP.sessions)
    if(d2!==null&&Math.abs(d2)>20) sigs.push({type:d2>0?'positive':'negative',title:`Social Media ${d2>0?'+':''}${d2.toFixed(0)}%`,body:`${fmtN(social.sessions)} sesiuni din social. ${d2>0?'Identifica postul viral si replica formatul.':'Activitate in scadere — verifica frecventa postarilor.'}`})
  }
  if(funnelDrop!==null) sigs.push({type:funnelDrop<15?'negative':'neutral',title:`Funnel cerere: ${funnelDrop.toFixed(0)}% din /cereri ajung la /cerere-noua`,body:`${fmtN(cereriPage?.screen_page_views)} vizite pe /cereri, doar ${fmtN(ceNouPage?.screen_page_views)} pe /cerere-noua. ${funnelDrop<15?'Drop major — adauga CTA mai vizibil pe lista de cereri.':'Drop normal dar optimizabil.'}`})
  const gD=dlt(gC,gP)
  if(gD!==null&&Math.abs(gD)>10) sigs.push({type:gD>0?'positive':'negative',title:`SEO: ${gD>0?'+':''}${gD.toFixed(0)}% clicks organice`,body:`${Math.round(gC)} clicks vs ${Math.round(gP)} perioada anterioara.`})
  if(custConv===0) sigs.push({type:'neutral',title:'Conversii custom = 0 — Key Events neconfigurate',body:'conversions_signup, offer_accepted si bravo_cerere_noua returneaza 0. GA4 Admin - Events - Mark as conversion.'})
  if(h3r>hpr*1.5&&(h3?.screen_page_views||0)>20) sigs.push({type:'positive',title:`/home3 converteste de ${(h3r/hpr).toFixed(1)}x mai bine decat homepage`,body:`/home3: ${h3r.toFixed(1)}% vs /: ${hpr.toFixed(1)}%. Potentialul de crestere e deja in site.`})
  return (
    <div>
      <Grid>
        <KPI label="Sesiuni" curr={tc} prev={tp}/>
        <KPI label="Useri noi" curr={nc} prev={np}/>
        <KPI label="Conversii" curr={cc} prev={cp}/>
        <KPI label="Clicks SEO" curr={Math.round(gC)} prev={Math.round(gP)}/>
      </Grid>
      <Sec title="Semnalele perioadei">
        {sigs.slice(0,5).map((s,i)=><Signal key={i} {...s}/>)}
      </Sec>
      <Sec title="Evolutie sesiuni si conversii">
        <Card>
          <LineChart data={data.daily.current} metrics={[{field:'sessions',label:'Sesiuni',color:'#3B82C4'},{field:'conversions',label:'Conversii',color:'#D97706'}]} height={190}/>
        </Card>
      </Sec>
    </div>
  )
}

/* ─── TRAFIC ───────────────────────────────────────────────────────── */
function TabTrafic({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const sorted=[...curr].sort((a,b)=>(b.sessions||0)-(a.sessions||0))
  const maxS=sorted[0]?.sessions||1
  const daily=data.daily?.byChannel||[]
  const chColors={'Direct':'#3B82C4','Organic Social':'#16A34A','Organic Search':'#D97706','Referral':'#DC2626','Unassigned':'#6B7280','Email':'#7C3AED'}
  return (
    <div>
      <Grid>
        {['Direct','Organic Social','Organic Search','Referral'].map(ch=>{
          const c=curr.find(r=>r.session_default_channel_group===ch)
          const p=prev.find(r=>r.session_default_channel_group===ch)
          return <KPI key={ch} label={ch} curr={c?.sessions||0} prev={p?.sessions||0} sub={c&&c.sessions>0?`${((c.conversions||0)/c.sessions*100).toFixed(1)}% conv rate`:undefined}/>
        })}
      </Grid>
      <Sec title="Canale de trafic">
        {sorted.map(row=>{
          const ch=row.session_default_channel_group
          const p=prev.find(r=>r.session_default_channel_group===ch)
          const d=p?dlt(row.sessions,p.sessions):null
          const pct=Math.round(row.sessions/maxS*100)
          const convR=row.sessions>0?(row.conversions/row.sessions*100).toFixed(1)+'%':'—'
          const dCol=d===null?C.gray:d>0?C.green:C.red
          const col=chColors[ch]||C.blue
          return (
            <div key={ch} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:col,flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:500,color:C.text,width:130,flexShrink:0}}>{ch}</span>
                <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:6,overflow:'hidden'}}>
                  <div style={{width:`${pct}%`,height:6,borderRadius:99,background:col}}/>
                </div>
                <span style={{fontSize:13,color:C.text,width:52,textAlign:'right',flexShrink:0}}>{fmtN(row.sessions)}</span>
                {d!==null&&<span style={{fontSize:11,fontWeight:500,color:dCol,width:40,textAlign:'right',flexShrink:0}}>{d>0?'+':''}{ d.toFixed(0)}%</span>}
              </div>
              <div style={{display:'flex',gap:18,marginLeft:20,fontSize:12,color:C.hint,flexWrap:'wrap'}}>
                <span>Conv rate: <strong style={{color:C.text}}>{convR}</strong></span>
                <span>Eng: <strong style={{color:C.text}}>{Math.round((row.engagement_rate||0)*100)}%</strong></span>
                <span>Dur: <strong style={{color:C.text}}>{Math.round(row.average_session_duration||0)}s</strong></span>
                <span>Useri noi: <strong style={{color:C.text}}>{fmtN(row.newusers)}</strong></span>
                {p&&<span>Prev: <strong style={{color:C.muted}}>{fmtN(p.sessions)}</strong></span>}
              </div>
            </div>
          )
        })}
      </Sec>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Sec title="Conversii per canal">
          <Card style={{padding:'12px 16px'}}>
            <BarChart data={sorted} labelField="session_default_channel_group" valueField="conversions" color={C.amber}/>
          </Card>
        </Sec>
        <Sec title="Conv rate per canal">
          <Card style={{padding:'12px 16px'}}>
            <BarChart data={sorted.map(r=>({...r,conv_rate:r.sessions>0?r.conversions/r.sessions*100:0}))} labelField="session_default_channel_group" valueField="conv_rate" color={C.green}/>
          </Card>
        </Sec>
      </div>
    </div>
  )
}

/* ─── SEO ──────────────────────────────────────────────────────────── */
function TabSEO({ data }) {
  const curr=data.gsc.current, prev=data.gsc.previous
  const queries=data.gsc.queries||[], gscPages=data.gsc.pages||[]
  const cCl=sum(curr,'organic_google_search_clicks'), pCl=sum(prev,'organic_google_search_clicks')
  const cIm=sum(curr,'organic_google_search_impressions'), pIm=sum(prev,'organic_google_search_impressions')
  const cCtr=avg(curr,'organic_google_search_click_through_rate'), pCtr=avg(prev,'organic_google_search_click_through_rate')
  const cPos=avg(curr,'organic_google_search_average_position'), pPos=avg(prev,'organic_google_search_average_position')
  const insights=[]
  const gD=dlt(cCl,pCl)
  if(gD!==null&&Math.abs(gD)>10) insights.push({type:gD>0?'positive':'negative',title:`Clicks organice ${gD>0?'+':''}${gD.toFixed(0)}%`,body:`${Math.round(cCl)} clicks vs ${Math.round(pCl)} perioada anterioara.`})
  const lowCtr=queries.filter(q=>(q.organic_google_search_impressions||0)>50&&(q.organic_google_search_click_through_rate||0)<0.03).sort((a,b)=>(b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  if(lowCtr) insights.push({type:'neutral',title:`CTR scazut: "${lowCtr.query||'(query)'}" — ${Math.round(lowCtr.organic_google_search_impressions)} impressions`,body:`CTR ${((lowCtr.organic_google_search_click_through_rate||0)*100).toFixed(1)}%. Optimizeaza titlul si meta description.`})
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=10).sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]
  if(nearTop) insights.push({type:'neutral',title:`"${nearTop.query||'(query)'}" pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — oportunitate top 3`,body:'Pe pagina 1 dar nu in top 3. Imbunatatire mica de continut poate dubla traficul.'})
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
        <Card>
          <LineChart data={curr} metrics={[{field:'organic_google_search_clicks',label:'Clicks',color:'#16A34A'},{field:'organic_google_search_impressions',label:'Impressions',color:'#BBF7D0'}]} height={180}/>
        </Card>
      </Sec>
      {topQ.length>0&&(
        <Sec title="Top queries dupa clicks">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Query','Clicks','Impr.','CTR','Pozitie'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {topQ.map((q,i)=>{
                  const pos=q.organic_google_search_average_position||0
                  const ctr=((q.organic_google_search_click_through_rate||0)*100)
                  return <tr key={i} style={{borderBottom:`0.5px solid ${C.border}`}}>
                    <td style={{padding:'7px 8px',color:C.text}}>{q.query||'(not provided)'}</td>
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
      {topP.length>0&&<Sec title="Top pagini organice"><Card style={{padding:'12px 16px'}}><BarChart data={topP} labelField="page_path" valueField="organic_google_search_clicks" color={C.green}/></Card></Sec>}
    </div>
  )
}

/* ─── PAGINI ───────────────────────────────────────────────────────── */
function TabPagini({ data }) {
  const curr=data.pages.current
  const prev=data.pages.previous||[]
  const prevMap={}
  for(const p of prev){
    if(!prevMap[p.page_path]) prevMap[p.page_path]={...p}
    else Object.keys(p).forEach(f=>{if(f!=='page_path'&&typeof p[f]==='number') prevMap[p.page_path][f]=(prevMap[p.page_path][f]||0)+p[f]})
  }
  for(const p of curr){
    if(prevMap[p.page_path]) Object.keys(p).forEach(f=>{if(f!=='page_path'&&typeof p[f]==='number') prevMap[p.page_path][f]=Math.max(0,(prevMap[p.page_path][f]||0)-p[f])})
  }
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
          <button key={v} onClick={()=>setSortBy(v)} style={{padding:'5px 12px',fontSize:12,borderRadius:7,cursor:'pointer',border:`0.5px solid ${sortBy===v?C.blue:C.border}`,background:sortBy===v?'#EBF4FC':'transparent',color:sortBy===v?C.blue:C.muted,fontWeight:sortBy===v?500:400}}>{l}</button>
        ))}
      </div>
      <Sec title="Top pagini">
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
              {['Pagina','Views','Delta','Eng%','Conv%','Durata'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {sorted.map(p=>{
                const conv=p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
                const isHL=HL.includes(p.page_path)
                const pp=prevMap[p.page_path]
                return <tr key={p.page_path} style={{borderBottom:`0.5px solid ${C.border}`,background:isHL?'#F0F9FF':'transparent'}}>
                  <td style={{padding:'7px 8px',color:isHL?C.blue:C.text,fontFamily:'monospace',fontSize:11}}>
                    {isHL?'* ':''}<PageLink path={p.page_path}>{p.page_path}</PageLink>
                  </td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{fmtN(p.screen_page_views)}</td>
                  <td style={{padding:'7px 8px'}}>{pp?<Delta c={p.screen_page_views} p={pp.screen_page_views} size={11}/>:'—'}</td>
                  <td style={{padding:'7px 8px',color:(p.engagement_rate||0)<0.8?C.red:C.muted,fontWeight:(p.engagement_rate||0)<0.8?500:400}}>{Math.round((p.engagement_rate||0)*100)}%</td>
                  <td style={{padding:'7px 8px',color:conv>5?C.green:conv>2?C.blue:C.muted,fontWeight:conv>5?500:400}}>{conv.toFixed(1)}%</td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{Math.round(p.average_session_duration||0)}s</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Sec>
      {lowEng.length>0&&<Sec title="Pagini cu engagement scazut"><div>{lowEng.map(p=><div key={p.page_path} style={{display:'flex',gap:12,padding:'8px 12px',background:'#FEF2F2',borderRadius:8,marginBottom:6,fontSize:13}}><span style={{fontFamily:'monospace',fontSize:11,flex:1}}><PageLink path={p.page_path}/></span><span style={{color:C.red,fontWeight:500}}>{Math.round((p.engagement_rate||0)*100)}%</span><span style={{color:C.muted}}>{p.screen_page_views} views</span></div>)}</div></Sec>}
      <Sec title="Top pagini dupa conversii"><Card style={{padding:'12px 16px'}}><BarChart data={curr.filter(p=>(p.conversions||0)>0)} labelField="page_path" valueField="conversions" color={C.amber} maxBars={10}/></Card></Sec>
    </div>
  )
}

/* ─── FUNNEL ───────────────────────────────────────────────────────── */
function TabFunnel({ data }) {
  const curr=data.traffic.current, pages=data.pages.current
  const totalSess=sum(curr,'sessions'), totalConv=sum(curr,'conversions')
  const get=path=>pages.find(p=>p.page_path===path)
  const h3=get('/home3'),simp=get('/simplu'),hp=get('/'),login=get('/login'),ceNou=get('/cerere-noua'),cereri=get('/cereri')
  const convs=data.conversions
  const signup=sum(convs,'conversions_signup'), offers=sum(convs,'conversions_offer_accepted'), cer=sum(convs,'conversions_bravo_cerere_noua')
  const ag=sum(convs,'conversions_bun_venit_agent'), cum=sum(convs,'conversions_bun_venit_cumparator'), prop=sum(convs,'conversions_bun_venit_proprietar')
  const custTotal=signup+offers+cer+ag+cum+prop
  const rate=p=>p&&p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
  const hpr=rate(hp), h3r=rate(h3), simpr=rate(simp)
  const landingViews=(h3?.screen_page_views||0)+(simp?.screen_page_views||0)+(hp?.screen_page_views||0)
  const cereriViews=cereri?.screen_page_views||0
  const ceNouViews=ceNou?.screen_page_views||0
  const loginViews=login?.screen_page_views||0
  const funnelDrop=cereriViews>0?(ceNouViews/cereriViews*100):null
  const steps=[
    {label:'Sesiuni totale',path:null,v:totalSess,pct:100,col:'#3B82C4'},
    {label:'Landing vizitat (/, /home3, /simplu)',path:'/',v:landingViews,pct:totalSess>0?landingViews/totalSess*100:0,col:'#3B82C4'},
    {label:'/cereri — lista cereri',path:'/cereri',v:cereriViews,pct:totalSess>0?cereriViews/totalSess*100:0,col:'#7C3AED'},
    {label:'/cerere-noua — formular',path:'/cerere-noua',v:ceNouViews,pct:totalSess>0?ceNouViews/totalSess*100:0,col:'#D97706'},
    {label:'/login',path:'/login',v:loginViews,pct:totalSess>0?loginViews/totalSess*100:0,col:'#D97706'},
    {label:'Conversii GA4 totale',path:null,v:totalConv,pct:totalSess>0?totalConv/totalSess*100:0,col:'#16A34A'},
  ]
  return (
    <div>
      <Sec title="Funnel principal">
        {steps.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <span style={{fontSize:12,color:C.muted,width:260,flexShrink:0}}>
              {s.path ? <PageLink path={s.path}>{s.label}</PageLink> : s.label}
            </span>
            <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:8,overflow:'hidden'}}>
              <div style={{width:`${Math.min(100,s.pct)}%`,height:8,borderRadius:99,background:s.col}}/>
            </div>
            <span style={{fontSize:13,fontWeight:500,color:C.text,width:52,textAlign:'right'}}>{fmtN(s.v)}</span>
            <span style={{fontSize:11,color:C.hint,width:34,textAlign:'right'}}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
        {funnelDrop!==null&&(
          <div style={{marginTop:12,padding:'10px 14px',background:funnelDrop<15?'#FEF2F2':'#FFF7ED',border:`0.5px solid ${funnelDrop<15?'#FCA5A5':'#FCD34D'}`,borderRadius:8,fontSize:13}}>
            <strong style={{color:funnelDrop<15?C.red:C.amber}}>Drop /cereri → /cerere-noua: {funnelDrop.toFixed(0)}%</strong>
            <span style={{color:C.muted,marginLeft:8}}>{funnelDrop<15?'Foarte mic — adauga CTA mai vizibil pe pagina /cereri':'Progresie normala, dar optimizabila'}</span>
          </div>
        )}
      </Sec>
      <Sec title="Conv rate landing pages">
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[{label:'/home3',r:h3r,views:h3?.screen_page_views||0,hl:true,path:'/home3'},{label:'/simplu',r:simpr,views:simp?.screen_page_views||0,hl:true,path:'/simplu'},{label:'/ homepage',r:hpr,views:hp?.screen_page_views||0,hl:false,path:'/'}].map(p=>(
            <div key={p.label} style={{background:p.hl&&p.r>hpr?'#F0FDF4':C.card,border:`0.5px solid ${p.hl&&p.r>hpr?'#86EFAC':C.border}`,borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
              <p style={{fontSize:24,fontWeight:500,color:p.r>5?C.green:C.text,margin:'0 0 4px'}}>{p.r.toFixed(1)}%</p>
              <p style={{fontSize:11,color:C.hint,margin:0}}><PageLink path={p.path}>{p.label}</PageLink></p>
              <p style={{fontSize:11,color:C.hint,margin:'2px 0 0'}}>{fmtN(p.views)} views</p>
            </div>
          ))}
        </div>
      </Sec>
      <Sec title="Conversii custom (Key Events)">
        {custTotal===0?(
          <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'14px 16px'}}>
            <p style={{fontSize:13,color:C.red,margin:0}}>Toate conversiile custom returneaza 0. GA4 Admin - Events - Mark as conversion: conversions_signup, conversions_offer_accepted, conversions_bravo_cerere_noua, bun_venit_agent/cumparator/proprietar.</p>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8}}>
            {[['Sign-ups',signup],['Oferte acc.',offers],['Cereri noi',cer],['Agent',ag],['Cumparator',cum],['Proprietar',prop]].map(([l,v])=>(
              <div key={l} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px',textAlign:'center'}}>
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
        <h2 style={{fontSize:16,fontWeight:500,margin:'0 0 4px'}}>3 rute pentru cerere noua</h2>
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
function TabActiuni({ data }) {
  const curr=data.traffic.current, prev=data.traffic.previous
  const pages=data.pages.current, queries=data.gsc.queries||[]
  const cc=sum(curr,'conversions'), cp=sum(prev,'conversions')
  const custConv=sum(data.conversions,'conversions_signup')+sum(data.conversions,'conversions_offer_accepted')+sum(data.conversions,'conversions_bravo_cerere_noua')
  const h3=pages.find(p=>p.page_path==='/home3'), hp=pages.find(p=>p.page_path==='/')
  const reset=pages.find(p=>p.page_path==='/resetare-parola')
  const h3r=h3&&h3.screen_page_views>0?h3.conversions/h3.screen_page_views*100:0
  const hpr=hp&&hp.screen_page_views>0?hp.conversions/hp.screen_page_views*100:0
  const cereri=pages.find(p=>p.page_path==='/cereri'), ceNou=pages.find(p=>p.page_path==='/cerere-noua')
  const funnelGap=cereri&&ceNou?(1-ceNou.screen_page_views/cereri.screen_page_views)*100:0
  const lowCtr=queries.filter(q=>(q.organic_google_search_impressions||0)>100&&(q.organic_google_search_click_through_rate||0)<0.03).sort((a,b)=>(b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  const nearTop=queries.filter(q=>(q.organic_google_search_average_position||0)>=4&&(q.organic_google_search_average_position||0)<=8).sort((a,b)=>(b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]
  const actions=[]
  if(custConv===0) actions.push({urgency:'urgent',title:'Activeaza Key Events GA4 — conversii custom = 0',body:'Fara conversions_signup, offer_accepted si cerere_noua nu poti masura ROI per canal sau lua decizii de investitie bazate pe date reale.',fix:'GA4 Admin - Events - Mark as conversion: conversions_signup, conversions_offer_accepted, conversions_bravo_cerere_noua. 5 minute.'})
  if(funnelGap>80) actions.push({urgency:'urgent',title:`Funnel gap ${funnelGap.toFixed(0)}%: ${fmtN(cereri?.screen_page_views)} useri vad /cereri, doar ${fmtN(ceNou?.screen_page_views)} ajung la formular`,body:'Cel mai mare gap din funnel. Adauga un CTA vizibil pe /cereri care sa duca la /cerere-noua.',fix:'Adauga buton fixed/sticky pe /cereri: "Adauga cererea ta acum". Testeaza si un banner inline dupa primele 3 rezultate.'})
  if(h3r>hpr*1.5&&(h3?.screen_page_views||0)>20) actions.push({urgency:'urgent',title:`/home3 converteste de ${(h3r/Math.max(hpr,0.1)).toFixed(1)}x mai bine — seteaza-l ca homepage`,body:`/home3: ${h3r.toFixed(1)}% vs /: ${hpr.toFixed(1)}%. Schimbarea aduce imediat mai multe conversii cu acelasi trafic.`,fix:'Seteaza /home3 ca pagina principala sau copiaza elementele diferite pe /. Monitorizeaza 14 zile.'})
  if(lowCtr) actions.push({urgency:'important',title:`SEO: "${lowCtr.query||'query'}" — ${Math.round(lowCtr.organic_google_search_impressions)} impr, CTR ${((lowCtr.organic_google_search_click_through_rate||0)*100).toFixed(1)}%`,body:'Multa vizibilitate, putine clickuri. Titlul sau meta description nu sunt convingatoare.',fix:'Gaseste pagina in GSC, rescrie titlul cu beneficiul principal, adauga meta description cu CTA. Monitorizeaza CTR 2 saptamani.'})
  if(nearTop) actions.push({urgency:'important',title:`SEO: "${nearTop.query||'query'}" pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — aproape de top 3`,body:'Esti pe pagina 1 dar nu in primele 3 rezultate. O imbunatatire mica poate dubla traficul.',fix:'Pe pagina care rankeaza: adauga continut relevant, imbunatateste H1/H2 cu query-ul exact, adauga link-uri interne.'})
  if(reset&&(reset.engagement_rate||0)<0.6&&(reset.screen_page_views||0)>10) actions.push({urgency:'important',title:`/resetare-parola — engagement ${Math.round((reset.engagement_rate||0)*100)}% (posibil broken)`,body:`${reset.screen_page_views} vizite dar bounce mare imediat. Emailul posibil nu ajunge sau linkul expira.`,fix:'Testeaza manual fluxul complet. Adauga mesaj de confirmare clar dupa submittere.'})
  const cd=dlt(cc,cp)
  if(cd!==null&&cd<-20) actions.push({urgency:'urgent',title:`Conversii -${Math.abs(cd).toFixed(0)}% fata de perioada anterioara`,body:`${cc} conversii vs ${cp}. Scadere semnificativa.`,fix:'Verifica GA4 pentru erori JS. Verifica /cerere-noua si /home3 pentru probleme.'})
  if(actions.length===0) actions.push({urgency:'luna asta',title:'Fara alerte majore — focus pe crestere organica',body:'Metricile sunt stabile.',fix:'Adauga 2-3 pagini de continut SEO targetand queries din GSC cu impressions mari si CTR scazut.'})
  return (
    <div>
      <Sec title={`${Math.min(actions.length,6)} actiuni prioritizate`}>
        {actions.slice(0,6).map((a,i)=><Action key={i} {...a}/>)}
      </Sec>
      <Sec title="Context">
        <Grid>
          <KPI label="Conversii" curr={cc} prev={cp}/>
          <KPI label="Conv custom" curr={custConv}/>
          <KPI label="/home3 rate" curr={h3r} type="pctN"/>
          <KPI label="/ rate" curr={hpr} type="pctN"/>
        </Grid>
      </Sec>
    </div>
  )
}

/* ─── MAIN ─────────────────────────────────────────────────────────── */
const TABS=[
  {id:'semnale',label:'Semnale'},
  {id:'grafice', label:'Grafice'},
  {id:'trafic',  label:'Trafic'},
  {id:'seo',     label:'SEO'},
  {id:'pagini',  label:'Pagini'},
  {id:'funnel',  label:'Funnel'},
  {id:'cerere',  label:'Cerere noua'},
  {id:'conversii',label:'Conversii'},
  {id:'recomandari',label:'Recomandari'},
  {id:'actiuni', label:'Actiuni'},
]

export default function Dashboard() {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState('semnale')
  const [days,setDays]=useState(30)

  const load=useCallback(async(d)=>{
    setLoading(true);setError('')
    try{
      const res=await fetch(`/api/report?days=${d||days}`)
      if(!res.ok) throw new Error(`${res.status}`)
      const j=await res.json()
      if(j.error) throw new Error(j.error)
      setData(j)
    }catch(e){setError('Eroare: '+e.message)}
    finally{setLoading(false)}
  },[days])

  const changeDays=useCallback(d=>{setDays(d);load(d)},[load])

  useEffect(()=>{load()},[])

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
        </div>
        <div style={{flex:1}}/>
        {data&&<PeriodBar days={days} onChange={changeDays}/>}
        <button onClick={()=>load()} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>↻</button>
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
          {tab==='cerere'      &&<TabCerereNoua  data={data}/>}
          {tab==='conversii'   &&<TabConversii   data={data}/>}
          {tab==='recomandari' &&<TabRecomandari data={data}/>}
          {tab==='actiuni'     &&<TabActiuni     data={data}/>}
          <div style={{marginTop:36,paddingTop:14,borderTop:`0.5px solid ${C.border}`,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:11,color:C.hint}}>Generat {new Date(data.generatedAt).toLocaleString('ro-RO')} | Windsor.ai - GA4 + GSC | Interval: {data.days} zile</span>
            <span style={{fontSize:11,color:C.hint}}>HomePitch.ro</span>
          </div>
        </>)}
      </div>
    </div>
  )
}
