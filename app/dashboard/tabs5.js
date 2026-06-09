'use client'
import { useEffect, useMemo, useState } from 'react'
import { C, fmtN, KPI, Sec, Grid, Card, BarChart, LineChart } from './components'

const SORTS = [
  { id:'created_desc', label:'Cele mai noi' },
  { id:'budget_desc', label:'Buget cumparare desc' },
  { id:'budget_asc', label:'Buget cumparare asc' },
  { id:'rent_budget_desc', label:'Buget chirie desc' },
  { id:'down_payment_desc', label:'Avans desc' },
  { id:'score_desc', label:'Scor cumparator desc' },
  { id:'score_asc', label:'Scor cumparator asc' },
  { id:'offers_desc', label:'Oferte desc' },
  { id:'rooms_desc', label:'Camere desc' },
]

const SCORE_BUCKET_ORDER = ['80-100', '60-79', '40-59', '20-39', '0-19', 'Fara scor']

function uniq(rows, field) {
  return Array.from(new Set(rows.map(row => row[field]).filter(value => value && value !== '—'))).sort((a, b) => String(a).localeCompare(String(b)))
}

function scoreBucketOptions(rows) {
  const values = new Set(rows.map(row => row.buyer_score_bucket || 'Fara scor'))
  return SCORE_BUCKET_ORDER.filter(bucket => values.has(bucket))
}

