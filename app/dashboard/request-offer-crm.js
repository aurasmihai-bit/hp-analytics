'use client'

import { useEffect, useMemo, useState } from 'react'
import { C, Card, KPI, fmtN } from './components'

const STAGES = [
  ['nou', 'Nou'],
  ['contactat', 'Contactat'],
  ['nu_raspunde', 'Nu raspunde la telefon'],
  ['pending_actiune', 'Pending actiune'],
  ['refuz', 'Refuz'],
  ['inchis_manual', 'Inchis manual'],
]

const CLOSED_STAGES = new Set(['refuz', 'inchis_manual'])
const STAGE_TABS = new Set(STAGES.map(([id]) => id))

const SOURCE_LABELS = {
  offer_no_response: 'Oferta fara raspuns',
  recommendation_no_offer: 'Recomandare fara oferta',
}

const PAGE_SIZES = [20, 50, 100, 'toate']
const TABLE_COLUMNS = 'minmax(240px,1.9fr) minmax(78px,.68fr) minmax(116px,.8fr) minmax(62px,.45fr) minmax(60px,.42fr) minmax(108px,.76fr) 68px'

const SORT_LABELS = {
  inactive_desc: 'Inactivitate descrescator',
  inactive_asc: 'Inactivitate crescator',
  received_desc: 'Primite recent',
  received_asc: 'Primite vechi',
  reminders_desc: 'Remindere descrescator',
  buyer_score_desc: 'Scor cumparator descrescator',
  ai_score_desc: 'Scor AI descrescator',
}

function safeDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleString('ro-RO', withTime
    ? { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }
    : { day:'2-digit', month:'short', year:'numeric' })
}

