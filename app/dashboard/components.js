'use client'
import { useState } from 'react'

export const C = {
  navy:'#1A2B4A', blue:'#3B82C4', green:'#16A34A', amber:'#D97706',
  red:'#DC2626', gray:'#6B7280', purple:'#7C3AED',
  border:'#e8e8e0', bg:'#f5f5f3', card:'#ffffff',
  text:'#1a1a18', muted:'#666660', hint:'#999990',
}
export const CHART_COLORS = ['#3B82C4','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2']

export const sum  = (arr,f) => arr.reduce((s,r) => s+(r[f]||0), 0)
export const avg  = (arr,f) => arr.length ? sum(arr,f)/arr.length : 0
export const dlt  = (c,p)   => p > 0 ? ((c-p)/p)*100 : null
export const fmt  = (v,t) => {
  if (v===undefined||v===null) return '—'
  if (t==='pct')  return (v*100).toFixed(1)+'%'
  if (t==='dec1') return Number(v).toFixed(1)
  if (t==='sec')  return Math.round(v)+'s'
  if (t==='pctN') return Number(v).toFixed(1)+'%'
  return Math.round(v).toLocaleString('ro')
}

export function Delta({ c, p, inv=false }) {
  const d = dlt(c,p)
  if (d===null) return null
  const good = inv ? d<0 : d>0
  const col = Math.abs(d)<2 ? C.gray : good ? C.green : C.red
  return <span style={{fontSize:11,fontWeight:500,color:col,marginLeft:5}}>{d>0?'\u2191':'\u2193'}{Math.abs(d).toFixed(0)}%</span>
}

export function KPI({ label, curr, prev, type, inv }) {
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
      <p style={{fontSize:11,color:C.hint,margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</p>
      <div style={{display:'flex',alignItems:'baseline',gap:2}}>
        <span style={{fontSize:22,fontWeight:500,color:C.text}}>{fmt(curr,type)}</span>
        {prev!==undefined && <Delta c={curr} p={prev} inv={inv}/>}
      </div>
    </div>
  )
}

export function Signal({ type, title, body }) {
  const s={positive:{bg:'#F0FDF4',bdr:'#86EFAC',dot:'#22C55E'},negative:{bg:'#FEF2F2',bdr:'#FCA5A5',dot:'#EF4444'},neutral:{bg:'#FFF7ED',bdr:'#FCD34D',dot:'#F59E0B'}}[type]||{bg:'#F5F5F3',bdr:'#D0D0C8',dot:C.gray}
  return (
    <div style={{background:s.bg,border:`0.5px solid ${s.bdr}`,borderRadius:10,padding:'14px 16px',marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:s.dot,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:500,color:C.text}}>{title}</span>
      </div>
      <p style={{fontSize:13,color:C.muted,margin:0,lineHeight:1.55}}>{body}</p>
    </div>
  )
}

export function Action({ urgency, title, body, fix }) {
  const [open,setOpen] = useState(false)
  const b={urgent:{bg:'#FEF2F2',col:C.red},important:{bg:'#FFF7ED',col:C.amber},'luna asta':{bg:'#EBF4FC',col:C.blue}}[urgency]||{bg:'#EBF4FC',col:C.blue}
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'}}>
        <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:99,background:b.bg,color:b.col,flexShrink:0}}>{urgency}</span>
        <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{title}</span>
        <span style={{fontSize:11,color:C.hint,transform:open?'rotate(90deg)':'none',transition:'transform .2s'}}>{'\u25B6'}</span>
      </div>
      {open && (
        <div style={{padding:'0 14px 14px',borderTop:`0.5px solid ${C.border}`}}>
          <p style={{fontSize:13,color:C.muted,margin:'12px 0 8px',lineHeight:1.55}}>{body}</p>
          <div style={{background:'#f5f5f3',borderRadius:8,padding:'10px 12px'}}>
            <p style={{fontSize:11,fontWeight:500,color:C.green,margin:'0 0 4px'}}>Actiune concreta</p>
            <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.5}}>{fix}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function Sec({ title, children }) {
  return (
    <div style={{marginBottom:28}}>
      <h3 style={{fontSize:11,fontWeight:500,color:C.hint,margin:'0 0 12px',textTransform:'uppercase',letterSpacing:'.06em'}}>{title}</h3>
      {children}
    </div>
  )
}

export function Grid({ children }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:24}}>{children}</div>
}

