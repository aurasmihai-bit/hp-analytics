import { NextResponse } from 'next/server'
import { isDashboardSessionAuthorized } from '../../lib/auth'
import { fetchSeoReport, cached } from '../../lib/seo-report'
import { checkAgentDiscovery } from '../../lib/agent-discovery'
import { fetchGscTopQueries, isGscConfigured } from '../../lib/gsc'

export const dynamic = 'force-dynamic'

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

async function loadGsc(force) {
  if (!isGscConfigured()) {
    return { configured: false, message: 'Google Search Console nu este configurat (lipsește GOOGLE_SERVICE_ACCOUNT_JSON).' }
  }
  return cached('gsc-top-queries', async () => {
    // GSC are ~2-3 zile intarziere: ultimele 28 de zile complete.
    const end = new Date(Date.now() - 2 * 86400000)
    const start = new Date(end.getTime() - 27 * 86400000)
    try {
      const data = await fetchGscTopQueries({ start: isoDate(start), end: isoDate(end), rowLimit: 500 })
      return { configured: true, ...data }
    } catch (error) {
      console.error('[api/seo] GSC', error?.message)
      return { configured: true, error: 'Nu pot citi datele din Google Search Console.' }
    }
  }, { force })
}

export async function GET(request) {
  if (!isDashboardSessionAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const force = new URL(request.url).searchParams.get('refresh') === '1'

  const [seo, gsc, discovery] = await Promise.all([
    fetchSeoReport({ force }).catch(() => ({ configured: true, error: 'Nu pot citi raportul SEO.' })),
    loadGsc(force).catch(() => ({ configured: true, error: 'Nu pot citi datele din Google Search Console.' })),
    checkAgentDiscovery({ force }).catch(() => ({ error: 'Verificarea agent discovery a eșuat.' })),
  ])

  const status = seo?.error ? 502 : 200
  return NextResponse.json(
    { seo, gsc, discovery, ...(seo?.error ? { error: seo.error } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}
