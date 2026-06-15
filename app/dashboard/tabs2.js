'use client'
import { useState } from 'react'
import { C, sum, dlt, fmt, fmtN, Delta, KPI, Signal, Sec, Card, BarChart, PageLink } from './components'

function TabPagini({ data }) {
  const curr=data.pages.current
  const prev=data.pages.previous||[]
  const [sortBy,setSortBy]=useState('views')
  const [section,setSection]=useState('all')

  // Build prev map for deltas
  const prevMap={}
  for(const p of prev){
    if(!prevMap[p.page_path]) prevMap[p.page_path]={...p}
    else Object.keys(p).forEach(f=>{if(f!=='page_path'&&typeof p[f]==='number') prevMap[p.page_path][f]=(prevMap[p.page_path][f]||0)+p[f]})
  }
  for(const p of curr){
    if(prevMap[p.page_path]) Object.keys(p).forEach(f=>{if(f!=='page_path'&&typeof p[f]==='number') prevMap[p.page_path][f]=Math.max(0,(prevMap[p.page_path][f]||0)-p[f])})
  }

  const HL=['/home3','/invers','/simplu','/platforma','/']
  const MIN_VIEWS=20

  // Sorted main table
  const sorted=[...curr].sort((a,b)=>{
    if(sortBy==='views') return (b.screen_page_views||0)-(a.screen_page_views||0)
    if(sortBy==='conv')  return (b.conversions/Math.max(b.screen_page_views,1))-(a.conversions/Math.max(a.screen_page_views,1))
    if(sortBy==='bounce')return (b.bounce_rate||0)-(a.bounce_rate||0)
    if(sortBy==='dur')   return (b.average_session_duration||0)-(a.average_session_duration||0)
    return (b.engagement_rate||0)-(a.engagement_rate||0)
  }).slice(0,20)

  // Exit pages — sorted by bounce_rate desc, min views
  const exitPages=[...curr]
    .filter(p=>(p.screen_page_views||0)>=MIN_VIEWS)
    .sort((a,b)=>(b.bounce_rate||0)-(a.bounce_rate||0))
    .slice(0,10)

  // Most time — avg_session_duration desc, min views
  const mostTime=[...curr]
    .filter(p=>(p.screen_page_views||0)>=MIN_VIEWS)
    .sort((a,b)=>(b.average_session_duration||0)-(a.average_session_duration||0))
    .slice(0,10)

  // Least time — avg_session_duration asc, min views, exclude instant redirects (<5s with 100% eng = redirect)
  const leastTime=[...curr]
    .filter(p=>(p.screen_page_views||0)>=MIN_VIEWS && !((p.average_session_duration||0)<5 && (p.engagement_rate||0)===1))
    .sort((a,b)=>(a.average_session_duration||0)-(b.average_session_duration||0))
    .slice(0,10)

  // Engagement time (user_engagement_duration / views)
  const engTime=[...curr]
    .filter(p=>(p.screen_page_views||0)>=MIN_VIEWS)
    .map(p=>({...p, avg_eng_time: (p.user_engagement_duration||0)/Math.max(p.screen_page_views,1)}))
    .sort((a,b)=>b.avg_eng_time-a.avg_eng_time)
    .slice(0,10)

  const lowEng=curr.filter(p=>(p.screen_page_views||0)>=MIN_VIEWS&&(p.engagement_rate||0)<0.80).sort((a,b)=>a.engagement_rate-b.engagement_rate).slice(0,5)

  // Duration bar helper
  const maxDur = Math.max(...mostTime.map(p=>p.average_session_duration||0), 1)
  const maxBounce = Math.max(...exitPages.map(p=>p.bounce_rate||0), 0.01)

  function PageRow({ p, extra }) {
    const conv=p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
    const isHL=HL.includes(p.page_path)
    const pp=prevMap[p.page_path]
    return (
      <tr style={{borderBottom:`0.5px solid ${C.border}`,background:isHL?C.softBlue:'transparent'}}>
        <td style={{padding:'7px 8px',fontFamily:'monospace',fontSize:11,color:isHL?C.blue:C.text,maxWidth:220}}>
          {isHL?'* ':''}<PageLink path={p.page_path}>{p.page_path}</PageLink>
        </td>
        <td style={{padding:'7px 8px',color:C.muted}}>{fmtN(p.screen_page_views)}</td>
        <td style={{padding:'7px 8px'}}>{pp?<Delta c={p.screen_page_views} p={pp.screen_page_views} size={11}/>:'—'}</td>
        <td style={{padding:'7px 8px',color:(p.engagement_rate||0)<0.8?C.red:C.muted}}>{Math.round((p.engagement_rate||0)*100)}%</td>
        <td style={{padding:'7px 8px',color:conv>5?C.green:conv>2?C.blue:C.muted,fontWeight:conv>5?500:400}}>{conv.toFixed(1)}%</td>
        {extra}
      </tr>
    )
  }

  const SECTIONS = [
    {id:'all',    label:'Toate paginile'},
    {id:'exit',   label:'Exit pages'},
    {id:'time',   label:'Timp pe pagina'},
    {id:'eng',    label:'Engagement scazut'},
  ]

  return (
    <div>
      {/* Section tabs */}
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{
            padding:'6px 14px',fontSize:12,fontWeight:section===s.id?500:400,borderRadius:8,cursor:'pointer',
            border:`0.5px solid ${section===s.id?C.blue:C.border}`,
            background:section===s.id?C.softBlue:'transparent',
            color:section===s.id?C.blue:C.muted
          }}>{s.label}</button>
        ))}
        {section==='all'&&(
          <>
            <div style={{width:1,height:20,background:C.border,margin:'0 4px'}}/>
            <span style={{fontSize:12,color:C.hint}}>Sorteaza:</span>
            {[['views','Views'],['bounce','Bounce'],['dur','Durata'],['conv','Conv%'],['eng','Eng%']].map(([v,l])=>(
              <button key={v} onClick={()=>setSortBy(v)} style={{padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',border:`0.5px solid ${sortBy===v?C.navy:C.border}`,background:sortBy===v?C.navy:'transparent',color:sortBy===v?'#fff':C.muted,fontWeight:sortBy===v?500:400}}>{l}</button>
            ))}
          </>
        )}
      </div>

      {/* ── TOATE PAGINILE ── */}
      {section==='all'&&(
        <Sec title="Top pagini">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Pagina','Views','Delta','Eng%','Conv%','Bounce','Durata (avg)'].map(h=><th key={h} style={{textAlign:'left',padding:'6px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {sorted.map(p=><PageRow key={p.page_path} p={p} extra={<>
                  <td style={{padding:'7px 8px',color:(p.bounce_rate||0)>0.2?C.red:(p.bounce_rate||0)>0.1?C.amber:C.muted}}>{((p.bounce_rate||0)*100).toFixed(0)}%</td>
                  <td style={{padding:'7px 8px',color:C.muted}}>{Math.round(p.average_session_duration||0)}s</td>
                </>}/>)}
              </tbody>
            </table>
          </div>
          <Sec title="Top pagini dupa conversii" style={{marginTop:20}}>
            <Card style={{padding:'12px 16px'}}>
              <BarChart data={curr.filter(p=>(p.conversions||0)>0)} labelField="page_path" valueField="conversions" color={C.amber} maxBars={10}/>
            </Card>
          </Sec>
        </Sec>
      )}

      {/* ── EXIT PAGES ── */}
      {section==='exit'&&(
        <div>
          <div style={{background:C.softAmber,border:`0.5px solid ${C.amber}`,borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:C.muted}}>
            <strong style={{color:C.amber}}>Bounce rate</strong> = procentul de sesiuni unde userul a vizitat o singura pagina si a plecat. O pagina cu bounce rate mare e adesea ultima pagina din sesiune. Valori sub 10% sunt normale, peste 20% necesita investigatie.
          </div>
          <Sec title={`Top ${exitPages.length} pagini cu bounce rate mare (min ${MIN_VIEWS} views)`}>
            {exitPages.map((p,i)=>{
              const pct=(p.bounce_rate||0)*100
              const barW=((p.bounce_rate||0)/maxBounce*100)
              const col=pct>20?C.red:pct>10?C.amber:C.green

              // Smart annotations per page type
              const path = p.page_path
              const annotation = (()=>{
                if(path==='/resetare-parola') return {col:C.red,  text:'Bounce si durata ridicate — flux probabil broken. Testeaza email reset manual.'}
                if(path==='/auth')            return {col:C.amber,text:'Pagina de redirect — bounce mare e normal aici.'}
                if(path==='/bun-venit-cumparator'||path==='/bun-venit-proprietar'||path==='/bun-venit-agent') return {col:C.blue,text:'Pagina post-inregistrare — userii pleaca intentionat dupa confirmare.'}
                if(path==='/logare'||path==='/login') return {col:C.blue,text:'Redirect rapid daca userul e deja logat — normal.'}
                if(path.includes('/proprietati/')&&path.split('/').length>4) return {col:C.amber,text:'Pagina de detalii proprietate — bounce poate insemna ca nu corespunde asteptarilor.'}
                if(path==='/cumparatori')     return {col:C.amber,text:'Pagina de prezentare — adauga CTA clar catre /cerere-noua sau /vreau.'}
                if(path.includes('/cereri/')&&!path.includes('/nou')&&!path.includes('/edit')) return {col:C.amber,text:'Pagina detalii cerere — verifica daca agentii pot aplica usor.'}
                if(pct>20)  return {col:C.red,  text:'Bounce ridicat — verifica CTA-uri si continuarea fluxului.'}
                if(pct>10)  return {col:C.amber,text:'Bounce moderat — monitorizeaza tendinta.'}
                return {col:C.green,text:'Bounce acceptabil.'}
              })()

              return (
                <div key={p.page_path} style={{background:C.card,border:`0.5px solid ${pct>20?C.red:C.border}`,borderRadius:10,padding:'11px 14px',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{fontSize:11,fontFamily:'monospace',color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      <PageLink path={p.page_path}>{p.page_path}</PageLink>
                    </span>
                    <span style={{fontSize:15,fontWeight:600,color:col,flexShrink:0}}>{pct.toFixed(0)}%</span>
                    <span style={{fontSize:11,color:C.hint,flexShrink:0}}>bounce</span>
                  </div>
                  <div style={{background:C.softPanel,borderRadius:99,height:5,overflow:'hidden',marginBottom:8}}>
                    <div style={{width:`${barW}%`,height:5,background:col,borderRadius:99}}/>
                  </div>
                  <div style={{display:'flex',gap:16,fontSize:11,color:C.hint,marginBottom:6,flexWrap:'wrap'}}>
                    <span>{fmtN(p.screen_page_views)} views</span>
                    <span>eng: {Math.round((p.engagement_rate||0)*100)}%</span>
                    <span>dur: {Math.round(p.average_session_duration||0)}s</span>
                    <span>conv: {(p.screen_page_views>0?p.conversions/p.screen_page_views*100:0).toFixed(1)}%</span>
                  </div>
                  <p style={{fontSize:12,color:annotation.col,margin:0,fontWeight:500}}>{annotation.text}</p>
                </div>
              )
            })}
          </Sec>
        </div>
      )}

      {/* ── TIMP PE PAGINA ── */}
      {section==='time'&&(
        <div>
          <Sec title={`Pagini pe care userii stau cel MAI MULT (min ${MIN_VIEWS} views)`}>
            {mostTime.map((p,i)=>{
              const dur=p.average_session_duration||0
              const barW=dur/maxDur*100
              const engT=p.user_engagement_duration>0?(p.user_engagement_duration/Math.max(p.screen_page_views,1)):0
              const col=dur>300?C.green:dur>120?C.blue:C.muted
              const path=p.page_path

              const note=(()=>{
                if(path==='/proprietati/nou')   return {col:C.green,  text:'Formular adaugare proprietate — durata mare poate fi pozitiva daca userii completeaza cu atentie.'}
                if(path==='/setari-crm')        return {col:C.green,  text:'Sectiune CRM — timp mare = agentii configureaza activ.'}
                if(path==='/resetare-parola')   return {col:C.red,    text:'Durata si bounce ridicate — userii pot fi blocati in flux. Verifica emailul si tokenul de reset.'}
                if(path==='/cereri/nou')        return {col:C.blue,   text:'Formular cerere noua — daca durata e mare dar conversiile GA4 sunt 0, verifica Key Event-ul.'}
                if(path==='/vreau') {
                  const convRate = p.screen_page_views > 0 ? p.conversions / p.screen_page_views * 100 : 0
                  return {col:C.green, text:`${Math.round(dur)}s si ${convRate.toFixed(1)}% conv rate — pagina de intent, merita scalata daca mentine performanta.`}
                }
                if(path==='/beneficii-vip')     return {col:C.green,  text:'Pagina beneficii abonament — durata mare indica interes activ in upgrade.'}
                if(path==='/dashboard/vip')     return {col:C.green,  text:'Dashboard VIP — userii activi exploreaza beneficiile.'}
                if(path==='/abonamente')        return {col:C.green,  text:'Pagina preturi/abonamente — durata si engagement ridicate indica interes comercial.'}
                if(path==='/scor-cumparator')   return {col:C.blue,   text:'Userii citesc cu atentie scorul. Oportunitate de upsell catre VIP.'}
                if(path.includes('/edit'))      return {col:C.blue,   text:'Pagina editare — timp mare e normal.'}
                if(dur>400)                     return {col:C.green,  text:'Timp exceptional de mare — continut valoros sau formular complex.'}
                if(dur>200)                     return {col:C.blue,   text:'Timp bun — userii sunt angajati.'}
                return {col:C.muted,text:''}
              })()

              return (
                <div key={p.page_path} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'11px 14px',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{fontSize:11,color:C.hint,width:22,flexShrink:0,fontWeight:600}}>#{i+1}</span>
                    <span style={{fontSize:11,fontFamily:'monospace',color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      <PageLink path={p.page_path}>{p.page_path}</PageLink>
                    </span>
                    <span style={{fontSize:15,fontWeight:600,color:col,flexShrink:0}}>{Math.round(dur)}s</span>
                  </div>
                  <div style={{background:C.softPanel,borderRadius:99,height:5,overflow:'hidden',marginBottom:8}}>
                    <div style={{width:`${barW}%`,height:5,background:col,borderRadius:99}}/>
                  </div>
                  <div style={{display:'flex',gap:14,fontSize:11,color:C.hint,marginBottom:note.text?6:0,flexWrap:'wrap'}}>
                    <span>{fmtN(p.screen_page_views)} views</span>
                    <span>eng time: <strong style={{color:C.text}}>{Math.round(engT)}s</strong></span>
                    <span>bounce: {((p.bounce_rate||0)*100).toFixed(0)}%</span>
                    <span>conv: {(p.screen_page_views>0?p.conversions/p.screen_page_views*100:0).toFixed(1)}%</span>
                  </div>
                  {note.text&&<p style={{fontSize:12,color:note.col,margin:0,fontWeight:500}}>{note.text}</p>}
                </div>
              )
            })}
          </Sec>

          <Sec title={`Pagini pe care userii stau cel MAI PUTIN (min ${MIN_VIEWS} views)`}>
            {leastTime.map((p,i)=>{
              const dur=p.average_session_duration||0
              const maxDurLeast=Math.max(...leastTime.map(x=>x.average_session_duration||0),1)
              const barW=dur/maxDurLeast*100
              const isRedirect=dur<15
              const col=isRedirect?C.amber:dur<60?C.red:C.muted
              const path=p.page_path

              const note=(()=>{
                if(path==='/bun-venit-cumparator') return {col:C.green, text:'Timp mic — redirect automat dupa inregistrare. Normal si intentionat.'}
                if(path==='/bun-venit-proprietar') return {col:C.green, text:'Redirect post-inregistrare — normal.'}
                if(path==='/logare')               return {col:C.blue,  text:'Timp mic — redirect rapid daca userul e deja autentificat. Verifica daca cei nelogati vad formular.'}
                if(path==='/auth')                 return {col:C.blue,  text:'Pagina de autentificare cu redirect. Normal.'}
                if(path.includes('/cereri/')&&dur<20) return {col:C.amber,text:'Sub 20s pe o pagina de detalii cerere — posibil continutul nu se incarca sau nu corespunde asteptarilor.'}
                if(path.includes('/proprietati/')&&dur<20) return {col:C.amber,text:'Sub 20s pe pagina proprietate — verifica calitatea listing-ului si pozele.'}
                if(path.includes('/oferte'))       return {col:C.amber, text:'Timp mic pe pagina oferte — verifica daca datele se incarca corect.'}
                if(isRedirect)                     return {col:C.amber, text:'Sub 15s — posibil redirect sau pagina de confirmare.'}
                if(dur<60)                         return {col:C.red,   text:'Sub 60s — userii nu gasesc valoare. Verifica continutul si CTA-urile.'}
                return {col:C.muted,text:''}
              })()

              return (
                <div key={p.page_path} style={{background:C.card,border:`0.5px solid ${isRedirect?C.border:C.red}`,borderRadius:10,padding:'11px 14px',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{fontSize:11,color:C.hint,width:22,flexShrink:0,fontWeight:600}}>#{i+1}</span>
                    <span style={{fontSize:11,fontFamily:'monospace',color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      <PageLink path={p.page_path}>{p.page_path}</PageLink>
                    </span>
                    <span style={{fontSize:15,fontWeight:600,color:col,flexShrink:0}}>{Math.round(dur)}s</span>
                  </div>
                  <div style={{background:C.softPanel,borderRadius:99,height:5,overflow:'hidden',marginBottom:8}}>
                    <div style={{width:`${barW}%`,height:5,background:col,borderRadius:99}}/>
                  </div>
                  <div style={{display:'flex',gap:14,fontSize:11,color:C.hint,marginBottom:note.text?6:0,flexWrap:'wrap'}}>
                    <span>{fmtN(p.screen_page_views)} views</span>
                    <span>eng: {Math.round((p.engagement_rate||0)*100)}%</span>
                    <span>bounce: {((p.bounce_rate||0)*100).toFixed(0)}%</span>
                    <span>conv: {(p.screen_page_views>0?p.conversions/p.screen_page_views*100:0).toFixed(1)}%</span>
                  </div>
                  {note.text&&<p style={{fontSize:12,color:note.col,margin:0,fontWeight:500}}>{note.text}</p>}
                </div>
              )
            })}
          </Sec>
        </div>
      )}

      {/* ── ENGAGEMENT SCAZUT ── */}
      {section==='eng'&&(
        <div>
          <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:C.muted}}>
            Pagini cu <strong style={{color:C.red}}>engagement rate sub 80%</strong> si minim {MIN_VIEWS} views. Engagement rate mic = userii nu interactioneaza sau pleaca rapid dupa landing.
          </div>
          {lowEng.length===0?(
            <Signal type="positive" title="Nicio pagina cu engagement scazut" body={`Toate paginile cu minim ${MIN_VIEWS} views au engagement rate peste 80%.`}/>
          ):(
            lowEng.map(p=>(
              <div key={p.page_path} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{fontSize:11,fontFamily:'monospace',color:C.text,flex:1}}>
                    <PageLink path={p.page_path}>{p.page_path}</PageLink>
                  </span>
                  <span style={{fontSize:14,fontWeight:600,color:C.red}}>{Math.round((p.engagement_rate||0)*100)}%</span>
                  <span style={{fontSize:11,color:C.hint}}>engagement</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {[
                    {l:'Views',v:fmtN(p.screen_page_views)},
                    {l:'Bounce',v:((p.bounce_rate||0)*100).toFixed(0)+'%',col:(p.bounce_rate||0)>0.15?C.red:C.muted},
                    {l:'Durata',v:Math.round(p.average_session_duration||0)+'s'},
                    {l:'Conv rate',v:(p.screen_page_views>0?p.conversions/p.screen_page_views*100:0).toFixed(1)+'%'},
                  ].map(m=>(
                    <div key={m.l} style={{background:C.softPanel,borderRadius:6,padding:'6px 8px'}}>
                      <p style={{fontSize:10,color:C.hint,margin:'0 0 2px'}}>{m.l}</p>
                      <p style={{fontSize:13,fontWeight:500,color:m.col||C.text,margin:0}}>{m.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ─── FUNNEL ───────────────────────────────────────────────────────── */
function TabFunnel({ data }) {
  const curr=data.traffic.current, pages=data.pages.current
  const totalSess=sum(curr,'sessions'), totalConv=sum(curr,'conversions')
  const get=path=>pages.find(p=>p.page_path===path)
  const h3=get('/home3'),invers=get('/invers'),simp=get('/simplu'),platforma=get('/platforma'),hp=get('/'),login=get('/login'),ceNou=get('/cerere-noua'),cereri=get('/cereri')
  const convs=data.conversions
  const signup=sum(convs,'conversions_signup'), offers=sum(convs,'conversions_offer_accepted'), cer=sum(convs,'conversions_bravo_cerere_noua')
  const ag=sum(convs,'conversions_bun_venit_agent'), cum=sum(convs,'conversions_bun_venit_cumparator'), prop=sum(convs,'conversions_bun_venit_proprietar')
  const custTotal=signup+offers+cer+ag+cum+prop
  const rate=p=>p&&p.screen_page_views>0?p.conversions/p.screen_page_views*100:0
  const hpr=rate(hp), h3r=rate(h3), inversR=rate(invers), simpr=rate(simp), platformaR=rate(platforma)
  const landingViews=(h3?.screen_page_views||0)+(invers?.screen_page_views||0)+(simp?.screen_page_views||0)+(platforma?.screen_page_views||0)+(hp?.screen_page_views||0)
  const cereriViews=cereri?.screen_page_views||0
  const ceNouViews=ceNou?.screen_page_views||0
  const loginViews=login?.screen_page_views||0
  const funnelDrop=cereriViews>0?(ceNouViews/cereriViews*100):null
  const requestEvents=data.requestFormEvents||{}
  const eventCounts=(requestEvents.events||[]).reduce((acc,row)=>{acc[row.event_name]=row.event_count||0;return acc},{})
  const requestEventSteps=[
    {label:'Form Started',event:'[Amplitude] Form Started',v:eventCounts['[Amplitude] Form Started']||0,col:C.blue},
    {label:'Step Completed',event:'Form Step Completed',v:eventCounts['Form Step Completed']||0,col:C.purple},
    {label:'Validation Error',event:'Form Validation Error',v:eventCounts['Form Validation Error']||0,col:C.red},
    {label:'Form Abandoned',event:'Form Abandoned',v:eventCounts['Form Abandoned']||0,col:C.amber},
    {label:'Request Created',event:'Request Created',v:eventCounts['Request Created']||0,col:C.green},
  ]
  const requestEventTotal=requestEventSteps.reduce((s,row)=>s+Number(row.v||0),0)
  const steps=[
    {label:'Sesiuni totale',path:null,v:totalSess,pct:100,col:'#3B82C4'},
    {label:'Landing vizitat (/, /home3, /invers, /simplu, /platforma)',path:'/',v:landingViews,pct:totalSess>0?landingViews/totalSess*100:0,col:'#3B82C4'},
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
            <div style={{flex:1,background:C.softPanel,borderRadius:99,height:8,overflow:'hidden'}}>
              <div style={{width:`${Math.min(100,s.pct)}%`,height:8,borderRadius:99,background:s.col}}/>
            </div>
            <span style={{fontSize:13,fontWeight:500,color:C.text,width:52,textAlign:'right'}}>{fmtN(s.v)}</span>
            <span style={{fontSize:11,color:C.hint,width:34,textAlign:'right'}}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
        {funnelDrop!==null&&(
          <div style={{marginTop:12,padding:'10px 14px',background:funnelDrop<15?C.softRed:C.softAmber,border:`0.5px solid ${funnelDrop<15?C.red:C.amber}`,borderRadius:8,fontSize:13}}>
            <strong style={{color:funnelDrop<15?C.red:C.amber}}>Drop /cereri → /cerere-noua: {funnelDrop.toFixed(0)}%</strong>
            <span style={{color:C.muted,marginLeft:8}}>{funnelDrop<15?'Foarte mic — adauga CTA mai vizibil pe pagina /cereri':'Progresie normala, dar optimizabila'}</span>
          </div>
        )}
      </Sec>
      <Sec title="Funnel intern formular cerere">
        {requestEventTotal===0 ? (
          <div style={{background:C.softAmber,border:`0.5px solid ${C.amber}`,borderRadius:10,padding:'12px 14px',fontSize:13,color:C.muted}}>
            Evenimentele noi nu apar inca in sursa raportului. Cand ajung in GA4/export, aici se vor vedea start, pasi finalizati, erori, abandon si Request Created.
          </div>
        ) : (
          <div>
            {requestEventSteps.map((s,i)=>(
              <div key={s.event} style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <span style={{fontSize:12,color:C.muted,width:150,flexShrink:0}}>{s.label}</span>
                <div style={{flex:1,background:C.softPanel,borderRadius:99,height:8,overflow:'hidden'}}>
                  <div style={{width:`${Math.min(100,Number(s.v||0)/Math.max(requestEventTotal,1)*100)}%`,height:8,borderRadius:99,background:s.col}}/>
                </div>
                <span style={{fontSize:13,fontWeight:500,color:C.text,width:52,textAlign:'right'}}>{fmtN(s.v)}</span>
              </div>
            ))}
          </div>
        )}
      </Sec>
      <Sec title="Conv rate landing pages">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
          {[{label:'/home3',r:h3r,views:h3?.screen_page_views||0,hl:true,path:'/home3'},{label:'/invers',r:inversR,views:invers?.screen_page_views||0,hl:true,path:'/invers'},{label:'/simplu',r:simpr,views:simp?.screen_page_views||0,hl:true,path:'/simplu'},{label:'/platforma',r:platformaR,views:platforma?.screen_page_views||0,hl:true,path:'/platforma'},{label:'/ homepage',r:hpr,views:hp?.screen_page_views||0,hl:false,path:'/'}].map(p=>(
            <div key={p.label} style={{background:p.hl&&p.r>hpr?C.softGreen:C.card,border:`0.5px solid ${p.hl&&p.r>hpr?C.green:C.border}`,borderRadius:10,padding:'14px 16px',textAlign:'center'}}>
              <p style={{fontSize:24,fontWeight:500,color:p.r>5?C.green:C.text,margin:'0 0 4px'}}>{p.r.toFixed(1)}%</p>
              <p style={{fontSize:11,color:C.hint,margin:0}}><PageLink path={p.path}>{p.label}</PageLink></p>
              <p style={{fontSize:11,color:C.hint,margin:'2px 0 0'}}>{fmtN(p.views)} views</p>
            </div>
          ))}
        </div>
      </Sec>
      <Sec title="Conversii custom (Key Events)">
        {custTotal===0?(
          <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'14px 16px'}}>
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


export { TabPagini, TabFunnel }
