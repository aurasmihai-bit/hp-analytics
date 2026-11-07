import { getOptionalEnv } from './env'
import { fetchWithTimeout } from './seo-report'
import { GSC_SCOPE, getConfiguredSiteUrl, isGscConfigured, querySearchAnalytics } from './gsc'
import { getGoogleAccessToken } from './google-auth'

const DEFAULT_INGEST_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co/functions/v1/seo-gsc-ingest'
const TIMEOUT_MS = 20 * 1000
const BATCH_SIZE = 2000
const QUERY_ROW_CAP = 5000
const QUERY_PAGE_ROW_CAP = 1000
const DAY_MS = 86400000

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function numberValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Ultimele 28 de zile complete; GSC are ~2-3 zile intarziere, deci finalul e azi - 3 zile.
export function gscPushRange(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(today.getTime() - 3 * DAY_MS)
  const start = new Date(end.getTime() - 27 * DAY_MS)
  return { start_date: isoDate(start), end_date: isoDate(end) }
}

// Citeste pana la `cap` randuri, paginat cu startRow.
async function queryAllRows(accessToken, siteUrl, body, cap) {
  const rows = []
  while (rows.length < cap) {
    const rowLimit = Math.min(cap - rows.length, 25000)
    const page = await querySearchAnalytics(accessToken, siteUrl, { ...body, rowLimit, startRow: rows.length })
    rows.push(...page)
    if (page.length < rowLimit) break
  }
  return rows.slice(0, cap)
}

function mapRow(row, withPage) {
  return {
    query: row.keys?.[0] || '(not provided)',
    page: withPage ? row.keys?.[1] || null : null,
    clicks: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    ctr: numberValue(row.ctr),
    position: numberValue(row.position),
  }
}

function describeHttpError(status) {
  if (status === 404) return 'Endpoint-ul seo-gsc-ingest din HomePitch nu există încă (404).'
  if (status === 401 || status === 403) return `HomePitch a refuzat tokenul (${status}); verifică SEO_REPORT_TOKEN.`
  if (status === 503) return 'Ingestia SEO nu este configurată încă în HomePitch (503).'
  return `HomePitch a răspuns cu eroare (${status}).`
}

async function postBatch(url, token, payload) {
  let res
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-seo-report-token': token },
      body: JSON.stringify(payload),
    }, TIMEOUT_MS)
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'HomePitch nu a răspuns în 20 de secunde.' : 'Nu pot contacta HomePitch.' }
  }
  if (!res.ok) return { ok: false, status: res.status, error: describeHttpError(res.status) }
  return { ok: true }
}

// Trimite zilnic interogarile din Search Console catre HomePitch. Nu arunca niciodata.
export async function pushGscToHomePitch() {
  if (!isGscConfigured()) return { skipped: 'Google Search Console nu este configurat (lipsește GOOGLE_SERVICE_ACCOUNT_JSON).' }
  const token = getOptionalEnv('SEO_REPORT_TOKEN')
  if (!token) return { skipped: 'Lipsește SEO_REPORT_TOKEN.' }
  const url = getOptionalEnv('HOMEPITCH_SEO_INGEST_URL') || DEFAULT_INGEST_URL
  const site = getConfiguredSiteUrl()
  const { start_date, end_date } = gscPushRange()

  let rows
  try {
    const accessToken = await getGoogleAccessToken(GSC_SCOPE)
    const base = { searchType: 'web', startDate: start_date, endDate: end_date }
    const [queryRows, queryPageRows] = await Promise.all([
      queryAllRows(accessToken, site, { ...base, dimensions: ['query'] }, QUERY_ROW_CAP),
      queryAllRows(accessToken, site, { ...base, dimensions: ['query', 'page'] }, QUERY_PAGE_ROW_CAP),
    ])
    rows = [...queryRows.map(row => mapRow(row, false)), ...queryPageRows.map(row => mapRow(row, true))]
  } catch (error) {
    console.error('[gsc-push] GSC', error?.message)
    return { ok: false, rows_sent: 0, batches: 0, error: 'Nu pot citi datele din Google Search Console.' }
  }

  if (!rows.length) return { ok: true, rows_sent: 0, batches: 0, start_date, end_date, message: 'Search Console nu a întors niciun rând.' }

  let rowsSent = 0
  let batches = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const result = await postBatch(url, token, { site, start_date, end_date, rows: chunk })
    if (!result.ok) {
      console.error('[gsc-push] HomePitch', result.status || '', result.error)
      return { ok: false, rows_sent: rowsSent, batches, start_date, end_date, error: result.error }
    }
    rowsSent += chunk.length
    batches += 1
  }

  return { ok: true, rows_sent: rowsSent, batches, start_date, end_date }
}
