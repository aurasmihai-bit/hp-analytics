// Logica pura (fara env / fetch) pentru raportul /api/report si tab-urile dashboard:
// - zile calendaristice in ora Romaniei (Europe/Bucharest),
// - perioada curenta / anterioara de lungime egala, fara ziua de azi,
// - cand se reimprospateaza o zi din cache-ul hp_tab_data_daily,
// - CTR / pozitie GSC ponderate, delta pe pagini, referrers interni,
// - paginare pentru citiri care pot trece de 1000 de randuri.
// Testata in tests/report-metrics.test.mjs. Fara importuri, ca sa mearga si in client si in node --test.

export const REPORT_TIME_ZONE = 'Europe/Bucharest'

// ── Zile si fus orar ─────────────────────────────────────────────────

export function addDaysIso(date, days) {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(start, end) {
  return Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 864e5)
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Ziua calendaristica (YYYY-MM-DD) in ora Romaniei pentru un timestamp.
export function bucharestDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const parts = dateFormatter.formatToParts(d)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: REPORT_TIME_ZONE,
  timeZoneName: 'shortOffset',
})

// Decalajul Bucuresti fata de UTC, in minute, la un moment dat (120 iarna, 180 vara).
function offsetMinutesAt(time) {
  const raw = offsetFormatter.formatToParts(new Date(time)).find(p => p.type === 'timeZoneName')?.value || 'GMT+2'
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 120
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0)
  return match[1] === '-' ? -minutes : minutes
}

// Momentul UTC (ISO) la care incepe ziua `date` in ora Romaniei.
export function bucharestDayStartUtc(date) {
  const utcMidnight = Date.parse(`${date}T00:00:00.000Z`)
  let start = utcMidnight - offsetMinutesAt(utcMidnight) * 60000
  // a doua trecere corecteaza zilele in care se schimba ora
  start = utcMidnight - offsetMinutesAt(start) * 60000
  return new Date(start).toISOString()
}

// Ultima milisecunda a zilei `date` in ora Romaniei (ISO UTC).
export function bucharestDayEndUtc(date) {
  return new Date(Date.parse(bucharestDayStartUtc(addDaysIso(date, 1))) - 1).toISOString()
}

// Perioada curenta = ultimele `days` zile complete (pana ieri, ora Romaniei);
// perioada anterioara are exact aceeasi lungime si se termina in ziua dinaintea celei curente.
export function completedDaysRange(days, now = new Date()) {
  const n = Math.max(1, Math.floor(Number(days) || 1))
  const today = bucharestDate(now)
  const currTo = addDaysIso(today, -1)
  const currFrom = addDaysIso(currTo, -(n - 1))
  const prevTo = addDaysIso(currFrom, -1)
  const prevFrom = addDaysIso(prevTo, -(n - 1))
  return { currFrom, currTo, prevFrom, prevTo }
}

// Saptamana luni–duminica, in ora Romaniei. offsetWeeks = 0 → saptamana curenta, 1 → cea trecuta.
export function weekBounds(offsetWeeks = 0, now = new Date()) {
  const today = bucharestDate(now)
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay() // 0 = duminica
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const start = addDaysIso(today, mondayOffset - offsetWeeks * 7)
  return { start, end: addDaysIso(start, 6) }
}

export function previousWeekStart(weekStart) {
  return addDaysIso(weekStart, -7)
}

// ── Cache zilnic: cand e o zi "completa" ─────────────────────────────

// GA4 mai modifica cifrele cateva zile, GSC are 2–3 zile intarziere.
export const GA4_SETTLE_DAYS = 3
export const GSC_SETTLE_DAYS = 4
export const TAB_DAY_REFRESH_MIN_AGE_HOURS = 6

// O zi salvata la `syncedAt` e completa pentru GA4 daca a fost salvata cel mai devreme
// la GA4_SETTLE_DAYS zile dupa ea (ora Romaniei); la fel pentru GSC.
export function tabDayCompleteness(date, syncedAt) {
  const syncDate = syncedAt ? bucharestDate(syncedAt) : null
  if (!date || !syncDate) return { ga4Complete: false, gscComplete: false }
  const lag = daysBetween(date, syncDate)
  return {
    ga4Complete: lag >= GA4_SETTLE_DAYS,
    gscComplete: lag >= GSC_SETTLE_DAYS,
  }
}

function rowNeedsData(row) {
  const computed = tabDayCompleteness(row?.data_date, row?.synced_at || row?.updated_at)
  const sources = row?.sources || {}
  // Randurile noi au completitudinea salvata (inclusiv GSC esuat la salvare); cele vechi o calculam.
  const ga4Complete = typeof sources.ga4Complete === 'boolean' ? sources.ga4Complete : computed.ga4Complete
  const gscComplete = typeof sources.gscComplete === 'boolean' ? sources.gscComplete : computed.gscComplete
  const gscFailed = sources.gsc === 'error'
  return !ga4Complete || !gscComplete || gscFailed
}

