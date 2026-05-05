import { NextResponse } from 'next/server'

export async function GET(request) {
  if (request.cookies.get('hp_session')?.value !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const KEY = process.env.SUPABASE_SERVICE_KEY || ''
  const URL = process.env.SUPABASE_URL || 'https://rstihjcnuazzyksdwczp.supabase.co'

  // Decode JWT payload to check role
  let role = 'unknown'
  try {
    const payload = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64').toString())
    role = payload.role
  } catch {}

  // Test REST call
  let test = null
  try {
    const res = await fetch(`${URL}/rest/v1/hp_analytics_snapshots?limit=1&select=id`, {
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    })
    test = { status: res.status, body: (await res.text()).slice(0, 300) }
  } catch(e) { test = { error: e.message } }

  return NextResponse.json({ keyRole: role, keyStart: KEY.slice(0,20)+'...', url: URL, test })
}
