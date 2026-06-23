'use client'

import { useEffect, useState } from 'react'
import { C } from '../components'
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY, ThemeSwitch } from '../theme'

export function ConciergeShell({ children, maxWidth = 1180 }) {
  const [darkMode, setDarkMode] = useState(false)
  const [session, setSession] = useState({ canAccessAll: false })

  useEffect(() => {
    setDarkMode(localStorage.getItem(THEME_STORAGE_KEY) === 'dark' || localStorage.getItem('hp_concierge_theme') === 'dark')
    fetch('/api/concierge/session', { cache:'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(json => json && setSession(json))
      .catch(() => {})
  }, [])

  function toggleTheme() {
    setDarkMode(current => {
      const next = !current
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
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
          <span style={{fontSize:11,color:C.hint}}>· CRM servicii</span>
        </div>
        <div style={{flex:1}}/>
        <ThemeSwitch darkMode={darkMode} onToggle={toggleTheme}/>
        {session.canAccessAll && (
          <>
            <a href="/dashboard" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,textDecoration:'none'}}>Trafic</a>
            <a href="/dashboard/cereri-piata" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.green}`,borderRadius:6,background:C.softGreen,color:C.green,textDecoration:'none'}}>Cereri piata</a>
            <a href="/dashboard/cereri-oferte" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.amber}`,borderRadius:6,background:C.softAmber,color:C.amber,textDecoration:'none'}}>Cereri/Oferte</a>
            <a href="/dashboard/servicii" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.green}`,borderRadius:6,background:C.softGreen,color:C.green,textDecoration:'none'}}>CRM servicii</a>
            <a href="/dashboard/procese-automate" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.blue}`,borderRadius:6,background:C.softBlue,color:C.blue,textDecoration:'none'}}>Procese automate</a>
          </>
        )}
        <button onClick={logout} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>Iesi</button>
      </div>
      <main style={{maxWidth,margin:'0 auto',padding:'20px 16px'}}>
        {children}
      </main>
    </div>
  )
}
