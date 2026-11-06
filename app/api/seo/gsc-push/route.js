import { NextResponse } from 'next/server'
import { isDashboardSessionAuthorized } from '../../../lib/auth'
import { pushGscToHomePitch } from '../../../lib/gsc-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Declansare manuala (test) a push-ului GSC catre HomePitch; acelasi push ruleaza zilnic din /api/sync.
export async function GET(request) {
  if (!isDashboardSessionAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await pushGscToHomePitch().catch(() => ({ ok: false, rows_sent: 0, batches: 0, error: 'Push-ul GSC a eșuat.' }))
  const status = result.skipped || result.ok ? 200 : 502
  return NextResponse.json(result, { status, headers: { 'Cache-Control': 'no-store' } })
}