function countBy(rows, labelField, valueFn) {
  const counts = rows.reduce((acc, row) => {
    const key = valueFn(row) || '—'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  return Object.entries(counts).map(([label, count]) => ({ [labelField]: label, count })).sort((a, b) => b.count - a.count)
}

function countZones(rows) {
  const counts = {}
  rows.forEach(row => {
    const zones = row.location_zones?.length ? row.location_zones : [row.cartier || '—']
    zones.forEach(zone => {
      counts[zone] = (counts[zone] || 0) + 1
    })
  })
  return Object.entries(counts).map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count)
}

function budgetBucket(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Necunoscut'
  if (n < 75000) return '<75k'
  if (n < 100000) return '75k-100k'
  if (n < 150000) return '100k-150k'
  if (n < 200000) return '150k-200k'
  if (n < 300000) return '200k-300k'
  return '300k+'
}

function median(values) {
  const clean = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b)
  if (!clean.length) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

function moneyWithCurrency(value, currency) {
  if (!Number.isFinite(value)) return '—'
  return `${fmtN(value)} ${currency || 'EUR'}`
}

function rangeLabel(min, max, currency = '') {
  const suffix = currency || ''
  if (Number.isFinite(min) && Number.isFinite(max)) return `${fmtN(min)}-${fmtN(max)}${suffix ? ' ' + suffix : ''}`
  if (Number.isFinite(max)) return `max ${fmtN(max)}${suffix ? ' ' + suffix : ''}`
  if (Number.isFinite(min)) return `min ${fmtN(min)}${suffix ? ' ' + suffix : ''}`
  return '—'
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label style={{display:'block'}}>
      <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:'100%',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}>
        <option value="">Toate</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function MultiSelectFilter({ label, values, options, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = Array.isArray(values) ? values : []
  const labelText = selected.length === 0 ? 'Toate' : selected.length === 1 ? selected[0] : `${selected.length} selectate`

  function toggle(option) {
    if (selected.includes(option)) {
      onChange(selected.filter(value => value !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div style={{display:'block',position:'relative'}}>
      <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</span>
      <button type="button" onClick={()=>setOpen(value=>!value)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'7px 9px',border:`0.5px solid ${open ? C.blue : C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit',cursor:'pointer'}}>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{labelText}</span>
        <span style={{fontSize:10,color:C.hint,transform:open?'rotate(180deg)':'none',transition:'transform .15s'}}>{'\u25BE'}</span>
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 5px)',left:0,right:0,zIndex:50,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,.12)',padding:6,maxHeight:230,overflowY:'auto'}}>
          <button type="button" onClick={()=>onChange([])} style={{width:'100%',textAlign:'left',padding:'7px 8px',border:'none',borderRadius:6,background:selected.length ? '#F5F5F3' : '#EBF4FC',color:selected.length ? C.muted : C.blue,fontSize:12,fontFamily:'inherit',cursor:'pointer'}}>Toate</button>
          {options.map(option => (
            <label key={option} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',borderRadius:6,cursor:'pointer',fontSize:12,color:C.text}}>
              <input type="checkbox" checked={selected.includes(option)} onChange={()=>toggle(option)} style={{margin:0}}/>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={option}>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function TabCereriPiata({ days, customFrom, customTo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    transaction:'', property:[], city:[], financing:[], preApproval:[], buyerScore:[], status:'', offers:'', zone:'',
    minBudget:'', maxBudget:'', minRentBudget:'', maxRentBudget:'', sort:'created_desc',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ limit:'1000' })
        if (customFrom && customTo) {
          params.set('from', customFrom)
          params.set('to', customTo)
        } else {
          params.set('days', String(days || 90))
        }
        const res = await fetch(`/api/platform/requests?${params}`, { cache:'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Nu am putut incarca cererile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [days, customFrom, customTo])

  const rows = data?.rows || []
  const options = useMemo(() => ({
    transactions: uniq(rows, 'transaction_type'),
    properties: uniq(rows, 'property_type'),
    cities: uniq(rows, 'location_city'),
    financing: uniq(rows, 'financing'),
    preApprovals: uniq(rows, 'pre_approval'),
    buyerScores: scoreBucketOptions(rows),
    statuses: uniq(rows, 'status'),
  }), [rows])

  const filtered = useMemo(() => {
    const minBudget = filters.minBudget === '' ? null : Number(filters.minBudget)
    const maxBudget = filters.maxBudget === '' ? null : Number(filters.maxBudget)
    const minRentBudget = filters.minRentBudget === '' ? null : Number(filters.minRentBudget)
    const maxRentBudget = filters.maxRentBudget === '' ? null : Number(filters.maxRentBudget)
    const zone = filters.zone.trim().toLowerCase()
    const result = rows.filter(row => {
      if (filters.transaction && row.transaction_type !== filters.transaction) return false
      if (filters.property.length && !filters.property.includes(row.property_type)) return false
      if (filters.city.length && !filters.city.includes(row.location_city)) return false
      if (filters.financing.length && !filters.financing.includes(row.financing)) return false
      if (filters.preApproval.length && !filters.preApproval.includes(row.pre_approval)) return false
      if (filters.buyerScore.length && !filters.buyerScore.includes(row.buyer_score_bucket)) return false
      if (filters.status && row.status !== filters.status) return false
      if (filters.offers === 'with' && !row.has_offers) return false
      if (filters.offers === 'without' && row.has_offers) return false
      if (zone) {
        const zoneText = [...(row.location_zones || []), row.cartier || ''].join(' ').toLowerCase()
        if (!zoneText.includes(zone)) return false
      }
      if (Number.isFinite(minBudget) && Number(row.budget_max || 0) < minBudget) return false
      if (Number.isFinite(maxBudget) && Number(row.budget_min || row.budget_max || 0) > maxBudget) return false
      if (Number.isFinite(minRentBudget) && Number(row.rent_budget_max || 0) < minRentBudget) return false
      if (Number.isFinite(maxRentBudget) && Number(row.rent_budget_min || row.rent_budget_max || 0) > maxRentBudget) return false
      return true
    })

    return [...result].sort((a, b) => {
      if (filters.sort === 'budget_desc') return Number(b.budget_max || 0) - Number(a.budget_max || 0)
      if (filters.sort === 'budget_asc') return Number(a.budget_max || Infinity) - Number(b.budget_max || Infinity)
      if (filters.sort === 'rent_budget_desc') return Number(b.rent_budget_max || 0) - Number(a.rent_budget_max || 0)
      if (filters.sort === 'down_payment_desc') return Number(b.down_payment || 0) - Number(a.down_payment || 0)
      if (filters.sort === 'score_desc') return (Number.isFinite(b.buyer_score) ? b.buyer_score : -1) - (Number.isFinite(a.buyer_score) ? a.buyer_score : -1)
      if (filters.sort === 'score_asc') return (Number.isFinite(a.buyer_score) ? a.buyer_score : 101) - (Number.isFinite(b.buyer_score) ? b.buyer_score : 101)
      if (filters.sort === 'offers_desc') return Number(b.offers_count || 0) - Number(a.offers_count || 0)
      if (filters.sort === 'rooms_desc') return Number(b.rooms_max || b.rooms_min || 0) - Number(a.rooms_max || a.rooms_min || 0)
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
  }, [rows, filters])

  const charts = useMemo(() => {
    const budgetValues = filtered.map(row => row.budget_max).filter(value => Number.isFinite(value))
    const rentBudgetValues = filtered.map(row => row.rent_budget_max).filter(value => Number.isFinite(value))
    const downPaymentValues = filtered.map(row => row.down_payment).filter(value => Number.isFinite(value))
    const downPaymentRatioValues = filtered.map(row => row.down_payment_ratio).filter(value => Number.isFinite(value))
    const buyerScoreValues = filtered.map(row => row.buyer_score).filter(value => Number.isFinite(value))
    const withOffers = filtered.filter(row => Number(row.offers_count || 0) > 0)
    const totalOffers = filtered.reduce((sum, row) => sum + Number(row.offers_count || 0), 0)
    const daily = countBy(filtered, 'date', row => row.date).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const budget = countBy(filtered, 'label', row => budgetBucket(row.budget_max))
    const rentBudget = countBy(filtered, 'label', row => budgetBucket(row.rent_budget_max))
    const creditShare = filtered.length ? filtered.filter(row => /credit|ipotec|loan/i.test(row.financing || '')).length / filtered.length * 100 : 0
    return {
      daily,
      byTransaction: countBy(filtered, 'label', row => row.transaction_type),
      byProperty: countBy(filtered, 'label', row => row.property_type),
      byCity: countBy(filtered, 'label', row => row.location_city),
      byFinancing: countBy(filtered, 'label', row => row.financing),
      byPreApproval: countBy(filtered, 'label', row => row.pre_approval || '—'),
      byBuyerScore: countBy(filtered, 'label', row => row.buyer_score_bucket || 'Fara scor'),
      byOffers: countBy(filtered, 'label', row => {
        const count = Number(row.offers_count || 0)
        if (!count) return '0 oferte'
        return `${count} ${count === 1 ? 'oferta' : 'oferte'}`
      }),
      byCurrency: countBy(filtered, 'label', row => row.currency || '—'),
      byRentCurrency: countBy(filtered, 'label', row => row.rent_currency || '—'),
      byZone: countZones(filtered),
      byBudget: budget,
      byRentBudget: rentBudget,
      medianBudget: median(budgetValues),
      avgBudget: budgetValues.length ? budgetValues.reduce((s, v) => s + v, 0) / budgetValues.length : null,
      medianRentBudget: median(rentBudgetValues),
      avgRentBudget: rentBudgetValues.length ? rentBudgetValues.reduce((s, v) => s + v, 0) / rentBudgetValues.length : null,
      medianDownPayment: median(downPaymentValues),
      medianDownPaymentRatio: median(downPaymentRatioValues),
      medianBuyerScore: median(buyerScoreValues),
      avgBuyerScore: buyerScoreValues.length ? buyerScoreValues.reduce((s, v) => s + v, 0) / buyerScoreValues.length : null,
      buyerScoreCoverage: filtered.length ? buyerScoreValues.length / filtered.length * 100 : 0,
      creditShare,
      downPaymentCoverage: filtered.length ? filtered.filter(row => Number.isFinite(row.down_payment)).length / filtered.length * 100 : 0,
      withOffers: withOffers.length,
      offerRate: filtered.length ? withOffers.length / filtered.length * 100 : 0,
      totalOffers,
      avgOffersPerRequest: filtered.length ? totalOffers / filtered.length : 0,
    }
  }, [filtered])

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function resetFilters() {
    setFilters({ transaction:'', property:[], city:[], financing:[], preApproval:[], buyerScore:[], status:'', offers:'', zone:'', minBudget:'', maxBudget:'', minRentBudget:'', maxRentBudget:'', sort:'created_desc' })
  }

  if (loading) return <div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontSize:14}}>Se incarca cererile...</div>
  if (error) return <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:10,padding:'14px 16px',color:C.red,fontSize:13}}>Eroare: {error}</div>

  return (
    <div>
      <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:10,alignItems:'end'}}>
          <SelectFilter label="Tranzactie" value={filters.transaction} options={options.transactions} onChange={v=>setFilter('transaction',v)}/>
          <MultiSelectFilter label="Proprietate" values={filters.property} options={options.properties} onChange={v=>setFilter('property',v)}/>
          <MultiSelectFilter label="Oras" values={filters.city} options={options.cities} onChange={v=>setFilter('city',v)}/>
          <MultiSelectFilter label="Finantare" values={filters.financing} options={options.financing} onChange={v=>setFilter('financing',v)}/>
          <MultiSelectFilter label="Pre-aprobare" values={filters.preApproval} options={options.preApprovals} onChange={v=>setFilter('preApproval',v)}/>
          <MultiSelectFilter label="Scor cumparator" values={filters.buyerScore} options={options.buyerScores} onChange={v=>setFilter('buyerScore',v)}/>
          <SelectFilter label="Status" value={filters.status} options={options.statuses} onChange={v=>setFilter('status',v)}/>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Oferte</span>
            <select value={filters.offers} onChange={e=>setFilter('offers',e.target.value)} style={{width:'100%',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}>
              <option value="">Toate</option>
              <option value="with">Cu oferte</option>
              <option value="without">Fara oferte</option>
            </select>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Cartier / zona</span>
            <input value={filters.zone} onChange={e=>setFilter('zone',e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}/>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Buget min</span>
            <input type="number" value={filters.minBudget} onChange={e=>setFilter('minBudget',e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}/>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Buget max</span>
            <input type="number" value={filters.maxBudget} onChange={e=>setFilter('maxBudget',e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}/>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Chirie min</span>
            <input type="number" value={filters.minRentBudget} onChange={e=>setFilter('minRentBudget',e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}/>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Chirie max</span>
            <input type="number" value={filters.maxRentBudget} onChange={e=>setFilter('maxRentBudget',e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}/>
          </label>
          <label style={{display:'block'}}>
            <span style={{display:'block',fontSize:10,color:C.hint,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>Sortare</span>
            <select value={filters.sort} onChange={e=>setFilter('sort',e.target.value)} style={{width:'100%',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.card,fontFamily:'inherit'}}>
              {SORTS.map(sort => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
            </select>
          </label>
          <button onClick={resetFilters} style={{padding:'8px 10px',fontSize:12,border:`0.5px solid ${C.border}`,borderRadius:7,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>Reset</button>
        </div>
      </div>

      <Grid>
        <KPI label="Cereri filtrate" curr={filtered.length} sub={`${rows.length} in perioada`}/>
        <KPI label="Cereri cu oferte" curr={charts.withOffers} sub={`${charts.offerRate.toFixed(1)}% din filtru`}/>
        <KPI label="Oferte totale" curr={charts.totalOffers} sub={`${charts.avgOffersPerRequest.toFixed(2)}/cerere`}/>
        <KPI label="Scor cumparator median" curr={charts.medianBuyerScore || 0} sub={`${charts.buyerScoreCoverage.toFixed(0)}% au scor`}/>
        <KPI label="Buget cumparare median" curr={charts.medianBudget || 0} sub="EUR"/>
        <KPI label="Buget chirie median" curr={charts.medianRentBudget || 0} sub="EUR/luna"/>
        <KPI label="Avans median" curr={charts.medianDownPayment || 0} sub={charts.medianDownPaymentRatio ? `${charts.medianDownPaymentRatio.toFixed(1)}% din buget` : 'date rare'}/>
        <KPI label="Pondere credit" curr={charts.creditShare} type="pctN" sub={`${charts.downPaymentCoverage.toFixed(0)}% au avans completat`}/>
      </Grid>

      <Sec title="Evolutie cereri">
        <Card>
          <LineChart data={charts.daily} metrics={[{field:'count',label:'Cereri',color:C.blue}]} height={190}/>
        </Card>
      </Sec>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginBottom:24}}>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Tranzactii</p>
          <BarChart data={charts.byTransaction} labelField="label" valueField="count" color={C.blue}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Tip proprietate</p>
          <BarChart data={charts.byProperty} labelField="label" valueField="count" color={C.green}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Finantare</p>
          <BarChart data={charts.byFinancing} labelField="label" valueField="count" color={C.amber}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Pre-aprobare credit</p>
          <BarChart data={charts.byPreApproval} labelField="label" valueField="count" color={C.blue}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Scor cumparator</p>
          <BarChart data={charts.byBuyerScore} labelField="label" valueField="count" color={C.purple}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Oferte primite</p>
          <BarChart data={charts.byOffers} labelField="label" valueField="count" color={C.green}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Buget cumparare max</p>
          <BarChart data={charts.byBudget} labelField="label" valueField="count" color={C.purple}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Buget chirie max</p>
          <BarChart data={charts.byRentBudget} labelField="label" valueField="count" color={C.green}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Valute buget</p>
          <BarChart data={charts.byCurrency} labelField="label" valueField="count" color={C.teal}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Valute chirie</p>
          <BarChart data={charts.byRentCurrency} labelField="label" valueField="count" color={C.gray}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Orase</p>
          <BarChart data={charts.byCity} labelField="label" valueField="count" color={C.teal}/>
        </Card>
        <Card>
          <p style={{fontSize:13,fontWeight:500,color:C.text,margin:'0 0 12px'}}>Zone / cartiere</p>
          <BarChart data={charts.byZone} labelField="zone" valueField="count" color={C.red} maxBars={10}/>
        </Card>
      </div>

      <Sec title={`Tabel cereri (${filtered.length})`}>
        <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:1320}}>
              <thead>
                <tr style={{borderBottom:`0.5px solid ${C.border}`,background:'#fafaf8'}}>
                  {['Data','Tranzactie','Tip','Oras','Zone','Buget cumparare','Buget chirie','Finantare','Pre-aprobare','Scor','Avans','Avans %','Camere','Oferte','Status'].map(header => (
                    <th key={header} style={{textAlign:'left',padding:'8px 10px',fontSize:10,color:C.hint,textTransform:'uppercase',letterSpacing:'.04em',fontWeight:600}}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => {
                  const zones = row.location_zones || []
                  const zoneLabel = zones.length > 2 ? `${zones.slice(0,2).join(', ')} +${zones.length - 2}` : zones.join(', ') || row.cartier || '—'
                  const offersCount = Number(row.offers_count || 0)
                  const hasBuyerScore = Number.isFinite(row.buyer_score)
                  return (
                    <tr key={`${row.created_at}-${index}`} style={{borderBottom:`0.5px solid ${C.border}`}}>
                      <td style={{padding:'8px 10px',color:C.muted,whiteSpace:'nowrap'}}>{row.date || '—'}</td>
                      <td style={{padding:'8px 10px',color:C.text}}>{row.transaction_type}</td>
                      <td style={{padding:'8px 10px',color:C.text}}>{row.property_type}</td>
                      <td style={{padding:'8px 10px',color:C.text}}>{row.location_city}</td>
                      <td style={{padding:'8px 10px',color:C.muted,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={zones.join(', ')}>{zoneLabel}</td>
                      <td style={{padding:'8px 10px',color:C.text,whiteSpace:'nowrap'}}>{rangeLabel(row.budget_min, row.budget_max, row.currency)}</td>
                      <td style={{padding:'8px 10px',color:C.text,whiteSpace:'nowrap'}}>{rangeLabel(row.rent_budget_min, row.rent_budget_max, row.rent_currency)}</td>
                      <td style={{padding:'8px 10px',color:C.text}}>{row.financing}</td>
                      <td style={{padding:'8px 10px',color:C.muted}}>{row.pre_approval || '—'}</td>
                      <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>
                        <span style={{display:'inline-block',minWidth:34,textAlign:'center',padding:'2px 7px',borderRadius:6,fontSize:11,fontWeight:600,background:hasBuyerScore ? '#F5F3FF' : '#F5F5F3',color:hasBuyerScore ? C.purple : C.hint}}>
                          {hasBuyerScore ? Math.round(row.buyer_score) : '—'}
                        </span>
                      </td>
                      <td style={{padding:'8px 10px',color:C.muted,whiteSpace:'nowrap'}}>{moneyWithCurrency(row.down_payment, row.down_payment_currency || row.currency)}</td>
                      <td style={{padding:'8px 10px',color:C.muted,whiteSpace:'nowrap'}}>{Number.isFinite(row.down_payment_ratio) ? row.down_payment_ratio.toFixed(1) + '%' : '—'}</td>
                      <td style={{padding:'8px 10px',color:C.muted,whiteSpace:'nowrap'}}>{rangeLabel(row.rooms_min, row.rooms_max)}</td>
                      <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>
                        <span style={{display:'inline-block',minWidth:28,textAlign:'center',padding:'2px 7px',borderRadius:6,fontSize:11,fontWeight:600,background:offersCount > 0 ? '#ECFDF5' : '#F5F5F3',color:offersCount > 0 ? C.green : C.hint}}>
                          {offersCount}
                        </span>
                      </td>
                      <td style={{padding:'8px 10px',color:C.muted}}>{row.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Sec>
    </div>
  )
}

export { TabCereriPiata }
