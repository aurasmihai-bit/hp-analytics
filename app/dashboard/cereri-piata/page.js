'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { C } from '../components'
import { TabCereriPiata } from '../tabs5'

const PERIODS = [
  { label:'Toate', days:1095 },
  { label:'30Z', days:30 },
  { label:'90Z', days:90 },
  { label:'180Z', days:180 },
  { label:'365Z', days:365 },
]

function PeriodControls({ days, customFrom, customTo, onDays, onCustom }) {
  const [showPicker, setShowPicker] = useState(false)
  const [from, setFrom] = useState(customFrom || '')
  const [to, setTo] = useState(customTo || '')
  const today = new Date().toISOString().slice(0,10)
  const isCustom = !!customFrom

  function applyCustom() {
    if (!from || !to || from > to) return
    setShowPicker(false)
    onCustom(from, to)
  }

  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
      <span style={{fontSize:11,color:C.hint,marginRight:2}}>Interval:</span>
      {PERIODS.map(period => (
        <button key={period.days} onClick={()=>{setShowPicker(false);onDays(period.days)}} style={{
          padding:'4px 9px',fontSize:11,borderRadius:6,cursor:'pointer',fontWeight:!isCustom&&days===period.days?500:400,
          border:`0.5px solid ${!isCustom&&days===period.days?C.navy:C.border}`,
          background:!isCustom&&days===period.days?C.navy:'transparent',
          color:!isCustom&&days===period.days?'#fff':C.muted,fontFamily:'inherit'
        }}>{period.label}</button>
      ))}
      <button onClick={()=>setShowPicker(v=>!v)} style={{
        padding:'4px 10px',fontSize:11,borderRadius:6,cursor:'pointer',fontWeight:isCustom?500:400,
        border:`0.5px solid ${isCustom||showPicker?C.blue:C.border}`,
        background:isCustom?'#EBF4FC':showPicker?'#F0F7FF':'transparent',
        color:isCustom||showPicker?C.blue:C.muted,fontFamily:'inherit'
      }}>
        {isCustom ? `${customFrom} - ${customTo}` : 'Personalizat'}
      </button>

      {showPicker && (
        <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,zIndex:100,background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:14,boxShadow:'0 8px 28px rgba(0,0,0,.12)',minWidth:280}}>
          <p style={{fontSize:12,fontWeight:600,color:C.text,margin:'0 0 10px'}}>Interval personalizat</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <label>
              <span style={{fontSize:11,color:C.hint,display:'block',marginBottom:4}}>De la</span>
              <input type="date" value={from} max={to || today} onChange={e=>setFrom(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg}}/>
            </label>
            <label>
              <span style={{fontSize:11,color:C.hint,display:'block',marginBottom:4}}>Pana la</span>
              <input type="date" value={to} min={from || undefined} max={today} onChange={e=>setTo(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'7px 9px',border:`0.5px solid ${C.border}`,borderRadius:7,fontSize:12,color:C.text,background:C.bg}}/>
            </label>
          </div>
          {from && to && from > to && <p style={{fontSize:11,color:C.red,margin:'0 0 8px'}}>Interval invalid.</p>}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setShowPicker(false)} style={{padding:'6px 12px',fontSize:12,borderRadius:7,cursor:'pointer',border:`0.5px solid ${C.border}`,background:'transparent',color:C.muted,fontFamily:'inherit'}}>Anuleaza</button>
            <button onClick={applyCustom} disabled={!from || !to || from > to} style={{padding:'6px 12px',fontSize:12,borderRadius:7,cursor:from&&to&&from<=to?'pointer':'not-allowed',border:'none',background:from&&to&&from<=to?C.navy:'#ccc',color:'#fff',fontFamily:'inherit'}}>Aplica</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CereriPiataPage() {
  const [days, setDays] = useState(1095)
  const [customFrom, setCustomFrom] = useState(null)
  const [customTo, setCustomTo] = useState(null)

  function selectDays(nextDays) {
    setDays(nextDays)
    setCustomFrom(null)
    setCustomTo(null)
  }

  function selectCustom(from, to) {
    setDays(null)
    setCustomFrom(from)
    setCustomTo(to)
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',gap:12,minHeight:52,position:'sticky',top:0,zIndex:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:6,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12}}>H</div>
          <span style={{fontSize:14,fontWeight:500,color:C.text}}>Cereri piata</span>
        </div>
        <div style={{flex:1}}/>
        <PeriodControls days={days} customFrom={customFrom} customTo={customTo} onDays={selectDays} onCustom={selectCustom}/>
        <a href="/dashboard" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,textDecoration:'none'}}>Dashboard</a>
      </div>
      <div style={{width:'100%',boxSizing:'border-box',padding:'20px 16px'}}>
        <TabCereriPiata days={days} customFrom={customFrom} customTo={customTo}/>
      </div>
    </div>
  )
}
