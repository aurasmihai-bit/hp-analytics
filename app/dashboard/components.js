'use client'
import { useState } from 'react'

export const C = {
  navy:'var(--hp-navy,#1A2B4A)', blue:'var(--hp-blue,#3B82C4)', green:'var(--hp-green,#16A34A)', amber:'var(--hp-amber,#D97706)',
  red:'var(--hp-red,#DC2626)', gray:'var(--hp-gray,#6B7280)', purple:'var(--hp-purple,#7C3AED)', teal:'var(--hp-teal,#0891B2)',
  border:'var(--hp-border,#e8e8e0)', bg:'var(--hp-bg,#f5f5f3)', card:'var(--hp-card,#ffffff)',
  text:'var(--hp-text,#1a1a18)', muted:'var(--hp-muted,#666660)', hint:'var(--hp-hint,#999990)',
  input:'var(--hp-input,#ffffff)', softBlue:'var(--hp-soft-blue,#EBF4FC)', softGreen:'var(--hp-soft-green,#F0FDF4)',
  softAmber:'var(--hp-soft-amber,#FFF7ED)', softRed:'var(--hp-soft-red,#FEF2F2)', softPanel:'var(--hp-soft-panel,#F5F5F3)',
}
export const COLORS = ['#3B82C4','#16A34A','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777']

export const sum  = (arr,f) => arr.reduce((s,r) => s+(r[f]||0), 0)
export const avg  = (arr,f) => arr.length ? sum(arr,f)/arr.length : 0
export const dlt  = (c,p)   => p > 0 ? ((c-p)/p)*100 : null
export const fmtN = v => v===undefined||v===null ? '—' : Math.round(v).toLocaleString('ro')
export const fmt  = (v,t) => {
  if (v===undefined||v===null) return '—'
  if (t==='pct')  return (v*100).toFixed(1)+'%'
  if (t==='dec1') return Number(v).toFixed(1)
  if (t==='sec')  return Math.round(v)+'s'
  if (t==='pctN') return Number(v).toFixed(1)+'%'
  return fmtN(v)
}

export function Delta({ c, p, inv=false, size=11 }) {
  const d = dlt(c,p)
  if (d===null || isNaN(d)) return null
  const good = inv ? d<0 : d>0
  const col = Math.abs(d)<2 ? C.gray : good ? C.green : C.red
  const arr = d>0 ? '\u2191' : '\u2193'
  return <span style={{fontSize:size,fontWeight:500,color:col,marginLeft:5}}>{arr}{Math.abs(d).toFixed(0)}%</span>
}

export function KPI({ label, curr, prev, type, inv, sub }) {
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
      <p style={{fontSize:11,color:C.hint,margin:'0 0 6px',textTransform:'uppercase',letterSpacing:'.05em'}}>{label}</p>
      <div style={{display:'flex',alignItems:'baseline',gap:2,flexWrap:'wrap'}}>
        <span style={{fontSize:22,fontWeight:500,color:C.text}}>{fmt(curr,type)}</span>
        {prev!==undefined && prev!==null && <Delta c={curr} p={prev} inv={inv}/>}
      </div>
      {sub && <p style={{fontSize:11,color:C.hint,margin:'4px 0 0'}}>{sub}</p>}
    </div>
  )
}

export function Signal({ type, title, body, tag }) {
  const s={positive:{bg:'#F0FDF4',bdr:'#86EFAC',dot:'#22C55E',tcol:'#15803D'},negative:{bg:'#FEF2F2',bdr:'#FCA5A5',dot:'#EF4444',tcol:'#B91C1C'},neutral:{bg:'#FFF7ED',bdr:'#FCD34D',dot:'#F59E0B',tcol:'#92400E'},info:{bg:'#EBF4FC',bdr:'#93C5FD',dot:'#3B82C4',tcol:'#1E40AF'}}[type]||{bg:'#F5F5F3',bdr:'#D0D0C8',dot:C.gray,tcol:C.gray}
  return (
    <div style={{background:s.bg,border:`0.5px solid ${s.bdr}`,borderRadius:10,padding:'14px 16px',marginBottom:10}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:body?6:0}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:s.dot,flexShrink:0,marginTop:4}}/>
        <div style={{flex:1}}>
          <span style={{fontSize:13,fontWeight:500,color:C.text}}>{title}</span>
          {tag && <span style={{fontSize:10,fontWeight:500,padding:'1px 6px',borderRadius:99,background:s.dot,color:'#fff',marginLeft:8}}>{tag}</span>}
        </div>
      </div>
      {body && <p style={{fontSize:13,color:C.muted,margin:'0 0 0 15px',lineHeight:1.55}}>{body}</p>}
    </div>
  )
}

