'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { C } from '../components'
import { TabConcierge } from '../tabs7'

const LIGHT_THEME = {
  '--hp-bg':'#f5f5f3',
  '--hp-card':'#ffffff',
  '--hp-input':'#ffffff',
  '--hp-border':'#e8e8e0',
  '--hp-text':'#1a1a18',
  '--hp-muted':'#666660',
  '--hp-hint':'#999990',
  '--hp-navy':'#1A2B4A',
  '--hp-blue':'#3B82C4',
  '--hp-green':'#16A34A',
  '--hp-amber':'#D97706',
  '--hp-red':'#DC2626',
  '--hp-gray':'#6B7280',
  '--hp-purple':'#7C3AED',
  '--hp-teal':'#0891B2',
  '--hp-soft-blue':'#EBF4FC',
  '--hp-soft-green':'#F0FDF4',
  '--hp-soft-amber':'#FFF7ED',
  '--hp-soft-red':'#FEF2F2',
  '--hp-soft-panel':'#F5F5F3',
}

const DARK_THEME = {
  '--hp-bg':'#0f172a',
  '--hp-card':'#111827',
  '--hp-input':'#0b1220',
  '--hp-border':'#273449',
  '--hp-text':'#f8fafc',
  '--hp-muted':'#cbd5e1',
  '--hp-hint':'#94a3b8',
  '--hp-navy':'#dbeafe',
  '--hp-blue':'#60a5fa',
  '--hp-green':'#4ade80',
  '--hp-amber':'#fbbf24',
  '--hp-red':'#f87171',
  '--hp-gray':'#94a3b8',
  '--hp-purple':'#a78bfa',
  '--hp-teal':'#2dd4bf',
  '--hp-soft-blue':'#10243d',
  '--hp-soft-green':'#102a1b',
  '--hp-soft-amber':'#33250b',
  '--hp-soft-red':'#351616',
  '--hp-soft-panel':'#162033',
}

export default function ConciergeDashboardPage() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setDarkMode(localStorage.getItem('hp_concierge_theme') === 'dark')
  }, [])

  function toggleTheme() {
    setDarkMode(current => {
      const next = !current
      localStorage.setItem('hp_concierge_theme', next ? 'dark' : 'light')
      return next
    })
  }

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'})
    window.location.href='/login'
  }

  const theme = darkMode ? DARK_THEME : LIGHT_THEME

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,...theme}}>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',gap:12,height:52,position:'sticky',top:0,zIndex:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:6,background:darkMode?'#1d4ed8':C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12}}>H</div>
          <span style={{fontSize:14,fontWeight:500,color:C.text}}>HomePitch Analytics</span>
          <span style={{fontSize:11,color:C.hint}}>· Concierge CRM</span>
        </div>
        <div style={{flex:1}}/>
        <button
          onClick={toggleTheme}
          aria-pressed={darkMode}
          title={darkMode ? 'Treci pe light mode' : 'Treci pe dark mode'}
          style={{
            height:28,minWidth:62,padding:3,border:`0.5px solid ${C.border}`,borderRadius:999,
            background:darkMode?'#020617':C.softPanel,cursor:'pointer',display:'flex',alignItems:'center',
            justifyContent:darkMode?'flex-end':'flex-start',transition:'all .18s ease',
          }}
        >
          <span style={{
            width:22,height:22,borderRadius:'50%',background:darkMode?'#f8fafc':'#ffffff',
            boxShadow:'0 1px 4px rgba(0,0,0,.18)',display:'flex',alignItems:'center',justifyContent:'center',
            color:darkMode?'#0f172a':'#f59e0b',fontSize:12,lineHeight:1,
          }}>{darkMode?'●':'○'}</span>
        </button>
        <a href="/dashboard" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,textDecoration:'none'}}>Dashboard</a>
        <a href="/dashboard/cereri-piata" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.green}`,borderRadius:6,background:C.softGreen,color:C.green,textDecoration:'none'}}>Cereri piata</a>
        <button onClick={logout} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>Iesi</button>
      </div>
      <main style={{maxWidth:1180,margin:'0 auto',padding:'20px 16px'}}>
        <TabConcierge />
      </main>
    </div>
  )
}
