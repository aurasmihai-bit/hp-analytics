'use client'
import { useEffect, useMemo, useState } from 'react'
import { C, fmtN, Sec, Card, Grid, Signal, PageLink } from './components'

/* ─── Date comune pentru taburile SEO si GEO / AI (/api/seo) ───────── */

const NO_DATA = 'Nu există încă date — rulează din adminul HomePitch (/admin/seo/ai-readiness)'

let sharedRequest = null

function loadSeo(force = false) {
  if (!sharedRequest || force) {
    sharedRequest = fetch(`/api/seo${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
      .then(async res => {
        const json = await res.json().catch(() => null)
        if (!json) throw new Error(res.status === 401 ? 'Sesiune expirată — autentifică-te din nou.' : `Eroare ${res.status}`)
        if (res.status === 401) throw new Error('Sesiune expirată — autentifică-te din nou.')
        return json
      })
      .catch(error => { sharedRequest = null; throw error })
  }
  return sharedRequest
}

function useSeoData() {
  const [state, setState] = useState({ loading: true, error: '', payload: null })
  const run = force => {
    setState(s => ({ ...s, loading: true, error: '' }))
    loadSeo(force)
      .then(payload => setState({ loading: false, error: '', payload }))
      .catch(error => setState({ loading: false, error: error.message || 'Eroare la încărcare.', payload: null }))
  }
  useEffect(() => { run(false) }, [])
  return { ...state, refresh: () => run(true) }
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const fmtDec = (v, d = 1) => (num(v) === null ? '—' : Number(v).toFixed(d))
const fmtPct = v => (num(v) === null ? '—' : `${(Number(v) * 100).toFixed(1)}%`)
const fmtUsd = v => (num(v) === null ? '—' : `$${Number(v).toFixed(2)}`)
const fmtDate = v => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const text = v => (v === null || v === undefined || v === '' ? '—' : String(v))

function safeHref(value) {
  const v = String(value || '')
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('/')) return `https://homepitch.ro${v}`
  return null
}

function ExtLink({ href, children }) {
  const url = safeHref(href)
  if (!url) return <span>{children || text(href)}</span>
  return <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'none', wordBreak: 'break-all' }}>{children || href}</a>
}

function shortUrl(value) {
  const v = String(value || '')
  return v.replace(/^https?:\/\/(www\.)?homepitch\.ro/i, '') || v || '—'
}

