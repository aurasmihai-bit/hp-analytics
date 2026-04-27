'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      setError('Parola incorecta')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f5f3'
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, border: '0.5px solid #e0e0d8',
        padding: '40px 48px', width: 360, maxWidth: '90vw'
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: '#1A2B4A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, fontSize: 18, color: '#fff', fontWeight: 600
          }}>H</div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: '#1a1a18' }}>
            HomePitch Analytics
          </h1>
          <p style={{ fontSize: 13, color: '#888', margin: '6px 0 0' }}>
            Raport saptamanal intern
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>
              Parola de acces
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', border: '0.5px solid #d0d0c8',
                borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box',
                background: '#fafaf8'
              }}
            />
          </div>
          {error && <p style={{ fontSize: 13, color: '#c0392b', margin: '0 0 12px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '11px', background: '#1A2B4A', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              opacity: loading || !password ? 0.6 : 1
            }}
          >
            {loading ? 'Se verifica...' : 'Intra in raport'}
          </button>
        </form>
      </div>
    </div>
  )
}
