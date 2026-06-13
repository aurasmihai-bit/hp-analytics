'use client'
import { useEffect, useMemo, useState } from 'react'
import { C, KPI, Sec, Grid, Card, fmtN } from './components'

const STAGES = [
  ['nou', 'Nou'],
  ['contactare', 'Contactare'],
  ['consultanta', 'Consultanta'],
  ['oferta_finala', 'Oferta finala'],
  ['plata_trimis', 'Plata trimisa'],
  ['platit', 'Platit'],
  ['livrare', 'Livrare'],
  ['inchis', 'Inchis'],
  ['pierdut', 'Pierdut'],
]

const PAYMENT_LABELS = {
  not_created: 'Fara link',
  pending: 'In asteptare',
  paid: 'Platita',
  expired: 'Expirata',
  cancelled: 'Anulata',
  failed: 'Eroare',
}

const PAYMENT_OPTIONS = [
  ['not_created', PAYMENT_LABELS.not_created],
  ['pending', PAYMENT_LABELS.pending],
  ['paid', PAYMENT_LABELS.paid],
  ['expired', PAYMENT_LABELS.expired],
  ['cancelled', PAYMENT_LABELS.cancelled],
  ['failed', PAYMENT_LABELS.failed],
]

const SOURCE_OPTIONS = [
  ['platform', 'HomePitch live'],
  ['imported', 'Import email'],
]

const SORT_OPTIONS = [
  ['newest', 'Cele mai noi'],
  ['oldest', 'Cele mai vechi'],
  ['updated', 'Actualizate recent'],
  ['value_desc', 'Valoare descrescator'],
  ['value_asc', 'Valoare crescator'],
  ['payment_pending', 'Plati pending primele'],
]

const STANDARD_SERVICES = [
  'Vizionare delegata',
  'Analiza oferta primita',
  'Comparare proprietati',
  'Verificare acte',
  'Strategie de ofertare',
  'Discutie cu expert, 30 min',
  'Serviciu extra',
]

function euro(value) {
  const n = Number(value || 0)
  return `${n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} EUR`
}

function rowTotal(row) {
  return Number(row?.finalTotalEur || row?.estimatedTotalEur || 0)
}

function timestamp(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function safeDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
}

function stageColor(stage) {
  if (stage === 'platit' || stage === 'inchis') return C.green
  if (stage === 'plata_trimis' || stage === 'oferta_finala') return C.blue
  if (stage === 'pierdut') return C.red
  if (stage === 'contactare' || stage === 'consultanta') return C.amber
  return C.gray
}

function paymentColor(status) {
  if (status === 'paid') return C.green
  if (status === 'pending') return C.amber
  if (status === 'expired' || status === 'failed' || status === 'cancelled') return C.red
  return C.gray
}

function serviceSummary(row) {
  const titles = (row.services || []).map(service => service.title).filter(Boolean)
  if (!titles.length) return 'Fara servicii selectate'
  if (titles.length <= 2) return titles.join(', ')
  return `${titles.slice(0, 2).join(', ')} +${titles.length - 2}`
}

function sourceLabel(row) {
  return row.source === 'imported' ? (row.sourceLabel || 'import email') : 'HomePitch live'
}

