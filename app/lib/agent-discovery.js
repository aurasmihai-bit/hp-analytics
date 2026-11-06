import { getOptionalEnv } from './env'
import { cached, fetchWithTimeout } from './seo-report'

export const AGENT_DISCOVERY_ENDPOINTS = [
  { label: 'API catalog', path: '/.well-known/api-catalog', kind: 'json', preferred: ['application/linkset+json', 'application/json'] },
  { label: 'Agent skills index', path: '/.well-known/agent-skills/index.json', kind: 'json', preferred: ['application/json'] },
  { label: 'MCP server card', path: '/.well-known/mcp/server-card.json', kind: 'json', preferred: ['application/json'] },
  { label: 'API docs', path: '/api-docs', kind: 'html' },
  { label: 'Aliat buyer services', path: '/aliat', kind: 'html' },
  { label: 'Cereri servicii', path: '/cereri-servicii', kind: 'html' },
]

function baseUrl() {
  return (getOptionalEnv('HOMEPITCH_APP_URL') || 'https://homepitch.ro').replace(/\/+$/, '')
}

function mediaType(res) {
  return String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
}

async function checkEndpoint(origin, endpoint) {
  const url = origin + endpoint.path
  let res
  try {
    res = await fetchWithTimeout(url, { headers: { Accept: endpoint.kind === 'json' ? 'application/linkset+json, application/json;q=0.9, */*;q=0.5' : 'text/html' }, redirect: 'follow' }, 8000)
  } catch (error) {
    return { ...endpoint, url, status: 0, content_type: '', state: 'fail', reason: error?.name === 'AbortError' ? 'Timeout (8s)' : 'Nu răspunde' }
  }
  const type = mediaType(res)
  const base = { ...endpoint, url, status: res.status, content_type: type || '(lipsă)' }
  if (!res.ok) return { ...base, state: 'fail', reason: `HTTP ${res.status}` }

  if (endpoint.kind === 'json') {
    const text = await res.text().catch(() => '')
    let parses = false
    try { JSON.parse(text); parses = true } catch {}
    if (!parses) return { ...base, json_valid: false, state: 'fail', reason: 'Răspunsul nu este JSON valid' }
    if (!endpoint.preferred.includes(type)) {
      return { ...base, json_valid: true, state: 'warn', reason: `Content-Type „${type || 'lipsă'}”; ar trebui ${endpoint.preferred.join(' sau ')}` }
    }
    return { ...base, json_valid: true, state: 'ok', reason: 'JSON valid' }
  }

  res.body?.cancel?.().catch(() => {})
  if (type !== 'text/html') return { ...base, state: 'warn', reason: `Content-Type „${type || 'lipsă'}”; ar trebui text/html` }
  return { ...base, state: 'ok', reason: 'Pagina răspunde' }
}

async function checkHomepageLink(origin) {
  const url = origin + '/'
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'text/html' }, redirect: 'follow' }, 8000)
    res.body?.cancel?.().catch(() => {})
    const link = res.headers.get('link') || ''
    if (!res.ok) return { label: 'Link header pe homepage', path: '/', url, status: res.status, state: 'fail', reason: `HTTP ${res.status}`, link: '' }
    if (!link) return { label: 'Link header pe homepage', path: '/', url, status: res.status, state: 'fail', reason: 'Homepage nu trimite header Link (ex. rel="api-catalog")', link: '' }
    const hasCatalog = /api-catalog/i.test(link)
    return {
      label: 'Link header pe homepage', path: '/', url, status: res.status,
      state: hasCatalog ? 'ok' : 'warn',
      reason: hasCatalog ? 'Header Link prezent, include api-catalog' : 'Header Link prezent, dar fără rel="api-catalog"',
      link: link.slice(0, 500),
    }
  } catch (error) {
    return { label: 'Link header pe homepage', path: '/', url, status: 0, state: 'fail', reason: error?.name === 'AbortError' ? 'Timeout (8s)' : 'Nu răspunde', link: '' }
  }
}

// Verificare live (server-side) a endpoint-urilor de agent discovery, cache 10 minute.
export async function checkAgentDiscovery({ force = false } = {}) {
  const origin = baseUrl()
  return cached('agent-discovery', async () => {
    const [homepage, ...endpoints] = await Promise.all([
      checkHomepageLink(origin),
      ...AGENT_DISCOVERY_ENDPOINTS.map(endpoint => checkEndpoint(origin, endpoint)),
    ])
    return { origin, checked_at: new Date().toISOString(), homepage, endpoints }
  }, { force })
}
