'use client'
import { C, fmtN, KPI, Signal, Sec, Card, Grid, LineChart, BarChart, PageLink } from './components'

function pct(value, digits = 0) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`
}

function pctNumber(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`
}

function riskColor(row) {
  const bounce = Number(row.bounce_rate || 0)
  const risk = Number(row.risk_score || 0)
  if (bounce >= 0.3 || risk >= 30) return C.red
  if (bounce >= 0.18 || risk >= 12) return C.amber
  return C.green
}

function EmptyState({ title, body }) {
  return (
    <div style={{padding:'18px 20px',textAlign:'center'}}>
      <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 6px'}}>{title}</p>
      <p style={{fontSize:12,color:C.muted,margin:0,lineHeight:1.5}}>{body}</p>
    </div>
  )
}

function ExitPagesTable({ rows }) {
  if (!rows.length) {
    return <EmptyState title="Nu exista pagini suficiente pentru analiza" body="Ai nevoie de minimum 10 views pe pagina in intervalul selectat."/>
  }

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
            {['Pagina','Risc','Exit proxy','Bounce','Conv%','Durata','Recomandare'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,14).map(row=>{
            const col = riskColor(row)
            return (
              <tr key={row.page_path} style={{borderBottom:`0.5px solid ${C.border}`}}>
                <td style={{padding:'9px 8px',fontFamily:'monospace',color:C.text,maxWidth:210}}>
                  <PageLink path={row.page_path}>{row.page_path}</PageLink>
                </td>
                <td style={{padding:'9px 8px',color:col,fontWeight:700}}>{Number(row.risk_score || 0).toFixed(1)}</td>
                <td style={{padding:'9px 8px',color:C.muted}}>{fmtN(row.estimated_exits)}</td>
                <td style={{padding:'9px 8px',color:col,fontWeight:500}}>{pct(row.bounce_rate)}</td>
                <td style={{padding:'9px 8px',color:Number(row.conversion_rate || 0)>3?C.green:C.muted}}>{pctNumber(row.conversion_rate)}</td>
                <td style={{padding:'9px 8px',color:C.muted}}>{Math.round(row.average_session_duration || 0)}s</td>
                <td style={{padding:'9px 8px',color:C.muted,minWidth:260,lineHeight:1.45}}>{row.recommendation}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IntentPagesTable({ rows }) {
  if (!rows.length) {
    return <EmptyState title="Nu exista evenimente exit intent" body="Cand GA4 primeste un event precum exit_intent, form_abandon sau page_leave, paginile apar aici."/>
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
            {['Pagina','Evenimente','Useri','Top event','Event names'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,12).map(row=>(
            <tr key={row.page_path} style={{borderBottom:`0.5px solid ${C.border}`}}>
              <td style={{padding:'8px',fontFamily:'monospace',color:C.text}}><PageLink path={row.page_path}>{row.page_path}</PageLink></td>
              <td style={{padding:'8px',color:C.red,fontWeight:700}}>{fmtN(row.event_count)}</td>
              <td style={{padding:'8px',color:C.muted}}>{fmtN(row.active_users)}</td>
              <td style={{padding:'8px',color:C.text}}>{row.top_event || '—'}</td>
              <td style={{padding:'8px',color:C.hint,maxWidth:260}}>{(row.event_names || []).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CohortsTable({ rows }) {
  if (!rows.length) {
    return <EmptyState title="Cohorts indisponibile" body="Cohortele apar dupa ce exista evenimente exit intent cu new/returning, canal si device."/>
  }
  const total = rows.reduce((sum, row) => sum + Number(row.event_count || 0), 0) || 1
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
            {['Cohorta','Canal','Device','Evenimente','Useri','Share'].map(h=>(
              <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:600,fontSize:10,textTransform:'uppercase'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0,12).map((row,i)=>{
            const share = Number(row.event_count || 0) / total * 100
            return (
              <tr key={`${row.new_vs_returning}-${row.session_default_channel_group}-${row.device_category}-${i}`} style={{borderBottom:`0.5px solid ${C.border}`}}>
                <td style={{padding:'8px',color:C.text,fontWeight:600}}>{row.new_vs_returning}</td>
                <td style={{padding:'8px',color:C.muted}}>{row.session_default_channel_group}</td>
                <td style={{padding:'8px',color:C.muted}}>{row.device_category}</td>
                <td style={{padding:'8px',color:C.red,fontWeight:700}}>{fmtN(row.event_count)}</td>
                <td style={{padding:'8px',color:C.muted}}>{fmtN(row.active_users)}</td>
                <td style={{padding:'8px',color:C.text,width:130}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,height:5,background:C.softPanel,borderRadius:99,overflow:'hidden'}}>
                      <div style={{width:`${share}%`,height:5,background:C.red,borderRadius:99}}/>
                    </div>
                    <span style={{fontSize:11,color:C.hint,width:38,textAlign:'right'}}>{share.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function TabExitIntent({ data }) {
  const analysis = data.exitAnalysis || {}
  const exitPages = analysis.exitPages || []
  const intent = analysis.exitIntent || {}
  const timeline = intent.timeline || []
  const events = intent.events || []
  const intentPages = intent.pages || []
  const cohorts = intent.cohorts || []
  const totalIntentEvents = Number(intent.totalEvents || 0)
  const highRiskPages = exitPages.filter(row => Number(row.bounce_rate || 0) >= 0.2 || Number(row.risk_score || 0) >= 12)
  const topRisk = exitPages[0]
  const topIntentPage = intentPages[0]
  const signals = []

  if (totalIntentEvents > 0) {
    signals.push({
      type:'negative',
      title:`${fmtN(totalIntentEvents)} evenimente exit intent detectate`,
      body: topIntentPage ? `Pagina cu cele mai multe semnale: ${topIntentPage.page_path} (${fmtN(topIntentPage.event_count)} evenimente).` : 'Evenimentele sunt active in GA4.',
    })
  } else {
    signals.push({
      type:'neutral',
      title:'Nu exista inca tracking explicit pentru exit intent',
      body:'Tab-ul foloseste momentan exit risk proxy din bounce rate si engagement. Pentru timeline/cohorts reale, trimite event GA4 exit_intent sau form_abandon.',
    })
  }

  if (topRisk) {
    signals.push({
      type: Number(topRisk.bounce_rate || 0) >= 0.25 ? 'negative' : 'info',
      title:`Top exit risk: ${topRisk.page_path}`,
      body:`${fmtN(topRisk.screen_page_views)} views, ${pct(topRisk.bounce_rate)} bounce, ${fmtN(topRisk.estimated_exits)} exit proxy. ${topRisk.recommendation}`,
    })
  }

  if (highRiskPages.length > 0) {
    signals.push({
      type:'info',
      title:`${highRiskPages.length} pagini au risc de exit peste prag`,
      body:'Prioritizeaza paginile cu volum mare, bounce ridicat si conversie mica; acolo CTA-ul sau urmatorul pas lipseste cel mai probabil.',
    })
  }

  return (
    <div>
      <Grid>
        <KPI label="Exit intent events" curr={totalIntentEvents} sub={events[0]?.event_name || 'tracking explicit'}/>
        <KPI label="Pagini cu risc" curr={highRiskPages.length} sub="bounce/risk peste prag"/>
        <KPI label="Top exit proxy" curr={topRisk?.estimated_exits || 0} sub={topRisk?.page_path || '—'}/>
        <KPI label="Cohorts" curr={cohorts.length} sub="new/returning + canal + device"/>
      </Grid>

      <Sec title="Semnale exit">
        {signals.map((signal,i)=><Signal key={i} {...signal}/>)}
      </Sec>

      <Sec title="Timeline exit intent">
        <Card>
          {timeline.length >= 2 ? (
            <LineChart
              data={timeline}
              metrics={[
                {field:'event_count',label:'Exit intent events',color:C.red},
                {field:'active_users',label:'Useri',color:C.amber},
              ]}
              height={210}
            />
          ) : (
            <EmptyState title="Timeline fara date" body="Nu exista suficiente evenimente exit intent in intervalul selectat."/>
          )}
        </Card>
      </Sec>

      {events.length > 0 && (
        <Sec title="Event names detectate">
          <Card style={{padding:'12px 16px'}}>
            <BarChart data={events} labelField="event_name" valueField="event_count" color={C.red} maxBars={10}/>
          </Card>
        </Sec>
      )}

      <Sec title="Exit pages - proxy de risc">
        <div style={{background:C.softAmber,border:`0.5px solid ${C.amber}`,borderRadius:10,padding:'11px 13px',marginBottom:12}}>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:0}}>
            GA4 API nu returneaza direct exits in raportul standard. Scorul de aici combina views, bounce rate, durata si conversia ca sa prioritizeze paginile unde userii pleaca fara urmator pas.
          </p>
        </div>
        <Card style={{padding:0,overflow:'hidden'}}>
          <ExitPagesTable rows={exitPages}/>
        </Card>
      </Sec>

      <Sec title="Pagini cu exit intent explicit">
        <Card style={{padding:0,overflow:'hidden'}}>
          <IntentPagesTable rows={intentPages}/>
        </Card>
      </Sec>

      <Sec title="Cohorts exit intent">
        <Card style={{padding:0,overflow:'hidden'}}>
          <CohortsTable rows={cohorts}/>
        </Card>
      </Sec>
    </div>
  )
}
