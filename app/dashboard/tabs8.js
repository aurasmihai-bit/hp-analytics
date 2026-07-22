'use client'
import { C, KPI, Signal, Sec, Grid, Card, LineChart, BarChart, PageLink, fmtN } from './components'

const HOMEPAGE_VARIANTS = [
  { path:'/', label:'Homepage actual', color:'#1A2B4A', field:'root' },
  { path:'/home3', label:'/home3', color:'#3B82C4', field:'home3' },
  { path:'/invers', label:'/invers', color:'#7C3AED', field:'invers' },
  { path:'/simplu', label:'/simplu', color:'#16A34A', field:'simplu' },
  { path:'/platforma', label:'/platforma', color:'#D97706', field:'platforma' },
]

function pct(v) {
  return `${Number(v || 0).toFixed(1)}%`
}

function sec(v) {
  return `${Math.round(Number(v || 0))}s`
}

function fallbackHomepageAnalysis(data) {
  const pages = data.pages?.current || []
  const previous = data.pages?.previous || []
  const get = (rows, path) => rows.find(row => row.page_path === path) || {}
  const variants = HOMEPAGE_VARIANTS.map(item => {
    const current = get(pages, item.path)
    const prev = get(previous, item.path)
    const views = Number(current.screen_page_views || 0)
    const conversions = Number(current.conversions || 0)
    const previousViews = Number(prev.screen_page_views || 0)
    const previousConversions = Number(prev.conversions || 0)
    return {
      ...item,
      views,
      active_users: Number(current.active_users || 0),
      conversions,
      conversion_rate: views > 0 ? conversions / views * 100 : 0,
      previous_conversion_rate: previousViews > 0 ? previousConversions / previousViews * 100 : 0,
      bounce_rate: Number(current.bounce_rate || 0),
      engagement_rate: Number(current.engagement_rate || 0),
      average_session_duration: Number(current.average_session_duration || 0),
      estimated_exits: Math.round(views * Number(current.bounce_rate || 0)),
      previous_views: previousViews,
      previous_conversions: previousConversions,
    }
  })
  return { variants, timeline: [], recommendations: [] }
}

function homepageTimelineRows(timeline = []) {
  const byDate = new Map()
  timeline.forEach(row => {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date })
    const target = byDate.get(row.date)
    const variant = HOMEPAGE_VARIANTS.find(item => item.path === row.path)
    if (!variant) return
    target[variant.field] = Number(row.conversion_rate || 0)
  })
  return Array.from(byDate.values()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
}

function RecommendationList({ items }) {
  if (!items?.length) return null
  return (
    <Sec title="Recomandari">
      {items.map((item, index) => (
        <Signal key={index} type={item.type || 'info'} title={item.title} body={item.body}/>
      ))}
    </Sec>
  )
}