function RowButton({ row }) {
  return (
    <a href={`/dashboard/concierge/${encodeURIComponent(row.id)}`} style={{
      display:'grid',gridTemplateColumns:'minmax(190px,1.4fr) minmax(180px,1.3fr) 112px 112px 96px 88px',
      gap:12,alignItems:'center',width:'100%',boxSizing:'border-box',border:`0.5px solid ${C.border}`,
      borderRadius:10,background:C.card,padding:'12px 13px',textDecoration:'none',marginBottom:8,
      boxShadow:'0 1px 8px rgba(15,23,42,.04)',
    }}>
      <div style={{minWidth:0}}>
        <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.customer.name}</p>
        <p style={{fontSize:11,color:C.hint,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.customer.email}{row.customer.phone ? ` · ${row.customer.phone}` : ''}</p>
        <p style={{fontSize:10,color:C.hint,margin:'3px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sourceLabel(row)}{row.owner ? ` · owner: ${row.owner}` : ''}</p>
      </div>
      <p style={{fontSize:12,color:C.muted,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{serviceSummary(row)}</p>
      <span style={{fontSize:11,fontWeight:600,color:stageColor(row.stage),background:C.input,border:`0.5px solid ${stageColor(row.stage)}55`,borderRadius:99,padding:'4px 8px',whiteSpace:'nowrap',textAlign:'center'}}>
          {STAGES.find(([id])=>id===row.stage)?.[1] || row.stage}
      </span>
      <span style={{fontSize:11,fontWeight:600,color:paymentColor(row.paymentStatus),textAlign:'center'}}>{PAYMENT_LABELS[row.paymentStatus] || row.paymentStatus}</span>
      <span style={{fontSize:12,fontWeight:700,color:C.text,textAlign:'right'}}>{euro(rowTotal(row))}</span>
      <span style={{fontSize:11,color:C.muted,textAlign:'right'}}>{safeDate(row.createdAt)}</span>
    </a>
  )
}

function TextInput({ label, value, onChange, type = 'text', multiline = false, placeholder = '' }) {
  const common = {
    value: value || '',
    onChange: e => onChange(e.target.value),
    placeholder,
    style: {
      width:'100%',boxSizing:'border-box',padding:'8px 10px',border:`0.5px solid ${C.border}`,
      borderRadius:7,fontSize:12,color:C.text,background:C.input,fontFamily:'inherit',
    },
  }
  return (
    <label style={{display:'block'}}>
      <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
      {multiline ? <textarea {...common} rows={4}/> : <input {...common} type={type}/>}
    </label>
  )
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label style={{display:'block'}}>
      <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
      <select value={value || ''} onChange={e=>onChange(e.target.value)} style={{width:'100%',padding:'8px 10px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input,fontFamily:'inherit'}}>
        {options.map(([id,label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
  )
}

function StageButtons({ value, onChange, savingStage = '' }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:7}}>
        <span style={{display:'block',fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>Pipeline concierge</span>
        {savingStage && <span style={{fontSize:11,color:C.amber}}>Se salveaza etapa...</span>}
      </div>
      <div style={{overflowX:'auto',border:`0.5px solid ${C.border}`,borderRadius:10,background:C.softPanel}}>
        <div style={{display:'grid',gridTemplateColumns:`repeat(${STAGES.length}, minmax(112px,1fr))`,minWidth:940}}>
          {STAGES.map(([id, label], index) => {
            const active = value === id
            const color = stageColor(id)
            const saving = savingStage === id
            return (
              <button
                key={id}
                type="button"
                disabled={saving}
                onClick={() => !active && onChange(id)}
                style={{
                  minHeight:54,padding:'8px 9px',border:'none',borderRight:index < STAGES.length - 1 ? `0.5px solid ${C.border}` : 'none',
                  background:active ? color : C.input,color:active ? '#fff' : C.muted,fontSize:12,
                  fontWeight:active ? 800 : 600,cursor:active || saving ? 'default' : 'pointer',textAlign:'left',
                }}
              >
                <span style={{display:'block',fontSize:10,opacity:active ? .9 : .65,marginBottom:3}}>#{index + 1}</span>
                <span style={{display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{saving ? 'Se salveaza...' : label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title, description, right }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:12}}>
      <div>
        <h3 style={{fontSize:14,fontWeight:700,color:C.text,margin:'0 0 3px'}}>{title}</h3>
        {description && <p style={{fontSize:12,color:C.muted,margin:0,lineHeight:1.45}}>{description}</p>}
      </div>
      {right}
    </div>
  )
}

function StatusPill({ label, color, tone = 'soft' }) {
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:24,
      padding:'3px 9px',borderRadius:999,border:`0.5px solid ${color}55`,
      background:tone === 'solid' ? color : C.input,color:tone === 'solid' ? '#fff' : color,
      fontSize:11,fontWeight:700,whiteSpace:'nowrap',
    }}>
      {label}
    </span>
  )
}

function FieldRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',gap:12,padding:'8px 0',borderBottom:`0.5px solid ${C.border}`}}>
      <span style={{fontSize:11,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
      <span style={{fontSize:12,color:C.text,textAlign:'right',wordBreak:'break-word'}}>{value || '—'}</span>
    </div>
  )
}

function useWideLayout(minWidth = 1080) {
  const [wide, setWide] = useState(true)

  useEffect(() => {
    function update() {
      setWide(window.innerWidth >= minWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [minWidth])

  return wide
}

function getNextAction(draft, finalTotal) {
  if (!draft.owner) {
    return {
      title: 'Atribuie un owner',
      body: 'Seteaza persoana responsabila inainte de follow-up, ca sa fie clar cine continua cazul.',
      color: C.amber,
    }
  }
  if (!(draft.services || []).length) {
    return {
      title: 'Adauga serviciile discutate',
      body: 'Alege serviciile cerute si ajusteaza cantitatile sau preturile inainte de oferta finala.',
      color: C.blue,
    }
  }
  if (finalTotal <= 0) {
    return {
      title: 'Seteaza suma finala',
      body: 'Completeaza totalul final in EUR pentru a putea crea linkul Stripe.',
      color: C.amber,
    }
  }
  if (draft.paymentStatus === 'pending') {
    return {
      title: 'Urmeaza plata',
      body: 'Clientul are link de plata. Verifica statusul sau trimite reminder daca nu a platit.',
      color: C.amber,
    }
  }
  if (draft.paymentStatus === 'paid') {
    return {
      title: 'Continua livrarea',
      body: 'Plata este confirmata. Actualizeaza etapa spre livrare si noteaza urmatorul pas operational.',
      color: C.green,
    }
  }
  if (draft.stage === 'nou' || draft.stage === 'contactare') {
    return {
      title: 'Confirma cererea cu clientul',
      body: 'Contacteaza clientul, valideaza nevoia si transforma cererea intr-o oferta finala clara.',
      color: C.blue,
    }
  }
  return {
    title: 'Pregateste linkul de plata',
    body: 'Cand oferta finala este stabilita, genereaza linkul Stripe si trimite-l clientului.',
    color: C.green,
  }
}

function CaseSignals({ draft, finalTotal }) {
  const signals = []
  if (!draft.owner) signals.push(['Owner lipsa', C.amber])
  if (!(draft.services || []).length) signals.push(['Servicii lipsa', C.amber])
  if (finalTotal <= 0) signals.push(['Total lipsa', C.red])
  if (draft.paymentStatus === 'pending') signals.push(['Plata pending', C.amber])
  if (draft.paymentStatus === 'paid') signals.push(['Plata confirmata', C.green])
  if (!signals.length) signals.push(['Caz organizat', C.green])

  return (
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      {signals.map(([label, color]) => <StatusPill key={label} label={label} color={color}/>)}
    </div>
  )
}

function dateKey(value) {
  if (!value) return ''
  try {
    return new Date(value).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function buildDailySeries(rows, days = 30) {
  const maxTime = rows.reduce((max, row) => Math.max(max, timestamp(row.createdAt)), 0) || Date.now()
  const end = new Date(maxTime)
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  const map = new Map()
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    map.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), count: 0, value: 0 })
  }
  rows.forEach(row => {
    const key = dateKey(row.createdAt)
    if (!map.has(key)) return
    const item = map.get(key)
    item.count += 1
    item.value += rowTotal(row)
  })
  return Array.from(map.values())
}

function EvolutionChart({ data }) {
  const max = Math.max(1, ...data.map(item => item.count))
  const width = 640
  const height = 210
  const pad = { top: 16, right: 16, bottom: 34, left: 32 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const points = data.map((item, index) => {
    const x = pad.left + (data.length <= 1 ? 0 : index * innerW / (data.length - 1))
    const y = pad.top + innerH - (item.count / max) * innerH
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{width:'100%',overflowX:'auto'}}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{width:'100%',minWidth:520,display:'block'}}>
        <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke={C.border}/>
        {[0, 0.5, 1].map(tick => {
          const y = pad.top + innerH - tick * innerH
          return <line key={tick} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={C.border} opacity={tick ? .55 : 1}/>
        })}
        {data.map((item, index) => {
          const x = pad.left + (data.length <= 1 ? 0 : index * innerW / (data.length - 1))
          const barW = Math.max(5, innerW / data.length * .45)
          const barH = (item.count / max) * innerH
          return (
            <rect
              key={item.date}
              x={x - barW / 2}
              y={pad.top + innerH - barH}
              width={barW}
              height={barH}
              rx={3}
              fill={C.softBlue}
              stroke={C.blue}
              opacity={item.count ? 1 : .25}
            />
          )
        })}
        <polyline points={points} fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {data.map((item, index) => {
          if (index % Math.ceil(data.length / 6) !== 0 && index !== data.length - 1) return null
          const x = pad.left + (data.length <= 1 ? 0 : index * innerW / (data.length - 1))
          return <text key={`${item.date}-label`} x={x} y={height - 10} textAnchor="middle" fontSize="10" fill={C.hint}>{item.date.slice(5)}</text>
        })}
      </svg>
    </div>
  )
}

function HorizontalBars({ rows, color = C.blue }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  return (
    <div style={{display:'grid',gap:10}}>
      {rows.map(row => (
        <div key={row.label}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:4}}>
            <span style={{fontSize:12,color:C.text,fontWeight:600}}>{row.label}</span>
            <span style={{fontSize:12,color:C.muted}}>{row.value}</span>
          </div>
          <div style={{height:8,borderRadius:99,background:C.softPanel,overflow:'hidden',border:`0.5px solid ${C.border}`}}>
            <div style={{height:'100%',width:`${Math.max(3, row.value / max * 100)}%`,background:row.color || color,borderRadius:99}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportTable({ columns, rows, empty = 'Fara date' }) {
  if (!rows.length) {
    return <p style={{fontSize:13,color:C.hint,margin:0,padding:'8px 0'}}>{empty}</p>
  }

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',minWidth:420}}>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} style={{textAlign:column.align || 'left',fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.05em',fontWeight:700,padding:'0 8px 8px',borderBottom:`0.5px solid ${C.border}`}}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key || index}>
              {columns.map(column => (
                <td key={column.key} style={{textAlign:column.align || 'left',fontSize:12,color:C.text,padding:'10px 8px',borderBottom:`0.5px solid ${C.border}`,verticalAlign:'top'}}>
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConciergeReports({ rows }) {
  const total = rows.length
  const paid = rows.filter(row => row.paymentStatus === 'paid').length
  const pending = rows.filter(row => row.paymentStatus === 'pending').length
  const noOwner = rows.filter(row => !row.owner).length
  const noPaymentLink = rows.filter(row => !row.stripePaymentUrl && row.paymentStatus !== 'paid').length
  const totalValue = rows.reduce((sum, row) => sum + rowTotal(row), 0)
  const avgValue = total ? totalValue / total : 0
  const maxTime = rows.reduce((max, row) => Math.max(max, timestamp(row.createdAt)), 0) || Date.now()
  const sevenDaysAgo = maxTime - 7 * 24 * 60 * 60 * 1000
  const last7 = rows.filter(row => timestamp(row.createdAt) >= sevenDaysAgo).length
  const paidRate = total ? paid / total * 100 : 0
  const daily = buildDailySeries(rows, 30)
  const stageRows = STAGES.map(([id, label]) => ({
    label,
    value: rows.filter(row => row.stage === id).length,
    color: stageColor(id),
  })).filter(row => row.value > 0)
  const paymentRows = PAYMENT_OPTIONS.map(([id, label]) => ({
    label,
    value: rows.filter(row => row.paymentStatus === id).length,
    color: paymentColor(id),
  })).filter(row => row.value > 0)
  const serviceMap = new Map()
  rows.forEach(row => {
    ;(row.services || []).forEach(service => {
      const title = service.title || 'Serviciu fara nume'
      const current = serviceMap.get(title) || { key:title, title, quantity:0, value:0, requests:new Set(), clients:new Set() }
      current.quantity += Number(service.quantity || 0)
      current.value += Number(service.subtotal_eur || 0)
      current.requests.add(row.id)
      current.clients.add(row.customer?.email || row.customer?.phone || row.id)
      serviceMap.set(title, current)
    })
  })
  const topServices = Array.from(serviceMap.values())
    .map(item => ({ ...item, requestCount:item.requests.size, clientCount:item.clients.size }))
    .sort((a, b) => b.value - a.value || b.quantity - a.quantity)
    .slice(0, 8)
  const clientMap = new Map()
  rows.forEach(row => {
    const email = row.customer?.email || ''
    const key = email.toLowerCase() || row.customer?.phone || row.id
    const current = clientMap.get(key) || {
      key,
      name: row.customer?.name || 'Client fara nume',
      email,
      phone: row.customer?.phone || '',
      value: 0,
      requests: 0,
      services: 0,
      lastRequest: row.createdAt,
    }
    current.value += rowTotal(row)
    current.requests += 1
    current.services += (row.services || []).reduce((sum, service) => sum + Number(service.quantity || 0), 0)
    if (timestamp(row.createdAt) > timestamp(current.lastRequest)) current.lastRequest = row.createdAt
    clientMap.set(key, current)
  })
  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.value - a.value || timestamp(b.lastRequest) - timestamp(a.lastRequest))
    .slice(0, 8)

  return (
    <div style={{display:'grid',gap:14}}>
      <Grid>
        <KPI label="Cereri totale" curr={total}/>
        <KPI label="Ultimele 7 zile" curr={last7}/>
        <KPI label="Pipeline" curr={totalValue} sub="EUR"/>
        <KPI label="Valoare medie" curr={avgValue} sub="EUR / cerere"/>
        <KPI label="Plati pending" curr={pending}/>
        <KPI label="Rata platite" curr={paidRate} type="pctN"/>
      </Grid>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.4fr) minmax(260px,.8fr)',gap:14,alignItems:'start'}}>
        <Card>
          <SectionHeader title="Evolutie cereri concierge" description="Numar de cereri primite pe zi in ultimele 30 de zile disponibile."/>
          <EvolutionChart data={daily}/>
        </Card>
        <Card>
          <SectionHeader title="Semnale operationale" description="Zone care cer follow-up rapid."/>
          <div style={{display:'grid',gap:8}}>
            <StatusPill label={`${noOwner} fara owner`} color={noOwner ? C.amber : C.green}/>
            <StatusPill label={`${noPaymentLink} fara link de plata`} color={noPaymentLink ? C.amber : C.green}/>
            <StatusPill label={`${pending} plati pending`} color={pending ? C.amber : C.green}/>
          </div>
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14}}>
        <Card>
          <SectionHeader title="Distributie pe etape"/>
          <HorizontalBars rows={stageRows.length ? stageRows : [{ label:'Fara date', value:0 }]} color={C.blue}/>
        </Card>
        <Card>
          <SectionHeader title="Status plata"/>
          <HorizontalBars rows={paymentRows.length ? paymentRows : [{ label:'Fara date', value:0 }]} color={C.green}/>
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(360px,1fr))',gap:14}}>
        <Card>
          <SectionHeader title="Top servicii" description="Serviciile ordonate dupa valoarea totala din CRM."/>
          <ReportTable
            columns={[
              { key:'title', label:'Serviciu', render:row => <span style={{fontWeight:700}}>{row.title}</span> },
              { key:'quantity', label:'Cant.', align:'right' },
              { key:'value', label:'Valoare', align:'right', render:row => euro(row.value) },
              { key:'clientCount', label:'Clienti', align:'right' },
            ]}
            rows={topServices}
          />
        </Card>
        <Card>
          <SectionHeader title="Top clienti" description="Clientii ordonati dupa valoarea estimata/finala a cererilor."/>
          <ReportTable
            columns={[
              { key:'name', label:'Client', render:row => (
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:C.text,margin:'0 0 2px'}}>{row.name}</p>
                  <p style={{fontSize:11,color:C.hint,margin:0}}>{row.email || row.phone || 'fara contact'}</p>
                </div>
              ) },
              { key:'value', label:'Valoare', align:'right', render:row => euro(row.value) },
              { key:'requests', label:'Cereri', align:'right' },
              { key:'lastRequest', label:'Ultima', align:'right', render:row => safeDate(row.lastRequest) },
            ]}
            rows={topClients}
          />
        </Card>
      </div>
    </div>
  )
}

function ServicesEditor({ services, onChange }) {
  const [adding, setAdding] = useState(false)
  const [selectedService, setSelectedService] = useState(STANDARD_SERVICES[0])
  const wideLayout = useWideLayout(760)

  function update(index, patch) {
    const next = services.map((service, i) => i === index ? { ...service, ...patch } : service)
      .map(service => {
        const quantity = Number(service.quantity || 0)
        const unit = Number(service.unit_price_eur || 0)
        return { ...service, subtotal_eur: Number((quantity * unit).toFixed(2)) }
      })
    onChange(next)
  }
  function remove(index) {
    onChange(services.filter((_, i) => i !== index))
  }
  function add() {
    const title = selectedService === 'Serviciu extra' ? 'Serviciu extra' : selectedService
    onChange([...services, { id:`custom-${Date.now()}`, title, quantity:1, unit_price_eur:0, subtotal_eur:0 }])
    setSelectedService(STANDARD_SERVICES[0])
    setAdding(false)
  }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:wideLayout ? '1fr 58px 82px 88px 34px' : 'minmax(180px,1fr) 54px 74px 82px 32px',gap:6,alignItems:'center',marginBottom:6,overflowX:'auto'}}>
        {['Serviciu','Nr','Pret','Subtotal',''].map(h => <span key={h} style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</span>)}
      </div>
      {services.map((service, index) => (
        <div key={service.id || index} style={{display:'grid',gridTemplateColumns:wideLayout ? '1fr 58px 82px 88px 34px' : 'minmax(180px,1fr) 54px 74px 82px 32px',gap:6,alignItems:'center',marginBottom:6,overflowX:'auto'}}>
          <input value={service.title || ''} onChange={e=>update(index,{title:e.target.value})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <input type="number" min="0" value={service.quantity || 0} onChange={e=>update(index,{quantity:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <input type="number" min="0" step="0.01" value={service.unit_price_eur || 0} onChange={e=>update(index,{unit_price_eur:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.text,textAlign:'right'}}>{euro(service.subtotal_eur)}</span>
          <button onClick={()=>remove(index)} style={{height:30,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.red,cursor:'pointer'}}>×</button>
        </div>
      ))}
      {adding ? (
        <div style={{display:'grid',gridTemplateColumns:wideLayout ? 'minmax(0,1fr) auto auto' : 'minmax(0,1fr)',gap:8,alignItems:'center',marginTop:8}}>
          <select value={selectedService} onChange={e=>setSelectedService(e.target.value)} style={{width:'100%',padding:'8px 10px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input,fontFamily:'inherit'}}>
            {STANDARD_SERVICES.map(service => <option key={service} value={service}>{service}</option>)}
          </select>
          <button onClick={add} style={{padding:'8px 11px',fontSize:12,border:'none',borderRadius:7,background:'#15803d',color:'#fff',fontWeight:700,cursor:'pointer'}}>Adauga</button>
          <button onClick={()=>setAdding(false)} style={{padding:'8px 11px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.muted,cursor:'pointer'}}>Renunta</button>
        </div>
      ) : (
        <button onClick={()=>setAdding(true)} style={{marginTop:4,padding:'7px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.blue,cursor:'pointer'}}>+ Adauga serviciu</button>
      )}
    </div>
  )
}

export function DetailsPanel({ row, onSaved, onCheckPayments }) {
  const [draft, setDraft] = useState(row)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [stageSaving, setStageSaving] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const wideLayout = useWideLayout(1120)

  useEffect(() => {
    setDraft(row)
    setComment('')
    setStageSaving('')
    setError('')
    setNotice('')
  }, [row?.id])

  const servicesTotal = useMemo(() => (draft.services || []).reduce((sum, service) => sum + Number(service.subtotal_eur || 0), 0), [draft.services])
  const finalTotal = Number(draft.finalTotalEur || servicesTotal || 0)

  function patch(updates) {
    setDraft(current => ({ ...current, ...updates }))
  }

  async function save(extra = {}, options = {}) {
    const refresh = options.refresh !== false
    const showNotice = options.showNotice !== false
    setSaving(true)
    setError('')
    if (showNotice) setNotice('')
    try {
      const payload = {
        requestId: draft.requestId,
        stage: draft.stage,
        contactStatus: draft.contactStatus,
        owner: draft.owner,
        comments: draft.comments || [],
        services: draft.services || [],
        finalTotalEur: finalTotal,
        finalNotes: draft.finalNotes,
        stripePaymentUrl: draft.stripePaymentUrl,
        stripeSessionId: draft.stripeSessionId,
        paymentStatus: draft.paymentStatus,
        afterPaymentStatus: draft.afterPaymentStatus,
        ...extra,
      }
      const res = await fetch('/api/concierge', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      if (showNotice) setNotice(options.notice || 'Salvat.')
      if (refresh) await onSaved()
      return true
    } catch (e) {
      setError(e.message || 'Nu am putut salva')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function changeStage(stage) {
    if (!stage || stage === draft.stage || stageSaving) return
    const previousStage = draft.stage
    setStageSaving(stage)
    patch({ stage })
    const ok = await save({ stage }, { refresh:false, notice:'Etapa salvata.' })
    if (!ok) patch({ stage: previousStage })
    setStageSaving('')
  }

  function addComment() {
    const text = comment.trim()
    if (!text) return
    patch({
      comments: [
        ...(draft.comments || []),
        { id:`c-${Date.now()}`, text, author:'Dashboard', created_at:new Date().toISOString() },
      ],
    })
    setComment('')
  }

  async function createPayment() {
    setBusy('payment')
    setError('')
    setNotice('')
    try {
      const saved = await save({}, { refresh:false, showNotice:false })
      if (!saved) return
      const res = await fetch('/api/concierge/create-payment', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          requestId: draft.requestId,
          amountEur: finalTotal,
          services: draft.services,
          finalNotes: draft.finalNotes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      patch({ stripePaymentUrl: json.url, stripeSessionId: json.sessionId, paymentStatus:'pending', stage:'plata_trimis' })
      setNotice('Link Stripe creat.')
    } catch (e) {
      setError(e.message || 'Nu am putut crea linkul Stripe')
    } finally {
      setBusy('')
    }
  }

  async function sendReminder() {
    setBusy('reminder')
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/concierge/payment-reminder', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ requestId: draft.requestId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      setNotice('Reminder trimis.')
      await onSaved()
    } catch (e) {
      setError(e.message || 'Nu am putut trimite reminderul')
    } finally {
      setBusy('')
    }
  }

  const stageLabel = STAGES.find(([id]) => id === draft.stage)?.[1] || draft.stage
  const nextAction = getNextAction(draft, finalTotal)
  const primaryButton = {
    padding:'9px 12px',border:'none',borderRadius:8,background:'#15803d',color:'#fff',
    fontSize:12,fontWeight:700,cursor:'pointer',textDecoration:'none',textAlign:'center',
    boxShadow:'0 1px 5px rgba(21,128,61,.25)',
  }
  const secondaryButton = {
    padding:'8px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:8,
    background:C.input,color:C.text,cursor:'pointer',textDecoration:'none',textAlign:'center',
  }

  return (
    <div style={{display:'grid',gap:14}}>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',padding:'18px 20px',borderBottom:`0.5px solid ${C.border}`,flexWrap:'wrap'}}>
          <div style={{minWidth:260,flex:1}}>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:8}}>
              <StatusPill label={stageLabel} color={stageColor(draft.stage)} tone="solid"/>
              <StatusPill label={PAYMENT_LABELS[draft.paymentStatus] || draft.paymentStatus} color={paymentColor(draft.paymentStatus)}/>
              <StatusPill label={sourceLabel(draft)} color={C.gray}/>
            </div>
            <h2 style={{fontSize:20,color:C.text,margin:'0 0 5px',letterSpacing:0}}>{draft.customer.name}</h2>
            <p style={{fontSize:13,color:C.muted,margin:'0 0 9px'}}>{draft.customer.email}{draft.customer.phone ? ` · ${draft.customer.phone}` : ''}</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {draft.customer.email && <a href={`mailto:${draft.customer.email}`} style={secondaryButton}>Email client</a>}
              {draft.customer.phone && <a href={`tel:${draft.customer.phone}`} style={secondaryButton}>Suna client</a>}
              {draft.stripePaymentUrl && <a href={draft.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={secondaryButton}>Link plata</a>}
            </div>
          </div>
          <div style={{minWidth:260,display:'grid',gap:10,justifyItems:'end'}}>
            <CaseSignals draft={draft} finalTotal={finalTotal}/>
            <button onClick={()=>save()} disabled={saving} style={{...primaryButton,background:saving?'#64748b':'#15803d',cursor:saving?'not-allowed':'pointer'}}>
              {saving?'Se salveaza...':'Salveaza modificari'}
            </button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:0}}>
          {[
            ['Total estimat', euro(draft.estimatedTotalEur || servicesTotal), 'din formular'],
            ['Total final', euro(finalTotal), 'pentru plata Stripe'],
            ['Servicii', (draft.services || []).length, serviceSummary(draft)],
            ['Reminder', draft.reminderCount || 0, draft.reminderSentAt ? safeDate(draft.reminderSentAt) : 'netrimis'],
          ].map(([label, value, sub]) => (
            <div key={label} style={{padding:'13px 16px',borderRight:`0.5px solid ${C.border}`}}>
              <p style={{fontSize:10,color:C.hint,margin:'0 0 5px',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</p>
              <p style={{fontSize:18,fontWeight:700,color:C.text,margin:'0 0 3px'}}>{value}</p>
              <p style={{fontSize:11,color:C.hint,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {notice && <div style={{padding:'10px 12px',border:`0.5px solid ${C.green}`,borderRadius:8,background:C.softGreen,color:C.green,fontSize:13}}>{notice}</div>}
      {error && <div style={{padding:'10px 12px',border:`0.5px solid ${C.red}`,borderRadius:8,background:C.softRed,color:C.red,fontSize:13}}>{error}</div>}

      <div style={{
        display:'grid',
        gridTemplateColumns:wideLayout ? 'minmax(0,1fr) minmax(300px,340px)' : 'minmax(0,1fr)',
        gap:14,
        alignItems:'start',
        width:'100%',
        maxWidth:'100%',
        overflow:'visible',
      }}>
        <div style={{display:'grid',gap:14,minWidth:0}}>
          <Card>
            <SectionHeader
              title="Workflow"
              description="Schimba etapa direct din pipeline; clickul pe etapa face autosave automat."
            />
            <StageButtons value={draft.stage} onChange={changeStage} savingStage={stageSaving}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
              <TextInput label="Contactare" value={draft.contactStatus} onChange={contactStatus=>patch({contactStatus})} placeholder="ex: sunat, astept raspuns"/>
              <TextInput label="Owner intern" value={draft.owner} onChange={owner=>patch({owner})} placeholder="ex: Auras"/>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Servicii si oferta"
              description="Ajusteaza serviciile, cantitatile si suma finala inainte de trimiterea linkului de plata."
              right={<StatusPill label={euro(finalTotal)} color={C.green}/>}
            />
            <ServicesEditor services={draft.services || []} onChange={services=>patch({services, finalTotalEur: services.reduce((sum,s)=>sum+Number(s.subtotal_eur||0),0)})}/>
            <div style={{display:'grid',gridTemplateColumns:wideLayout ? 'minmax(0,1fr) 160px' : 'minmax(0,1fr)',gap:10,marginTop:14}}>
              <TextInput label="Observatii oferta finala" value={draft.finalNotes} onChange={finalNotes=>patch({finalNotes})} multiline/>
              <TextInput label="Total final EUR" type="number" value={String(finalTotal)} onChange={value=>patch({finalTotalEur:Number(value)})}/>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
              <button onClick={()=>save()} disabled={saving} style={{...primaryButton,background:saving?'#64748b':'#15803d',cursor:saving?'not-allowed':'pointer'}}>
                {saving?'Se salveaza...':'Salveaza cerere finala'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Brief client" description="Contextul original primit din formular sau din importul de email."/>
            {draft.customerMessage ? (
              <div style={{background:C.softPanel,border:`0.5px solid ${C.border}`,borderRadius:9,padding:'12px 14px'}}>
                <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{draft.customerMessage}</p>
              </div>
            ) : (
              <p style={{fontSize:13,color:C.hint,margin:0}}>Nu exista mesaj separat de la client.</p>
            )}
          </Card>

          <Card>
            <SectionHeader title="Timeline si comentarii" description="Pastreaza istoricul discutiilor si deciziilor interne."/>
            <TextInput label="Comentariu nou" value={comment} onChange={setComment} multiline placeholder="Note despre discutie, follow-up, preferinte client..."/>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
              <button onClick={addComment} style={{...secondaryButton,color:C.blue}}>Adauga comentariu</button>
            </div>
            <div style={{marginTop:12}}>
              {(draft.comments || []).length ? (draft.comments || []).slice().reverse().map(item => (
                <div key={item.id} style={{display:'grid',gridTemplateColumns:'10px minmax(0,1fr)',gap:10,borderTop:`0.5px solid ${C.border}`,padding:'12px 0'}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:C.blue,marginTop:5}}/>
                  <div>
                    <p style={{fontSize:11,color:C.hint,margin:'0 0 4px'}}>{item.author || 'Dashboard'} · {safeDate(item.created_at)}</p>
                    <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{item.text}</p>
                  </div>
                </div>
              )) : (
                <p style={{fontSize:13,color:C.hint,margin:'12px 0 0'}}>Nu exista comentarii interne inca.</p>
              )}
            </div>
          </Card>
        </div>

        <div style={{
          display:'grid',
          gap:14,
          position:wideLayout ? 'sticky' : 'static',
          top:wideLayout ? 68 : 'auto',
          width:'100%',
          maxWidth:'100%',
          minWidth:0,
        }}>
          <Card>
            <SectionHeader title="Actiune urmatoare"/>
            <div style={{border:`0.5px solid ${nextAction.color}66`,background:C.softPanel,borderRadius:10,padding:'12px 13px',marginBottom:12}}>
              <p style={{fontSize:13,fontWeight:700,color:nextAction.color,margin:'0 0 5px'}}>{nextAction.title}</p>
              <p style={{fontSize:12,color:C.muted,margin:0,lineHeight:1.5}}>{nextAction.body}</p>
            </div>
            <div style={{display:'grid',gap:8}}>
              <button onClick={createPayment} disabled={busy==='payment' || finalTotal <= 0} style={{...primaryButton,background:(busy==='payment' || finalTotal <= 0)?'#64748b':'#15803d',cursor:(busy==='payment' || finalTotal <= 0)?'not-allowed':'pointer'}}>
                {busy==='payment'?'Se creeaza...':'Creeaza link Stripe'}
              </button>
              {error && <div style={{padding:'9px 10px',border:`0.5px solid ${C.red}`,borderRadius:8,background:C.softRed,color:C.red,fontSize:12,lineHeight:1.4}}>{error}</div>}
              {notice && <div style={{padding:'9px 10px',border:`0.5px solid ${C.green}`,borderRadius:8,background:C.softGreen,color:C.green,fontSize:12,lineHeight:1.4}}>{notice}</div>}
              <button onClick={sendReminder} disabled={busy==='reminder' || !draft.stripePaymentUrl} style={{...secondaryButton,color:C.amber,border:`0.5px solid ${C.amber}`}}>
                {busy==='reminder'?'Se trimite...':'Reminder plata email'}
              </button>
              <button onClick={onCheckPayments} style={{...secondaryButton,color:C.blue,border:`0.5px solid ${C.blue}`,background:C.softBlue}}>Verifica plati</button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Plata" description="Linkul generat ramane independent de contul HomePitch."/>
            <TextInput label="Link plata Stripe" value={draft.stripePaymentUrl} onChange={stripePaymentUrl=>patch({stripePaymentUrl})} placeholder="se genereaza automat"/>
            {draft.stripePaymentUrl && (
              <a href={draft.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{...primaryButton,display:'block',marginTop:10}}>Deschide link plata</a>
            )}
            <FieldRow label="Status" value={PAYMENT_LABELS[draft.paymentStatus] || draft.paymentStatus}/>
            <FieldRow label="Sesiune Stripe" value={draft.stripeSessionId ? `${draft.stripeSessionId.slice(0, 18)}...` : '—'}/>
          </Card>

          <Card>
            <SectionHeader title="Date caz"/>
            <FieldRow label="Creat" value={safeDate(draft.createdAt)}/>
            <FieldRow label="Actualizat" value={safeDate(draft.updatedAt)}/>
            <FieldRow label="Sursa" value={sourceLabel(draft)}/>
            <FieldRow label="Email audit" value={draft.email?.status || '—'}/>
            <FieldRow label="ID cerere" value={draft.requestId ? `${String(draft.requestId).slice(0, 8)}...` : '—'}/>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function TabConcierge() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupRequired, setSetupRequired] = useState({})
  const [stageFilter, setStageFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minValue, setMinValue] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [crmView, setCrmView] = useState('cereri')
  const [query, setQuery] = useState('')
  const [checking, setChecking] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/concierge?limit=200', { cache:'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.rows || [])
      setSetupRequired(json.setupRequired || {})
    } catch (e) {
      setError(e.message || 'Nu am putut incarca concierge CRM')
    } finally {
      setLoading(false)
    }
  }

  async function checkPayments() {
    setChecking(true)
    setError('')
    try {
      const res = await fetch('/api/concierge/check-payments', { method:'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e.message || 'Nu am putut verifica platile')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { load() }, [])

  function resetFilters() {
    setQuery('')
    setStageFilter('')
    setPaymentFilter('')
    setSourceFilter('')
    setDateFrom('')
    setDateTo('')
    setMinValue('')
    setSortBy('newest')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : 0
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : 0
    const minTotal = Number(minValue)
    const result = rows.filter(row => {
      if (stageFilter && row.stage !== stageFilter) return false
      if (paymentFilter && row.paymentStatus !== paymentFilter) return false
      if (sourceFilter && row.source !== sourceFilter) return false
      const created = timestamp(row.createdAt)
      if (fromTime && created < fromTime) return false
      if (toTime && created > toTime) return false
      if (Number.isFinite(minTotal) && minTotal > 0 && rowTotal(row) < minTotal) return false
      if (q) {
        const stageLabel = STAGES.find(([id]) => id === row.stage)?.[1] || row.stage
        const haystack = [
          row.customer.name,
          row.customer.email,
          row.customer.phone,
          row.owner,
          row.contactStatus,
          stageLabel,
          PAYMENT_LABELS[row.paymentStatus],
          sourceLabel(row),
          serviceSummary(row),
          row.finalNotes,
          row.rawMessage,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    return result.sort((a, b) => {
      if (sortBy === 'oldest') return timestamp(a.createdAt) - timestamp(b.createdAt)
      if (sortBy === 'updated') return timestamp(b.updatedAt) - timestamp(a.updatedAt)
      if (sortBy === 'value_desc') return rowTotal(b) - rowTotal(a)
      if (sortBy === 'value_asc') return rowTotal(a) - rowTotal(b)
      if (sortBy === 'payment_pending') {
        const score = row => row.paymentStatus === 'pending' ? 0 : row.paymentStatus === 'not_created' ? 1 : 2
        return score(a) - score(b) || timestamp(b.createdAt) - timestamp(a.createdAt)
      }
      return timestamp(b.createdAt) - timestamp(a.createdAt)
    })
  }, [rows, stageFilter, paymentFilter, sourceFilter, dateFrom, dateTo, minValue, sortBy, query])

  const paid = rows.filter(row => row.paymentStatus === 'paid').length
  const pendingPayment = rows.filter(row => row.paymentStatus === 'pending').length
  const totalValue = rows.reduce((sum, row) => sum + Number(row.finalTotalEur || 0), 0)
  const filteredValue = filtered.reduce((sum, row) => sum + rowTotal(row), 0)
  const activeFilters = [
    query.trim(),
    stageFilter,
    paymentFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    minValue,
    sortBy !== 'newest' ? sortBy : '',
  ].filter(Boolean).length

  if (loading) return <div style={{textAlign:'center',padding:'70px 0',color:C.muted,fontSize:14}}>Se incarca cererile concierge...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:600,color:C.text,margin:'0 0 4px'}}>Concierge CRM</h2>
          <p style={{fontSize:13,color:C.muted,margin:0}}>Cereri venite din /concierge, proces contactare, servicii, plata si follow-up dupa plata.</p>
        </div>
        <button onClick={checkPayments} disabled={checking} style={{padding:'8px 12px',fontSize:12,border:`0.5px solid ${C.blue}`,borderRadius:8,background:C.softBlue,color:C.blue,cursor:checking?'not-allowed':'pointer'}}>
          {checking?'Verific...':'Verifica platile Stripe'}
        </button>
      </div>

      {(setupRequired.crm || setupRequired.emailLog || setupRequired.importedRequests) && (
        <div style={{background:C.softAmber,border:`0.5px solid ${C.amber}`,borderRadius:10,padding:'12px 14px',marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:600,color:C.amber,margin:'0 0 4px'}}>Setup Supabase pending</p>
          <p style={{fontSize:13,color:C.muted,margin:0}}>
            {setupRequired.crm ? 'Lipseste tabela hp_concierge_crm. ' : ''}
            {setupRequired.importedRequests ? 'Lipseste tabela hp_concierge_imported_requests. ' : ''}
            {setupRequired.emailLog ? 'Lipseste auditul hp_concierge_email_log. ' : ''}
            {setupRequired.crm || setupRequired.importedRequests ? 'Ruleaza `supabase/hp_concierge_crm.sql` in Supabase analytics. ' : ''}
            {setupRequired.emailLog ? 'Ruleaza migrarea hp_concierge_email_log in Supabase HomePitch. ' : ''}
          </p>
        </div>
      )}

      {error && <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'12px 14px',marginBottom:14,color:C.red,fontSize:13}}>{error}</div>}

      <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:`0.5px solid ${C.border}`}}>
        {[
          ['cereri', 'Cereri'],
          ['rapoarte', 'Rapoarte'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setCrmView(id)}
            style={{
              padding:'10px 13px',border:'none',borderBottom:`2px solid ${crmView === id ? C.blue : 'transparent'}`,
              background:'transparent',color:crmView === id ? C.blue : C.muted,fontSize:12,fontWeight:crmView === id ? 700 : 500,
              cursor:'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {crmView === 'rapoarte' ? (
        <ConciergeReports rows={rows}/>
      ) : (
        <>
          <Grid>
            <KPI label="Cereri concierge" curr={rows.length}/>
            <KPI label="Plati pending" curr={pendingPayment}/>
            <KPI label="Plati confirmate" curr={paid}/>
            <KPI label="Valoare pipeline" curr={totalValue} sub="EUR"/>
          </Grid>

          <Card style={{padding:'12px',marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
              <div style={{gridColumn:'span 2'}}>
              <TextInput label="Cauta" value={query} onChange={setQuery} placeholder="nume, email, telefon, serviciu"/>
              </div>
              <SelectInput label="Etapa" value={stageFilter} onChange={setStageFilter} options={[['','Toate'], ...STAGES]}/>
              <SelectInput label="Plata" value={paymentFilter} onChange={setPaymentFilter} options={[['','Toate'], ...PAYMENT_OPTIONS]}/>
              <SelectInput label="Sursa" value={sourceFilter} onChange={setSourceFilter} options={[['','Toate'], ...SOURCE_OPTIONS]}/>
              <SelectInput label="Sortare" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS}/>
              <TextInput label="De la" type="date" value={dateFrom} onChange={setDateFrom}/>
              <TextInput label="Pana la" type="date" value={dateTo} onChange={setDateTo}/>
              <TextInput label="Valoare min. EUR" type="number" value={minValue} onChange={setMinValue} placeholder="ex: 100"/>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:10,flexWrap:'wrap'}}>
              <p style={{fontSize:12,color:C.muted,margin:0}}>
                {filtered.length} din {rows.length} cereri · pipeline filtrat {fmtN(filteredValue)} EUR
              </p>
              <button onClick={resetFilters} disabled={!activeFilters} style={{padding:'7px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:activeFilters?C.blue:C.hint,cursor:activeFilters?'pointer':'not-allowed'}}>
                Reseteaza filtre
              </button>
            </div>
          </Card>

          <Card style={{padding:'12px'}}>
            <div style={{overflowX:'auto'}}>
              <div style={{minWidth:860}}>
                <div style={{
                  display:'grid',gridTemplateColumns:'minmax(190px,1.4fr) minmax(180px,1.3fr) 112px 112px 96px 88px',
                  gap:12,alignItems:'center',padding:'0 13px 9px',borderBottom:`0.5px solid ${C.border}`,marginBottom:8,
                }}>
                  {['Client','Servicii','Etapa','Plata','Total','Trimis la'].map(label => (
                    <span key={label} style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',textAlign:['Total','Trimis la'].includes(label)?'right':'left'}}>{label}</span>
                  ))}
                </div>
                <div>
                  {filtered.map(row => <RowButton key={row.id} row={row}/>)}
                  {!filtered.length && <p style={{fontSize:13,color:C.hint,textAlign:'center',padding:'24px 0'}}>Nu exista cereri pentru filtrele curente.</p>}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export function ConciergeDetail({ requestId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/concierge?limit=500', { cache:'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      setRows(json.rows || [])
    } catch (e) {
      setError(e.message || 'Nu am putut incarca cererea concierge')
    } finally {
      setLoading(false)
    }
  }

  async function checkPayments() {
    setChecking(true)
    setError('')
    try {
      const res = await fetch('/api/concierge/check-payments', { method:'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e.message || 'Nu am putut verifica platile')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { load() }, [requestId])

  const row = rows.find(item => String(item.id) === String(requestId))

  if (loading) return <div style={{textAlign:'center',padding:'70px 0',color:C.muted,fontSize:14}}>Se incarca cererea concierge...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <a href="/dashboard/concierge" style={{fontSize:12,color:C.blue,textDecoration:'none'}}>← Inapoi la cereri</a>
          <h2 style={{fontSize:18,fontWeight:600,color:C.text,margin:'8px 0 4px'}}>Detalii cerere concierge</h2>
          <p style={{fontSize:13,color:C.muted,margin:0}}>Editare servicii, comentarii, suma finala si link de plata.</p>
        </div>
        <button onClick={checkPayments} disabled={checking} style={{padding:'8px 12px',fontSize:12,border:`0.5px solid ${C.blue}`,borderRadius:8,background:C.softBlue,color:C.blue,cursor:checking?'not-allowed':'pointer'}}>
          {checking?'Verific...':'Verifica platile Stripe'}
        </button>
      </div>

      {error && <div style={{background:C.softRed,border:`0.5px solid ${C.red}`,borderRadius:10,padding:'12px 14px',marginBottom:14,color:C.red,fontSize:13}}>{error}</div>}
      {row ? <DetailsPanel row={row} onSaved={load} onCheckPayments={checkPayments}/> : (
        <Card>
          <p style={{fontSize:13,color:C.muted,margin:'0 0 10px'}}>Nu am gasit aceasta cerere concierge.</p>
          <a href="/dashboard/concierge" style={{fontSize:12,color:C.blue,textDecoration:'none'}}>Vezi lista de cereri</a>
        </Card>
      )}
    </div>
  )
}