export function LineChart({ data, metrics, height=200, showLegend=true }) {
  const [hover,setHover] = useState(null)
  if (!data||data.length===0) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:C.hint,fontSize:13}}>Nu exista date</div>
  const W=560, H=height, PAD={top:16,right:16,bottom:32,left:44}
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom
  const axes = {}
  metrics.forEach(m => {
    const axis=m.yAxis||'left'
    if(!axes[axis]) axes[axis]={min:Infinity,max:-Infinity}
    data.forEach(d => {
      const v=d[m.field]||0
      if(v<axes[axis].min) axes[axis].min=v
      if(v>axes[axis].max) axes[axis].max=v
    })
    axes[axis].range=(axes[axis].max-axes[axis].min)||1
  })
  const toY=(v,axis)=>{const ax=axes[axis||'left'];return PAD.top+cH-((v-ax.min)/ax.range)*cH}
  const toX=i=>PAD.left+(i/(Math.max(data.length-1,1)))*cW
  const step=Math.max(1,Math.floor(data.length/6))
  const xTicks=data.filter((_,i)=>i%step===0||i===data.length-1)
  const leftAx=axes['left']
  const yTicks=leftAx?Array.from({length:5},(_,i)=>leftAx.min+(leftAx.range/4)*i):[]
  return (
    <div style={{position:'relative'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}} onMouseLeave={()=>setHover(null)}>
        {yTicks.map((t,i)=>{const y=toY(t,'left');return <line key={i} x1={PAD.left} y1={y} x2={W-PAD.right} y2={y} stroke={C.border} strokeWidth=".5" strokeDasharray="3,3"/>})}
        {yTicks.map((t,i)=><text key={i} x={PAD.left-6} y={toY(t,'left')+4} textAnchor="end" fontSize="9" fill={C.hint}>{Math.round(t)}</text>)}
        {xTicks.map((d,i)=>{const idx=data.indexOf(d);const x=toX(idx);const label=d.date?d.date.slice(5):'?';return <text key={i} x={x} y={H-6} textAnchor="middle" fontSize="9" fill={C.hint}>{label}</text>})}
        {metrics.map((m,mi)=>{const pts=data.map((d,i)=>`${toX(i).toFixed(1)},${toY(d[m.field]||0,m.yAxis).toFixed(1)}`).join(' ');return <polyline key={mi} points={pts} fill="none" stroke={m.color||CHART_COLORS[mi]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>})}
        {data.map((d,i)=><rect key={i} x={toX(i)-8} y={PAD.top} width={16} height={cH} fill="transparent" onMouseEnter={()=>setHover({d,x:toX(i),y:PAD.top})}/>)}
        {hover&&(<>
          <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={H-PAD.bottom} stroke={C.muted} strokeWidth=".5" strokeDasharray="3,2"/>
          {metrics.map((m,mi)=>{const v=hover.d[m.field]||0;const y=toY(v,m.yAxis);return <circle key={mi} cx={hover.x} cy={y} r="3" fill={m.color||CHART_COLORS[mi]} stroke="#fff" strokeWidth="1.5"/>})}
          <rect x={Math.min(hover.x+8,W-120)} y={hover.y} width={112} height={16+metrics.length*14} rx="4" fill="#1a1a18" opacity=".88"/>
          <text x={Math.min(hover.x+14,W-114)} y={hover.y+11} fontSize="9" fill="#fff">{hover.d.date}</text>
          {metrics.map((m,mi)=><text key={mi} x={Math.min(hover.x+14,W-114)} y={hover.y+23+mi*14} fontSize="9" fill={m.color||CHART_COLORS[mi]}>{m.label}: {fmt(hover.d[m.field]||0,m.fmt)}</text>)}
        </>)}
      </svg>
      {showLegend&&<div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:8}}>{metrics.map((m,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:C.muted}}><div style={{width:16,height:2,background:m.color||CHART_COLORS[i],borderRadius:2}}/>{m.label}</div>)}</div>}
    </div>
  )
}

export function BarChart({ data, labelField, valueField, color='#3B82C4', maxBars=8 }) {
  const top=[...data].sort((a,b)=>(b[valueField]||0)-(a[valueField]||0)).slice(0,maxBars)
  const maxV=Math.max(...top.map(d=>d[valueField]||0),1)
  return (
    <div>
      {top.map((d,i)=>{
        const v=d[valueField]||0, pct=v/maxV*100
        const label=(d[labelField]||'').replace('https://homepitch.ro','')
        return (
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span style={{fontSize:11,fontFamily:label.startsWith('/')?'monospace':'inherit',color:C.text,width:160,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={label}>{label}</span>
            <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:6,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:6,borderRadius:99,background:color}}/>
            </div>
            <span style={{fontSize:12,color:C.muted,width:40,textAlign:'right',flexShrink:0}}>{Math.round(v).toLocaleString('ro')}</span>
          </div>
        )
      })}
    </div>
  )
}
