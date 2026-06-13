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

function StageButtons({ value, onChange }) {
  return (
    <div style={{marginBottom:14}}>
      <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:7,textTransform:'uppercase',letterSpacing:'.04em'}}>Etapa cererii</span>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        {STAGES.map(([id, label]) => {
          const active = value === id
          const color = stageColor(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              style={{
                padding:'7px 10px',borderRadius:999,border:`0.5px solid ${active ? color : C.border}`,
                background:active ? color : C.input,color:active ? '#fff' : C.muted,fontSize:12,
                fontWeight:active ? 700 : 500,cursor:'pointer',whiteSpace:'nowrap',
                boxShadow:active ? `0 1px 5px ${color}33` : 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ServicesEditor({ services, onChange }) {
  const [adding, setAdding] = useState(false)
  const [selectedService, setSelectedService] = useState(STANDARD_SERVICES[0])

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
      <div style={{display:'grid',gridTemplateColumns:'1fr 58px 82px 88px 34px',gap:6,alignItems:'center',marginBottom:6}}>
        {['Serviciu','Nr','Pret','Subtotal',''].map(h => <span key={h} style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</span>)}
      </div>
      {services.map((service, index) => (
        <div key={service.id || index} style={{display:'grid',gridTemplateColumns:'1fr 58px 82px 88px 34px',gap:6,alignItems:'center',marginBottom:6}}>
          <input value={service.title || ''} onChange={e=>update(index,{title:e.target.value})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <input type="number" min="0" value={service.quantity || 0} onChange={e=>update(index,{quantity:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <input type="number" min="0" step="0.01" value={service.unit_price_eur || 0} onChange={e=>update(index,{unit_price_eur:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.input}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.text,textAlign:'right'}}>{euro(service.subtotal_eur)}</span>
          <button onClick={()=>remove(index)} style={{height:30,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.red,cursor:'pointer'}}>×</button>
        </div>
      ))}
      {adding ? (
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto auto',gap:8,alignItems:'center',marginTop:8}}>
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
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setDraft(row)
    setComment('')
    setError('')
    setNotice('')
  }, [row?.id])

  const servicesTotal = useMemo(() => (draft.services || []).reduce((sum, service) => sum + Number(service.subtotal_eur || 0), 0), [draft.services])
  const finalTotal = Number(draft.finalTotalEur || servicesTotal || 0)

  function patch(updates) {
    setDraft(current => ({ ...current, ...updates }))
  }

  async function save(extra = {}) {
    setSaving(true)
    setError('')
    setNotice('')
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
      setNotice('Salvat.')
      await onSaved()
    } catch (e) {
      setError(e.message || 'Nu am putut salva')
    } finally {
      setSaving(false)
    }
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
      await save()
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
      await onSaved()
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

  return (
    <div style={{display:'grid',gap:14}}>
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',marginBottom:14}}>
          <div>
            <h2 style={{fontSize:18,color:C.text,margin:'0 0 4px'}}>{draft.customer.name}</h2>
            <p style={{fontSize:12,color:C.muted,margin:'0 0 2px'}}>{draft.customer.email}{draft.customer.phone ? ` · ${draft.customer.phone}` : ''}</p>
            <p style={{fontSize:11,color:C.hint,margin:0}}>
              Cerere {safeDate(draft.createdAt)} · {draft.source === 'imported' ? `sursa: ${draft.sourceLabel || 'import email'}` : `email: ${draft.email.status}`}
            </p>
          </div>
          <span style={{fontSize:12,fontWeight:700,color:paymentColor(draft.paymentStatus),background:C.input,border:`0.5px solid ${paymentColor(draft.paymentStatus)}55`,borderRadius:99,padding:'4px 10px'}}>
            {PAYMENT_LABELS[draft.paymentStatus] || draft.paymentStatus}
          </span>
        </div>
        <Grid>
          <KPI label="Total estimat" curr={draft.estimatedTotalEur || servicesTotal} sub="din formular"/>
          <KPI label="Total final" curr={finalTotal} sub="pentru plata Stripe"/>
          <KPI label="Reminder" curr={draft.reminderCount || 0} sub={draft.reminderSentAt ? safeDate(draft.reminderSentAt) : 'netrimis'}/>
        </Grid>
        {draft.customerMessage && (
          <div style={{background:C.softPanel,border:`0.5px solid ${C.border}`,borderRadius:8,padding:'10px 12px',marginTop:8}}>
            <p style={{fontSize:11,fontWeight:600,color:C.hint,margin:'0 0 4px',textTransform:'uppercase'}}>Mesaj client</p>
            <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.55,whiteSpace:'pre-wrap'}}>{draft.customerMessage}</p>
          </div>
        )}
      </Card>

      <Card>
        <StageButtons value={draft.stage} onChange={stage=>patch({stage})}/>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:14}}>
          <TextInput label="Contactare" value={draft.contactStatus} onChange={contactStatus=>patch({contactStatus})} placeholder="ex: sunat, astept raspuns"/>
          <TextInput label="Owner intern" value={draft.owner} onChange={owner=>patch({owner})} placeholder="ex: Auras"/>
        </div>
        <ServicesEditor services={draft.services || []} onChange={services=>patch({services, finalTotalEur: services.reduce((sum,s)=>sum+Number(s.subtotal_eur||0),0)})}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 160px',gap:10,marginTop:14}}>
          <TextInput label="Observatii oferta finala" value={draft.finalNotes} onChange={finalNotes=>patch({finalNotes})} multiline/>
          <TextInput label="Total final EUR" type="number" value={String(finalTotal)} onChange={value=>patch({finalTotalEur:Number(value)})}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
          <button onClick={()=>save()} disabled={saving} style={{padding:'8px 13px',border:'none',borderRadius:8,background:saving?'#64748b':'#15803d',color:'#fff',fontSize:12,fontWeight:700,cursor:saving?'not-allowed':'pointer',boxShadow:'0 1px 5px rgba(21,128,61,.25)'}}>{saving?'Se salveaza...':'Salveaza cerere finala'}</button>
        </div>
      </Card>

      <Card>
        <div style={{display:'grid',gridTemplateColumns:'1fr 170px',gap:10,alignItems:'end'}}>
          <TextInput label="Link plata Stripe" value={draft.stripePaymentUrl} onChange={stripePaymentUrl=>patch({stripePaymentUrl})} placeholder="se genereaza automat"/>
          <button onClick={createPayment} disabled={busy==='payment' || finalTotal <= 0} style={{padding:'9px 12px',border:'none',borderRadius:8,background:C.green,color:'#fff',fontSize:12,fontWeight:700,cursor:busy==='payment'?'not-allowed':'pointer'}}>
            {busy==='payment'?'Se creeaza...':'Creeaza link Stripe'}
          </button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          {draft.stripePaymentUrl && <a href={draft.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{padding:'7px 10px',fontSize:12,borderRadius:7,border:`0.5px solid ${C.green}`,color:C.green,textDecoration:'none'}}>Deschide link plata</a>}
          <button onClick={onCheckPayments} style={{padding:'7px 10px',fontSize:12,borderRadius:7,border:`0.5px solid ${C.blue}`,background:C.softBlue,color:C.blue,cursor:'pointer'}}>Verifica plati</button>
          <button onClick={sendReminder} disabled={busy==='reminder' || !draft.stripePaymentUrl} style={{padding:'7px 10px',fontSize:12,borderRadius:7,border:`0.5px solid ${C.amber}`,background:C.softAmber,color:C.amber,cursor:busy==='reminder'?'not-allowed':'pointer'}}>
            {busy==='reminder'?'Se trimite...':'Reminder plata email'}
          </button>
        </div>
      </Card>

      <Card>
        <TextInput label="Comentariu nou" value={comment} onChange={setComment} multiline placeholder="Note despre discutie, follow-up, preferinte client..."/>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
          <button onClick={addComment} style={{padding:'7px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.blue,cursor:'pointer'}}>Adauga comentariu</button>
        </div>
        <div style={{marginTop:12}}>
          {(draft.comments || []).slice().reverse().map(item => (
            <div key={item.id} style={{borderTop:`0.5px solid ${C.border}`,padding:'10px 0'}}>
              <p style={{fontSize:11,color:C.hint,margin:'0 0 4px'}}>{item.author || 'Dashboard'} · {safeDate(item.created_at)}</p>
              <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{item.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {notice && <div style={{padding:'10px 12px',border:`0.5px solid ${C.green}`,borderRadius:8,background:C.softGreen,color:C.green,fontSize:13}}>{notice}</div>}
      {error && <div style={{padding:'10px 12px',border:`0.5px solid ${C.red}`,borderRadius:8,background:C.softRed,color:C.red,fontSize:13}}>{error}</div>}
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

      <Grid>
        <KPI label="Cereri concierge" curr={rows.length}/>
        <KPI label="Plati pending" curr={pendingPayment}/>
        <KPI label="Plati confirmate" curr={paid}/>
        <KPI label="Valoare pipeline" curr={fmtN(totalValue)} sub="EUR"/>
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
