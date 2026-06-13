'use client'
export const dynamic = 'force-dynamic'

import { C } from '../components'
import { TabConcierge } from '../tabs7'

export default function ConciergeDashboardPage() {
  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'})
    window.location.href='/login'
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.card,borderBottom:`0.5px solid ${C.border}`,padding:'0 16px',display:'flex',alignItems:'center',gap:12,height:52,position:'sticky',top:0,zIndex:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:6,background:C.navy,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:12}}>H</div>
          <span style={{fontSize:14,fontWeight:500,color:C.text}}>HomePitch Analytics</span>
          <span style={{fontSize:11,color:C.hint}}>· Concierge CRM</span>
        </div>
        <div style={{flex:1}}/>
        <a href="/dashboard" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,textDecoration:'none'}}>Dashboard</a>
        <a href="/dashboard/cereri-piata" style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.green}`,borderRadius:6,background:'#F0FDF4',color:C.green,textDecoration:'none'}}>Cereri piata</a>
        <button onClick={logout} style={{padding:'4px 10px',fontSize:11,border:`0.5px solid ${C.border}`,borderRadius:6,background:'transparent',color:C.muted,cursor:'pointer'}}>Iesi</button>
      </div>
      <main style={{maxWidth:1180,margin:'0 auto',padding:'20px 16px'}}>
        <TabConcierge />
      </main>
    </div>
  )
}
