'use client'
import { useEffect, useState, useCallback } from 'react'
import { C, sum, dlt, fmtN, Delta, KPI, Signal, Action, Sec, Grid, Card, LineChart } from './components'

export function TabRaportSaptamanal({ data }) {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError]       = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/weekly')
      const j = await res.json()
      const sorted = (j.reports || []).sort((a,b) => b.week_start.localeCompare(a.week_start))
      setReports(sorted)
      if (sorted.length > 0 && !selected) setSelected(sorted[0].week_start)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadReports() }, [loadReports])

  async function generateReport(offsetWeeks = 0) {
    setSyncing(true)
    try {
      const res = await fetch('/api/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsetWeeks })
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      await loadReports()
    } catch(e) { setError(e.message) }
    finally { setSyncing(false) }
  }

  const current = reports.find(r => r.week_start === selected)
  const currentIdx = reports.findIndex(r => r.week_start === selected)
  const prevReport = currentIdx >= 0 ? reports[currentIdx + 1] : null

  if (loading) return <div style={{textAlign:'center',padding:'60px',color:C.hint,fontSize:13}}>Se incarca rapoartele saptamanale...</div>

  return (
    <div>
      {/* Header + generate buttons */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div style={{flex:1}}>
          <h3 style={{fontSize:14,fontWeight:600,color:C.navy,margin:'0 0 4px'}}>Rapoarte saptamanale — istoric</h3>
          <p style={{fontSize:12,color:C.hint,margin:0}}>
            {reports.length} rapoarte salvate · Generat automat in fiecare luni dimineata
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>generateReport(0)} disabled={syncing} style={{
            padding:'8px 14px',fontSize:12,fontWeight:500,borderRadius:8,cursor:'pointer',
            background:C.navy,color:'#fff',border:'none',opacity:syncing?0.6:1
          }}>{syncing ? 'Se genereaza...' : '⬇ Genereaza saptamana curenta'}</button>
          <button onClick={()=>generateReport(1)} disabled={syncing} style={{
            padding:'8px 14px',fontSize:12,fontWeight:500,borderRadius:8,cursor:'pointer',
            background:'transparent',color:C.navy,border:`1px solid ${C.navy}`,opacity:syncing?0.6:1
          }}>+ Saptamana trecuta</button>
        </div>
      </div>

      {error && <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:C.red}}>{error}</div>}

      {reports.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:C.card,borderRadius:12,border:`0.5px solid ${C.border}`}}>
          <p style={{fontSize:14,color:C.muted,marginBottom:8}}>Nu exista rapoarte saptamanale inca.</p>
          <p style={{fontSize:12,color:C.hint,marginBottom:16}}>Apasa "Genereaza saptamana curenta" pentru a crea primul raport.</p>
          <button onClick={()=>generateReport(0)} style={{padding:'10px 20px',fontSize:13,fontWeight:500,background:C.navy,color:'#fff',border:'none',borderRadius:8,cursor:'pointer'}}>
            Genereaza acum
          </button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16,alignItems:'start'}}>

          {/* Sidebar — lista rapoarte */}
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',background:'#f9f9f7',borderBottom:`0.5px solid ${C.border}`,fontSize:11,fontWeight:600,color:C.hint,textTransform:'uppercase',letterSpacing:'.06em'}}>
              Saptamani
            </div>
            {reports.map((r,i) => {
              const isSelected = r.week_start === selected
              const cereriTrend = i < reports.length-1 ? dlt(r.cereri_noi||0, reports[i+1]?.cereri_noi||0) : null
              return (
                <div key={r.week_start}
                  onClick={() => setSelected(r.week_start)}
                  style={{
                    padding:'10px 14px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,
                    background:isSelected?'#EBF4FC':'transparent',
                    borderLeft:`3px solid ${isSelected?C.blue:'transparent'}`,
                    transition:'background .1s'
                  }}>
                  <div style={{fontSize:12,fontWeight:isSelected?600:400,color:isSelected?C.blue:C.text,marginBottom:2}}>
                    {r.summary?.weekLabel || r.week_start}
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:10,color:C.hint}}>{fmtN(r.sessions)} ses.</span>
                    {r.cereri_noi > 0 && <span style={{fontSize:10,fontWeight:600,color:C.green}}>{r.cereri_noi} cereri</span>}
                    {cereriTrend !== null && Math.abs(cereriTrend) > 5 && (
                      <span style={{fontSize:9,color:cereriTrend>0?C.green:C.red}}>{cereriTrend>0?'↑':'↓'}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Main panel — raportul selectat */}
          {current ? (
            <div>
              {/* Week header */}
              <div style={{background:'linear-gradient(135deg,#1A2B4A,#2d4a7a)',borderRadius:12,padding:'16px 20px',marginBottom:16,color:'#fff'}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,.5)',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.07em'}}>Raport saptamanal</p>
                <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 10px'}}>{current.summary?.weekLabel}</h2>
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  {[
                    {l:'Sesiuni',v:fmtN(current.sessions),prev:prevReport?.sessions,inv:false},
                    {l:'Conversii',v:fmtN(current.conversions),prev:prevReport?.conversions,inv:false},
                    {l:'Cereri noi',v:current.cereri_noi||0,prev:prevReport?.cereri_noi,inv:false},
                    {l:'Conv rate',v:current.sessions>0?((current.conversions/current.sessions)*100).toFixed(1)+'%':'-',prev:null},
                  ].map(m=>(
                    <div key={m.l}>
                      <p style={{fontSize:10,color:'rgba(255,255,255,.45)',margin:'0 0 1px'}}>{m.l}</p>
                      <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                        <span style={{fontSize:18,fontWeight:600,color:'#fff'}}>{m.v}</span>
                        {m.prev !== null && m.prev !== undefined && (
                          <span style={{fontSize:10,color:dlt(parseInt(m.v),m.prev)>0?'#86EFAC':'#FCA5A5'}}>
                            {dlt(parseInt(m.v),m.prev)>0?'↑':'↓'}{Math.abs(dlt(parseInt(m.v),m.prev)||0).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:16}}>
                {[
                  {l:'Direct',v:fmtN(current.direct_sess),sub:`${current.direct_sess>0?((current.direct_conv/current.direct_sess)*100).toFixed(1):0}% conv`},
                  {l:'Social',v:fmtN(current.social_sess),sub:`${current.social_sess>0?((current.social_conv/current.social_sess)*100).toFixed(1):0}% conv`,hl:true},
                  {l:'Search',v:fmtN(current.search_sess),sub:`${current.search_sess>0?((current.search_conv/current.search_sess)*100).toFixed(1):0}% conv`},
                  {l:'Funnel /cereri',v:(current.funnel_rate||0)+'%',sub:`${fmtN(current.cereri_views)} views`,col:(current.funnel_rate||0)<15?C.red:C.green},
                  {l:'Homepage rate',v:(current.homepage_rate||0)+'%',col:(current.homepage_rate||0)>8?C.green:(current.homepage_rate||0)>5?C.amber:C.red},
                  {l:'/vreau rate',v:(current.vreau_rate||0)+'%',col:(current.vreau_rate||0)>3?C.green:C.hint},
                  {l:'Cereri noi',v:current.cereri_noi||0,col:(current.cereri_noi||0)>5?C.green:(current.cereri_noi||0)>0?C.amber:C.red},
                  {l:'Inreg. cumpar.',v:current.bun_venit_c||0},
                ].map(m=>(
                  <div key={m.l} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'11px 13px'}}>
                    <p style={{fontSize:10,color:C.hint,margin:'0 0 3px',textTransform:'uppercase',letterSpacing:'.04em'}}>{m.l}</p>
                    <p style={{fontSize:18,fontWeight:500,color:m.col||C.text,margin:'0 0 1px'}}>{m.v}</p>
                    {m.sub && <p style={{fontSize:10,color:C.hint,margin:0}}>{m.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Insights */}
              {(current.insights||[]).length > 0 && (
                <Sec title="Semnale saptamanii">
                  {(current.insights||[]).map((s,i) => <Signal key={i} {...s}/>)}
                </Sec>
              )}

              {/* Actiuni */}
              {(current.actions||[]).length > 0 && (
                <Sec title="Actiuni recomandate">
                  {(current.actions||[]).map((a,i) => <Action key={i} {...a}/>)}
                </Sec>
              )}

              {/* Comparatie cu saptamana anterioara */}
              {prevReport && (
                <Sec title={`Comparatie vs ${prevReport.summary?.weekLabel||prevReport.week_start}`}>
                  <Card style={{padding:'14px 16px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
                      {[
                        {l:'Sesiuni',curr:current.sessions,prev:prevReport.sessions},
                        {l:'Conversii',curr:current.conversions,prev:prevReport.conversions},
                        {l:'Cereri noi',curr:current.cereri_noi||0,prev:prevReport.cereri_noi||0},
                        {l:'Social sess',curr:current.social_sess||0,prev:prevReport.social_sess||0},
                        {l:'Funnel rate',curr:current.funnel_rate||0,prev:prevReport.funnel_rate||0},
                        {l:'Homepage rate',curr:current.homepage_rate||0,prev:prevReport.homepage_rate||0},
                      ].map(m=>{
                        const d = dlt(m.curr, m.prev)
                        return (
                          <div key={m.l} style={{padding:'8px',background:'#f9f9f7',borderRadius:8}}>
                            <p style={{fontSize:10,color:C.hint,margin:'0 0 2px'}}>{m.l}</p>
                            <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                              <span style={{fontSize:16,fontWeight:500,color:C.text}}>{m.curr.toLocaleString('ro')}</span>
                              {d !== null && (
                                <span style={{fontSize:10,fontWeight:600,color:Math.abs(d)<2?C.gray:d>0?C.green:C.red}}>
                                  {d>0?'↑':'↓'}{Math.abs(d).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <p style={{fontSize:10,color:C.hint,margin:'1px 0 0'}}>prev: {m.prev.toLocaleString('ro')}</p>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </Sec>
              )}

              <div style={{fontSize:11,color:C.hint,marginTop:8}}>
                Generat: {current.summary?.generatedAt ? new Date(current.summary.generatedAt).toLocaleString('ro-RO') : current.created_at ? new Date(current.created_at).toLocaleString('ro-RO') : '—'}
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:'40px',color:C.hint}}>Selecteaza o saptamana din stanga.</div>
          )}
        </div>
      )}

      {/* Trend chart dacă avem ≥2 rapoarte */}
      {reports.length >= 2 && (
        <div style={{marginTop:24}}>
          <Sec title="Trend saptamanal — cereri noi si sesiuni">
            <Card>
              <LineChart
                data={[...reports].reverse().map(r=>({
                  date: r.week_start,
                  cereri_noi: r.cereri_noi||0,
                  sessions_scaled: Math.round((r.sessions||0)/10),
                  conv_rate: r.sessions>0?+((r.conversions/r.sessions)*100).toFixed(1):0,
                }))}
                metrics={[
                  {field:'cereri_noi',      label:'Cereri noi',        color:'#3B82C4'},
                  {field:'conv_rate',        label:'Conv rate %',        color:'#16A34A'},
                ]}
                height={180}
              />
            </Card>
          </Sec>
        </div>
      )}
    </div>
  )
}