// Zilele din cache care trebuie recitite: zilele recente (ultimele 3 pentru GA4, 4 pentru GSC)
// si zilele salvate inainte sa fie complete (de ex. ziua de azi salvata partial) sau cu GSC esuat.
// Fara `force`, o zi se reciteste cel mult o data la `minAgeHours` ore. `maxDays` limiteaza
// cate zile vechi (in afara ferestrei recente) se recitesc la un request.
export function selectTabDayRefreshDates(rows = [], { now = new Date(), force = false, minAgeHours = TAB_DAY_REFRESH_MIN_AGE_HOURS, maxDays = 10 } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now)
  const today = bucharestDate(nowMs)
  const recent = []
  const older = []
  for (const row of rows || []) {
    if (!row?.data_date || row.data_date > today) continue
    if (!rowNeedsData(row)) continue
    const synced = Date.parse(row.synced_at || row.updated_at || '')
    const ageHours = Number.isFinite(synced) ? (nowMs - synced) / 36e5 : Infinity
    if (!force && ageHours < minAgeHours) continue
    const inRecentWindow = daysBetween(row.data_date, today) <= GSC_SETTLE_DAYS
    ;(inRecentWindow ? recent : older).push(row.data_date)
  }
  older.sort().reverse()
  return [...recent, ...older.slice(0, Math.max(0, maxDays))].sort()
}

// ── GSC ──────────────────────────────────────────────────────────────

// CTR = clickuri / impresii; pozitia medie ponderata cu impresiile.
export function gscTotals(rows = []) {
  let clicks = 0
  let impressions = 0
  let weightedPosition = 0
  for (const row of rows || []) {
    const rowImpressions = Number(row?.organic_google_search_impressions || 0)
    clicks += Number(row?.organic_google_search_clicks || 0)
    impressions += rowImpressions
    weightedPosition += Number(row?.organic_google_search_average_position || 0) * rowImpressions
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : null,
    position: impressions > 0 ? weightedPosition / impressions : null,
  }
}

// ── Pagini ───────────────────────────────────────────────────────────

// `previous` este deja perioada anterioara reala (cache zilnic, GA4 direct, Windsor):
// fiecare pagina se compara direct cu valoarea ei din perioada anterioara.
export function buildPreviousMap(previous = [], key = 'page_path') {
  const map = {}
  for (const row of previous || []) {
    const k = row?.[key]
    if (k === undefined || k === null) continue
    if (!map[k]) { map[k] = { ...row }; continue }
    Object.keys(row).forEach(field => {
      if (field !== key && typeof row[field] === 'number') map[k][field] = (map[k][field] || 0) + row[field]
    })
  }
  return map
}

// Evenimente-cheie GA4 la 100 de views/sesiuni. Nu e procent: un view poate avea mai multe evenimente.
export function keyEventsPer100(keyEvents, denominator) {
  const d = Number(denominator || 0)
  if (!(d > 0)) return 0
  return Number(keyEvents || 0) / d * 100
}

// ── Formulare de cerere (V = /vreau, VH = /new) ──────────────────────

export const REQUEST_FORM_PATHS = ['/vreau', '/new']

export function isNewFormPath(path) {
  const clean = String(path || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  return clean === '/new' || clean.startsWith('/new/')
}

export function isVreauFormPath(path) {
  const clean = String(path || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  return clean === '/vreau' || clean.startsWith('/vreau/')
}

// Views pe formularele active (V + VH) dintr-o lista de pagini GA4.
export function activeFormViews(pages = []) {
  return (pages || []).reduce((sum, row) => {
    const path = row?.page_path
    return isVreauFormPath(path) || isNewFormPath(path) ? sum + Number(row?.screen_page_views || 0) : sum
  }, 0)
}

// ── Referrers ────────────────────────────────────────────────────────

export const INTERNAL_REFERRER_HOSTS = ['homepitch.ro', 'www.homepitch.ro']

export function isInternalReferrer(referrer) {
  const raw = String(referrer || '').trim()
  if (!raw || raw === '(direct)' || raw === '(not set)') return false
  let host = ''
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname
  } catch {
    return false
  }
  return INTERNAL_REFERRER_HOSTS.includes(host.toLowerCase())
}

// ── Useri ────────────────────────────────────────────────────────────

// activeUsers adunat pe zile nu e numar de useri unici: un user activ 3 zile apare de 3 ori.
export function activeUsersLabel(mode, short = false) {
  if (mode === 'daily_sum') return short ? 'Useri activi (sumă zilnică)' : 'Useri activi (sumă zilnică, nu useri unici)'
  return 'Useri activi'
}

// ── Paginare ─────────────────────────────────────────────────────────

// Citeste pagini de `pageSize` randuri pana cand o pagina vine incompleta.
// `fetchPage({ offset, limit })` intoarce un array. Daca serverul ignora offset-ul
// (pagina 2 = pagina 1), ne oprim si marcam `truncated`, ca sa nu dublam randuri.
export async function fetchAllPages(fetchPage, { pageSize = 1000, maxRows = 100000 } = {}) {
  const rows = []
  let offset = 0
  let firstKey = null
  let truncated = false
  while (offset < maxRows) {
    const limit = Math.min(pageSize, maxRows - offset)
    const page = await fetchPage({ offset, limit })
    const list = Array.isArray(page) ? page : []
    if (!list.length) break
    const key = JSON.stringify(list[0])
    if (offset > 0 && key === firstKey) { truncated = true; break }
    if (offset === 0) firstKey = key
    rows.push(...list)
    if (list.length < limit) break
    offset += list.length
    if (offset >= maxRows) truncated = true
  }
  return { rows, truncated }
}