export function Action({ urgency, title, body, fix, impact }) {
  const [open,setOpen] = useState(false)
  const b={urgent:{bg:'#FEF2F2',col:C.red},important:{bg:'#FFF7ED',col:C.amber},'luna asta':{bg:'#EBF4FC',col:C.blue},seo:{bg:'#F0FDF4',col:C.green}}[urgency]||{bg:'#EBF4FC',col:C.blue}
  return (
    <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:10,marginBottom:8,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'}}>
        <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:99,background:b.bg,color:b.col,flexShrink:0}}>{urgency}</span>
        <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1,lineHeight:1.4}}>{title}</span>
        {impact && <span style={{fontSize:10,color:C.hint,flexShrink:0}}>{impact}</span>}
        <span style={{fontSize:11,color:C.hint,transform:open?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>{'\u25B6'}</span>
      </div>
      {open && (
        <div style={{padding:'0 14px 14px',borderTop:`0.5px solid ${C.border}`}}>
          <p style={{fontSize:13,color:C.muted,margin:'12px 0 8px',lineHeight:1.6}}>{body}</p>
          <div style={{background:'#f0fdf4',border:'0.5px solid #86efac',borderRadius:8,padding:'10px 12px'}}>
            <p style={{fontSize:11,fontWeight:500,color:C.green,margin:'0 0 4px'}}>Actiune concreta</p>
            <p style={{fontSize:13,color:C.text,margin:0,lineHeight:1.5}}>{fix}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function Sec({ title, children, right }) {
  return (
    <div style={{marginBottom:28}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <h3 style={{fontSize:11,fontWeight:500,color:C.hint,margin:0,textTransform:'uppercase',letterSpacing:'.06em'}}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Grid({ children, cols }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,marginBottom:20}}>{children}</div>
}

export function Card({ children, style }) {
  return <div style={{background:C.card,border:`0.5px solid ${C.border}`,borderRadius:12,padding:'16px 20px',...style}}>{children}</div>
}

export function LineChart({ data, metrics, height=200, showLegend=true }) {
  const [hover,setHover] = useState(null)
  if (!data||data.length<2) return <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',color:C.hint,fontSize:13}}>Nu exista date</div>
  const W=560, H=height, PAD={top:16,right:16,bottom:28,left:44}
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom
  const axes={}
  metrics.forEach(m=>{
    const axis=m.yAxis||'left'
    if(!axes[axis]) axes[axis]={min:0,max:0}
    data.forEach(d=>{const v=d[m.field]||0;if(v<axes[axis].min)axes[axis].min=v;if(v>axes[axis].max)axes[axis].max=v})
    // Guard: if all values are 0 or identical, set range to 1 to avoid div by zero
    axes[axis].min=Math.min(0,axes[axis].min)
    axes[axis].range=Math.max((axes[axis].max-axes[axis].min),1)
  })
  const toY=(v,axis)=>{const ax=axes[axis||'left'];return PAD.top+cH-((v-ax.min)/ax.range)*cH}
  const toX=i=>PAD.left+(i/Math.max(data.length-1,1))*cW
  const step=Math.max(1,Math.floor(data.length/5))
  const xTicks=data.filter((_,i)=>i%step===0||i===data.length-1)
  const la=axes['left'], yTicks=la?[0,1,2,3,4].map(i=>la.min+(la.range/4)*i):[]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}} onMouseLeave={()=>setHover(null)}>
        {yTicks.map((t,i)=>{const y=toY(t,'left');return <g key={i}><line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y} stroke={C.border} strokeWidth=".5" strokeDasharray="3,3"/><text x={PAD.left-5} y={y+4} textAnchor="end" fontSize="9" fill={C.hint}>{Math.round(t)}</text></g>})}
        {xTicks.map((d,i)=>{const idx=data.indexOf(d);return <text key={i} x={toX(idx)} y={H-6} textAnchor="middle" fontSize="9" fill={C.hint}>{(d.date||'').slice(5)}</text>})}
        {metrics.map((m,mi)=>{
          const pts=data.map((d,i)=>`${toX(i).toFixed(1)},${toY(d[m.field]||0,m.yAxis).toFixed(1)}`).join(' ')
          const apts=`${toX(0)},${PAD.top+cH} ${pts} ${toX(data.length-1)},${PAD.top+cH}`
          return <g key={mi}>
            <polyline points={apts} fill={m.color||COLORS[mi]} fillOpacity=".08" stroke="none"/>
            <polyline points={pts} fill="none" stroke={m.color||COLORS[mi]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
          </g>
        })}
        {data.map((d,i)=><rect key={i} x={toX(i)-8} y={PAD.top} width={16} height={cH} fill="transparent" onMouseEnter={()=>setHover({d,x:toX(i),y:PAD.top})}/>)}
        {hover&&(<g>
          <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={H-PAD.bottom} stroke={C.muted} strokeWidth=".5" strokeDasharray="3,2"/>
          {metrics.map((m,mi)=>{const v=hover.d[m.field]||0;return <circle key={mi} cx={hover.x} cy={toY(v,m.yAxis)} r="3" fill={m.color||COLORS[mi]} stroke="#fff" strokeWidth="1.5"/>})}
          <rect x={Math.min(hover.x+8,W-130)} y={hover.y} width={124} height={14+metrics.length*16} rx="5" fill="#0f172a" opacity=".92"/>
          <text x={Math.min(hover.x+14,W-124)} y={hover.y+11} fontSize="9.5" fill="#94a3b8">{hover.d.date}</text>
          {metrics.map((m,mi)=><text key={mi} x={Math.min(hover.x+14,W-124)} y={hover.y+11+(mi+1)*16} fontSize="9.5" fontWeight="500" fill={m.color||COLORS[mi]}>{m.label}: {fmt(hover.d[m.field]||0,m.fmt)}</text>)}
        </g>)}
      </svg>
      {showLegend&&<div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:8}}>{metrics.map((m,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:C.muted}}><div style={{width:18,height:2.5,background:m.color||COLORS[i],borderRadius:2}}/>{m.label}</div>)}</div>}
    </div>
  )
}

