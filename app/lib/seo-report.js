import { getOptionalEnv } from './env'

const DEFAULT_SEO_REPORT_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co/functions/v1/seo-report'
const CACHE_TTL_MS = 10 * 60 * 1000
const TIMEOUT_MS = 10 * 1000

const cache = new Map()

export async function cached(key, loader, { force = false, ttl = CACHE_TTL_MS } = {}) {
  const hit = cache.get(key)
  if (!force && hit && Date.now() - hit.at < ttl) return { ...hit.value, _cachedAt: new Date(hit.at).toISOString() }
  const value = await loader()
  if (!value?.error) cache.set(key, { at: Date.now(), value })
  return value
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

// Citeste raportul SEO/GEO din HomePitch (server-to-server). Tokenul nu iese niciodata din server.
export async function fetchSeoReport({ force = false } = {}) {
  const token = getOptionalEnv('SEO_REPORT_TOKEN')
  if (!token) return { configured: false, message: 'Lipsește SEO_REPORT_TOKEN în variabilele de mediu.' }
  const url = getOptionalEnv('HOMEPITCH_SEO_REPORT_URL') || DEFAULT_SEO_REPORT_URL

  return cached('seo-report', async () => {
    let res
    try {
      res = await fetchWithTimeout(url, { headers: { 'x-seo-report-token': token, Accept: 'application/json' } })
    } catch (error) {
      const timeout = error?.name === 'AbortError'
      return { configured: true, error: timeout ? 'Raportul SEO nu a răspuns în 10 secunde.' : 'Nu pot contacta raportul SEO din HomePitch.' }
    }
    if (res.status === 401) return { configured: true, error: 'Token invalid pentru raportul SEO (verifică SEO_REPORT_TOKEN).' }
    if (res.status === 503) return { configured: true, error: 'Raportul SEO nu este configurat încă în HomePitch.' }
    if (!res.ok) return { configured: true, error: `Raportul SEO a răspuns cu eroare (${res.status}).` }
    try {
      const report = await res.json()
      if (!report || typeof report !== 'object') return { configured: true, error: 'Raportul SEO a întors un răspuns invalid.' }
      return { configured: true, ...report }
    } catch {
      return { configured: true, error: 'Raportul SEO a întors un JSON invalid.' }
    }
  }, { force })
}
