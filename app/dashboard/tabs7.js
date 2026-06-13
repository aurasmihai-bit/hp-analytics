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

function euro(value) {
  const n = Number(value || 0)
  return `${n.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} EUR`
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

function RowButton({ row, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:'100%',textAlign:'left',border:`0.5px solid ${selected?C.blue:C.border}`,borderRadius:10,
      background:selected?'#EBF4FC':C.card,padding:'12px 13px',cursor:'pointer',marginBottom:8,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
        <div style={{minWidth:0}}>
          <p style={{fontSize:13,fontWeight:600,color:C.text,margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.customer.name}</p>
          <p style={{fontSize:11,color:C.hint,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.customer.email}</p>
        </div>
        <span style={{fontSize:10,fontWeight:600,color:stageColor(row.stage),background:'#fff',border:`0.5px solid ${stageColor(row.stage)}33`,borderRadius:99,padding:'2px 7px',whiteSpace:'nowrap'}}>
          {STAGES.find(([id])=>id===row.stage)?.[1] || row.stage}
        </span>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:9}}>
        <span style={{fontSize:11,color:C.muted}}>{safeDate(row.createdAt)}</span>
        <span style={{fontSize:11,fontWeight:600,color:paymentColor(row.paymentStatus)}}>{PAYMENT_LABELS[row.paymentStatus] || row.paymentStatus}</span>
      </div>
    </button>
  )
}

function TextInput({ label, value, onChange, type = 'text', multiline = false, placeholder = '' }) {
  const common = {
    value: value || '',
    onChange: e => onChange(e.target.value),
    placeholder,
    style: {
      width:'100%',boxSizing:'border-box',padding:'8px 10px',border:`0.5px solid ${C.border}`,
      borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit',
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
      <select value={value || ''} onChange={e=>onChange(e.target.value)} style={{width:'100%',padding:'8px 10px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}>
        {options.map(([id,label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
  )
}

function ServicesEditor({ services, onChange }) {
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
    onChange([...services, { id:`custom-${Date.now()}`, title:'Serviciu nou', quantity:1, unit_price_eur:0, subtotal_eur:0 }])
  }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 58px 82px 88px 34px',gap:6,alignItems:'center',marginBottom:6}}>
        {['Serviciu','Nr','Pret','Subtotal',''].map(h => <span key={h} style={{fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</span>)}
      </div>
      {services.map((service, index) => (
        <div key={service.id || index} style={{display:'grid',gridTemplateColumns:'1fr 58px 82px 88px 34px',gap:6,alignItems:'center',marginBottom:6}}>
          <input value={service.title || ''} onChange={e=>update(index,{title:e.target.value})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12}}/>
          <input type="number" min="0" value={service.quantity || 0} onChange={e=>update(index,{quantity:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12}}/>
          <input type="number" min="0" step="0.01" value={service.unit_price_eur || 0} onChange={e=>update(index,{unit_price_eur:Number(e.target.value)})} style={{padding:'7px 8px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.text,textAlign:'right'}}>{euro(service.subtotal_eur)}</span>
          <button onClick={()=>remove(index)} style={{height:30,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.red,cursor:'pointer'}}>×</button>
        </div>
      ))}
      <button onClick={add} style={{marginTop:4,padding:'7px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.blue,cursor:'pointer'}}>+ Adauga serviciu</button>
    </div>
  )
}

function DetailsPanel({ row, onSaved, onCheckPayments }) {
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
            <p style={{fontSize:11,color:C.hint,margin:0}}>Cerere {safeDate(draft.createdAt)} · email: {draft.email.status}</p>
          </div>
          <span style={{fontSize:12,fontWeight:700,color:paymentColor(draft.paymentStatus),background:'#fff',border:`0.5px solid ${paymentColor(draft.paymentStatus)}55`,borderRadius:99,padding:'4px 10px'}}>
            {PAYMENT_LABELS[draft.paymentStatus] || draft.paymentStatus}
          </span>
        </div>
        <Grid>
          <KPI label="Total estimat" curr={draft.estimatedTotalEur || servicesTotal} sub="din formular"/>
          <KPI label="Total final" curr={finalTotal} sub="pentru plata Stripe"/>
          <KPI label="Reminder" curr={draft.reminderCount || 0} sub={draft.reminderSentAt ? safeDate(draft.reminderSentAt) : 'netrimis'}/>
        </Grid>
        {draft.customerMessage && (
          <div style={{background:'#F5F5F3',border:`0.5px solid ${C.border}`,borderRadius:8,padding:'10px 12px',marginTop:8}}>
            <p style={{fontSize:11,fontWeight:600,color:C.hint,margin:'0 0 4px',textTransform:'uppercase'}}>Mesaj client</p>
            <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.55,whiteSpace:'pre-wrap'}}>{draft.customerMessage}</p>
          </div>
        )}
      </Card>

      <Card>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:14}}>
          <SelectInput label="Etapa" value={draft.stage} onChange={stage=>patch({stage})} options={STAGES}/>
          <TextInput label="Contactare" value={draft.contactStatus} onChange={contactStatus=>patch({contactStatus})} placeholder="ex: sunat, astept raspuns"/>
          <TextInput label="Owner intern" value={draft.owner} onChange={owner=>patch({owner})} placeholder="ex: Auras"/>
        </div>
        <ServicesEditor services={draft.services || []} onChange={services=>patch({services, finalTotalEur: services.reduce((sum,s)=>sum+Number(s.subtotal_eur||0),0)})}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 160px',gap:10,marginTop:14}}>
          <TextInput label="Observatii oferta finala" value={draft.finalNotes} onChange={finalNotes=>patch({finalNotes})} multiline/>
          <TextInput label="Total final EUR" type="number" value={String(finalTotal)} onChange={value=>patch({finalTotalEur:Number(value)})}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
          <button onClick={()=>save()} disabled={saving} style={{padding:'8px 13px',border:'none',borderRadius:8,background:C.navy,color:'#fff',fontSize:12,fontWeight:600,cursor:saving?'not-allowed':'pointer'}}>{saving?'Se salveaza...':'Salveaza cerere finala'}</button>
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
          <button onClick={onCheckPayments} style={{padding:'7px 10px',fontSize:12,borderRadius:7,border:`0.5px solid ${C.blue}`,background:'#EBF4FC',color:C.blue,cursor:'pointer'}}>Verifica plati</button>
          <button onClick={sendReminder} disabled={busy==='reminder' || !draft.stripePaymentUrl} style={{padding:'7px 10px',fontSize:12,borderRadius:7,border:`0.5px solid ${C.amber}`,background:'#FFF7ED',color:C.amber,cursor:busy==='reminder'?'not-allowed':'pointer'}}>
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

      {notice && <div style={{padding:'10px 12px',border:`0.5px solid #86EFAC`,borderRadius:8,background:'#F0FDF4',color:C.green,fontSize:13}}>{notice}</div>}
      {error && <div style={{padding:'10px 12px',border:`0.5px solid #FCA5A5`,borderRadius:8,background:'#FEF2F2',color:C.red,fontSize:13}}>{error}</div>}
    </div>
  )
}

export function TabConcierge() {
  const [rows, setRows] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupRequired, setSetupRequired] = useState({})
  const [stageFilter, setStageFilter] = useState('')
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
      setSelectedId(current => current || json.rows?.[0]?.id || '')
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (stageFilter && row.stage !== stageFilter) return false
      if (q) {
        const haystack = [row.customer.name, row.customer.email, row.customer.phone, row.rawMessage].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, stageFilter, query])

  const selected = rows.find(row => row.id === selectedId) || filtered[0] || rows[0]
  const paid = rows.filter(row => row.paymentStatus === 'paid').length
  const pendingPayment = rows.filter(row => row.paymentStatus === 'pending').length
  const totalValue = rows.reduce((sum, row) => sum + Number(row.finalTotalEur || 0), 0)

  if (loading) return <div style={{textAlign:'center',padding:'70px 0',color:C.muted,fontSize:14}}>Se incarca cererile concierge...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:16,flexWrap:'wrap'}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:600,color:C.text,margin:'0 0 4px'}}>Concierge CRM</h2>
          <p style={{fontSize:13,color:C.muted,margin:0}}>Cereri venite din /concierge, proces contactare, servicii, plata si follow-up dupa plata.</p>
        </div>
        <button onClick={checkPayments} disabled={checking} style={{padding:'8px 12px',fontSize:12,border:`0.5px solid ${C.blue}`,borderRadius:8,background:'#EBF4FC',color:C.blue,cursor:checking?'not-allowed':'pointer'}}>
          {checking?'Verific...':'Verifica platile Stripe'}
        </button>
      </div>

      {(setupRequired.crm || setupRequired.emailLog) && (
        <div style={{background:'#FFF7ED',border:'0.5px solid #FCD34D',borderRadius:10,padding:'12px 14px',marginBottom:14}}>
          <p style={{fontSize:13,fontWeight:600,color:C.amber,margin:'0 0 4px'}}>Setup Supabase pending</p>
          <p style={{fontSize:13,color:C.muted,margin:0}}>
            {setupRequired.crm ? 'Lipseste tabela hp_concierge_crm. ' : ''}
            {setupRequired.emailLog ? 'Lipseste auditul hp_concierge_email_log. ' : ''}
            Ruleaza `supabase/hp_concierge_crm.sql` cand ai acces la Lovable/Supabase si seteaza `PLATFORM_SUPABASE_SERVICE_KEY` in Vercel.
          </p>
        </div>
      )}

      {error && <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'12px 14px',marginBottom:14,color:C.red,fontSize:13}}>{error}</div>}

      <Grid>
        <KPI label="Cereri concierge" curr={rows.length}/>
        <KPI label="Plati pending" curr={pendingPayment}/>
        <KPI label="Plati confirmate" curr={paid}/>
        <KPI label="Valoare pipeline" curr={fmtN(totalValue)} sub="EUR"/>
      </Grid>

      <div style={{display:'grid',gridTemplateColumns:'280px minmax(0,1fr)',gap:14,alignItems:'start'}}>
        <div>
          <Card style={{padding:'12px'}}>
            <div style={{display:'grid',gap:8,marginBottom:10}}>
              <TextInput label="Cauta" value={query} onChange={setQuery} placeholder="nume, email, telefon"/>
              <SelectInput label="Etapa" value={stageFilter} onChange={setStageFilter} options={[['','Toate'], ...STAGES]}/>
            </div>
            <p style={{fontSize:11,color:C.hint,margin:'0 0 8px'}}>{filtered.length} din {rows.length} cereri</p>
            <div style={{maxHeight:680,overflowY:'auto',paddingRight:2}}>
              {filtered.map(row => (
                <RowButton key={row.id} row={row} selected={selected?.id === row.id} onClick={()=>setSelectedId(row.id)}/>
              ))}
              {!filtered.length && <p style={{fontSize:13,color:C.hint,textAlign:'center',padding:'24px 0'}}>Nu exista cereri pentru filtrele curente.</p>}
            </div>
          </Card>
        </div>
        <div>
          {selected ? <DetailsPanel row={selected} onSaved={load} onCheckPayments={checkPayments}/> : (
            <Card><p style={{fontSize:13,color:C.muted,margin:0}}>Selecteaza o cerere concierge.</p></Card>
          )}
        </div>
      </div>
    </div>
  )
}