export function TabHomepageConversions({ data }) {
  const analysis = data.homepageVariants?.variants ? data.homepageVariants : fallbackHomepageAnalysis(data)
  const variants = [...(analysis.variants || [])]
  const sorted = [...variants].sort((a, b) => Number(b.conversion_rate || 0) - Number(a.conversion_rate || 0))
  const best = sorted.find(row => Number(row.views || 0) > 0)
  const platforma = variants.find(row => row.path === '/platforma') || {}
  const totalViews = variants.reduce((sum, row) => sum + Number(row.views || 0), 0)
  const totalConversions = variants.reduce((sum, row) => sum + Number(row.conversions || 0), 0)
  const timeline = homepageTimelineRows(analysis.timeline || [])
  const metrics = HOMEPAGE_VARIANTS.map(item => ({ field:item.field, label:item.label, color:item.color, fmt:'pctN' }))

  return (
    <div>
      <Grid>
        <KPI label="Views variante" curr={totalViews}/>
        <KPI label="Conversii variante" curr={totalConversions}/>
        <KPI label="Best conv rate" curr={best?.conversion_rate || 0} type="pctN" sub={best?.label || 'fara date'}/>
        <KPI label="/platforma bounce" curr={Number(platforma.bounce_rate || 0)} type="pct" sub={`${sec(platforma.average_session_duration)} durata medie`}/>
      </Grid>

      <Sec title="Comparatie conversie homepage">
        <div style={{display:'grid',gridTemplateColumns:'1.1fr .9fr',gap:12,alignItems:'stretch'}}>
          <Card>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 12px'}}>Conversie pe varianta</p>
            <BarChart data={variants} labelField="label" valueField="conversion_rate" color={C.blue} maxBars={8}/>
          </Card>
          <Card>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 10px'}}>Ce urmărești</p>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.55,margin:0}}>
              Obiectivul este sa vezi care homepage transforma vizita in intent: click spre formular, conversie GA4 sau cerere noua.
              Pentru `/platforma`, primul ecran trebuie sa fie mai luminos si sa lase CTA-ul principal sa domine vizual.
            </p>
          </Card>
        </div>
      </Sec>

      {timeline.length > 1 && (
        <Sec title="Evolutie rata conversie">
          <Card>
            <LineChart data={timeline} metrics={metrics} height={220}/>
          </Card>
        </Sec>
      )}

      <Sec title="Tabel variante">
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Pagina','Views','Conv.','Conv rate','Bounce','Durata','Exit proxy'].map(h => (
                  <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map(row => {
                const isPlatforma = row.path === '/platforma'
                return (
                  <tr key={row.path} style={{borderBottom:`0.5px solid ${C.border}`,background:isPlatforma && Number(row.bounce_rate || 0) > .35 ? C.softAmber : 'transparent'}}>
                    <td style={{padding:'8px',fontWeight:600,color:C.text}}><PageLink path={row.path}>{row.label}</PageLink></td>
                    <td style={{padding:'8px',color:C.muted}}>{fmtN(row.views)}</td>
                    <td style={{padding:'8px',color:C.muted}}>{fmtN(row.conversions)}</td>
                    <td style={{padding:'8px',fontWeight:600,color:Number(row.conversion_rate || 0) >= 5 ? C.green : C.amber}}>{pct(row.conversion_rate)}</td>
                    <td style={{padding:'8px',color:Number(row.bounce_rate || 0) >= .4 ? C.red : C.muted}}>{pct(Number(row.bounce_rate || 0) * 100)}</td>
                    <td style={{padding:'8px',color:C.muted}}>{sec(row.average_session_duration)}</td>
                    <td style={{padding:'8px',color:C.muted}}>{fmtN(row.estimated_exits)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Sec>

      <RecommendationList items={analysis.recommendations}/>
    </div>
  )
}

function fallbackConciergeAnalysis(data) {
  const page = (data.pages?.current || []).find(row => row.page_path === '/aliat') || {}
  const prev = (data.pages?.previous || []).find(row => row.page_path === '/aliat') || {}
  const views = Number(page.screen_page_views || 0)
  const conversions = Number(page.conversions || 0)
  return {
    summary: {
      views,
      previous_views: Number(prev.screen_page_views || 0),
      active_users: Number(page.active_users || 0),
      conversions,
      previous_conversions: Number(prev.conversions || 0),
      conversion_rate: views > 0 ? conversions / views * 100 : 0,
      bounce_rate: Number(page.bounce_rate || 0),
      engagement_rate: Number(page.engagement_rate || 0),
      average_session_duration: Number(page.average_session_duration || 0),
      estimated_bounces: Math.round(views * Number(page.bounce_rate || 0)),
    },
    referrers: [],
    sources: [],
    devices: [],
    timeline: [],
    topClicks: [],
    timeSpent: [],
    heatmap: { cells: [], devices: [], dates: [] },
    recommendations: [],
  }
}

function MiniTable({ title, rows, labelField, valueLabel = 'Views' }) {
  return (
    <Sec title={title}>
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).slice(0, 10).map((row, index) => (
          <div key={`${row[labelField]}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 72px 72px 72px',gap:10,alignItems:'center',borderBottom:index < Math.min(rows.length, 10) - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row[labelField]}>{row[labelField] || '(not set)'}</span>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.screen_page_views)}</span>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{pct(Number(row.bounce_rate || 0) * 100)}</span>
            <span style={{fontSize:12,color:Number(row.conversion_rate || 0) > 0 ? C.green : C.hint,textAlign:'right',fontWeight:600}}>{pct(row.conversion_rate)}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista date pe acest interval.</p>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 72px 72px 72px',gap:10,marginTop:8,paddingTop:8,borderTop:`0.5px solid ${C.border}`}}>
          <span style={{fontSize:10,color:C.hint,textTransform:'uppercase'}}></span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>{valueLabel}</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Bounce</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Conv</span>
        </div>
      </Card>
    </Sec>
  )
}

function InteractionTable({ rows }) {
  return (
    <Sec title="Top click-uri / interactiuni">
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).slice(0, 12).map((row, index) => (
          <div key={`${row.event_name}-${row.click_target}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 72px 74px',gap:10,alignItems:'center',borderBottom:index < Math.min(rows.length, 12) - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:C.text,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.click_target}>
                {String(row.click_target || '(not set)').startsWith('/') ? <PageLink path={row.click_target}>{row.click_target}</PageLink> : row.click_target || '(not set)'}
              </p>
              <p style={{fontSize:10,color:C.hint,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.event_name}>{row.event_name || '(not set)'} · {row.device_category || '(not set)'}</p>
            </div>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.event_count)}</span>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.active_users)}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista click-uri etichetate pentru /aliat pe acest interval.</p>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 72px 74px',gap:10,marginTop:8,paddingTop:8,borderTop:`0.5px solid ${C.border}`}}>
          <span style={{fontSize:10,color:C.hint,textTransform:'uppercase'}}>Target / event</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Click-uri</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Useri</span>
        </div>
      </Card>
    </Sec>
  )
}

function TimeSpentTable({ rows }) {
  return (
    <Sec title="Time spent / sursa">
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).slice(0, 12).map((row, index) => (
          <div key={`${row.session_source_medium}-${row.device_category}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 60px 64px 64px',gap:10,alignItems:'center',borderBottom:index < Math.min(rows.length, 12) - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:C.text,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.session_source_medium}>{row.session_source_medium || '(not set)'}</p>
              <p style={{fontSize:10,color:C.hint,margin:0}}>{row.device_category || '(not set)'}</p>
            </div>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.screen_page_views)}</span>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{sec(row.average_session_duration)}</span>
            <span style={{fontSize:12,color:Number(row.conversion_rate || 0) > 0 ? C.green : C.hint,textAlign:'right',fontWeight:600}}>{pct(row.conversion_rate)}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista date suficiente pentru timp petrecut.</p>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 60px 64px 64px',gap:10,marginTop:8,paddingTop:8,borderTop:`0.5px solid ${C.border}`}}>
          <span style={{fontSize:10,color:C.hint,textTransform:'uppercase'}}>Sursa</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Views</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Timp</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Conv</span>
        </div>
      </Card>
    </Sec>
  )
}

function ConciergeHeatmap({ heatmap }) {
  const cells = heatmap?.cells || []
  const dates = (heatmap?.dates || []).slice(-14)
  const devices = heatmap?.devices || []
  const getCell = (date, device) => cells.find(cell => cell.date === date && cell.device_category === device)
  return (
    <Sec title="Heatmap trafic /aliat">
      <Card style={{padding:'12px 14px',overflowX:'auto'}}>
        {dates.length > 0 && devices.length > 0 ? (
          <div style={{minWidth:Math.max(520, dates.length * 48)}}>
            <div style={{display:'grid',gridTemplateColumns:`92px repeat(${dates.length}, 1fr)`,gap:4,alignItems:'center',marginBottom:6}}>
              <span />
              {dates.map(date => <span key={date} style={{fontSize:10,color:C.hint,textAlign:'center'}}>{String(date).slice(5)}</span>)}
            </div>
            {devices.map(device => (
              <div key={device} style={{display:'grid',gridTemplateColumns:`92px repeat(${dates.length}, 1fr)`,gap:4,alignItems:'center',marginBottom:4}}>
                <span style={{fontSize:11,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{device}</span>
                {dates.map(date => {
                  const cell = getCell(date, device)
                  const intensity = Math.max(0, Math.min(100, Number(cell?.intensity_pct || 0)))
                  return (
                    <div
                      key={`${date}-${device}`}
                      title={cell ? `${fmtN(cell.screen_page_views)} views · ${sec(cell.average_session_duration)} · ${fmtN(cell.conversions)} conversii` : 'fara date'}
                      style={{
                        height:26,
                        borderRadius:6,
                        border:`0.5px solid ${C.border}`,
                        background:intensity > 0 ? `rgba(59,130,196,${0.12 + intensity / 130})` : C.softPanel,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        color:intensity > 55 ? '#fff' : C.muted,
                        fontSize:10,
                        fontWeight:600,
                      }}
                    >
                      {cell?.screen_page_views ? fmtN(cell.screen_page_views) : ''}
                    </div>
                  )
                })}
              </div>
            ))}
            <p style={{fontSize:11,color:C.hint,margin:'8px 0 0'}}>Intensitatea combina views cu durata medie. Pentru heatmap real pe click-uri pe ecran este nevoie de tool dedicat, de tip Hotjar/Microsoft Clarity.</p>
          </div>
        ) : (
          <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista suficiente date pentru heatmap pe intervalul selectat.</p>
        )}
      </Card>
    </Sec>
  )
}

export function TabConciergeTraffic({ data }) {
  const analysis = data.conciergeTraffic?.summary ? data.conciergeTraffic : fallbackConciergeAnalysis(data)
  const summary = analysis.summary || {}
  const timeline = analysis.timeline || []

  return (
    <div>
      <Grid>
        <KPI label="/aliat views" curr={summary.views || 0} prev={summary.previous_views}/>
        <KPI label="Conversii" curr={summary.conversions || 0} prev={summary.previous_conversions}/>
        <KPI label="Rata conversie" curr={summary.conversion_rate || 0} prev={summary.previous_conversion_rate} type="pctN"/>
        <KPI label="Bounce rate" curr={summary.bounce_rate || 0} type="pct" sub={`${sec(summary.average_session_duration)} time on page`}/>
      </Grid>

      <Sec title="Evolutie /aliat">
        <Card>
          <LineChart
            data={timeline}
            metrics={[
              {field:'screen_page_views',label:'Views',color:C.blue},
              {field:'conversions',label:'Conversii',color:C.green},
              {field:'conversion_rate',label:'Conv rate',color:C.amber,fmt:'pctN'},
            ]}
            height={210}
          />
        </Card>
      </Sec>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <MiniTable title="Top referreri" rows={analysis.referrers || []} labelField="page_referrer"/>
        <MiniTable title="Top surse / medium" rows={analysis.sources || []} labelField="session_source_medium"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
        <InteractionTable rows={analysis.topClicks || []}/>
        <TimeSpentTable rows={analysis.timeSpent || []}/>
      </div>

      <ConciergeHeatmap heatmap={analysis.heatmap}/>

      <Sec title="Device mix">
        <Card>
          <BarChart data={analysis.devices || []} labelField="device_category" valueField="screen_page_views" color={C.purple}/>
        </Card>
      </Sec>

      <RecommendationList items={analysis.recommendations}/>

      <Sec title="Note masurare">
        <Card>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:0}}>
            Conversia vine din GA4 `conversions` pe pagina `/aliat`. Pentru confirmare operationala, compara periodic cu cererile salvate in CRM Servicii/Aliat.
            Referrerul vine din `pageReferrer`; pentru CTA-uri interne recomand UTM-uri dedicate, altfel multe vizite apar ca direct sau fara sursa clara.
          </p>
        </Card>
      </Sec>
    </div>
  )
}

export function TabReferrals({ data }) {
  const analysis = data.referrals || { summary: {}, rows: [], recommendations: [] }
  const summary = analysis.summary || {}
  const rows = analysis.rows || []
  return (
    <div>
      <Grid>
        <KPI label="Referrers + landing" curr={summary.referrers || rows.length || 0}/>
        <KPI label="Views din referrers" curr={summary.views || 0} prev={summary.previous_views}/>
        <KPI label="Conversii" curr={summary.conversions || 0} prev={summary.previous_conversions}/>
        <KPI label="Rata conversie" curr={summary.conversion_rate || 0} prev={summary.previous_conversion_rate} type="pctN"/>
      </Grid>
      <Sec title="Referrers cu URL complet + landing path + conversii">
        <Card style={{padding:'10px 14px',overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:760}}>
            <thead>
              <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Full referrer URL','Landing path','Sursa / medium','Views','Conversii','Conv rate'].map(h => (
                  <th key={h} style={{textAlign:h === 'Views' || h === 'Conversii' || h === 'Conv rate' ? 'right' : 'left',padding:'7px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((row, index) => (
                <tr key={`${row.referrer_full}-${row.landing_path}-${index}`} style={{borderBottom:`0.5px solid ${C.border}`}}>
                  <td style={{padding:'8px',maxWidth:320,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.text}} title={row.referrer_full}>{row.referrer_full || '(direct)'}</td>
                  <td style={{padding:'8px',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}} title={row.landing_path}>
                    <PageLink path={row.landing_path || '/'}>{row.landing_path || '/'}</PageLink>
                  </td>
                  <td style={{padding:'8px',color:C.muted}}>{row.session_source_medium || '(not set)'}</td>
                  <td style={{padding:'8px',textAlign:'right',color:C.muted}}>{fmtN(row.screen_page_views)}</td>
                  <td style={{padding:'8px',textAlign:'right',color:Number(row.conversions || 0) > 0 ? C.green : C.muted,fontWeight:600}}>{fmtN(row.conversions)}</td>
                  <td style={{padding:'8px',textAlign:'right',color:Number(row.conversion_rate || 0) > 0 ? C.green : C.hint,fontWeight:600}}>{pct(row.conversion_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista date detaliate de referrer pe intervalul selectat. Apasa sync dupa deploy pentru populare.</p>}
        </Card>
      </Sec>
      <RecommendationList items={analysis.recommendations}/>
    </div>
  )
}

export function TabLlmVisibility({ data }) {
  const pages = data.pages?.current || []
  const gsc = data.gsc || {}
  const amplitude = data.amplitudeAnalytics || {}
  const llmEvents = amplitude.llmEvents || []
  const llmEventTotal = llmEvents.reduce((sum, row) => sum + Number(row.events || 0), 0)
  const agentReadyPages = [
    { label:'API catalog', path:'/.well-known/api-catalog' },
    { label:'Agent skills index', path:'/.well-known/agent-skills/index.json' },
    { label:'MCP server card', path:'/.well-known/mcp/server-card.json' },
    { label:'API docs', path:'/api-docs' },
    { label:'Aliat buyer services', path:'/aliat' },
    { label:'Cereri servicii', path:'/cereri-servicii' },
  ]
  const hasGsc = (gsc.queries || []).length > 0 || (gsc.pages || []).length > 0 || (gsc.current || []).length > 0
  const indexedAgentPages = agentReadyPages.map(item => {
    const ga4 = pages.find(page => page.page_path === item.path) || {}
    const gscPage = (gsc.pages || gsc.current || []).find(page => page.page_path === item.path || page.page === item.path) || {}
    return {
      ...item,
      views: Number(ga4.screen_page_views || 0),
      clicks: Number(gscPage.organic_google_search_clicks || gscPage.clicks || 0),
      impressions: Number(gscPage.organic_google_search_impressions || gscPage.impressions || 0),
      status: Number(ga4.screen_page_views || 0) > 0 || Number(gscPage.organic_google_search_impressions || 0) > 0 ? 'vizibil' : 'de verificat',
    }
  })
  return (
    <div>
      <Grid>
        <KPI label="Pagini agent-ready urmărite" curr={agentReadyPages.length}/>
        <KPI label="Cu trafic / impresii" curr={indexedAgentPages.filter(row => row.status === 'vizibil').length}/>
        <KPI label="GSC conectat" curr={hasGsc ? 1 : 0}/>
        <KPI label="Evenimente LLM Amplitude" curr={llmEventTotal}/>
      </Grid>
      {amplitude.setupIssue && (
        <Sec title="Amplitude">
          <Signal type="neutral" title="Conecteaza Amplitude pentru semnale LLM" body={amplitude.setupIssue}/>
        </Sec>
      )}
      {!amplitude.setupIssue && (
        <Sec title="Evenimente LLM / agent discovery din Amplitude">
          <Card style={{padding:'10px 14px'}}>
            {(llmEvents.length ? llmEvents : [{event_name:'llm_referral / agent_discovery',events:0}]).map((row, index) => (
              <div key={`${row.event_name}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:10,alignItems:'center',borderBottom:index < llmEvents.length - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
                <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.event_name}>{row.event_name}</span>
                <span style={{fontSize:12,fontWeight:600,color:Number(row.events || 0) > 0 ? C.green : C.hint,textAlign:'right'}}>{fmtN(row.events || 0)}</span>
              </div>
            ))}
          </Card>
        </Sec>
      )}
      <Sec title="Vizibilitate in LLM-uri si agent discovery">
        <Card>
          <p style={{fontSize:13,color:C.muted,lineHeight:1.55,margin:'0 0 14px'}}>
            Acest tab monitorizeaza readiness pentru AI agents si LLM discovery: pagini agent-ready, link headers, API catalog, documentatie si pagini cu intent comercial. Nu inventeaza citari LLM; pentru citari reale trebuie conectat un monitor extern de brand mentions.
          </p>
          {indexedAgentPages.map((row, index) => (
            <div key={row.path} style={{display:'grid',gridTemplateColumns:'1fr 90px 90px 90px',gap:10,alignItems:'center',borderTop:index ? `0.5px solid ${C.border}` : 'none',padding:'9px 0'}}>
              <div style={{minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 2px'}}>{row.label}</p>
                <PageLink path={row.path}>{row.path}</PageLink>
              </div>
              <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.views)} views</span>
              <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.impressions)} impr.</span>
              <span style={{fontSize:11,fontWeight:600,textAlign:'right',color:row.status === 'vizibil' ? C.green : C.amber}}>{row.status}</span>
            </div>
          ))}
        </Card>
      </Sec>
      <RecommendationList items={[
        { type:'info', title:'Urmatorul pas pentru LLM visibility', body:'Adauga monitorizare externa pentru interogari tip ChatGPT/Perplexity/Gemini: nume brand, pagini citate, sentiment si competitori mentionati.' },
        { type:'neutral', title:'Pastreaza agent discovery verificabil', body:'Verifica periodic /.well-known/api-catalog, agent-skills index, mcp server card si Link headers pe homepage.' },
      ]}/>
    </div>
  )
}