function money(value, currency = 'EUR') {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${n.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} ${currency || 'EUR'}`
}

function labelize(value) {
  if (!value) return '—'
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function financingLabel(value) {
  const labels = {
    cash: 'Cash',
    credit: 'Credit',
    mixt: 'Mixt',
    nedecis: 'Nedecis',
  }
  return labels[value] || labelize(value)
}

function preApprovalLabel(value) {
  const labels = {
    da: 'Da',
    nu: 'Nu',
    in_progress: 'In lucru',
  }
  return labels[value] || labelize(value)
}

function stageLabel(value) {
  return STAGES.find(([id]) => id === value)?.[1] || value || 'Nou'
}

function stageColor(value) {
  if (value === 'refuz' || value === 'inchis_manual') return C.red
  if (value === 'pending_actiune' || value === 'nu_raspunde') return C.amber
  if (value === 'contactat') return C.blue
  return C.green
}

function sourceColor(value) {
  return value === 'recommendation_no_offer' ? C.purple : C.blue
}

function contactFor(row) {
  if (row.sourceType === 'recommendation_no_offer') {
    return {
      name: row.counterpartyName || 'Utilizator fara nume',
      email: row.counterpartyEmail || '',
      phone: row.counterpartyPhone || '',
      userType: row.counterpartyUserType || '',
    }
  }
  return {
    name: row.requestAuthorName || 'Cumparator fara nume',
    email: row.requestAuthorEmail || '',
    phone: row.requestAuthorPhone || '',
    userType: row.requestAuthorUserType || 'cumparator',
  }
}

function otherContactFor(row) {
  if (row.sourceType === 'recommendation_no_offer') {
    return {
      name: row.requestAuthorName || 'Cumparator fara nume',
      email: row.requestAuthorEmail || '',
      phone: row.requestAuthorPhone || '',
      userType: row.requestAuthorUserType || 'cumparator',
      label: 'Autor cerere',
    }
  }
  return {
    name: row.counterpartyName || 'Autor oferta',
    email: row.counterpartyEmail || '',
    phone: row.counterpartyPhone || '',
    userType: row.counterpartyUserType || '',
    label: 'Autor oferta',
  }
}

function matchesSearch(row, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    row.requestTitle,
    row.propertyTitle,
    row.requestAuthorName,
    row.requestAuthorEmail,
    row.counterpartyName,
    row.counterpartyEmail,
    row.city,
    row.neighborhood,
    row.transactionType,
  ].some(value => String(value || '').toLowerCase().includes(q))
}

function sortRows(rows, sortBy, direction = 'desc') {
  const factor = direction === 'asc' ? 1 : -1
  const getValue = (row) => {
    if (sortBy === 'inactive') return row.inactiveDays || 0
    if (sortBy === 'received') return new Date(row.sourceReceivedAt || row.sourceCreatedAt || 0).getTime() || 0
    if (sortBy === 'reminders') return row.reminderCount || 0
    if (sortBy === 'buyer_score') return row.buyerScore || 0
    if (sortBy === 'ai_score') return row.aiScore || 0
    if (sortBy === 'stage') return stageLabel(row.stage)
    return String(row.requestTitle || row.propertyTitle || '')
  }
  return [...rows].sort((a, b) => {
    const av = getValue(a)
    const bv = getValue(b)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
    return String(av).localeCompare(String(bv), 'ro') * factor
  })
}

function HeaderButton({ children, field, sortField, sortDirection, onSort }) {
  const active = sortField === field
  return (
    <button onClick={() => onSort(field)} style={{border:0,background:'transparent',padding:0,font:'inherit',fontSize:11,color:active ? C.text : C.hint,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em',cursor:'pointer',textAlign:'left'}}>
      {children}{active ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  )
}

function Pill({ children, color = C.gray }) {
  return (
    <span style={{fontSize:11,fontWeight:600,color,background:`color-mix(in srgb, ${color} 12%, transparent)`,border:`0.5px solid color-mix(in srgb, ${color} 24%, transparent)`,borderRadius:999,padding:'3px 8px',lineHeight:1.2}}>
      {children}
    </span>
  )
}

function SourceIssue({ setupRequired, sourceIssue }) {
  if (!setupRequired?.crm && !setupRequired?.homePitchExport && !sourceIssue) return null
  return (
    <Card style={{borderColor:C.amber,background:C.softAmber,marginBottom:14}}>
      <p style={{margin:'0 0 6px',fontSize:13,fontWeight:700,color:C.text}}>Date live partiale</p>
      <p style={{margin:0,fontSize:13,color:C.muted,lineHeight:1.5}}>
        {setupRequired?.crm ? 'Ruleaza migrarea supabase/hp_request_offer_crm.sql in Supabase analytics. ' : ''}
        {setupRequired?.homePitchExport ? 'Exportul HomePitch pentru request_offer_cases trebuie activat in Lovable ca pagina sa citeasca date live. ' : ''}
        {sourceIssue ? `Detaliu: ${sourceIssue}` : ''}
      </p>
    </Card>
  )
}

function StageSelect({ value, onChange, disabled }) {
  return (
    <select value={value || 'nou'} onChange={e => onChange(e.target.value)} disabled={disabled} style={{width:'100%',border:`0.5px solid ${C.border}`,borderRadius:8,background:C.input,color:C.text,padding:'8px 10px',fontSize:13}}>
      {STAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
  )
}

function MiniContact({ contact, muted = false }) {
  return (
    <div>
      <p style={{margin:'0 0 2px',fontSize:13,fontWeight:700,color:muted ? C.muted : C.text}}>{contact.name || '—'}</p>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',fontSize:11,color:C.hint,lineHeight:1.4}}>
        {contact.email && <a href={`mailto:${contact.email}`} style={{color:'inherit',textDecoration:'none'}}>{contact.email}</a>}
        {contact.phone && <a href={`tel:${contact.phone}`} style={{color:'inherit',textDecoration:'none'}}>{contact.phone}</a>}
        {contact.userType && <span>{contact.userType}</span>}
      </div>
    </div>
  )
}

function RequestOfferRow({ row }) {
  const detailHref = `/dashboard/cereri-oferte/${encodeURIComponent(`${row.sourceType}:${row.sourceId}`)}`
  const openDetail = () => {
    window.location.href = detailHref
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openDetail()
        }
      }}
      style={{display:'grid',gridTemplateColumns:TABLE_COLUMNS,gap:10,alignItems:'center',padding:'12px 14px',borderBottom:`0.5px solid ${C.border}`,minWidth:0,cursor:'pointer'}}
    >
      <div>
        <span style={{fontSize:13,fontWeight:700,color:C.text,lineHeight:1.35}}>{row.requestTitle}</span>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:5}}>
          {row.propertyTitle && <span style={{fontSize:11,color:C.muted}}>Oferta: {row.propertyTitle}</span>}
          {row.city && <Pill color={C.blue}>{row.city}</Pill>}
          {row.neighborhood && <Pill color={C.gray}>{row.neighborhood}</Pill>}
        </div>
      </div>
      <Pill color={sourceColor(row.sourceType)}>{SOURCE_LABELS[row.sourceType] || row.sourceType}</Pill>
      <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
        <div>Creat: {safeDate(row.sourceCreatedAt || row.createdAt)}</div>
        <div>Primit: {safeDate(row.sourceReceivedAt, true)}</div>
      </div>
      <strong style={{fontSize:13,color:row.inactiveDays >= 7 ? C.red : row.inactiveDays >= 3 ? C.amber : C.text}}>{row.inactiveDays} zile</strong>
      <span style={{fontSize:13,color:C.text}}>{row.reminderCount}</span>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{width:7,height:7,borderRadius:'50%',background:stageColor(row.stage)}}/>
        <span style={{fontSize:12,color:C.muted}}>{stageLabel(row.stage)}</span>
      </div>
      <a
        href={detailHref}
        onClick={e => e.stopPropagation()}
        style={{textAlign:'center',fontSize:12,fontWeight:700,color:C.blue,textDecoration:'none',border:`0.5px solid ${C.blue}`,borderRadius:8,padding:'7px 8px'}}
      >
        Detalii
      </a>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <Card style={{textAlign:'center',padding:'34px 20px'}}>
      <p style={{fontSize:15,fontWeight:700,color:C.text,margin:'0 0 6px'}}>{text}</p>
      <p style={{fontSize:13,color:C.muted,margin:0}}>Cand apar cazuri noi, le vezi aici cu etapa, inactivitate si remindere.</p>
    </Card>
  )
}

function useRequestOfferRows() {
  const [state, setState] = useState({ loading:true, rows:[], error:'', setupRequired:{}, sourceIssue:'' })
  useEffect(() => {
    let cancelled = false
    fetch('/api/request-offer-crm?limit=1000', { cache:'no-store' })
      .then(async res => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
        return json
      })
      .then(json => {
        if (!cancelled) setState({ loading:false, rows:json.rows || [], error:'', setupRequired:json.setupRequired || {}, sourceIssue:json.sourceIssue || '' })
      })
      .catch(error => {
        if (!cancelled) setState({ loading:false, rows:[], error:error.message || String(error), setupRequired:{}, sourceIssue:'' })
      })
    return () => { cancelled = true }
  }, [])
  return state
}

export function RequestOfferCrmPage() {
  const { loading, rows, error, setupRequired, sourceIssue } = useRequestOfferRows()
  const [tab, setTab] = useState('offer_no_response')
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('all')
  const [transaction, setTransaction] = useState('all')
  const [minInactive, setMinInactive] = useState('all')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState('inactive')
  const [sortDirection, setSortDirection] = useState('desc')

  const stats = useMemo(() => {
    const active = rows.filter(row => !CLOSED_STAGES.has(row.stage))
    return {
      offers: active.filter(row => row.sourceType === 'offer_no_response' && row.stage === 'nou').length,
      recs: active.filter(row => row.sourceType === 'recommendation_no_offer' && row.stage === 'nou').length,
      overdue: active.filter(row => row.inactiveDays >= 7).length,
      reminders: active.reduce((sum, row) => sum + Number(row.reminderCount || 0), 0),
    }
  }, [rows])

  const transactions = useMemo(() => Array.from(new Set(rows.map(row => row.transactionType).filter(Boolean))).sort(), [rows])

  const filtered = useMemo(() => {
    let base = rows
    if (STAGE_TABS.has(tab)) {
      base = base.filter(row => row.stage === tab)
    } else {
      base = base.filter(row => row.sourceType === tab && row.stage === 'nou')
    }
    if (stage !== 'all') base = base.filter(row => row.stage === stage)
    if (transaction !== 'all') base = base.filter(row => row.transactionType === transaction)
    if (minInactive !== 'all') base = base.filter(row => row.inactiveDays >= Number(minInactive))
    base = base.filter(row => matchesSearch(row, query))
    return sortRows(base, sortField, sortDirection)
  }, [rows, tab, stage, transaction, minInactive, query, sortField, sortDirection])

  const totalPages = pageSize === 'toate' ? 1 : Math.max(1, Math.ceil(filtered.length / Number(pageSize)))
  const visibleRows = pageSize === 'toate'
    ? filtered
    : filtered.slice((page - 1) * Number(pageSize), page * Number(pageSize))

  function onSort(field) {
    if (sortField === field) setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('desc') }
  }

  function selectTab(id) {
    setTab(id)
    setStage('all')
  }

  useEffect(() => { setPage(1) }, [tab, query, stage, transaction, minInactive, pageSize])

  if (loading) return <Card>Se incarca CRM-ul cereri/oferte...</Card>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h1 style={{fontSize:28,lineHeight:1.1,margin:'0 0 6px',color:C.text}}>Cereri / Oferte</h1>
          <p style={{fontSize:14,color:C.muted,margin:0,maxWidth:720,lineHeight:1.5}}>CRM operational pentru cumparatori care nu au raspuns la oferte si agenti/proprietari care au recomandari AI aprobate, dar netrimise.</p>
        </div>
        <a href="/dashboard/concierge" style={{fontSize:12,color:C.blue,textDecoration:'none',border:`0.5px solid ${C.border}`,borderRadius:8,padding:'8px 10px'}}>Inapoi la Concierge</a>
      </div>

      <SourceIssue setupRequired={setupRequired} sourceIssue={sourceIssue}/>
      {error && <Card style={{borderColor:C.red,background:C.softRed,marginBottom:14}}><p style={{color:C.red,margin:0,fontSize:13}}>{error}</p></Card>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:16}}>
        <KPI label="Oferte fara raspuns" curr={stats.offers}/>
        <KPI label="Recomandari fara oferta" curr={stats.recs}/>
        <KPI label="7+ zile inactivitate" curr={stats.overdue}/>
        <KPI label="Remindere trimise" curr={stats.reminders}/>
      </div>

      <Card style={{padding:12,marginBottom:14}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
          {[
            ['offer_no_response', `Oferte fara raspuns (${stats.offers})`],
            ['recommendation_no_offer', `Recomandari netrimise (${stats.recs})`],
            ...STAGES.map(([id, label]) => [id, `${label} (${rows.filter(row => row.stage === id).length})`]),
          ].map(([id, label]) => (
            <button key={id} onClick={() => selectTab(id)} style={{border:`0.5px solid ${tab === id ? C.blue : C.border}`,background:tab === id ? C.softBlue : 'transparent',color:tab === id ? C.blue : C.muted,borderRadius:8,padding:'8px 10px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{label}</button>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'minmax(240px,1.8fr) repeat(4,minmax(130px,1fr))',gap:8}}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cauta nume, email, cerere, proprietate, zona..." style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',background:C.input,color:C.text,fontSize:13}}/>
          <select value={stage} onChange={e => setStage(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',background:C.input,color:C.text,fontSize:13}}>
            <option value="all">Toate etapele</option>
            {STAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={transaction} onChange={e => setTransaction(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',background:C.input,color:C.text,fontSize:13}}>
            <option value="all">Toate tranzactiile</option>
            {transactions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={minInactive} onChange={e => setMinInactive(e.target.value)} style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',background:C.input,color:C.text,fontSize:13}}>
            <option value="all">Orice inactivitate</option>
            <option value="3">3+ zile</option>
            <option value="5">5+ zile</option>
            <option value="7">7+ zile</option>
            <option value="10">10+ zile</option>
          </select>
          <select value={pageSize} onChange={e => setPageSize(e.target.value === 'toate' ? 'toate' : Number(e.target.value))} style={{border:`0.5px solid ${C.border}`,borderRadius:8,padding:'9px 10px',background:C.input,color:C.text,fontSize:13}}>
            {PAGE_SIZES.map(value => <option key={value} value={value}>{value === 'toate' ? 'Toate' : `${value} / pagina`}</option>)}
          </select>
        </div>
      </Card>

      <Card style={{padding:0,overflowX:'auto'}}>
        <div style={{display:'grid',gridTemplateColumns:TABLE_COLUMNS,gap:10,padding:'11px 14px',borderBottom:`0.5px solid ${C.border}`,background:C.softPanel,minWidth:0}}>
          <HeaderButton field="title" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>Cerere / proprietate</HeaderButton>
          <span style={{fontSize:11,color:C.hint,fontWeight:600,textTransform:'uppercase'}}>Tip</span>
          <HeaderButton field="received" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>Date</HeaderButton>
          <HeaderButton field="inactive" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>Zile</HeaderButton>
          <HeaderButton field="reminders" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>Rem.</HeaderButton>
          <HeaderButton field="stage" sortField={sortField} sortDirection={sortDirection} onSort={onSort}>Etapa</HeaderButton>
          <span/>
        </div>
        {visibleRows.length ? visibleRows.map(row => <RequestOfferRow key={`${row.sourceType}:${row.sourceId}`} row={row}/>) : <EmptyState text="Nu exista cazuri in acest tab."/>}
      </Card>

      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8,marginTop:12}}>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{border:`0.5px solid ${C.border}`,background:C.card,color:C.text,borderRadius:8,padding:'7px 10px',cursor:'pointer'}}>Inapoi</button>
          <span style={{fontSize:12,color:C.muted}}>Pagina {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{border:`0.5px solid ${C.border}`,background:C.card,color:C.text,borderRadius:8,padding:'7px 10px',cursor:'pointer'}}>Inainte</button>
        </div>
      )}

      <Card style={{marginTop:18,background:C.softBlue}}>
        <p style={{margin:'0 0 8px',fontSize:14,fontWeight:800,color:C.text}}>Recomandari UX pentru operare</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
          {[
            ['Prioritate automata', 'Sorteaza implicit dupa zile inactive si remindere, ca echipa sa inceapa cu blocajele reale.'],
            ['SLA vizibil', 'Marcheaza rosu cazurile cu 7+ zile fara actiune si galben pe cele cu 3-6 zile.'],
            ['Istoric complet', 'Pastreaza comentariile si logul separat de datele live, pentru audit si handover intre asistenti.'],
          ].map(([title, body]) => (
            <div key={title} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:12}}>
              <p style={{fontSize:13,fontWeight:700,color:C.text,margin:'0 0 4px'}}>{title}</p>
              <p style={{fontSize:12,color:C.muted,margin:0,lineHeight:1.45}}>{body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function DetailCard({ label, value, sub }) {
  return (
    <div style={{border:`0.5px solid ${C.border}`,borderRadius:10,padding:'12px 14px',background:C.card}}>
      <p style={{fontSize:11,color:C.hint,margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</p>
      <p style={{fontSize:18,fontWeight:800,color:C.text,margin:'0 0 4px'}}>{value || '—'}</p>
      {sub && <p style={{fontSize:12,color:C.muted,margin:0}}>{sub}</p>}
    </div>
  )
}

const CASE_DETAIL_FIELDS = [
  ['tip', 'Tip'],
  ['tranzactie', 'Tranzactie'],
  ['valoare', 'Buget / pret'],
  ['localitate', 'Oras'],
  ['cartier', 'Cartier'],
  ['reper', 'Reper'],
  ['camere', 'Nr. camere'],
  ['suprafata', 'Suprafata'],
  ['etaj', 'Etaj'],
  ['bai', 'Bai'],
  ['an_constructie', 'An constructie'],
  ['compartimentare', 'Compartimentare'],
  ['orientare', 'Orientare'],
  ['risc_seismic', 'Risc seismic'],
  ['facilitati_cladire', 'Facilitati cladire'],
  ['facilitati_apartament', 'Facilitati apartament'],
  ['dotari', 'Dotari'],
  ['balcon', 'Balcon'],
  ['parcare', 'Parcare'],
  ['lift', 'Lift'],
  ['finantare', 'Finantare'],
  ['avans', 'Avans'],
  ['preaprobare', 'Preaprobare'],
  ['timing', 'Timing'],
  ['comision', 'Comision'],
  ['sursa_crm', 'Sursa CRM'],
]

const DETAIL_ALIASES = {
  valoare: ['valoare', 'buget', 'pret', 'budget', 'price'],
  localitate: ['localitate', 'oras', 'city'],
  cartier: ['cartier', 'cartiere', 'neighborhood', 'neighborhoods'],
  camere: ['camere', 'nr_camere', 'rooms', 'rooms_text', 'numar_camere'],
  suprafata: ['suprafata', 'suprafata_utila', 'area', 'area_text', 'surface', 'surface_area'],
  etaj: ['etaj', 'floor', 'floor_text'],
  bai: ['bai', 'bathrooms', 'nr_bai'],
  an_constructie: ['an_constructie', 'year_built', 'year_built_text', 'construction_year'],
  compartimentare: ['compartimentare', 'compartment_type'],
  orientare: ['orientare', 'orientation'],
  risc_seismic: ['risc_seismic', 'seismic_risk', 'has_seismic_risk', 'seismic_risk_class'],
  facilitati_cladire: ['facilitati_cladire', 'building_facilities', 'building_amenities'],
  facilitati_apartament: ['facilitati_apartament', 'apartment_facilities', 'facilities'],
  dotari: ['dotari', 'amenities'],
  balcon: ['balcon', 'balcony'],
  parcare: ['parcare', 'parking'],
  lift: ['lift', 'elevator'],
}

function cleanDetailText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (value === null || value === undefined || value === '') return ''
  if (value === true) return 'Da'
  if (value === false) return 'Nu'
  return String(value)
}

function detailValue(details, key) {
  const keys = DETAIL_ALIASES[key] || [key]
  for (const item of keys) {
    const value = cleanDetailText(details?.[item])
    if (value) return value
  }
  return ''
}

function buildFallbackRequestDetails(draft) {
  return {
    tip: draft.metadata?.request_details?.tip || '',
    tranzactie: draft.transactionType || '',
    valoare: money(draft.price, draft.currency),
    buget: money(draft.price, draft.currency),
    scor_cumparator: draft.buyerScore ? `${draft.buyerScore}/100` : '',
    status_homepitch: draft.sourceStatus ? labelize(draft.sourceStatus) : '',
    localitate: draft.city || '',
    cartier: draft.neighborhood || '',
    finantare: draft.financing ? financingLabel(draft.financing) : '',
    avans: draft.downPayment !== null && draft.downPayment !== undefined ? money(draft.downPayment, draft.downPaymentCurrency || draft.currency) : '',
    preaprobare: draft.preApproval ? preApprovalLabel(draft.preApproval) : '',
    timing: draft.deadline ? safeDate(draft.deadline) : '',
  }
}

function buildFallbackPropertyDetails(draft) {
  return {
    tip: draft.metadata?.property_details?.tip || '',
    tranzactie: draft.transactionType || '',
    valoare: money(draft.price, draft.currency),
    pret: money(draft.price, draft.currency),
    scor_ai: draft.aiScore ? `${draft.aiScore}%` : '',
    localitate: draft.city || '',
    cartier: draft.neighborhood || '',
  }
}

function CaseTitle({ title, href }) {
  if (!title) return <span style={{color:C.hint}}>—</span>
  if (!href) return <span>{title}</span>
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{color:C.blue,textDecoration:'none'}}>{title}</a>
}

function CaseDetailsComparison({ requestTitle, requestHref, requestDetails, propertyTitle, propertyHref, propertyDetails }) {
  const rows = CASE_DETAIL_FIELDS
    .map(([key, label]) => ({
      key,
      label,
      request: detailValue(requestDetails, key),
      property: detailValue(propertyDetails, key),
    }))
    .filter(row => row.request || row.property)

  return (
    <div style={{border:`0.5px solid ${C.border}`,borderRadius:12,background:C.softPanel,overflowX:'auto'}}>
      <div style={{minWidth:660}}>
        <div style={{display:'grid',gridTemplateColumns:'132px minmax(0,1fr) minmax(0,1fr)',gap:0,borderBottom:`0.5px solid ${C.border}`,background:C.card}}>
          <div style={{padding:'10px 12px'}}/>
          <div style={{padding:'10px 12px',borderLeft:`0.5px solid ${C.border}`}}>
            <p style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',margin:'0 0 4px'}}>Date cerere</p>
            <p style={{fontSize:13,fontWeight:800,color:C.text,margin:0,lineHeight:1.35,overflowWrap:'anywhere'}}>
              <CaseTitle title={requestTitle} href={requestHref}/>
            </p>
          </div>
          <div style={{padding:'10px 12px',borderLeft:`0.5px solid ${C.border}`}}>
            <p style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',margin:'0 0 4px'}}>Date proprietate</p>
            <p style={{fontSize:13,fontWeight:800,color:C.text,margin:0,lineHeight:1.35,overflowWrap:'anywhere'}}>
              <CaseTitle title={propertyTitle || 'Fara proprietate asociata'} href={propertyHref}/>
            </p>
          </div>
        </div>
        {rows.map(row => (
          <div key={row.key} style={{display:'grid',gridTemplateColumns:'132px minmax(0,1fr) minmax(0,1fr)',gap:0,borderBottom:`0.5px solid ${C.border}`}}>
            <div style={{padding:'8px 12px'}}>
              <span style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.035em'}}>{row.label}</span>
            </div>
            <div style={{padding:'8px 12px',borderLeft:`0.5px solid ${C.border}`}}>
              <span style={{fontSize:13,color:row.request ? C.text : C.hint,fontWeight:row.request ? 650 : 500,lineHeight:1.35,overflowWrap:'anywhere'}}>{row.request || '—'}</span>
            </div>
            <div style={{padding:'8px 12px',borderLeft:`0.5px solid ${C.border}`}}>
              <span style={{fontSize:13,color:row.property ? C.text : C.hint,fontWeight:row.property ? 650 : 500,lineHeight:1.35,overflowWrap:'anywhere'}}>{row.property || '—'}</span>
            </div>
          </div>
        ))}
        {!rows.length && <p style={{fontSize:13,color:C.muted,margin:0,padding:12}}>Nu exista detalii disponibile.</p>}
      </div>
    </div>
  )
}

function ActivityLog({ log }) {
  const rows = [...(log || [])].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  if (!rows.length) return <p style={{fontSize:13,color:C.muted,margin:0}}>Nu exista log de modificari.</p>
  return (
    <div style={{display:'grid',gap:8}}>
      {rows.map((item, index) => (
        <div key={item.id || index} style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:10,borderBottom:index < rows.length - 1 ? `0.5px solid ${C.border}` : 'none',paddingBottom:8}}>
          <span style={{fontSize:11,color:C.hint}}>{safeDate(item.created_at, true)}</span>
          <div>
            <p style={{fontSize:13,color:C.text,margin:'0 0 2px'}}>{item.text || 'Actualizare'}</p>
            <p style={{fontSize:11,color:C.hint,margin:0}}>{item.author || 'Sistem'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function RequestOfferCrmDetail({ caseId }) {
  const { loading, rows, error, setupRequired, sourceIssue } = useRequestOfferRows()
  const decodedCaseId = decodeURIComponent(caseId || '')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!rows.length) return
    const found = rows.find(row => row.id === decodedCaseId || `${row.sourceType}:${row.sourceId}` === decodedCaseId)
    if (found) setDraft(JSON.parse(JSON.stringify(found)))
  }, [rows, decodedCaseId])

  async function patch(updates) {
    if (!draft) return
    const next = { ...draft, ...updates }
    setDraft(next)
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/request-offer-crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      if (json.row) setDraft({ ...next, ...json.row })
    } catch (err) {
      setSaveError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  function saveComment() {
    const text = comment.trim()
    if (!text) return
    const comments = [
      ...(draft.comments || []),
      {
        id: `c-${Date.now()}`,
        type: 'comment',
        text,
        author: 'CRM',
        created_at: new Date().toISOString(),
      },
    ]
    setComment('')
    patch({ comments })
  }

  if (loading) return <Card>Se incarca detaliile...</Card>
  if (error) return <Card style={{borderColor:C.red,background:C.softRed}}><p style={{color:C.red,margin:0}}>{error}</p></Card>
  if (!draft) return <Card>Nu am gasit cazul CRM.</Card>

  const primary = contactFor(draft)
  const other = otherContactFor(draft)
  const closed = CLOSED_STAGES.has(draft.stage)
  const requestCaseDetails = {
    ...buildFallbackRequestDetails(draft),
    ...(draft.metadata?.request_details || {}),
  }
  const propertyCaseDetails = {
    ...buildFallbackPropertyDetails(draft),
    ...(draft.metadata?.property_details || {}),
  }

  return (
    <div>
      <a href="/dashboard/cereri-oferte" style={{fontSize:12,color:C.blue,textDecoration:'none'}}>← Inapoi la Cereri/Oferte</a>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',margin:'14px 0 16px',flexWrap:'wrap'}}>
        <div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
            <Pill color={sourceColor(draft.sourceType)}>{SOURCE_LABELS[draft.sourceType]}</Pill>
            <Pill color={stageColor(draft.stage)}>{stageLabel(draft.stage)}</Pill>
            {closed && <Pill color={C.red}>Scos din listing principal</Pill>}
          </div>
          <h1 style={{fontSize:28,lineHeight:1.12,margin:'0 0 6px',color:C.text}}>{draft.requestTitle}</h1>
        </div>
      </div>

      <SourceIssue setupRequired={setupRequired} sourceIssue={sourceIssue}/>
      {saveError && <Card style={{borderColor:C.red,background:C.softRed,marginBottom:12}}><p style={{fontSize:13,color:C.red,margin:0}}>{saveError}</p></Card>}

      <div style={{display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:14,alignItems:'start'}}>
        <div style={{display:'grid',gap:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>
            <DetailCard label="Pret / buget" value={money(draft.price, draft.currency)} sub={draft.transactionType}/>
            <DetailCard label="Localitate" value={draft.city || '—'} sub={draft.neighborhood}/>
            <DetailCard label="Scor cumparator" value={draft.buyerScore ? `${draft.buyerScore}/100` : '—'}/>
            <DetailCard label="Scor AI" value={draft.aiScore ? `${draft.aiScore}%` : '—'}/>
          </div>

          {draft.requestDescription && (
            <Card>
              <h2 style={{fontSize:16,margin:'0 0 10px',color:C.text}}>Descriere user</h2>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.65,whiteSpace:'pre-wrap',margin:0}}>{draft.requestDescription}</p>
            </Card>
          )}

          <Card>
            <h2 style={{fontSize:16,margin:'0 0 12px',color:C.text}}>Contacte</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
              <div style={{background:C.softPanel,border:`0.5px solid ${C.border}`,borderRadius:10,padding:12}}>
                <p style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',margin:'0 0 8px'}}>{draft.sourceType === 'recommendation_no_offer' ? 'User de contactat' : 'Autor cerere'}</p>
                <MiniContact contact={primary}/>
              </div>
              <div style={{background:C.softPanel,border:`0.5px solid ${C.border}`,borderRadius:10,padding:12}}>
                <p style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',margin:'0 0 8px'}}>{other.label}</p>
                <MiniContact contact={other} muted/>
              </div>
            </div>
          </Card>

          <Card>
            <h2 style={{fontSize:16,margin:'0 0 12px',color:C.text}}>Date caz</h2>
            <div style={{marginBottom:12}}>
              <CaseDetailsComparison
                requestTitle={draft.requestTitle}
                requestHref={draft.requestUrl}
                requestDetails={requestCaseDetails}
                propertyTitle={draft.propertyTitle}
                propertyHref={draft.propertyUrl}
                propertyDetails={propertyCaseDetails}
              />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
              <InfoRow label="Creat" value={safeDate(draft.sourceCreatedAt, true)}/>
              <InfoRow label="Primit oferta/recomandare" value={safeDate(draft.sourceReceivedAt, true)}/>
              <InfoRow label="Zile inactivitate" value={`${draft.inactiveDays} zile`}/>
              <InfoRow label="Remindere" value={`${draft.reminderCount} · ${(draft.reminderChannels || []).join(', ') || 'canal necunoscut'}`}/>
            </div>
          </Card>

        </div>

        <div style={{display:'grid',gap:14,position:'sticky',top:16,alignSelf:'start'}}>
          <Card>
            <h2 style={{fontSize:16,margin:'0 0 10px',color:C.text}}>Etapa CRM</h2>
            <StageSelect value={draft.stage} disabled={saving} onChange={stage => patch({ stage })}/>
            {saving && <p style={{fontSize:11,color:C.hint,margin:'6px 0 0'}}>Se salveaza...</p>}
          </Card>

          <Card style={{background:C.softBlue}}>
            <h2 style={{fontSize:16,margin:'0 0 8px',color:C.text}}>Urmatoarea actiune</h2>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.5,margin:'0 0 12px'}}>
              {draft.sourceType === 'offer_no_response'
                ? 'Contacteaza cumparatorul si confirma daca oferta este inca relevanta.'
                : 'Contacteaza agentul/proprietarul si cere trimiterea ofertei pentru recomandarea AI aprobata.'}
            </p>
            <div style={{display:'grid',gap:8}}>
              <button onClick={() => patch({ stage:'contactat' })} disabled={saving} style={{border:0,borderRadius:8,background:C.blue,color:'#fff',padding:'9px 10px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Marcheaza contactat</button>
              <button onClick={() => patch({ stage:'pending_actiune' })} disabled={saving} style={{border:`0.5px solid ${C.amber}`,borderRadius:8,background:C.softAmber,color:C.amber,padding:'9px 10px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Pending actiune</button>
            </div>
          </Card>

          <Card>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:10}}>
              <h2 style={{fontSize:16,margin:0,color:C.text}}>Comentarii</h2>
              <span style={{fontSize:12,color:C.hint}}>{(draft.comments || []).length} note</span>
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Adauga un comentariu intern..." rows={4} style={{width:'100%',boxSizing:'border-box',border:`0.5px solid ${C.border}`,borderRadius:10,padding:12,background:C.input,color:C.text,fontSize:13,resize:'vertical'}}/>
            <button onClick={saveComment} disabled={saving || !comment.trim()} style={{marginTop:8,border:0,borderRadius:8,background:C.green,color:'#fff',padding:'8px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Salveaza comentariu</button>
            <div style={{marginTop:14,display:'grid',gap:8}}>
              {(draft.comments || []).filter(item => !item.type || item.type === 'comment').map((item, index) => (
                <div key={item.id || index} style={{background:C.softPanel,border:`0.5px solid ${C.border}`,borderRadius:10,padding:10}}>
                  <p style={{fontSize:13,color:C.text,margin:'0 0 4px',whiteSpace:'pre-wrap'}}>{item.text}</p>
                  <p style={{fontSize:11,color:C.hint,margin:0}}>{item.author || 'CRM'} · {safeDate(item.created_at, true)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 style={{fontSize:16,margin:'0 0 12px',color:C.text}}>Log modificari</h2>
            <ActivityLog log={draft.log}/>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, link = false }) {
  const content = link && value
    ? <a href={value} target="_blank" rel="noopener noreferrer" style={{color:C.blue,textDecoration:'none',overflowWrap:'anywhere'}}>{value}</a>
    : value || '—'
  return (
    <div style={{borderBottom:`0.5px solid ${C.border}`,padding:'8px 0'}}>
      <p style={{fontSize:11,color:C.hint,margin:'0 0 3px',textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</p>
      <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.45}}>{content}</p>
    </div>
  )
}