export function BarChart({ data, labelField, valueField, color='#3B82C4', maxBars=8, sub }) {
  const top=[...data].sort((a,b)=>(b[valueField]||0)-(a[valueField]||0)).slice(0,maxBars)
  const maxV=Math.max(...top.map(d=>d[valueField]||0),1)
  const isPath = labelField==='page_path'||labelField==='page'
  return (
    <div>
      {top.map((d,i)=>{
        const v=d[valueField]||0, pct=v/maxV*100
        const label=(d[labelField]||'').replace('https://homepitch.ro','')
        const subVal = sub ? d[sub] : null
        return (
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <span style={{fontSize:11,fontFamily:label.startsWith('/')?'monospace':'inherit',color:C.text,width:164,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={label}>
              {isPath&&label.startsWith('/')?<PageLink path={label}>{label}</PageLink>:label}
            </span>
            <div style={{flex:1,background:'#ebebE4',borderRadius:99,height:6,overflow:'hidden'}}>
              <div style={{width:`${pct}%`,height:6,borderRadius:99,background:color}}/>
            </div>
            <span style={{fontSize:12,color:C.muted,width:44,textAlign:'right',flexShrink:0}}>{fmtN(v)}</span>
            {subVal!==null&&<span style={{fontSize:11,color:C.hint,width:36,textAlign:'right',flexShrink:0}}>{typeof subVal==='number'?subVal.toFixed(1)+'%':subVal}</span>}
          </div>
        )
      })}
    </div>
  )
}

export const BASE_URL = 'https://homepitch.ro'

export function PageLink({ path, children, style }) {
  if (!path) return <span style={style}>{children || path}</span>
  const href = path.startsWith('http') ? path : BASE_URL + path
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{color:'inherit',textDecoration:'none',borderBottom:'0.5px dashed #ccc',...style}}
      onMouseEnter={e=>e.target.style.borderBottomColor=C.blue}
      onMouseLeave={e=>e.target.style.borderBottomColor='#ccc'}>
      {children || path}
    </a>
  )
}
