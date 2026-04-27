'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'

const C = {
  navy: '#1A2B4A', blue: '#3B82C4', green: '#16A34A',
  amber: '#D97706', red: '#DC2626', gray: '#6B7280',
  border: '#e8e8e0', bg: '#f5f5f3', card: '#ffffff',
  text: '#1a1a18', muted: '#666660', hint: '#999990',
}

function delta(curr, prev) {
  if (!prev) return null
  return ((curr - prev) / prev) * 100
}

function DeltaBadge({ curr, prev, invert = false }) {
  const d = delta(curr, prev)
  if (d === null) return null
  const positive = invert ? d < 0 : d > 0
  const color = Math.abs(d) < 2 ? C.gray : positive ? C.green : C.red
  return (
    <span style={{ fontSize: 11, fontWeight: 500, color, marginLeft: 6 }}>
      {d > 0 ? '↑' : '↓'}{Math.abs(d).toFixed(0)}%
    </span>
  )
}

function MetricCard({ label, curr, prev, format, invert }) {
  const fmt = v => {
    if (!v && v !== 0) return '—'
    if (format === 'pct') return (v * 100).toFixed(1) + '%'
    if (format === 'sec') return Math.round(v) + 's'
    if (format === 'dec') return v.toFixed(1)
    return Math.round(v).toLocaleString('ro')
  }
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ fontSize: 12, color: C.hint, margin: '0 0 6px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontSize: 22, fontWeight: 500, color: C.text }}>{fmt(curr)}</span>
        {prev !== undefined && <DeltaBadge curr={curr} prev={prev} invert={invert} />}
      </div>
    </div>
  )
}

function Signal({ type, title, body }) {
  const s = {
    positive: { bg: '#F0FDF4', border: '#86EFAC', dot: '#22C55E' },
    negative: { bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444' },
    neutral:  { bg: '#FFF7ED', border: '#FCD34D', dot: '#F59E0B' },
  }[type] || { bg: '#F5F5F3', border: '#D0D0C8', dot: C.gray }
  return (
    <div style={{ background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{title}</span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.55 }}>{body}</p>
    </div>
  )
}

function ActionCard({ urgency, title, body, fix }) {
  const [open, setOpen] = useState(false)
  const badge = {
    urgent:      { bg: '#FEF2F2', color: C.red },
    important:   { bg: '#FFF7ED', color: C.amber },
    'luna asta': { bg: '#EBF4FC', color: C.blue },
  }[urgency] || { bg: '#EBF4FC', color: C.blue }
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: badge.bg, color: badge.color, flexShrink: 0 }}>{urgency}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: C.hint, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: `0.5px solid ${C.border}` }}>
          <p style={{ fontSize: 13, color: C.muted, margin: '12px 0 8px', lineHeight: 1.55 }}>{body}</p>
          <div style={{ background: '#f5f5f3', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.green, margin: '0 0 4px' }}>Actiune recomandata</p>
            <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>{fix}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 11, fontWeight: 500, color: C.hint, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 24 }}>{children}</div>
}

function SimpleTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}` }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '7px 8px', color: j === 0 ? C.text : C.muted, fontFamily: j === 0 && String(cell).startsWith('/') ? 'monospace' : 'inherit', fontSize: j === 0 && String(cell).startsWith('/') ? 11 : 12 }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── TAB: Semnale ──────────────────────────────────────────────────────
function TabSemnale({ data }) {
  const curr = data.traffic.current
  const prev = data.traffic.previous

  const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0)
  const totalCurr = sum(curr, 'sessions')
  const totalPrev = sum(prev, 'sessions')
  const convCurr  = sum(curr, 'conversions')
  const convPrev  = sum(prev, 'conversions')
  const newCurr   = sum(curr, 'newusers')
  const newPrev   = sum(prev, 'newusers')

  const gscClicks = sum(data.gsc.current, 'organic_google_search_clicks')
  const gscPrevClicks = sum(data.gsc.previous, 'organic_google_search_clicks')

  const social = curr.find(r => r.session_default_channel_group === 'Organic Social')
  const socialPrev = prev.find(r => r.session_default_channel_group === 'Organic Social')
  const customConv = sum(data.conversions, 'conversions_signup') + sum(data.conversions, 'conversions_offer_accepted') + sum(data.conversions, 'conversions_bravo_cerere_noua')

  const signals = []

  const sessD = delta(totalCurr, totalPrev)
  if (sessD !== null) {
    if (sessD > 15) signals.push({ type: 'positive', title: `Trafic ↑${sessD.toFixed(0)}% fata de saptamana trecuta`, body: `${totalCurr.toLocaleString('ro')} sesiuni vs ${totalPrev.toLocaleString('ro')}. Crestere solida generala.` })
    else if (sessD < -15) signals.push({ type: 'negative', title: `Trafic ↓${Math.abs(sessD).toFixed(0)}% fata de saptamana trecuta`, body: `${totalCurr.toLocaleString('ro')} sesiuni vs ${totalPrev.toLocaleString('ro')}. Investigati sursa scaderii.` })
  }

  if (social && socialPrev) {
    const sd = delta(social.sessions, socialPrev.sessions)
    if (sd !== null && Math.abs(sd) > 20) signals.push({ type: sd > 0 ? 'positive' : 'negative', title: `Social Media ${sd > 0 ? '↑' : '↓'}${Math.abs(sd).toFixed(0)}%`, body: `${social.sessions} sesiuni din social. ${sd > 0 ? 'Un post a performat bine — identifica-l si replica formatul.' : 'Activitate sociala in scadere.'}` })
  }

  const gscD = delta(gscClicks, gscPrevClicks)
  if (gscD !== null && Math.abs(gscD) > 10) signals.push({ type: gscD > 0 ? 'positive' : 'negative', title: `SEO: ${gscD > 0 ? '↑' : '↓'}${Math.abs(gscD).toFixed(0)}% clicks organice`, body: `${Math.round(gscClicks)} clicks aceasta saptamana vs ${Math.round(gscPrevClicks)} saptamana trecuta.` })

  if (customConv === 0) signals.push({ type: 'neutral', title: 'Conversii custom = 0 — Key Events neconfigurate in GA4', body: 'conversions_signup, conversions_offer_accepted si conversions_bravo_cerere_noua returneaza 0. GA4 Admin → Events → Mark as conversion.' })

  if (signals.length === 0) signals.push({ type: 'neutral', title: 'Saptamana stabila', body: `${totalCurr.toLocaleString('ro')} sesiuni, ${convCurr} conversii. Fara anomalii majore.` })

  return (
    <div>
      <Grid>
        <MetricCard label="Sesiuni" curr={totalCurr} prev={totalPrev} />
        <MetricCard label="Useri noi" curr={newCurr} prev={newPrev} />
        <MetricCard label="Conversii GA4" curr={convCurr} prev={convPrev} />
        <MetricCard label="Clicks SEO" curr={Math.round(gscClicks)} prev={Math.round(gscPrevClicks)} />
      </Grid>
      <Section title="Semnalele saptamanii">
        {signals.slice(0, 3).map((s, i) => <Signal key={i} {...s} />)}
      </Section>
    </div>
  )
}

// ── TAB: Trafic ───────────────────────────────────────────────────────
function TabTrafic({ data }) {
  const curr = data.traffic.current
  const prev = data.traffic.previous
  const sorted = [...curr].sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
  const maxSess = sorted[0]?.sessions || 1

  return (
    <div>
      <Grid>
        {['Direct','Organic Social','Organic Search','Referral'].map(ch => {
          const c = curr.find(r => r.session_default_channel_group === ch)
          const p = prev.find(r => r.session_default_channel_group === ch)
          return <MetricCard key={ch} label={ch} curr={c?.sessions || 0} prev={p?.sessions || 0} />
        })}
      </Grid>
      <Section title="Sesiuni per canal">
        {sorted.map(row => {
          const ch = row.session_default_channel_group
          const p = prev.find(r => r.session_default_channel_group === ch)
          const d = p ? delta(row.sessions, p.sessions) : null
          const pct = Math.round((row.sessions / maxSess) * 100)
          const dColor = d === null ? C.gray : d > 0 ? C.green : C.red
          return (
            <div key={ch} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: C.text, width: 140, flexShrink: 0 }}>{ch}</span>
                <div style={{ flex: 1, background: '#ebebE4', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: 6, borderRadius: 99, background: C.blue }} />
                </div>
                <span style={{ fontSize: 13, color: C.text, width: 55, textAlign: 'right', flexShrink: 0 }}>{row.sessions?.toLocaleString('ro')}</span>
                {d !== null && <span style={{ fontSize: 11, fontWeight: 500, color: dColor, width: 44, textAlign: 'right', flexShrink: 0 }}>{d > 0 ? '↑' : '↓'}{Math.abs(d).toFixed(0)}%</span>}
              </div>
              <div style={{ marginLeft: 150, fontSize: 11, color: C.hint, marginTop: 3 }}>
                conv: {row.conversions} · eng: {Math.round((row.engagement_rate || 0) * 100)}% · {Math.round(row.average_session_duration || 0)}s
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

// ── TAB: SEO ──────────────────────────────────────────────────────────
function TabSEO({ data }) {
  const curr = data.gsc.current
  const prev = data.gsc.previous
  const queries = data.gsc.queries || []
  const pages = data.gsc.pages || []

  const sum = (arr, f) => arr.reduce((s, r) => s + (r[f] || 0), 0)
  const avg = (arr, f) => arr.length ? sum(arr, f) / arr.length : 0

  const cClicks = sum(curr, 'organic_google_search_clicks')
  const pClicks = sum(prev, 'organic_google_search_clicks')
  const cImpr   = sum(curr, 'organic_google_search_impressions')
  const pImpr   = sum(prev, 'organic_google_search_impressions')
  const cCtr    = avg(curr, 'organic_google_search_click_through_rate')
  const pCtr    = avg(prev, 'organic_google_search_click_through_rate')
  const cPos    = avg(curr, 'organic_google_search_average_position')
  const pPos    = avg(prev, 'organic_google_search_average_position')

  const insights = []
  const gscD = delta(cClicks, pClicks)
  if (gscD !== null && Math.abs(gscD) > 10) insights.push({ type: gscD > 0 ? 'positive' : 'negative', title: `Clicks organice ${gscD > 0 ? '↑' : '↓'}${Math.abs(gscD).toFixed(0)}%`, body: `${Math.round(cClicks)} clicks aceasta saptamana vs ${Math.round(pClicks)}.` })

  const lowCtr = queries.filter(q => (q.organic_google_search_impressions || 0) > 50 && (q.organic_google_search_click_through_rate || 0) < 0.03).sort((a, b) => (b.organic_google_search_impressions || 0) - (a.organic_google_search_impressions || 0)).slice(0, 1)[0]
  if (lowCtr) insights.push({ type: 'neutral', title: `CTR scazut cu impressions mari: "${lowCtr.query || '(query)'}"`, body: `${Math.round(lowCtr.organic_google_search_impressions)} impressions dar CTR ${((lowCtr.organic_google_search_click_through_rate || 0)*100).toFixed(1)}%. Optimizeaza titlul paginii si meta description.` })

  const nearTop = queries.filter(q => (q.organic_google_search_average_position || 0) >= 4 && (q.organic_google_search_average_position || 0) <= 10).sort((a, b) => (b.organic_google_search_clicks || 0) - (a.organic_google_search_clicks || 0)).slice(0, 1)[0]
  if (nearTop) insights.push({ type: 'neutral', title: `"${nearTop.query || '(query)'}" — pozitia ${(nearTop.organic_google_search_average_position || 0).toFixed(1)}, fruct la indemana`, body: `Pe pagina 1 dar nu in top 3. O imbunatatire mica de continut poate dubla traficul.` })

  const topQ = [...queries].sort((a, b) => (b.organic_google_search_clicks || 0) - (a.organic_google_search_clicks || 0)).slice(0, 10)
  const topP = [...pages].sort((a, b) => (b.organic_google_search_clicks || 0) - (a.organic_google_search_clicks || 0)).slice(0, 8)

  return (
    <div>
      <Grid>
        <MetricCard label="Clicks organice" curr={Math.round(cClicks)} prev={Math.round(pClicks)} />
        <MetricCard label="Impressions" curr={Math.round(cImpr)} prev={Math.round(pImpr)} />
        <MetricCard label="CTR mediu" curr={cCtr} prev={pCtr} format="pct" />
        <MetricCard label="Pozitie medie" curr={cPos} prev={pPos} format="dec" invert />
      </Grid>
      {insights.length > 0 && (
        <Section title="Observatii SEO">
          {insights.map((s, i) => <Signal key={i} {...s} />)}
        </Section>
      )}
      {topQ.length > 0 && (
        <Section title="Top queries">
          <SimpleTable
            headers={['Query', 'Clicks', 'Impressions', 'CTR', 'Pozitie']}
            rows={topQ.map(q => [
              q.query || '(not provided)',
              Math.round(q.organic_google_search_clicks || 0),
              Math.round(q.organic_google_search_impressions || 0),
              ((q.organic_google_search_click_through_rate || 0) * 100).toFixed(1) + '%',
              (q.organic_google_search_average_position || 0).toFixed(1),
            ])}
          />
        </Section>
      )}
      {topP.length > 0 && (
        <Section title="Top pagini organice">
          <SimpleTable
            headers={['Pagina', 'Clicks', 'Impressions', 'CTR', 'Pozitie']}
            rows={topP.map(p => [
              (p.page || p.page_path || '').replace('https://homepitch.ro', ''),
              Math.round(p.organic_google_search_clicks || 0),
              Math.round(p.organic_google_search_impressions || 0),
              ((p.organic_google_search_click_through_rate || 0) * 100).toFixed(1) + '%',
              (p.organic_google_search_average_position || 0).toFixed(1),
            ])}
          />
        </Section>
      )}
    </div>
  )
}

// ── TAB: Pagini ───────────────────────────────────────────────────────
function TabPagini({ data }) {
  const curr = data.pages.current
  const top = [...curr].sort((a, b) => (b.screen_page_views || 0) - (a.screen_page_views || 0)).slice(0, 15)
  const lowEng = curr.filter(p => (p.screen_page_views || 0) >= 20 && (p.engagement_rate || 0) < 0.80).sort((a, b) => a.engagement_rate - b.engagement_rate).slice(0, 5)
  const highlights = ['/home3', '/simplu', '/']

  return (
    <div>
      <Section title="Top pagini dupa views">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
                {['Pagina', 'Views', 'Eng%', 'Conv%', 'Dur(s)'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: C.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map(p => {
                const conv = p.screen_page_views > 0 ? p.conversions / p.screen_page_views * 100 : 0
                const isHL = highlights.includes(p.page_path)
                return (
                  <tr key={p.page_path} style={{ borderBottom: `0.5px solid ${C.border}`, background: isHL ? '#F0F9FF' : 'transparent' }}>
                    <td style={{ padding: '7px 8px', color: isHL ? C.blue : C.text, fontFamily: 'monospace', fontSize: 11 }}>{isHL ? '★ ' : ''}{p.page_path}</td>
                    <td style={{ padding: '7px 8px', color: C.muted }}>{(p.screen_page_views || 0).toLocaleString('ro')}</td>
                    <td style={{ padding: '7px 8px', color: (p.engagement_rate || 0) < 0.8 ? C.red : C.muted }}>{Math.round((p.engagement_rate || 0) * 100)}%</td>
                    <td style={{ padding: '7px 8px', color: conv > 5 ? C.green : C.muted, fontWeight: conv > 5 ? 500 : 400 }}>{conv.toFixed(1)}%</td>
                    <td style={{ padding: '7px 8px', color: C.muted }}>{Math.round(p.average_session_duration || 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
      {lowEng.length > 0 && (
        <Section title="Pagini cu engagement scazut — alerta">
          {lowEng.map(p => (
            <div key={p.page_path} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, flex: 1 }}>{p.page_path}</span>
              <span style={{ color: C.red, fontWeight: 500 }}>{Math.round((p.engagement_rate || 0) * 100)}%</span>
              <span style={{ color: C.muted }}>{p.screen_page_views} views</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

// ── TAB: Funnel ───────────────────────────────────────────────────────
function TabFunnel({ data }) {
  const curr = data.traffic.current
  const pages = data.pages.current
  const totalSess = curr.reduce((s, r) => s + (r.sessions || 0), 0)

  const get = path => pages.find(p => p.page_path === path)
  const home3 = get('/home3')
  const simplu = get('/simplu')
  const homepage = get('/')
  const login = get('/login')
  const totalConv = curr.reduce((s, r) => s + (r.conversions || 0), 0)

  const convs = data.conversions
  const sum = (f) => convs.reduce((s, r) => s + (r[f] || 0), 0)
  const signup = sum('conversions_signup')
  const offers = sum('conversions_offer_accepted')
  const cereri = sum('conversions_bravo_cerere_noua')
  const customTotal = signup + offers + cereri

  const landingViews = (home3?.screen_page_views || 0) + (simplu?.screen_page_views || 0) + (homepage?.screen_page_views || 0)

  const steps = [
    { label: 'Sesiuni totale', v: totalSess, pct: 100, color: C.blue },
    { label: 'Landing pages (/, /home3, /simplu)', v: landingViews, pct: totalSess > 0 ? landingViews/totalSess*100 : 0, color: C.blue },
    { label: '/login vizitat', v: login?.screen_page_views || 0, pct: totalSess > 0 ? (login?.screen_page_views||0)/totalSess*100 : 0, color: C.amber },
    { label: 'Conversii GA4', v: totalConv, pct: totalSess > 0 ? totalConv/totalSess*100 : 0, color: C.green },
  ]

  const r = (page) => page && page.screen_page_views > 0 ? (page.conversions / page.screen_page_views * 100) : 0

  return (
    <div>
      <Section title="Funnel principal">
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.muted, width: 240, flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, background: '#ebebE4', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, s.pct)}%`, height: 8, borderRadius: 99, background: s.color }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, width: 50, textAlign: 'right' }}>{s.v.toLocaleString('ro')}</span>
            <span style={{ fontSize: 11, color: C.hint, width: 36, textAlign: 'right' }}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </Section>
      <Section title="Conv rate landing pages — comparatie">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: '/home3', rate: r(home3), views: home3?.screen_page_views || 0, hl: true },
            { label: '/simplu', rate: r(simplu), views: simplu?.screen_page_views || 0, hl: true },
            { label: '/ homepage', rate: r(homepage), views: homepage?.screen_page_views || 0, hl: false },
          ].map(p => (
            <div key={p.label} style={{ background: p.hl && p.rate > r(homepage) ? '#F0FDF4' : C.card, border: `0.5px solid ${p.hl && p.rate > r(homepage) ? '#86EFAC' : C.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 500, color: p.rate > 5 ? C.green : C.text, margin: '0 0 4px' }}>{p.rate.toFixed(1)}%</p>
              <p style={{ fontSize: 11, color: C.hint, margin: 0 }}>{p.label}</p>
              <p style={{ fontSize: 11, color: C.hint, margin: '2px 0 0' }}>{p.views} views</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Conversii custom (Key Events)">
        <div style={{ background: customTotal === 0 ? '#FEF2F2' : '#F0FDF4', border: `0.5px solid ${customTotal === 0 ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 10, padding: '14px 16px' }}>
          {customTotal === 0 ? (
            <p style={{ fontSize: 13, color: C.red, margin: 0 }}>Toate conversiile custom = 0. GA4 Admin → Events → Mark as conversion: conversions_signup, conversions_offer_accepted, conversions_bravo_cerere_noua.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[['Sign-ups', signup], ['Oferte acceptate', offers], ['Cereri noi', cereri]].map(([l, v]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 24, fontWeight: 500, color: C.green, margin: '0 0 4px' }}>{v}</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{l}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

// ── TAB: Actiuni ──────────────────────────────────────────────────────
function TabActiuni({ data }) {
  const curr = data.traffic.current
  const prev = data.traffic.previous
  const pages = data.pages.current
  const queries = data.gsc.queries || []

  const sum = (arr, f) => arr.reduce((s, r) => s + (r[f] || 0), 0)
  const convCurr = sum(curr, 'conversions')
  const convPrev = sum(prev, 'conversions')
  const customConv = sum(data.conversions, 'conversions_signup') + sum(data.conversions, 'conversions_offer_accepted') + sum(data.conversions, 'conversions_bravo_cerere_noua')

  const home3 = pages.find(p => p.page_path === '/home3')
  const homepage = pages.find(p => p.page_path === '/')
  const resetPage = pages.find(p => p.page_path === '/resetare-parola')
  const home3Rate = home3?.screen_page_views > 0 ? home3.conversions/home3.screen_page_views*100 : 0
  const homepageRate = homepage?.screen_page_views > 0 ? homepage.conversions/homepage.screen_page_views*100 : 0

  const lowCtr = queries.filter(q => (q.organic_google_search_impressions||0) > 100 && (q.organic_google_search_click_through_rate||0) < 0.03).sort((a,b) => (b.organic_google_search_impressions||0)-(a.organic_google_search_impressions||0))[0]
  const nearTop = queries.filter(q => (q.organic_google_search_average_position||0) >= 4 && (q.organic_google_search_average_position||0) <= 8).sort((a,b) => (b.organic_google_search_clicks||0)-(a.organic_google_search_clicks||0))[0]

  const actions = []

  if (customConv === 0) actions.push({ urgency: 'urgent', title: 'Activeaza conversiile custom in GA4', body: 'conversions_signup, conversions_offer_accepted si conversions_bravo_cerere_noua returneaza 0. Fara aceste date nu stii cati useri se inregistreaza sau cate cereri sunt create saptamanal.', fix: 'GA4 Admin → Events → cauta "conversions_signup" → toggle "Mark as conversion". Repeta pentru offer_accepted si bravo_cerere_noua. Durata: 5 minute.' })

  if (home3Rate > homepageRate * 1.5 && (home3?.screen_page_views||0) > 20) actions.push({ urgency: 'urgent', title: `/home3 converteste de ${(home3Rate/homepageRate).toFixed(1)}x mai bine decat homepage`, body: `/home3: ${home3Rate.toFixed(1)}% conv rate vs /: ${homepageRate.toFixed(1)}%. Cu acelasi trafic ai putea obtine mult mai multe conversii.`, fix: 'Seteaza /home3 ca homepage principal pentru 2 saptamani si monitorizeaza. Sau identifica ce e diferit pe /home3 si aplica pe homepage.' })

  if (lowCtr) actions.push({ urgency: 'important', title: `SEO: "${lowCtr.query || 'query'}" — ${Math.round(lowCtr.organic_google_search_impressions)} impressions, CTR ${((lowCtr.organic_google_search_click_through_rate||0)*100).toFixed(1)}%`, body: `Multi oameni vad site-ul pentru acest query dar nu dau click. Titlul sau meta description nu sunt convingătoare.`, fix: `Gaseste pagina care apare pentru acest query in GSC → optimizeaza titlul sa fie mai descriptiv. Monitorizeaza CTR in 2 saptamani.` })

  if (nearTop) actions.push({ urgency: 'important', title: `SEO: "${nearTop.query || 'query'}" pe pozitia ${(nearTop.organic_google_search_average_position||0).toFixed(1)} — fruct la indemana`, body: `Esti pe pagina 1 dar nu in top 3. O imbunatatire mica poate dubla traficul.`, fix: `Adauga mai mult continut relevant pe pagina care rankeaza. Imbunatateste headingurile H1/H2, adauga link-uri interne.` })

  if (resetPage && (resetPage.engagement_rate||0) < 0.6 && (resetPage.screen_page_views||0) > 10) actions.push({ urgency: 'important', title: `/resetare-parola — engagement ${Math.round((resetPage.engagement_rate||0)*100)}% (posibil flux broken)`, body: `${resetPage.screen_page_views} useri au vizitat dar ${Math.round((1-(resetPage.engagement_rate||0))*100)}% au plecat imediat. Posibil emailul nu ajunge sau linkul e expirat.`, fix: 'Testeaza manual fluxul complet: solicita reset → verifica ca emailul ajunge in max 2 minute → verifica ca linkul functioneaza.' })

  const convD = delta(convCurr, convPrev)
  if (convD !== null && convD < -20) actions.push({ urgency: 'urgent', title: `Conversii ↓${Math.abs(convD).toFixed(0)}% fata de saptamana trecuta`, body: `${convCurr} conversii vs ${convPrev}. Scadere semnificativa.`, fix: 'Verifica in GA4 daca exista erori JS sau pagini cu trafic crescut si conversii zero.' })

  if (actions.length === 0) actions.push({ urgency: 'luna asta', title: 'Saptamana fara alerte — focus pe crestere organica', body: 'Metricile sunt stabile. Moment bun pentru a investi in continut SEO si optimizari pe termen lung.', fix: 'Adauga 1-2 pagini de continut targetand queries din GSC cu impressions mari si CTR scazut.' })

  return (
    <Section title={`${Math.min(actions.length, 5)} actiuni pentru aceasta saptamana`}>
      {actions.slice(0, 5).map((a, i) => <ActionCard key={i} {...a} />)}
    </Section>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)

  const tabs = ['Semnale', 'Trafic', 'Organic SEO', 'Pagini', 'Funnel', 'Actiuni']

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/report')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) { setError('Eroare la incarcarea datelor: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `0.5px solid ${C.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 56, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 13, marginRight: 12 }}>H</div>
        <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>HomePitch Analytics</span>
        {data && <span style={{ fontSize: 12, color: C.hint, marginLeft: 12 }}>{data.weekLabel}</span>}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ padding: '6px 12px', fontSize: 12, border: `0.5px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer', marginRight: 8 }}>↻ Reincarca</button>
        <button onClick={logout} style={{ padding: '6px 12px', fontSize: 12, border: `0.5px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer' }}>Iesi</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
            <p style={{ fontSize: 14 }}>Se incarca datele din GA4 si GSC via Windsor...</p>
          </div>
        )}
        {error && <div style={{ background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 10, padding: '16px 20px' }}><p style={{ color: C.red, fontSize: 14, margin: 0 }}>{error}</p></div>}
        {data && !loading && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
              {tabs.map((t, i) => (
                <button key={t} onClick={() => setTab(i)} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `0.5px solid ${i === tab ? C.blue : C.border}`, background: i === tab ? '#EBF4FC' : 'transparent', color: i === tab ? C.blue : C.muted, cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            {tab === 0 && <TabSemnale data={data} />}
            {tab === 1 && <TabTrafic data={data} />}
            {tab === 2 && <TabSEO data={data} />}
            {tab === 3 && <TabPagini data={data} />}
            {tab === 4 && <TabFunnel data={data} />}
            {tab === 5 && <TabActiuni data={data} />}
            <div style={{ marginTop: 40, paddingTop: 20, borderTop: `0.5px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.hint }}>Generat la {new Date(data.generatedAt).toLocaleString('ro-RO')} · Windsor.ai → GA4 + GSC</span>
              <span style={{ fontSize: 11, color: C.hint }}>HomePitch.ro</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