function Empty({ children }) {
  return (
    <Card style={{ padding: '14px 16px' }}>
      <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>{children || NO_DATA}</p>
    </Card>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', minWidth: 0 }}>
      <p style={{ fontSize: 11, color: C.hint, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
      <div style={{ fontSize: 22, fontWeight: 500, color: color || C.text, overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <p style={{ fontSize: 11, color: C.hint, margin: '4px 0 0', overflowWrap: 'anywhere' }}>{sub}</p>}
    </div>
  )
}

const th = align => ({ textAlign: align || 'left', padding: '7px 8px', color: C.hint, fontWeight: 500, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' })
const td = align => ({ padding: '8px', textAlign: align || 'left', color: C.text, verticalAlign: 'top' })

function SimpleTable({ columns, rows, minWidth = 520, rowKey, highlight }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth }}>
        <thead>
          <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
            {columns.map(col => <th key={col.key} style={th(col.align)}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} style={{ borderBottom: `0.5px solid ${C.border}`, background: highlight?.(row) ? C.softBlue : 'transparent' }}>
              {columns.map(col => (
                <td key={col.key} style={{ ...td(col.align), ...(col.style || {}) }}>
                  {col.render ? col.render(row) : text(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortableTable({ columns, rows, initialSort, initialDir = 'desc', placeholder = 'Caută...', searchKey, minWidth = 560, pageSize = 50 }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort)
  const [dir, setDir] = useState(initialDir)
  const [showAll, setShowAll] = useState(false)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle ? rows.filter(r => String(r[searchKey] ?? '').toLowerCase().includes(needle)) : [...rows]
    const col = columns.find(c => c.key === sort)
    if (col) {
      list.sort((a, b) => {
        const av = a[sort], bv = b[sort]
        let cmp
        if (col.numeric) {
          const an = num(av), bn = num(bv)
          if (an === null && bn === null) cmp = 0
          else if (an === null) return 1
          else if (bn === null) return -1
          else cmp = an - bn
        } else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'ro')
        return dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [rows, q, sort, dir, columns, searchKey])
  const visible = showAll ? filtered : filtered.slice(0, pageSize)
  function toggle(key) {
    if (key === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      const col = columns.find(c => c.key === key)
      setDir(col?.numeric && key !== 'position' ? 'desc' : 'asc')
    }
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ flex: '1 1 180px', minWidth: 0, maxWidth: 320, padding: '6px 10px', fontSize: 12, border: `0.5px solid ${C.border}`, borderRadius: 6, background: C.input, color: C.text }}
        />
        <span style={{ fontSize: 11, color: C.hint }}>{fmtN(filtered.length)} rânduri</span>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth }}>
          <thead>
            <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
              {columns.map(col => (
                <th key={col.key} style={{ ...th(col.align), cursor: 'pointer', userSelect: 'none', color: sort === col.key ? C.blue : C.hint }} onClick={() => toggle(col.key)}>
                  {col.label}{sort === col.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} style={{ borderBottom: `0.5px solid ${C.border}` }}>
                {columns.map(col => (
                  <td key={col.key} style={{ ...td(col.align), ...(col.style || {}) }}>{col.render ? col.render(row) : text(row[col.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > pageSize && (
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 8, padding: '4px 10px', fontSize: 11, border: `0.5px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer' }}>
          {showAll ? 'Arată mai puțin' : `Arată toate (${fmtN(filtered.length)})`}
        </button>
      )}
    </div>
  )
}

function posColor(p) {
  const v = num(p)
  if (v === null) return C.hint
  return v <= 3 ? C.green : v <= 10 ? C.amber : C.red
}

function Header({ state, payload }) {
  const seo = payload?.seo
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: C.hint }}>
        {seo?.generated_at ? `Raport HomePitch generat: ${fmtDate(seo.generated_at)}` : 'Raport HomePitch'}
        {seo?.domain ? ` · ${seo.domain}` : ''}
      </span>
      <div style={{ flex: 1 }} />
      <button onClick={state.refresh} disabled={state.loading} style={{ padding: '4px 10px', fontSize: 11, border: `0.5px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: state.loading ? 'wait' : 'pointer' }}>
        {state.loading ? 'se încarcă…' : '↻ reîncarcă'}
      </button>
    </div>
  )
}

function SeoStatus({ state }) {
  if (state.loading && !state.payload) return <Empty>Se încarcă raportul SEO…</Empty>
  if (state.error) return <Signal type="negative" title="Nu pot încărca datele SEO" body={state.error} />
  const seo = state.payload?.seo
  if (seo && seo.configured === false) return <Signal type="neutral" title="Raportul SEO HomePitch nu este conectat" body="Setează SEO_REPORT_TOKEN (și opțional HOMEPITCH_SEO_REPORT_URL) în variabilele de mediu Vercel ale hp-analytics." />
  if (seo?.error) return <Signal type="negative" title="Raportul SEO HomePitch indisponibil" body={seo.error} />
  return null
}

const isReport = seo => seo && seo.configured !== false && !seo.error

/* ─── TAB SEO ──────────────────────────────────────────────────────── */

function trackedChange(row) {
  const pos = num(row.position), prev = num(row.previous_position)
  if (pos !== null && prev !== null) return prev - pos // pozitiv = a urcat
  if (pos !== null && prev === null) return 'new'
  if (pos === null && prev !== null) return 'lost'
  const c = num(row.change)
  return c
}

function ChangeBadge({ row }) {
  const ch = trackedChange(row)
  if (ch === 'new') return <span style={{ color: C.blue, fontWeight: 600 }}>nou</span>
  if (ch === 'lost') return <span style={{ color: C.red, fontWeight: 600 }}>✗ ieșit</span>
  if (ch === null || ch === 0) return <span style={{ color: C.hint }}>—</span>
  return ch > 0
    ? <span style={{ color: C.green, fontWeight: 600 }}>▲ {Math.abs(ch).toFixed(0)}</span>
    : <span style={{ color: C.red, fontWeight: 600 }}>▼ {Math.abs(ch).toFixed(0)}</span>
}

function GscBlock({ gsc }) {
  if (!gsc || gsc.configured === false) {
    return <Empty>Google Search Console nu este configurat pentru acest dashboard (lipsește GOOGLE_SERVICE_ACCOUNT_JSON sau accesul la proprietate).</Empty>
  }
  if (gsc.error) return <Empty>{gsc.error}</Empty>
  const queries = gsc.queries || []
  if (!queries.length) return <Empty>Search Console nu a întors interogări pentru ultimele 28 de zile.</Empty>
  return (
    <Card style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: C.hint, margin: '0 0 8px' }}>{gsc.start} → {gsc.end} · {gsc.siteUrl}</p>
      <SortableTable
        rows={queries}
        searchKey="query"
        placeholder="Caută interogare..."
        initialSort="clicks"
        columns={[
          { key: 'query', label: 'Interogare', style: { maxWidth: 320, overflowWrap: 'anywhere' } },
          { key: 'clicks', label: 'Clicks', numeric: true, align: 'right', render: r => fmtN(r.clicks) },
          { key: 'impressions', label: 'Impresii', numeric: true, align: 'right', render: r => fmtN(r.impressions) },
          { key: 'ctr', label: 'CTR', numeric: true, align: 'right', render: r => fmtPct(r.ctr) },
          { key: 'position', label: 'Poziție', numeric: true, align: 'right', render: r => <span style={{ color: posColor(r.position), fontWeight: 600 }}>{fmtDec(r.position)}</span> },
        ]}
      />
    </Card>
  )
}

function GscPages({ gsc }) {
  const pages = gsc?.pages || []
  if (!pages.length) return null
  return (
    <Sec title="Top pagini din Google (Search Console, 28 zile)">
      <Card style={{ padding: '12px 14px' }}>
        <SimpleTable
          minWidth={480}
          rows={[...pages].sort((a, b) => b.clicks - a.clicks).slice(0, 20)}
          columns={[
            { key: 'path', label: 'Pagină', style: { maxWidth: 300, overflowWrap: 'anywhere', fontFamily: 'monospace' }, render: r => <PageLink path={r.path}>{r.path}</PageLink> },
            { key: 'clicks', label: 'Clicks', align: 'right', render: r => fmtN(r.clicks) },
            { key: 'impressions', label: 'Impresii', align: 'right', render: r => fmtN(r.impressions) },
            { key: 'ctr', label: 'CTR', align: 'right', render: r => fmtPct(r.ctr) },
            { key: 'position', label: 'Poziție', align: 'right', render: r => <span style={{ color: posColor(r.position), fontWeight: 600 }}>{fmtDec(r.position)}</span> },
          ]}
        />
      </Card>
    </Sec>
  )
}

function PositionDistribution({ overview }) {
  const buckets = [
    { key: 'pos_1', label: 'Poz. 1' },
    { key: 'pos_2_3', label: '2–3' },
    { key: 'pos_4_10', label: '4–10' },
    { key: 'pos_11_20', label: '11–20' },
    { key: 'pos_21_100', label: '21–100' },
  ]
  const max = Math.max(1, ...buckets.map(b => num(overview[b.key]) || 0))
  const moves = [
    { key: 'is_new', label: 'noi', color: C.blue },
    { key: 'is_up', label: 'urcă', color: C.green },
    { key: 'is_down', label: 'coboară', color: C.amber },
    { key: 'is_lost', label: 'pierdute', color: C.red },
  ]
  return (
    <Card style={{ padding: '12px 16px' }}>
      {buckets.map(b => {
        const v = num(overview[b.key]) || 0
        return (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: C.muted, width: 52, flexShrink: 0 }}>{b.label}</span>
            <div style={{ flex: 1, background: C.softPanel, borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(v / max) * 100}%`, height: 6, borderRadius: 99, background: C.green }} />
            </div>
            <span style={{ fontSize: 12, color: C.muted, width: 44, textAlign: 'right', flexShrink: 0 }}>{fmtN(v)}</span>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {moves.map(m => num(overview[m.key]) !== null && (
          <span key={m.key} style={{ fontSize: 11, color: m.color }}>{fmtN(overview[m.key])} {m.label}</span>
        ))}
        {num(overview.paid_keywords) !== null && <span style={{ fontSize: 11, color: C.hint }}>{fmtN(overview.paid_keywords)} cuvinte plătite</span>}
      </div>
    </Card>
  )
}

export function TabSeoReport() {
  const state = useSeoData()
  const payload = state.payload
  const seo = payload?.seo
  const report = isReport(seo) ? seo : null
  const overview = report?.domain_overview || null
  const organic = report?.organic_keywords || null
  const tracked = report?.keywords || []
  const ranked = tracked.filter(k => num(k.position) !== null)
  const top10 = ranked.filter(k => k.position <= 10).length
  const top3 = ranked.filter(k => k.position <= 3).length
  const avgPos = ranked.length ? ranked.reduce((s, k) => s + Number(k.position), 0) / ranked.length : null
  const usage = report?.usage || null
  const organicCount = num(organic?.total_count) ?? num(overview?.organic_keywords)
  const competitors = report?.competitors || null
  const watched = report?.watched_domains || null

  return (
    <div>
      <Header state={state} payload={payload} />
      <SeoStatus state={state} />

      {report && (
        <Grid>
          <Stat label="Cuvinte cheie organice" value={organicCount === null ? '—' : fmtN(organicCount)} sub={organic?.taken_at ? `DataForSEO · ${fmtDate(organic.taken_at)}` : 'DataForSEO'} />
          <Stat label="Trafic estimat / lună" value={num(overview?.organic_etv) === null ? '—' : fmtN(overview.organic_etv)} sub={num(overview?.organic_traffic_cost) !== null ? `valoare ~${fmtUsd(overview.organic_traffic_cost)}` : 'ETV organic'} />
          <Stat label="Urmărite în top 10" value={`${top10} / ${tracked.length}`} sub={`${top3} în top 3`} color={top10 ? C.green : C.text} />
          <Stat label="Poziție medie (urmărite)" value={avgPos === null ? '—' : avgPos.toFixed(1)} sub={`${ranked.length} cuvinte cu poziție`} color={posColor(avgPos)} />
          <Stat
            label="Cost DataForSEO luna asta"
            value={usage ? `${fmtUsd(usage.month_cost_usd)} / ${fmtUsd(usage.budget_usd)}` : '—'}
            sub={usage && num(usage.budget_usd) ? `${((Number(usage.month_cost_usd || 0) / Number(usage.budget_usd)) * 100).toFixed(0)}% din buget` : 'buget lunar'}
            color={usage && num(usage.budget_usd) && Number(usage.month_cost_usd || 0) > Number(usage.budget_usd) * 0.9 ? C.red : C.text}
          />
        </Grid>
      )}

      <Sec title="Interogări reale din Google (Search Console)">
        {state.loading && !payload ? <Empty>Se încarcă…</Empty> : <GscBlock gsc={payload?.gsc} />}
      </Sec>
      <GscPages gsc={payload?.gsc} />

      {payload && (
        <>
          {overview && (
            <Sec title="Distribuția pozițiilor (DataForSEO)">
              <PositionDistribution overview={overview} />
            </Sec>
          )}

          <Sec title="Cuvinte cheie organice (DataForSEO)">
            {organic?.items?.length ? (
              <Card style={{ padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: C.hint, margin: '0 0 8px' }}>
                  {text(organic.domain)} · {fmtN(organic.total_count)} total · {fmtN(organic.items.length)} afișate · {fmtDate(organic.taken_at)}
                </p>
                <SortableTable
                  rows={organic.items}
                  searchKey="keyword"
                  placeholder="Caută cuvânt cheie..."
                  initialSort="etv"
                  minWidth={620}
                  columns={[
                    { key: 'keyword', label: 'Cuvânt cheie', style: { maxWidth: 260, overflowWrap: 'anywhere' } },
                    { key: 'position', label: 'Poziție', numeric: true, align: 'right', render: r => <span style={{ color: posColor(r.position), fontWeight: 600 }}>{text(r.position)}</span> },
                    { key: 'search_volume', label: 'Volum', numeric: true, align: 'right', render: r => fmtN(r.search_volume) },
                    { key: 'etv', label: 'ETV', numeric: true, align: 'right', render: r => fmtDec(r.etv) },
                    { key: 'url', label: 'URL', style: { maxWidth: 260, overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 11 }, render: r => r.url ? <ExtLink href={r.url}>{shortUrl(r.url)}</ExtLink> : '—' },
                  ]}
                />
              </Card>
            ) : <Empty />}
          </Sec>

          <Sec title="Cuvinte cheie urmărite">
            {tracked.length ? (
              <Card style={{ padding: '12px 14px' }}>
                <SimpleTable
                  minWidth={640}
                  rows={[...tracked].sort((a, b) => (num(a.position) ?? 999) - (num(b.position) ?? 999))}
                  columns={[
                    { key: 'keyword', label: 'Cuvânt cheie', style: { maxWidth: 240, overflowWrap: 'anywhere', fontWeight: 500 } },
                    { key: 'target_path', label: 'Pagină țintă', style: { fontFamily: 'monospace', fontSize: 11, overflowWrap: 'anywhere' }, render: r => r.target_path ? <PageLink path={r.target_path}>{r.target_path}</PageLink> : '—' },
                    { key: 'position', label: 'Poziție', align: 'right', render: r => <span style={{ color: posColor(r.position), fontWeight: 600 }}>{num(r.position) === null ? '>100' : r.position}</span> },
                    { key: 'change', label: 'Schimbare', align: 'right', render: r => <ChangeBadge row={r} /> },
                    { key: 'url', label: 'URL găsit', style: { maxWidth: 220, overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 11 }, render: r => r.url ? <ExtLink href={r.url}>{shortUrl(r.url)}</ExtLink> : '—' },
                    { key: 'checked_at', label: 'Verificat', style: { whiteSpace: 'nowrap', color: C.hint }, render: r => fmtDate(r.checked_at) },
                  ]}
                />
              </Card>
            ) : <Empty />}
          </Sec>

          <Sec title="Competitori și domenii urmărite">
            {competitors?.length || watched?.length ? (
              <>
                {competitors?.length > 0 && (
                  <Card style={{ padding: '12px 14px', marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: '0 0 8px' }}>Competitori organici (intersecții de cuvinte cheie)</p>
                    <SimpleTable
                      minWidth={560}
                      highlight={r => r._self}
                      rows={[
                        ...(overview ? [{ _self: true, domain: report.domain || 'homepitch.ro', avg_position: null, intersections: null, organic_keywords: overview.organic_keywords, organic_etv: overview.organic_etv }] : []),
                        ...[...competitors].sort((a, b) => (num(b.intersections) || 0) - (num(a.intersections) || 0)),
                      ]}
                      columns={[
                        { key: 'domain', label: 'Domeniu', style: { fontWeight: 500, overflowWrap: 'anywhere' }, render: r => <ExtLink href={`https://${r.domain}`}>{r.domain}</ExtLink> },
                        { key: 'avg_position', label: 'Poz. medie', align: 'right', render: r => fmtDec(r.avg_position) },
                        { key: 'intersections', label: 'Intersecții', align: 'right', render: r => (r._self ? '—' : fmtN(r.intersections)) },
                        { key: 'organic_keywords', label: 'Cuvinte organice', align: 'right', render: r => fmtN(r.organic_keywords) },
                        { key: 'organic_etv', label: 'ETV', align: 'right', render: r => fmtN(r.organic_etv) },
                      ]}
                    />
                  </Card>
                )}
                {watched?.length > 0 && (
                  <Card style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: '0 0 8px' }}>Domenii urmărite (SEO + mențiuni LLM)</p>
                    <SimpleTable
                      minWidth={480}
                      highlight={r => /homepitch\.ro$/i.test(String(r.domain || ''))}
                      rows={[...watched].sort((a, b) => (num(b.etv) || 0) - (num(a.etv) || 0))}
                      columns={[
                        { key: 'domain', label: 'Domeniu', style: { fontWeight: 500, overflowWrap: 'anywhere' }, render: r => <ExtLink href={`https://${r.domain}`}>{r.domain}</ExtLink> },
                        { key: 'organic_keywords', label: 'Cuvinte organice', align: 'right', render: r => fmtN(r.organic_keywords) },
                        { key: 'etv', label: 'ETV', align: 'right', render: r => fmtN(r.etv) },
                        { key: 'llm_mentions_count', label: 'Mențiuni LLM', align: 'right', render: r => fmtN(r.llm_mentions_count) },
                      ]}
                    />
                  </Card>
                )}
              </>
            ) : <Empty />}
          </Sec>
        </>
      )}
    </div>
  )
}

/* ─── TAB GEO / AI ─────────────────────────────────────────────────── */

const SEVERITY_ORDER = { critical: 0, critic: 0, high: 1, mare: 1, medium: 2, mediu: 2, low: 3, mic: 3, info: 4 }
function severityColor(s) {
  const k = String(s || '').toLowerCase()
  if (k === 'critical' || k === 'critic' || k === 'high' || k === 'mare') return C.red
  if (k === 'medium' || k === 'mediu') return C.amber
  return C.blue
}

function bandColor(band, score) {
  const b = String(band || '').toLowerCase()
  if (/excel|bun|good|great|strong|ready/.test(b)) return C.green
  if (/slab|poor|weak|low|critic/.test(b)) return C.red
  const s = num(score)
  if (s === null) return C.text
  return s >= 75 ? C.green : s >= 50 ? C.amber : C.red
}

function GeoAudit({ audit }) {
  const [showAll, setShowAll] = useState(false)
  if (!audit) return <Empty />
  const areas = audit.areas || []
  const findings = [...(audit.findings || [])].sort((a, b) => (SEVERITY_ORDER[String(a.severity || '').toLowerCase()] ?? 9) - (SEVERITY_ORDER[String(b.severity || '').toLowerCase()] ?? 9))
  const visible = showAll ? findings : findings.slice(0, 8)
  const color = bandColor(audit.band, audit.score)
  return (
    <div>
      <Card style={{ padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: areas.length ? 12 : 0 }}>
          <span style={{ fontSize: 34, fontWeight: 600, color }}>{text(audit.score)}</span>
          <span style={{ fontSize: 12, color: C.hint }}>/ 100</span>
          {audit.band && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: C.softPanel, color }}>{audit.band}</span>}
          <span style={{ fontSize: 11, color: C.hint, marginLeft: 'auto' }}>audit: {fmtDate(audit.audited_at)}</span>
        </div>
        {areas.map((a, i) => {
          const max = num(a.max) || 1, sc = num(a.score) || 0, pct = Math.max(0, Math.min(100, (sc / max) * 100))
          return (
            <div key={`${a.area}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: C.text, flex: '0 1 150px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={text(a.area)}>{text(a.area)}</span>
              <div style={{ flex: 1, minWidth: 60, background: C.softPanel, borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: 6, borderRadius: 99, background: pct >= 75 ? C.green : pct >= 50 ? C.amber : C.red }} />
              </div>
              <span style={{ fontSize: 11, color: C.muted, width: 48, textAlign: 'right', flexShrink: 0 }}>{fmtN(sc)}/{fmtN(max)}</span>
            </div>
          )
        })}
      </Card>
      {findings.length > 0 && (
        <Card style={{ padding: '6px 14px' }}>
          {visible.map((f, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? `0.5px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: severityColor(f.severity), color: '#fff', textTransform: 'uppercase' }}>{text(f.severity)}</span>
                {f.area && <span style={{ fontSize: 11, color: C.hint }}>{f.area}</span>}
                {f.page && <span style={{ fontSize: 11, fontFamily: 'monospace', overflowWrap: 'anywhere' }}><PageLink path={String(f.page).startsWith('/') ? f.page : shortUrl(f.page)}>{shortUrl(f.page)}</PageLink></span>}
              </div>
              <p style={{ fontSize: 13, color: C.text, margin: '0 0 4px', lineHeight: 1.45 }}>{text(f.message)}</p>
              {f.fix && <p style={{ fontSize: 12, color: C.green, margin: 0, lineHeight: 1.45 }}>Fix: {f.fix}</p>}
            </div>
          ))}
          {findings.length > 8 && (
            <button onClick={() => setShowAll(v => !v)} style={{ margin: '4px 0 10px', padding: '4px 10px', fontSize: 11, border: `0.5px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer' }}>
              {showAll ? 'Arată mai puțin' : `Arată toate (${findings.length})`}
            </button>
          )}
        </Card>
      )}
    </div>
  )
}

function describeSources(sources) {
  if (!sources) return '—'
  if (Array.isArray(sources)) {
    return sources.map(s => (s && typeof s === 'object' ? `${s.source ?? s.name ?? '?'}${num(s.views) !== null ? ` (${s.views})` : ''}` : String(s))).join(', ') || '—'
  }
  if (typeof sources === 'object') return Object.entries(sources).map(([k, v]) => `${k} (${typeof v === 'object' ? JSON.stringify(v) : v})`).join(', ')
  return String(sources)
}

function AiTraffic({ traffic, amplitude }) {
  const ampSources = amplitude?.llmReferralSources || []
  const ampEvents = (amplitude?.llmEvents || []).filter(r => r.event_name === 'LLM Referral' || Number(r.events || 0) > 0)
  const ampTotal = ampEvents.reduce((s, r) => s + Number(r.events || 0), 0)
  return (
    <div>
      {traffic ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 10 }}>
          <Card style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: '0 0 8px' }}>Surse AI · ultimele {text(traffic.days)} zile</p>
            {(traffic.sources || []).length ? (
              <SimpleTable
                minWidth={260}
                rows={[...traffic.sources].sort((a, b) => (num(b.views) || 0) - (num(a.views) || 0))}
                columns={[
                  { key: 'source', label: 'Sursă', style: { fontWeight: 500 } },
                  { key: 'views', label: 'Views', align: 'right', render: r => fmtN(r.views) },
                  { key: 'sessions', label: 'Sesiuni', align: 'right', render: r => fmtN(r.sessions) },
                ]}
              />
            ) : <p style={{ fontSize: 12, color: C.hint, margin: 0 }}>Nicio vizită din asistenți AI în interval.</p>}
          </Card>
          <Card style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: '0 0 8px' }}>Top pagini de intrare din AI</p>
            {(traffic.top_pages || []).length ? (
              <SimpleTable
                minWidth={280}
                rows={[...traffic.top_pages].sort((a, b) => (num(b.views) || 0) - (num(a.views) || 0)).slice(0, 15)}
                columns={[
                  { key: 'path', label: 'Pagină', style: { fontFamily: 'monospace', fontSize: 11, overflowWrap: 'anywhere' }, render: r => <PageLink path={r.path}>{r.path}</PageLink> },
                  { key: 'views', label: 'Views', align: 'right', render: r => fmtN(r.views) },
                  { key: 'sources', label: 'Surse', style: { color: C.muted, fontSize: 11 }, render: r => describeSources(r.sources) },
                ]}
              />
            ) : <p style={{ fontSize: 12, color: C.hint, margin: 0 }}>—</p>}
          </Card>
        </div>
      ) : <Empty />}
      <Card style={{ padding: '12px 14px', marginTop: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: '0 0 6px' }}>Amplitude (sursă secundară) · evenimentul „LLM Referral”</p>
        {amplitude?.setupIssue ? (
          <p style={{ fontSize: 12, color: C.hint, margin: 0 }}>{amplitude.setupIssue}</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>
              {fmtN(ampTotal)} evenimente în perioada selectată{ampTotal === 0 ? ' — evenimentul se trimite de pe homepitch.ro la vizitele din asistenți AI; datele apar după primele vizite.' : '.'}
            </p>
            {ampSources.length > 0 && (
              <SimpleTable
                minWidth={240}
                rows={ampSources}
                columns={[
                  { key: 'source', label: 'Sursă (source)', style: { fontWeight: 500 } },
                  { key: 'events', label: 'Evenimente', align: 'right', render: r => fmtN(r.events) },
                ]}
              />
            )}
            {ampEvents.filter(r => r.event_name !== 'LLM Referral').length > 0 && (
              <p style={{ fontSize: 11, color: C.hint, margin: '6px 0 0' }}>
                Alte evenimente LLM: {ampEvents.filter(r => r.event_name !== 'LLM Referral').map(r => `${r.event_name} (${fmtN(r.events)})`).join(', ')}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

const PLATFORM_LABELS = { chat_gpt: 'ChatGPT', chatgpt: 'ChatGPT', google: 'Google AI', claude: 'Claude', gemini: 'Gemini', perplexity: 'Perplexity', copilot: 'Copilot', grok: 'Grok' }
const platformLabel = key => PLATFORM_LABELS[String(key).toLowerCase()] || String(key)

const Yes = ({ on, label }) => on
  ? <span style={{ color: C.green, fontWeight: 600 }}>✓{label ? ` ${label}` : ''}</span>
  : <span style={{ color: C.hint }}>✗</span>

function LlmMentions({ mentions }) {
  const platforms = Object.keys(mentions?.by_platform || {})
  const [active, setActive] = useState(null)
  if (!mentions || !platforms.length) return <Empty />
  const current = active && platforms.includes(active) ? active : platforms[0]
  const rows = mentions.by_platform[current] || []
  return (
    <Card style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: `0.5px solid ${C.border}`, marginBottom: 10 }}>
        {platforms.map(p => (
          <button key={p} onClick={() => setActive(p)} style={{
            padding: '6px 10px', fontSize: 12, border: 'none', background: 'transparent', cursor: 'pointer',
            borderBottom: `2px solid ${p === current ? C.blue : 'transparent'}`, color: p === current ? C.blue : C.muted, fontWeight: p === current ? 500 : 400,
          }}>
            {platformLabel(p)} <span style={{ fontSize: 10, color: C.hint }}>({(mentions.by_platform[p] || []).length})</span>
          </button>
        ))}
        <span style={{ fontSize: 11, color: C.hint, marginLeft: 'auto', alignSelf: 'center' }}>{fmtDate(mentions.fetched_at)}</span>
      </div>
      {rows.length ? (
        <SimpleTable
          minWidth={560}
          rows={[...rows].sort((a, b) => (Number(!!b.cited) - Number(!!a.cited)) || (Number(!!b.mentioned) - Number(!!a.mentioned)) || ((num(b.ai_search_volume) || 0) - (num(a.ai_search_volume) || 0)))}
          columns={[
            { key: 'question', label: 'Întrebare', style: { maxWidth: 320, overflowWrap: 'anywhere' } },
            { key: 'ai_search_volume', label: 'Volum AI', align: 'right', render: r => fmtN(r.ai_search_volume) },
            { key: 'mentioned', label: 'Menționat', align: 'center', render: r => <Yes on={r.mentioned} /> },
            { key: 'cited', label: 'Citat', align: 'center', render: r => (r.cited ? <span style={{ color: C.blue, fontWeight: 600 }}>🔗</span> : <span style={{ color: C.hint }}>✗</span>) },
            { key: 'cited_url', label: 'URL citat', style: { maxWidth: 220, overflowWrap: 'anywhere', fontFamily: 'monospace', fontSize: 11 }, render: r => r.cited_url ? <ExtLink href={r.cited_url}>{shortUrl(r.cited_url)}</ExtLink> : '—' },
          ]}
        />
      ) : <p style={{ fontSize: 12, color: C.hint, margin: '4px 0 8px' }}>Nicio întrebare pentru această platformă.</p>}
    </Card>
  )
}

function PromptCell({ result }) {
  if (!result) return <span style={{ color: C.hint }}>—</span>
  const domains = Array.isArray(result.cited_domains) ? result.cited_domains : []
  const title = domains.length ? `Domenii citate: ${domains.join(', ')}` : undefined
  if (result.cited) return <span title={title} style={{ color: C.blue, fontWeight: 600, whiteSpace: 'nowrap' }}>🔗 citat</span>
  if (result.mentioned) return <span title={title} style={{ color: C.green, fontWeight: 600, whiteSpace: 'nowrap' }}>✓ menționat</span>
  return <span title={title} style={{ color: C.red }}>✗</span>
}

function PromptTests({ tests }) {
  if (!tests || !(tests.prompts || []).length) return <Empty />
  const keys = new Set((tests.platforms || []).map(p => String(p).toLowerCase()))
  tests.prompts.forEach(p => Object.keys(p.results || {}).forEach(k => keys.add(k.toLowerCase())))
  const platforms = [...keys]
  const getResult = (p, key) => {
    const r = p.results || {}
    const found = Object.keys(r).find(k => k.toLowerCase() === key)
    return found ? r[found] : null
  }
  const totals = platforms.map(key => ({
    key,
    mentioned: tests.prompts.filter(p => { const r = getResult(p, key); return r && (r.mentioned || r.cited) }).length,
  }))
  return (
    <Card style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: C.hint, margin: '0 0 8px' }}>Rulat: {fmtDate(tests.run_at)} · {tests.prompts.length} prompturi · ✓ menționat · 🔗 citat · ✗ absent</p>
      <SimpleTable
        minWidth={260 + platforms.length * 100}
        rows={tests.prompts}
        columns={[
          { key: 'prompt', label: 'Prompt', style: { maxWidth: 320, overflowWrap: 'anywhere' } },
          ...platforms.map(key => ({ key: `p_${key}`, label: platformLabel(key), align: 'center', render: r => <PromptCell result={getResult(r, key)} /> })),
        ]}
      />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {totals.map(t => <span key={t.key} style={{ fontSize: 11, color: C.muted }}>{platformLabel(t.key)}: <b>{t.mentioned}</b>/{tests.prompts.length}</span>)}
      </div>
    </Card>
  )
}

const STATE_UI = {
  ok: { icon: '✓', color: C.green },
  warn: { icon: '⚠', color: C.amber },
  fail: { icon: '✗', color: C.red },
}

function AgentDiscovery({ discovery, data }) {
  const pages = data?.pages?.current || []
  const gsc = data?.gsc || {}
  if (!discovery || discovery.error) return <Empty>{discovery?.error || 'Verificarea live nu este disponibilă.'}</Empty>
  const rows = [discovery.homepage, ...(discovery.endpoints || [])].filter(Boolean).map(row => {
    const ga4 = pages.find(p => p.page_path === row.path) || {}
    const gscPage = (gsc.pages || gsc.current || []).find(p => p.page_path === row.path || p.page === row.path) || {}
    return {
      ...row,
      views: Number(ga4.screen_page_views || 0),
      impressions: Number(gscPage.organic_google_search_impressions || gscPage.impressions || 0),
    }
  })
  return (
    <Card style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: C.hint, margin: '0 0 8px' }}>Verificare live {discovery.origin} · {fmtDate(discovery.checked_at)} (cache 10 min)</p>
      <SimpleTable
        minWidth={720}
        rows={rows}
        columns={[
          { key: 'label', label: 'Endpoint', render: r => (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}><PageLink path={r.path}>{r.path}</PageLink></span>
            </div>
          ) },
          { key: 'state', label: 'Stare', render: r => {
            const ui = STATE_UI[r.state] || STATE_UI.fail
            return (
              <div style={{ color: ui.color }}>
                <b>{ui.icon}</b> <span style={{ fontSize: 11 }}>{r.reason}</span>
                {r.link ? <div style={{ fontSize: 10, color: C.hint, fontFamily: 'monospace', overflowWrap: 'anywhere', marginTop: 2 }}>{r.link}</div> : null}
              </div>
            )
          }, style: { maxWidth: 280 } },
          { key: 'status', label: 'HTTP', align: 'right', render: r => (r.status ? r.status : '—') },
          { key: 'content_type', label: 'Content-Type', style: { fontFamily: 'monospace', fontSize: 11, overflowWrap: 'anywhere' }, render: r => text(r.content_type) },
          { key: 'views', label: 'Views', align: 'right', render: r => `${fmtN(r.views)}` },
          { key: 'impressions', label: 'Impr.', align: 'right', render: r => `${fmtN(r.impressions)}` },
        ]}
      />
    </Card>
  )
}

export function TabGeoAi({ data }) {
  const state = useSeoData()
  const payload = state.payload
  const seo = payload?.seo
  const report = isReport(seo) ? seo : null
  const audit = report?.geo_audit || null
  const traffic = report?.ai_traffic || null
  const mentions = report?.llm_mentions || null
  const tests = report?.prompt_tests || null
  const discovery = payload?.discovery
  const amplitude = data?.amplitudeAnalytics || null

  const aiViews = (traffic?.sources || []).reduce((s, r) => s + (num(r.views) || 0), 0)
  const allQuestions = Object.values(mentions?.by_platform || {}).flat()
  const mentionedQ = allQuestions.filter(q => q.mentioned || q.cited).length
  const promptRows = tests?.prompts || []
  const promptHits = promptRows.reduce((s, p) => s + Object.values(p.results || {}).filter(r => r && (r.mentioned || r.cited)).length, 0)
  const promptCells = promptRows.reduce((s, p) => s + Object.values(p.results || {}).filter(Boolean).length, 0)
  const discRows = discovery && !discovery.error ? [discovery.homepage, ...(discovery.endpoints || [])].filter(Boolean) : []
  const discOk = discRows.filter(r => r.state === 'ok').length

  return (
    <div>
      <Header state={state} payload={payload} />
      <SeoStatus state={state} />

      {payload && (
        <>
          <Grid>
            <Stat label="Scor GEO" value={audit ? text(audit.score) : '—'} sub={audit?.band || 'audit AI readiness'} color={audit ? bandColor(audit.band, audit.score) : C.text} />
            <Stat label="Vizite din AI" value={traffic ? fmtN(aiViews) : '—'} sub={traffic ? `ultimele ${text(traffic.days)} zile` : 'ai_traffic'} />
            <Stat label="Întrebări cu HomePitch" value={mentions ? `${mentionedQ} / ${allQuestions.length}` : '—'} sub="menționat sau citat" />
            <Stat label="Test prompturi" value={tests ? `${promptHits} / ${promptCells}` : '—'} sub="răspunsuri cu HomePitch" />
            <Stat label="Agent discovery" value={discRows.length ? `${discOk} / ${discRows.length}` : '—'} sub="verificări ✓" color={discRows.length && discOk === discRows.length ? C.green : C.amber} />
          </Grid>

          <Sec title="Scor GEO (AI readiness)"><GeoAudit audit={audit} /></Sec>
          <Sec title="Trafic din asistenți AI"><AiTraffic traffic={traffic} amplitude={amplitude} /></Sec>
          <Sec title="Întrebările în care apare HomePitch"><LlmMentions mentions={mentions} /></Sec>
          <Sec title="Test prompturi"><PromptTests tests={tests} /></Sec>
        </>
      )}

      <Sec title="Agent discovery și pagini agent-ready">
        {state.loading && !payload ? <Empty>Se verifică endpoint-urile…</Empty> : <AgentDiscovery discovery={discovery} data={data} />}
      </Sec>
    </div>
  )
}