export function TabAmplitude({ data }) {
  const analysis = data.amplitudeAnalytics || { events: [], llmEvents: [], formEvents: [], timeline: [], recommendations: [] }
  const settings = analysis.settings || {}
  const events = analysis.events || []
  const llmEvents = analysis.llmEvents || []
  const formEvents = analysis.formEvents || []
  const sessionReplayEvents = analysis.sessionReplayEvents || []
  const liveEvents = analysis.liveEvents || []
  const replays = analysis.replays || []
  const replayMetadata = analysis.replayMetadata || {}
  const totalEvents = events.reduce((sum, row) => sum + Number(row.events || 0), 0)
  const llmTotal = llmEvents.reduce((sum, row) => sum + Number(row.events || 0), 0)
  const formTotal = formEvents.reduce((sum, row) => sum + Number(row.events || 0), 0)
  const replayTotal = sessionReplayEvents.reduce((sum, row) => sum + Number(row.events || 0), 0)
  const timeline = analysis.timeline || []
  const topTimelineMetrics = events
    .filter(row => Number(row.events || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.events || 0) - Number(a.events || 0))
    .slice(0, 4)
    .map((row, index) => ({ field: row.event_name, label: row.event_name, color: [C.blue, C.green, C.amber, C.purple][index] || C.gray }))

  const EventTable = ({ title, rows }) => (
    <Sec title={title}>
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).map((row, index) => (
          <div key={`${row.event_name}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:10,alignItems:'center',borderBottom:index < rows.length - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:C.text,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.event_name}>{row.event_name}</p>
              {row.error && <p style={{fontSize:10,color:C.red,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.error}>{row.error}</p>}
            </div>
            <span style={{fontSize:13,color:Number(row.events || 0) > 0 ? C.green : C.hint,textAlign:'right',fontWeight:600}}>{fmtN(row.events || 0)}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista evenimente in aceasta categorie.</p>}
      </Card>
    </Sec>
  )

  const EventListing = ({ title, rows, empty }) => (
    <Sec title={title}>
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).length ? rows.map((row, index) => (
          <div key={`${title}-${row.event_name}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 90px 100px',gap:10,alignItems:'center',borderBottom:index < rows.length - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.event_name}>{row.event_name}</span>
            <span style={{fontSize:12,fontWeight:600,color:Number(row.events || 0) > 0 ? C.green : C.hint,textAlign:'right'}}>{fmtN(row.events || 0)}</span>
            <span style={{fontSize:11,color:C.hint,textAlign:'right'}}>{row.last_seen || 'fara data'}</span>
          </div>
        )) : (
          <p style={{fontSize:13,color:C.muted,lineHeight:1.45,margin:0}}>{empty}</p>
        )}
      </Card>
    </Sec>
  )

  const ReplayLinks = () => (
    <Sec title="Session Replay links">
      <Card style={{padding:'10px 14px'}}>
        {analysis.replaySearchIssue && (
          <p style={{fontSize:13,color:C.amber,lineHeight:1.45,margin:'0 0 10px'}}>
            {analysis.replaySearchIssue}
          </p>
        )}
        {replays.length ? replays.map((row, index) => {
          const start = row.session_start_time ? new Date(row.session_start_time).toLocaleString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'
          const page = row.groupBys?.page_url || row.groupBys?.page_location || row.groupBys?.page_path || ''
          const email = row.groupBys?.email || ''
          return (
            <div key={`${row.session_replay_id}-${index}`} style={{display:'grid',gridTemplateColumns:'150px 1fr 90px 110px',gap:10,alignItems:'center',borderBottom:index < replays.length - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
              <span style={{fontSize:12,color:C.muted,whiteSpace:'nowrap'}}>{start}</span>
              <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={page || email || row.amplitude_id}>
                {email || page || row.amplitude_id || row.session_replay_id}
              </span>
              <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.duration || 0)}s</span>
              {row.url ? (
                <a href={row.url} target="_blank" rel="noreferrer" style={{fontSize:12,fontWeight:700,color:C.blue,textAlign:'right'}}>Vezi replay</a>
              ) : (
                <span style={{fontSize:12,color:C.hint,textAlign:'right'}}>fără link</span>
              )}
            </div>
          )
        }) : (
          <p style={{fontSize:13,color:C.muted,lineHeight:1.45,margin:0}}>
            Nu există replay-uri returnate pentru intervalul selectat. După ce Amplitude capturează replay-uri, aici apare link direct către video în Amplitude.
          </p>
        )}
        {replayMetadata && Object.keys(replayMetadata).length > 0 && (
          <p style={{fontSize:11,color:C.hint,margin:'10px 0 0'}}>
            Matched: {fmtN(replayMetadata.post_filter_count ?? replayMetadata.pre_filter_count ?? 0)}
            {replayMetadata.pre_filter_capped ? ' · rezultat capat la 1.000 sesiuni' : ''}
          </p>
        )}
      </Card>
    </Sec>
  )

  return (
    <div>
      {analysis.setupIssue && (
        <Sec title="Setup">
          <Signal type="neutral" title="Amplitude nu este conectat complet" body={analysis.setupIssue}/>
        </Sec>
      )}
      <Sec title="Setari Amplitude">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          {[
            { label:'SDK browser', value:settings.sdk || '@amplitude/unified', tone:C.blue },
            { label:'Autocapture / live events', value:settings.analyticsAutocapture ? 'Activ' : 'De verificat', tone:settings.analyticsAutocapture ? C.green : C.amber },
            { label:'Session Replay', value:settings.sessionReplayEnabled ? `Activ · sample ${Math.round(Number(settings.sessionReplaySampleRate || 0) * 100)}%` : 'De verificat', tone:settings.sessionReplayEnabled ? C.green : C.amber },
            { label:'Initializare', value:settings.initializedClientSide ? 'Client-side, o singura data' : 'De verificat', tone:settings.initializedClientSide ? C.green : C.amber },
          ].map(item => (
            <Card key={item.label} style={{padding:14}}>
              <p style={{fontSize:11,fontWeight:700,color:C.hint,textTransform:'uppercase',letterSpacing:.4,margin:'0 0 6px'}}>{item.label}</p>
              <p style={{fontSize:15,fontWeight:700,color:item.tone,margin:0}}>{item.value}</p>
            </Card>
          ))}
        </div>
      </Sec>
      <Grid>
        <KPI label="Evenimente Amplitude" curr={totalEvents}/>
        <KPI label="LLM / agent discovery" curr={llmTotal}/>
        <KPI label="Funnel formular" curr={formTotal}/>
        <KPI label="Session Replay events" curr={replayTotal}/>
      </Grid>
      {timeline.length > 1 && topTimelineMetrics.length > 0 && (
        <Sec title="Evolutie evenimente Amplitude">
          <Card>
            <LineChart data={timeline} metrics={topTimelineMetrics} height={220}/>
          </Card>
        </Sec>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
        <EventListing title="Live events monitorizate" rows={liveEvents.slice(0, 10)} empty="Nu exista inca evenimente live in API pentru intervalul selectat."/>
        <EventListing title="Session Replay" rows={sessionReplayEvents} empty="Session Replay este activ in SDK. Daca Amplitude nu expune un event separat pentru replay in API, verifica replay-urile din dashboardul Amplitude pe evenimentele autocapture."/>
        <EventTable title="Evenimente LLM / agent discovery" rows={llmEvents}/>
        <EventTable title="Evenimente formular si cereri" rows={formEvents}/>
      </div>
      <ReplayLinks />
      <Sec title="Toate evenimentele monitorizate">
        <Card style={{padding:'10px 14px'}}>
          {events.map((row, index) => (
            <div key={`${row.event_name}-all-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:10,alignItems:'center',borderBottom:index < events.length - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
              <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.event_name}>{row.event_name}</span>
              <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.events || 0)}</span>
            </div>
          ))}
        </Card>
      </Sec>
      <RecommendationList items={analysis.recommendations}/>
    </div>
  )
}

function fallbackHeaderMenuAnalysis() {
  return {
    schemaVersion: 1,
    variants: [
      { key:'control', label:'Meniu actual', views:0, clicks:0, click_rate:0, requests_created:0, request_rate:0, properties_created:0, property_rate:0, contact_clicks:0 },
      { key:'simplu', label:'Meniu pe intentie', views:0, clicks:0, click_rate:0, requests_created:0, request_rate:0, properties_created:0, property_rate:0, contact_clicks:0 },
      { key:'variant_c', label:'Varianta C', views:0, clicks:0, click_rate:0, requests_created:0, request_rate:0, properties_created:0, property_rate:0, contact_clicks:0 },
    ],
    timeline: [],
    recommendations: [{ type:'neutral', title:'Nu exista date pentru testul de header', body:'Ruleaza migrarea Supabase si activeaza switch-ul din /admin/pagini.' }],
  }
}

function headerTimelineRows(timeline = []) {
  const byDate = new Map()
  timeline.forEach(row => {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date })
    const target = byDate.get(row.date)
    const prefix = row.variant === 'simplu' ? 'intent' : row.variant === 'control' ? 'control' : 'variant_c'
    target[`${prefix}_request_rate`] = Number(row.request_rate || 0)
    target[`${prefix}_property_rate`] = Number(row.property_rate || 0)
    target[`${prefix}_views`] = Number(row.views || 0)
  })
  return Array.from(byDate.values()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
}

export function TabHeaderMenuAB({ data }) {
  const analysis = data.headerMenuTest?.variants ? data.headerMenuTest : fallbackHeaderMenuAnalysis()
  const variants = analysis.variants || []
  const control = variants.find(row => row.key === 'control') || {}
  const intent = variants.find(row => row.key === 'simplu') || {}
  const summary = analysis.summary || {}
  const totalViews = summary.totalViews ?? variants.reduce((sum, row) => sum + Number(row.views || 0), 0)
  const totalClicks = summary.totalClicks ?? variants.reduce((sum, row) => sum + Number(row.clicks || 0), 0)
  const totalRequests = summary.totalRequests ?? variants.reduce((sum, row) => sum + Number(row.requests_created || 0), 0)
  const totalProperties = summary.totalProperties ?? variants.reduce((sum, row) => sum + Number(row.properties_created || 0), 0)
  const timeline = headerTimelineRows(analysis.timeline || [])
  const visibleRows = variants.filter(row => row.key !== 'variant_c' || Number(row.views || 0) > 0)
  const hasConfigIssue = ['analytics_token_missing', 'analytics_token_invalid', 'platform_key_missing', 'platform_key_invalid'].includes(analysis.setupIssueCode)

  return (
    <div>
      {analysis.setupIssue && (
        <Sec title="Setup">
          <Signal
            type={hasConfigIssue ? 'neutral' : 'negative'}
            title={hasConfigIssue ? 'Conexiunea cu exportul HomePitch trebuie corectata' : 'Datele A/B pentru header nu sunt inca disponibile'}
            body={analysis.setupIssue}
          />
        </Sec>
      )}

      <Grid>
        <KPI label="Expuneri header" curr={totalViews}/>
        <KPI label="CTR header" curr={totalViews > 0 ? totalClicks / totalViews * 100 : 0} type="pctN"/>
        <KPI label="Cereri create" curr={totalRequests} sub={summary.bestRequestVariant?.label || 'fara castigator'}/>
        <KPI label="Proprietati create" curr={totalProperties} sub={summary.bestPropertyVariant?.label || 'fara castigator'}/>
      </Grid>

      <Sec title="Comparatie meniu actual vs meniu pe intentie">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Card>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 12px'}}>Cereri create pe variantă</p>
            <BarChart data={visibleRows} labelField="label" valueField="requests_created" color={C.green} maxBars={3}/>
            <p style={{fontSize:11,color:C.hint,margin:'8px 0 0'}}>Numar brut de cereri. Rata se vede in tabel si in comparatia din dreapta.</p>
          </Card>
          <Card>
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 10px'}}>Ce masoara testul</p>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.55,margin:0}}>
              Varianta B reorganizeaza headerul dupa intentie: cumpar, inchiriez, vand si sunt agent.
              KPI-ul principal este cerere creata; KPI-ul secundar este proprietate creata.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
              <div style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:10}}>
                <p style={{fontSize:10,color:C.hint,textTransform:'uppercase',margin:'0 0 4px'}}>Control</p>
                <p style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{pct(control.request_rate || 0)}</p>
                <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>{fmtN(control.requests_created || 0)} cereri / {fmtN(control.views || 0)} expuneri</p>
              </div>
              <div style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:10,background:Number(intent.request_rate || 0) > Number(control.request_rate || 0) ? C.softGreen : 'transparent'}}>
                <p style={{fontSize:10,color:C.hint,textTransform:'uppercase',margin:'0 0 4px'}}>Varianta B</p>
                <p style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{pct(intent.request_rate || 0)}</p>
                <p style={{fontSize:11,color:C.hint,margin:'3px 0 0'}}>{fmtN(intent.requests_created || 0)} cereri / {fmtN(intent.views || 0)} expuneri</p>
              </div>
            </div>
          </Card>
        </div>
      </Sec>

      {timeline.length > 1 && (
        <Sec title="Evolutie conversie header">
          <Card>
            <LineChart
              data={timeline}
              metrics={[
                { field:'control_request_rate', label:'Control cereri', color:C.blue, fmt:'pctN' },
                { field:'intent_request_rate', label:'Intentie cereri', color:C.green, fmt:'pctN' },
                { field:'control_property_rate', label:'Control proprietati', color:C.amber, fmt:'pctN' },
                { field:'intent_property_rate', label:'Intentie proprietati', color:C.purple, fmt:'pctN' },
              ]}
              height={220}
            />
          </Card>
        </Sec>
      )}

      <Sec title="Tabel variante">
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Varianta','Expuneri','Clickuri','CTR','Click cerere','Cereri create','Rata cereri','Prop. create','Rata prop.','Contact'].map(h => (
                  <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.key} style={{borderBottom:`0.5px solid ${C.border}`,background:row.key === 'simplu' ? C.softBlue : 'transparent'}}>
                  <td style={{padding:'8px',fontWeight:600,color:C.text}}>{row.label}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.views)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.clicks)}</td>
                  <td style={{padding:'8px',fontWeight:600,color:Number(row.click_rate || 0) > 0 ? C.blue : C.hint}}>{pct(row.click_rate)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.request_cta_clicks)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.requests_created)}</td>
                  <td style={{padding:'8px',fontWeight:600,color:Number(row.request_rate || 0) > 0 ? C.green : C.hint}}>{pct(row.request_rate)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.properties_created)}</td>
                  <td style={{padding:'8px',fontWeight:600,color:Number(row.property_rate || 0) > 0 ? C.amber : C.hint}}>{pct(row.property_rate)}</td>
                  <td style={{padding:'8px',color:C.muted}}>{fmtN(row.contact_clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      <RecommendationList items={analysis.recommendations}/>
    </div>
  )
}

function eur(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('ro-RO')} EUR`
}

function paymentFallback() {
  return {
    summary: { checkout_started: 0, payment_completed: 0, payment_failed: 0, revenue: 0, conversion_rate: 0, average_order_value: 0 },
    pages: [],
    referrers: [],
    users: [],
    types: [],
    timeline: [],
    recent: [],
    recommendations: [{ type:'neutral', title:'Nu există încă date de plăți', body:'După ce HomePitch exportă `stripe_payment_events`, aici vor apărea sursa plăților, referrerul și venitul.' }],
  }
}

function PaymentBreakdown({ title, rows, labelField }) {
  return (
    <Sec title={title}>
      <Card style={{padding:'10px 14px'}}>
        {(rows || []).slice(0, 10).map((row, index) => (
          <div key={`${row[labelField]}-${index}`} style={{display:'grid',gridTemplateColumns:'1fr 74px 74px 92px',gap:10,alignItems:'center',borderBottom:index < Math.min(rows.length, 10) - 1 ? `0.5px solid ${C.border}` : 'none',padding:'8px 0'}}>
            <span style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row[labelField]}>
              {labelField === 'page_path' && row[labelField]?.startsWith('/') ? <PageLink path={row[labelField]}>{row[labelField]}</PageLink> : row[labelField] || '(not set)'}
            </span>
            <span style={{fontSize:12,color:C.muted,textAlign:'right'}}>{fmtN(row.checkout_started)}</span>
            <span style={{fontSize:12,color:C.green,textAlign:'right',fontWeight:600}}>{fmtN(row.payment_completed)}</span>
            <span style={{fontSize:12,color:C.text,textAlign:'right',fontWeight:600}}>{eur(row.revenue)}</span>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p style={{fontSize:13,color:C.hint,margin:0}}>Nu există date pentru intervalul selectat.</p>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 74px 74px 92px',gap:10,marginTop:8,paddingTop:8,borderTop:`0.5px solid ${C.border}`}}>
          <span style={{fontSize:10,color:C.hint,textTransform:'uppercase'}}>Sursă</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Checkout</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Plăți</span>
          <span style={{fontSize:10,color:C.hint,textAlign:'right',textTransform:'uppercase'}}>Venit</span>
        </div>
      </Card>
    </Sec>
  )
}

export function TabPayments({ data }) {
  const analysis = data.paymentAnalytics?.summary ? data.paymentAnalytics : paymentFallback()
  const summary = analysis.summary || {}
  const timeline = analysis.timeline || []

  return (
    <div>
      {analysis.setupIssue && (
        <Sec title="Setup">
          <Signal
            type="neutral"
            title="Datele de plată nu sunt încă disponibile complet"
            body={analysis.setupIssue}
          />
        </Sec>
      )}

      <Sec title="Sursa datelor">
        <Signal
          type="info"
          title="Plățile sunt citite din HomePitch / Stripe"
          body="Tab-ul folosește exportul `stripe_payment_events` din HomePitch. GA4 poate apărea în alte tab-uri de trafic, dar plățile, userii și referrerii din acest tab vin din evenimentele Stripe exportate de HomePitch."
        />
      </Sec>

      <Grid>
        <KPI label="Checkout-uri pornite" curr={summary.checkout_started || 0}/>
        <KPI label="Plăți confirmate" curr={summary.payment_completed || 0}/>
        <KPI label="Venit Stripe" curr={summary.revenue || 0} sub={eur(summary.revenue)}/>
        <KPI label="Checkout → paid" curr={summary.conversion_rate || 0} type="pctN"/>
        <KPI label="Valoare medie" curr={summary.average_order_value || 0} sub={eur(summary.average_order_value)}/>
      </Grid>

      <Sec title="Evoluție plăți">
        <Card>
          <LineChart
            data={timeline}
            metrics={[
              { field:'checkout_started', label:'Checkout', color:C.blue },
              { field:'payment_completed', label:'Plăți', color:C.green },
              { field:'revenue', label:'Venit EUR', color:C.amber },
            ]}
            height={220}
          />
        </Card>
      </Sec>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
        <PaymentBreakdown title="Top pagini sursă" rows={analysis.pages || []} labelField="page_path"/>
        <PaymentBreakdown title="Top referreri" rows={analysis.referrers || []} labelField="referrer"/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
        <PaymentBreakdown title="Top useri / conturi" rows={analysis.users || []} labelField="user"/>
        <PaymentBreakdown title="Tipuri de plată" rows={analysis.types || []} labelField="payment_type"/>
      </div>

      <Sec title="Ultimele evenimente Stripe">
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:`0.5px solid ${C.border}`}}>
                {['Data','Eveniment','Tip plată','User','Sursă','Pagină','Referrer','Valoare'].map(h => (
                  <th key={h} style={{textAlign:'left',padding:'7px 8px',color:C.hint,fontWeight:500,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(analysis.recent || []).slice(0, 30).map(row => (
                <tr key={row.id || `${row.created_at}-${row.stripe_session_id}`} style={{borderBottom:`0.5px solid ${C.border}`}}>
                  <td style={{padding:'8px',color:C.muted,whiteSpace:'nowrap'}}>{row.created_at ? new Date(row.created_at).toLocaleString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                  <td style={{padding:'8px',fontWeight:600,color:row.event_type === 'payment_completed' ? C.green : C.text}}>{row.event_type}</td>
                  <td style={{padding:'8px',color:C.muted}}>{row.payment_type || '—'}</td>
                  <td style={{padding:'8px',color:row.user_email ? C.muted : C.amber,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.user_email || row.user_id || 'email lipsă în export'}>{row.user_display || row.user_email || (row.user_id ? `ID: ${row.user_id}` : 'email lipsă în export')}</td>
                  <td style={{padding:'8px',color:C.hint,whiteSpace:'nowrap'}}>{row.data_source || 'HomePitch / Stripe'}</td>
                  <td style={{padding:'8px',color:C.muted,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.page_path}>{row.page_path?.startsWith('/') ? <PageLink path={row.page_path}>{row.page_path}</PageLink> : row.page_path || '—'}</td>
                  <td style={{padding:'8px',color:C.muted,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.referrer}>{row.referrer || '—'}</td>
                  <td style={{padding:'8px',fontWeight:600,color:C.text,textAlign:'right'}}>{row.event_type === 'payment_completed' ? eur(row.amount_total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!analysis.recent || analysis.recent.length === 0) && <Card><p style={{fontSize:13,color:C.hint,margin:0}}>Nu există evenimente de plată în interval.</p></Card>}
        </div>
      </Sec>

      <RecommendationList items={analysis.recommendations}/>
    </div>
  )
}
