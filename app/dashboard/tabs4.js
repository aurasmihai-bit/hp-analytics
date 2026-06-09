'use client'
import { useEffect, useState, useCallback } from 'react'
import { C, dlt, fmtN, Signal, Action, Sec, Card, LineChart } from './components'

function isSuspiciousZeroReport(report) {
  if (!report) return false
  return [
    'sessions',
    'conversions',
    'new_users',
    'direct_sess',
    'social_sess',
    'search_sess',
    'gsc_impressions',
  ].every(field => !report[field])
}

export function TabRaportSaptamanal({ data }) {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError]       = useState('')
  const [syncMsg, setSyncMsg]   = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/weekly?limit=12')
      const text = await res.text()
      if (!text) throw new Error('Raspuns gol de la server')
      const j = JSON.parse(text)
      if (j.error) throw new Error(j.error)
      const sorted = (j.reports || []).sort((a,b) => b.week_start.localeCompare(a.week_start))
      setReports(sorted)
      if (sorted.length > 0) setSelected(s => s || sorted[0].week_start)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadReports() }, [loadReports])

  async function generateReport(offsetWeeks = 0) {
    setSyncing(true); setError(''); setSyncMsg('Se genereaza raportul (30-60 secunde)...')
    try {
      const res = await fetch('/api/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsetWeeks })
      })
      const text = await res.text()
      if (!text) throw new Error('Server a returnat raspuns gol. Incearca din nou.')
      const j = JSON.parse(text)
      if (j.error) throw new Error(j.error)
      setSyncMsg('Raport generat cu succes!')
      setTimeout(() => setSyncMsg(''), 3000)
      await loadReports()
    } catch(e) {
      setError(e.message)
      setSyncMsg('')
    }
    finally { setSyncing(false) }
  }

  const current = reports.find(r => r.week_start === selected)
  const currentIdx = reports.findIndex(r => r.week_start === selected)
  const prevReport = currentIdx >= 0 ? reports[currentIdx + 1] : null
  const currentLooksInvalid = isSuspiciousZeroReport(current)

  if (loading) return (
    <div style={{textAlign:'center',padding:'60px',color:C.hint,fontSize:13}}>
      Se incarca rapoartele saptamanale...
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div style={{flex:1}}>
          <h3 style={{fontSize:14,fontWeight:600,color:C.navy,margin:'0 0 3px'}}>Rapoarte saptamanale — istoric</h3>
          <p style={{fontSize:12,color:C.hint,margin:0}}>
            {reports.length} rapoarte salvate · Generat automat in fiecare luni la 07:00
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {syncMsg && <span style={{fontSize:12,color:C.green,fontStyle:'italic'}}>{syncMsg}</span>}
          <button onClick={()=>generateReport(0)} disabled={syncing} style={{
            padding:'8px 14px',fontSize:12,fontWeight:500,borderRadius:8,cursor:syncing?'wait':'pointer',
            background:C.navy,color:'#fff',border:'none',opacity:syncing?0.65:1,fontFamily:'inherit'
          }}>{syncing ? '⏳ Se genereaza...' : '⬇ Genereaza saptamana curenta'}</button>
          <button onClick={()=>generateReport(1)} disabled={syncing} style={{
            padding:'8px 14px',fontSize:12,fontWeight:500,borderRadius:8,cursor:syncing?'wait':'pointer',
            background:'transparent',color:C.navy,border:`1px solid ${C.navy}`,opacity:syncing?0.65:1,fontFamily:'inherit'
          }}>+ Saptamana trecuta</button>
        </div>
      </div>

      {error && (
        <div style={{background:'#FEF2F2',border:'0.5px solid #FCA5A5',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:C.red,display:'flex',gap:8,alignItems:'flex-start'}}>
          <span>⚠️</span>
          <div>
            <strong>Eroare:</strong> {error}
            <div style={{marginTop:4,color:C.muted}}>Incearca din nou. Daca persista, apasa ↻ sync in header intai.</div>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 20px',background:C.card,borderRadius:12,border:`0.5px solid ${C.border}`}}>
          <div style={{fontSize:32,marginBottom:12}}>📅</div>
          <p style={{fontSize:14,fontWeight:500,color:C.text,marginBottom:6}}>Nu exista rapoarte saptamanale inca.</p>
          <p style={{fontSize:12,color:C.hint,marginBottom:20}}>
            Primul raport va fi generat automat luni la 07:00.<br/>
            Sau apasa mai jos pentru a genera acum (dureaza ~30-60 secunde).
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <button onClick={()=>generateReport(1)} disabled={syncing} style={{padding:'10px 20px',fontSize:13,fontWeight:500,background:C.card,color:C.navy,border:`1px solid ${C.navy}`,borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
              Genereaza saptamana trecuta
            </button>
            <button onClick={()=>generateReport(0)} disabled={syncing} style={{padding:'10px 20px',fontSize:13,fontWeight:500,background:C.navy,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
              {syncing ? '⏳ Se genereaza...' : '⬇ Genereaza saptamana curenta'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:16,alignItems:'start'}}>

          {/* Sidebar */}
          <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,overflow:'hidden',position:'sticky',top:70}}>
            <div style={{padding:'9px 13px',background:'#f9f9f7',borderBottom:`0.5px solid ${C.border}`,fontSize:10,fontWeight:700,color:C.hint,textTransform:'uppercase',letterSpacing:'.07em'}}>
              Saptamani salvate
            </div>
            {reports.map((r,i) => {
              const isOn = r.week_start === selected
              const cereriD = i < reports.length-1 ? dlt(r.cereri_noi||0, reports[i+1]?.cereri_noi||0) : null
              return (
                <div key={r.week_start} onClick={()=>setSelected(r.week_start)} style={{
                  padding:'10px 13px',cursor:'pointer',borderBottom:`0.5px solid ${C.border}`,
                  background:isOn?'#EBF4FC':'transparent',
                  borderLeft:`3px solid ${isOn?C.blue:'transparent'}`,
                }}>
                  <div style={{fontSize:11,fontWeight:isOn?600:400,color:isOn?C.blue:C.text,marginBottom:3}}>
                    {r.summary?.weekLabel || r.week_start}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{fontSize:10,color:C.hint}}>{fmtN(r.sessions||0)} ses.</span>
                    <span style={{fontSize:10,fontWeight:600,color:(r.cereri_noi||0)>0?C.green:C.hint}}>
                      {r.cereri_noi||0} cereri
                    </span>
                    {cereriD !== null && Math.abs(cereriD) > 10 && (
                      <span style={{fontSize:9,color:cereriD>0?C.green:C.red,fontWeight:700}}>
                        {cereriD>0?'↑':'↓'}{Math.abs(cereriD).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Buton adaugare saptamana precedenta */}
            <div style={{padding:'8px 13px'}}>
              <button onClick={()=>generateReport(reports.length)} disabled={syncing} style={{
                width:'100%',padding:'6px',fontSize:11,borderRadius:6,cursor:'pointer',
                background:'transparent',color:C.hint,border:`0.5px solid ${C.border}`,fontFamily:'inherit'
              }}>+ Saptamana mai veche</button>
            </div>
          </div>

          {/* Panel principal */}
          {current ? (
            <div>
              {currentLooksInvalid && (
                <Signal
                  type="negative"
                  title="Raport generat fara date"
                  body="Sesiuni si conversii sunt toate 0. Cel mai probabil raportul a fost salvat cand GA4 nu a returnat date. Regenereaza saptamana dupa ce deploy-ul are GA4_ACCOUNT_ID, GOOGLE_SERVICE_ACCOUNT_JSON si SUPABASE_SERVICE_KEY corecte."
                />
              )}

              {/* Week header */}
              <div style={{background:'linear-gradient(135deg,#1A2B4A,#2d4a7a)',borderRadius:12,padding:'16px 20px',marginBottom:14,color:'#fff'}}>
                <p style={{fontSize:10,color:'rgba(255,255,255,.5)',margin:'0 0 2px',textTransform:'uppercase',letterSpacing:'.07em'}}>Raport saptamanal</p>
                <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 12px'}}>{current.summary?.weekLabel}</h2>
                <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                  {[
                    {l:'Sesiuni',   c:current.sessions||0,  p:prevReport?.sessions},
                    {l:'Conversii', c:current.conversions||0,p:prevReport?.conversions},
                    {l:'Cereri noi',c:current.cereri_noi||0, p:prevReport?.cereri_noi},
                    {l:'Conv rate', c:current.sessions>0?+((current.conversions/current.sessions)*100).toFixed(1):0, p:null, suf:'%'},
                  ].map(m=>{
                    const d = m.p !== null && m.p !== undefined ? dlt(m.c, m.p) : null
                    return (
                      <div key={m.l}>
                        <p style={{fontSize:10,color:'rgba(255,255,255,.45)',margin:'0 0 1px'}}>{m.l}</p>
                        <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                          <span style={{fontSize:18,fontWeight:600}}>{fmtN(m.c)}{m.suf||''}</span>
                          {d !== null && <span style={{fontSize:10,color:Math.abs(d)<2?'rgba(255,255,255,.5)':d>0?'#86EFAC':'#FCA5A5',fontWeight:600}}>
                            {d>0?'↑':'↓'}{Math.abs(d).toFixed(0)}%
                          </span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* KPI grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8,marginBottom:14}}>
                {[
                  {l:'Direct',      v:fmtN(current.direct_sess||0), sub:`${current.direct_sess>0?((current.direct_conv/current.direct_sess)*100).toFixed(1):0}% conv`},
                  {l:'Social',      v:fmtN(current.social_sess||0), sub:`${current.social_sess>0?((current.social_conv/current.social_sess)*100).toFixed(1):0}% conv`, hl:true},
                  {l:'Search',      v:fmtN(current.search_sess||0), sub:`${current.search_sess>0?((current.search_conv/current.search_sess)*100).toFixed(1):0}% conv`},
                  {l:'Cereri noi',  v:current.cereri_noi||0, col:(current.cereri_noi||0)>5?C.green:(current.cereri_noi||0)>0?C.amber:C.red},
                  {l:'Inreg. c.',   v:current.bun_venit_c||0},
                  {l:'Funnel %',    v:(current.funnel_rate||0)+'%', col:(current.funnel_rate||0)<15?C.red:C.green},
                  {l:'Homepage %',  v:(current.homepage_rate||0)+'%', col:(current.homepage_rate||0)>8?C.green:(current.homepage_rate||0)>5?C.amber:C.red},
                  {l:'/vreau %',    v:(current.vreau_rate||0)+'%', col:(current.vreau_rate||0)>3?C.green:C.hint},
                ].map(m=>(
                  <div key={m.l} style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                    <p style={{fontSize:9,color:C.hint,margin:'0 0 3px',textTransform:'uppercase',letterSpacing:'.05em'}}>{m.l}</p>
                    <p style={{fontSize:17,fontWeight:500,color:m.col||(m.hl?C.green:C.text),margin:'0 0 1px'}}>{m.v}</p>
                    {m.sub && <p style={{fontSize:10,color:C.hint,margin:0}}>{m.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Insights */}
              {(current.insights||[]).length > 0 && (
                <Sec title="Semnale saptamanii">
                  {(current.insights||[]).map((s,i)=><Signal key={i} {...s}/>)}
                </Sec>
              )}

              {/* Actiuni */}
              {(current.actions||[]).length > 0 && (
                <Sec title="Actiuni recomandate">
                  {(current.actions||[]).map((a,i)=><Action key={i} {...a}/>)}
                </Sec>
              )}

              {/* Comparatie vs saptamana anterioara */}
              {prevReport && (
                <Sec title={`Comparatie vs ${prevReport.summary?.weekLabel||prevReport.week_start}`}>
                  <Card style={{padding:'14px 16px'}}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
                      {[
                        {l:'Sesiuni',      c:current.sessions||0,       p:prevReport.sessions||0},
                        {l:'Conversii',    c:current.conversions||0,    p:prevReport.conversions||0},
                        {l:'Cereri noi',   c:current.cereri_noi||0,     p:prevReport.cereri_noi||0},
                        {l:'Social sess',  c:current.social_sess||0,    p:prevReport.social_sess||0},
                        {l:'Funnel rate',  c:current.funnel_rate||0,    p:prevReport.funnel_rate||0},
                        {l:'Homepage %',   c:current.homepage_rate||0,  p:prevReport.homepage_rate||0},
                      ].map(m=>{
                        const d = dlt(m.c, m.p)
                        return (
                          <div key={m.l} style={{padding:'8px',background:'#f9f9f7',borderRadius:8}}>
                            <p style={{fontSize:10,color:C.hint,margin:'0 0 2px'}}>{m.l}</p>
                            <div style={{display:'flex',alignItems:'baseline',gap:3}}>
                              <span style={{fontSize:15,fontWeight:500,color:C.text}}>{m.c.toLocaleString('ro')}</span>
                              {d !== null && <span style={{fontSize:10,fontWeight:600,color:Math.abs(d)<2?C.gray:d>0?C.green:C.red}}>
                                {d>0?'↑':'↓'}{Math.abs(d).toFixed(0)}%
                              </span>}
                            </div>
                            <p style={{fontSize:10,color:C.hint,margin:'1px 0 0'}}>prev: {m.p.toLocaleString('ro')}</p>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </Sec>
              )}

              <p style={{fontSize:11,color:C.hint,marginTop:8}}>
                Generat: {current.summary?.generatedAt
                  ? new Date(current.summary.generatedAt).toLocaleString('ro-RO')
                  : current.created_at ? new Date(current.created_at).toLocaleString('ro-RO') : '—'}
              </p>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:'40px',color:C.hint,fontSize:13}}>
              Selecteaza o saptamana din stanga.
            </div>
          )}
        </div>
      )}

      {/* Trend chart >= 2 rapoarte */}
      {reports.length >= 2 && (
        <div style={{marginTop:24}}>
          <Sec title="Trend saptamanal — cereri noi si conv rate">
            <Card>
              <LineChart
                data={[...reports].reverse().map(r=>({
                  date:        r.week_start,
                  cereri_noi:  r.cereri_noi||0,
                  conv_rate:   r.sessions>0?+((r.conversions/r.sessions)*100).toFixed(1):0,
                  social_rate: r.social_sess>0?+((r.social_conv/r.social_sess)*100).toFixed(1):0,
                }))}
                metrics={[
                  {field:'cereri_noi',  label:'Cereri noi',   color:'#3B82C4'},
                  {field:'conv_rate',   label:'Conv rate %',  color:'#16A34A'},
                  {field:'social_rate', label:'Social conv %',color:'#D97706'},
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
