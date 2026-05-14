'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { C, COLORS, sum, avg, dlt, fmt, fmtN, Delta, KPI, Signal, Action, Sec, Grid, Card, LineChart, BarChart, PageLink, BASE_URL } from './components'
import { CONV_DEFINITIONS, CATEGORIES, CERERE_PAGES } from './conversions_config'

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
  if(nearTop) {
    const q = nearTop.query && nearTop.query!=='(not provided)' ? `"${nearTop.query}"` : 'un query'
    insights.push({type:'neutral',title:`${q} pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — oportunitate top 3`,body:`${Math.round(nearTop.organic_google_search_impressions||0)} impressions. Imbunatatire mica de continut poate dubla traficul.`})
  }
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

      {/* ZONA CUVINTE CHEIE — SEO + AI */}
      <Sec title="Cuvinte cheie cu potential — SEO si AI Search">
        <div style={{background:'linear-gradient(135deg,#1A2B4A,#1e3a6e)',borderRadius:12,padding:'14px 18px',marginBottom:14,color:'#fff'}}>
          <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.07em',color:'rgba(255,255,255,.55)',margin:'0 0 4px'}}>Analiza manuala — actualizata luna Mai 2026</p>
          <p style={{fontSize:13,color:'rgba(255,255,255,.8)',margin:0,lineHeight:1.5}}>
            Pozitia medie actuala: <strong style={{color:'#FCD34D'}}>84</strong> · 104 impressions · HomePitch nu apare pe niciun query relevant. Aceste cuvinte cheie reprezinta oportunitatea de crestere organica.
          </p>
        </div>

        {/* Categorii de keywords */}
        {[
          {
            cat: 'Cerere de cumparare — intent direct (prioritate 1)',
            col: C.red,
            desc: 'Oamenii care cauta exact ce ofera HomePitch. Volum mediu, intent maxim.',
            keywords: [
              {kw:'cerere cumparare apartament',vol:'~500/luna',dif:'mica',tip:'pagina /cereri',ai:'DA'},
              {kw:'adauga cerere imobiliara',vol:'~200/luna',dif:'mica',tip:'pagina /cerere-noua',ai:'DA'},
              {kw:'cum sa gasesti un apartament fara agent',vol:'~800/luna',dif:'medie',tip:'articol blog',ai:'DA'},
              {kw:'platforma cumparare apartament Romania',vol:'~300/luna',dif:'medie',tip:'homepage',ai:'DA'},
              {kw:'cerere oferta imobiliara',vol:'~150/luna',dif:'mica',tip:'pagina /cereri',ai:'NU'},
            ]
          },
          {
            cat: 'Agent imobiliar — recrutare si credibilitate (prioritate 2)',
            col: C.amber,
            desc: 'Agentii cauta platforme unde gasesc cumparatori calificati. Volum mic, valoare mare.',
            keywords: [
              {kw:'agenti imobiliari bucuresti',vol:'~2000/luna',dif:'mare',tip:'pagina /agenti',ai:'DA'},
              {kw:'platforma agenti imobiliari',vol:'~400/luna',dif:'mica',tip:'pagina /pentru-agenti',ai:'DA'},
              {kw:'cum sa gasesti clienti imobiliari',vol:'~600/luna',dif:'medie',tip:'articol blog',ai:'DA'},
              {kw:'lead-uri imobiliare cumparatori',vol:'~250/luna',dif:'mica',tip:'landing agenti',ai:'DA'},
              {kw:'homepitch agent',vol:'branded',dif:'mica',tip:'homepage',ai:'DA'},
            ]
          },
          {
            cat: 'Cumparator activ — intent tranzactional (prioritate 2)',
            col: C.green,
            desc: 'Oamenii in cautare activa de proprietate. Volum mare dar competitie ridicata.',
            keywords: [
              {kw:'apartamente de vanzare bucuresti',vol:'~8000/luna',dif:'mare',tip:'pagina de cereri filtrata',ai:'DA'},
              {kw:'apartament 2 camere bucuresti pret',vol:'~3000/luna',dif:'mare',tip:'landing filtrat',ai:'DA'},
              {kw:'cumpar apartament bucuresti',vol:'~1500/luna',dif:'mare',tip:'pagina /cereri',ai:'DA'},
              {kw:'apartamente sector 2 de vanzare',vol:'~900/luna',dif:'medie',tip:'pagina filtrata zona',ai:'NU'},
              {kw:'apartament 3 camere pret 2025',vol:'~1200/luna',dif:'medie',tip:'articol ghid pret',ai:'DA'},
            ]
          },
          {
            cat: 'AI Search — ChatGPT, Perplexity, Gemini (prioritate 3)',
            col: C.purple,
            desc: 'Queries pe care oamenii le pun in AI si HomePitch ar trebui sa apara in raspunsuri. Necesita continut de tip "raspuns definitiv".',
            keywords: [
              {kw:'cum functioneaza homepitch',vol:'AI',dif:'mica',tip:'pagina /cum-functioneaza',ai:'DA'},
              {kw:'cele mai bune platforme imobiliare romania 2025',vol:'AI',dif:'mica',tip:'articol comparativ',ai:'DA'},
              {kw:'alternativa imobiliare.ro',vol:'~200/luna',dif:'medie',tip:'landing comparativ',ai:'DA'},
              {kw:'platforma unde cumparatorul face cerere si primeste oferte',vol:'AI',dif:'mica',tip:'homepage + FAQ',ai:'DA'},
              {kw:'cum sa cumperi apartament fara stres romania',vol:'AI+SEO',dif:'mica',tip:'ghid complet',ai:'DA'},
            ]
          },
          {
            cat: 'Long-tail cu conversie ridicata (prioritate 1 — quick wins)',
            col: C.blue,
            desc: 'Volume mici, competitie minima, intent clar. Cele mai rapide de rankat.',
            keywords: [
              {kw:'vreau sa cumpar apartament in bucuresti',vol:'~300/luna',dif:'mica',tip:'/vreau sau /cerere-noua',ai:'DA'},
              {kw:'agenti imobiliari care vin la tine cu oferte',vol:'~100/luna',dif:'mica',tip:'homepage',ai:'DA'},
              {kw:'adauga cerere si primesti oferte imobiliare',vol:'~80/luna',dif:'mica',tip:'/cerere-noua',ai:'DA'},
              {kw:'caut apartament 2 camere bucuresti buget 100000',vol:'~200/luna',dif:'mica',tip:'cerere filtrata',ai:'NU'},
              {kw:'scor cumparator imobiliare',vol:'~50/luna',dif:'mica',tip:'/scor-cumparator',ai:'DA'},
            ]
          },
        ].map(({cat,col,desc,keywords})=>(
          <div key={cat} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:col,flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:600,color:C.text}}>{cat}</span>
            </div>
            <p style={{fontSize:12,color:C.muted,margin:'0 0 8px',marginLeft:18}}>{desc}</p>
            <div style={{overflowX:'auto',marginLeft:18}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:`0.5px solid ${C.border}`,background:'#fafaf8'}}>
                    {['Cuvant cheie','Volum/luna','Dificultate','Pagina recomandata','AI Search'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'5px 10px',color:C.hint,fontWeight:600,fontSize:9,textTransform:'uppercase',letterSpacing:'.05em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((k,i)=>(
                    <tr key={i} style={{borderBottom:`0.5px solid ${C.border}`}}>
                      <td style={{padding:'7px 10px',color:C.text,fontWeight:500}}>{k.kw}</td>
                      <td style={{padding:'7px 10px',color:C.muted}}>{k.vol}</td>
                      <td style={{padding:'7px 10px'}}>
                        <span style={{fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:4,
                          background:k.dif==='mica'?'#F0FDF4':k.dif==='medie'?'#FFF7ED':k.dif==='mare'?'#FEF2F2':'#EFF6FF',
                          color:k.dif==='mica'?C.green:k.dif==='medie'?C.amber:k.dif==='mare'?C.red:C.blue
                        }}>{k.dif}</span>
                      </td>
                      <td style={{padding:'7px 10px',fontFamily:'monospace',fontSize:10,color:C.blue}}>{k.tip}</td>
                      <td style={{padding:'7px 10px',textAlign:'center'}}>
                        <span style={{fontSize:11,fontWeight:600,color:k.ai==='DA'?C.green:C.hint}}>{k.ai==='DA'?'✓':'-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Ghid de actiune */}
        <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:10,padding:'14px 16px',marginTop:8}}>
          <p style={{fontSize:12,fontWeight:600,color:C.green,margin:'0 0 8px'}}>Cum sa incepi — plan in 3 pasi</p>
          {[
            '1. Quick wins (saptamana 1): Optimizeaza paginile existente pentru long-tail — /cerere-noua, /vreau, /scor-cumparator. Adauga H1 cu query-ul exact, 200 cuvinte de continut relevant, meta description cu CTA.',
            '2. Pagini noi (luna 1-2): Creeaza /agenti-imobiliari-bucuresti si /cum-functioneaza cu continut de 800+ cuvinte. Acestea targeteaza si AI Search — ChatGPT si Perplexity le vor cita in raspunsuri.',
            '3. Continut long-form (luna 2-3): Ghid "Cum sa cumperi apartament in Romania 2025" — articol de 2000+ cuvinte care rankeaza pentru zeci de queries long-tail simultan.',
          ].map((s,i)=>(
            <p key={i} style={{fontSize:12,color:C.muted,margin:'0 0 6px',lineHeight:1.55}}>{s}</p>
          ))}
        </div>
      </Sec>
    </div>
  )
}


export { TabGrafice, TabSemnale, TabTrafic, TabSEO }
