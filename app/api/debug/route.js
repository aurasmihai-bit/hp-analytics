import { NextResponse } from 'next/server'
import { requireEnv } from '../../lib/env'

export async function GET(request) {
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret || request.cookies.get('hp_session')?.value !== sessionSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let KEY, URL
  try {
    KEY = requireEnv('SUPABASE_SERVICE_KEY')
    URL = requireEnv('SUPABASE_URL')
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

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

  return NextResponse.json({ keyRole: role, url: URL, test })
}
