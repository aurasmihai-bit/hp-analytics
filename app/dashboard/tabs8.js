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
  const page = (data.pages?.current || []).find(row => row.page_path === '/concierge') || {}
  const prev = (data.pages?.previous || []).find(row => row.page_path === '/concierge') || {}
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

export function TabConciergeTraffic({ data }) {
  const analysis = data.conciergeTraffic?.summary ? data.conciergeTraffic : fallbackConciergeAnalysis(data)
  const summary = analysis.summary || {}
  const timeline = analysis.timeline || []

  return (
    <div>
      <Grid>
        <KPI label="/concierge views" curr={summary.views || 0} prev={summary.previous_views}/>
        <KPI label="Conversii" curr={summary.conversions || 0} prev={summary.previous_conversions}/>
        <KPI label="Rata conversie" curr={summary.conversion_rate || 0} prev={summary.previous_conversion_rate} type="pctN"/>
        <KPI label="Bounce rate" curr={summary.bounce_rate || 0} type="pct" sub={`${sec(summary.average_session_duration)} time on page`}/>
      </Grid>

      <Sec title="Evolutie /concierge">
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

      <Sec title="Device mix">
        <Card>
          <BarChart data={analysis.devices || []} labelField="device_category" valueField="screen_page_views" color={C.purple}/>
        </Card>
      </Sec>

      <RecommendationList items={analysis.recommendations}/>

      <Sec title="Note masurare">
        <Card>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.55,margin:0}}>
            Conversia vine din GA4 `conversions` pe pagina `/concierge`. Pentru confirmare operationala, compara periodic cu cererile salvate in CRM Concierge.
            Referrerul vine din `pageReferrer`; pentru CTA-uri interne recomand UTM-uri dedicate, altfel multe vizite apar ca direct sau fara sursa clara.
          </p>
        </Card>
      </Sec>
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

  return (
    <div>
      {analysis.setupIssue && (
        <Sec title="Setup">
          <Signal
            type="negative"
            title="Datele A/B pentru header nu sunt inca disponibile"
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
            <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 12px'}}>Rata cereri create</p>
            <BarChart data={visibleRows} labelField="label" valueField="request_rate" color={C.green} maxBars={3}/>
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
              </div>
              <div style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:10,background:Number(intent.request_rate || 0) > Number(control.request_rate || 0) ? C.softGreen : 'transparent'}}>
                <p style={{fontSize:10,color:C.hint,textTransform:'uppercase',margin:'0 0 4px'}}>Varianta B</p>
                <p style={{fontSize:16,fontWeight:700,color:C.text,margin:0}}>{pct(intent.request_rate || 0)}</p>
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
