'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CrmLoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/concierge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const json = await res.json().catch(() => ({}))

    if (res.ok) {
      router.push(json.user?.role === 'admin' ? '/dashboard' : '/dashboard/concierge')
      return
    }

    if (json.setupRequired) {
      setError('Tabela de useri CRM lipseste. Ruleaza migrarea supabase/hp_concierge_users.sql.')
    } else {
      setError(json.error || 'Credentiale CRM invalide')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#f5f5f3',padding:'28px 16px',boxSizing:'border-box',
    }}>
      <div style={{
        background:'#fff',borderRadius:14,border:'0.5px solid #e0e0d8',
        padding:'36px 40px',width:420,maxWidth:'100%',boxShadow:'0 12px 36px rgba(15,23,42,.08)',
      }}>
        <div style={{marginBottom:28}}>
          <div style={{
            width:42,height:42,borderRadius:10,background:'#1A2B4A',
            display:'flex',alignItems:'center',justifyContent:'center',
            marginBottom:16,fontSize:18,color:'#fff',fontWeight:700,
          }}>H</div>
          <h1 style={{fontSize:22,fontWeight:700,margin:'0 0 6px',color:'#1a1a18'}}>
            HomePitch CRM
          </h1>
          <p style={{fontSize:13,color:'#666660',margin:0,lineHeight:1.45}}>
            Autentificare pentru Concierge CRM si zona interna de analytics.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{display:'grid',gap:14,marginBottom:16}}>
            <label style={{display:'block'}}>
              <span style={{fontSize:12,color:'#555',display:'block',marginBottom:6}}>Username</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="crmadmin"
                autoFocus
                autoComplete="username"
                style={{
                  width:'100%',padding:'11px 12px',border:'0.5px solid #d0d0c8',
                  borderRadius:8,fontSize:15,outline:'none',boxSizing:'border-box',background:'#fafaf8',
                }}
              />
            </label>
            <label style={{display:'block'}}>
              <span style={{fontSize:12,color:'#555',display:'block',marginBottom:6}}>Parola</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width:'100%',padding:'11px 12px',border:'0.5px solid #d0d0c8',
                  borderRadius:8,fontSize:15,outline:'none',boxSizing:'border-box',background:'#fafaf8',
                }}
              />
            </label>
          </div>

          {error && <p style={{fontSize:13,color:'#c0392b',margin:'0 0 12px',lineHeight:1.45}}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width:'100%',padding:'12px',background:'#1A2B4A',color:'#fff',
              border:'none',borderRadius:8,fontSize:14,fontWeight:700,
              cursor:loading || !username || !password ? 'not-allowed' : 'pointer',
              opacity:loading || !username || !password ? 0.6 : 1,
            }}
          >
            {loading ? 'Se verifica...' : 'Intra in CRM'}
          </button>
        </form>
      </div>
    </div>
  )
}
