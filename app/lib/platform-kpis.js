// Calcule pure pentru KPI-urile din platforma HomePitch (punctul 6 din audit):
// cereri la 1.000 de sesiuni, drafturi → cereri, timp pana la prima oferta, abonati VIP,
// incercari de notificare. Fara importuri; testat in tests/platform-kpis.test.mjs.

function time(value) {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

function medianOf(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

// Cereri reale (buyer_requests) la 1.000 de sesiuni GA4.
export function requestsPer1000Sessions(requests, sessions) {
  const s = Number(sessions || 0)
  if (!(s > 0)) return null
  return Number(requests || 0) / s * 1000
}

// Drafturi de formular incepute in perioada vs cereri create in perioada.
// Nu leaga draftul de cererea lui (nu stim coloana de legatura), deci e un raport orientativ.
export function draftFunnel(drafts, requests) {
  const d = Number(drafts || 0)
  const r = Number(requests || 0)
  return {
    drafts: d,
    requests: r,
    requestsPerDraft: d > 0 ? r / d : null,
  }
}

// requests = [{ id, created_at }], offers = [{ request_id, created_at }]
// → mediana orelor pana la prima oferta, % cereri cu oferta in 48 h (din cererile care au
// avut deja 48 h la dispozitie), cereri fara oferta.
export function firstOfferStats(requests = [], offers = [], { now = Date.now(), windowHours = 48 } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now)
  const firstOffer = new Map()
  for (const offer of offers || []) {
    const id = offer?.request_id
    const t = time(offer?.created_at)
    if (!id || t === null) continue
    if (!firstOffer.has(id) || t < firstOffer.get(id)) firstOffer.set(id, t)
  }
  const hours = []
  let eligible = 0
  let within = 0
  let withoutOffer = 0
  for (const request of requests || []) {
    const created = time(request?.created_at)
    if (!request?.id || created === null) continue
    const first = firstOffer.get(request.id)
    if (first !== undefined && first >= created) hours.push((first - created) / 36e5)
    else withoutOffer += 1
    if (nowMs - created >= windowHours * 36e5) {
      eligible += 1
      if (first !== undefined && first >= created && first - created <= windowHours * 36e5) within += 1
    }
  }
  return {
    requests: (requests || []).length,
    withOffer: hours.length,
    withoutOffer,
    medianHoursToFirstOffer: medianOf(hours),
    eligibleFor48h: eligible,
    within48h: within,
    within48hRate: eligible > 0 ? within / eligible * 100 : null,
  }
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'activ'])

// rows = randuri vip_subscriptions. Fara coloana status nu putem spune care sunt active.
// MRR nu se calculeaza: nu stim sigur daca sumele sunt in centi sau in EUR.
export function vipSubscriptionSummary(rows = [], { start = '', end = '' } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const hasStatus = list.some(row => row && Object.prototype.hasOwnProperty.call(row, 'status'))
  const active = hasStatus
    ? list.filter(row => ACTIVE_SUBSCRIPTION_STATUSES.has(String(row?.status || '').toLowerCase())).length
    : null
  const inPeriod = value => {
    const day = String(value || '').slice(0, 10)
    return day && (!start || day >= start) && (!end || day <= end)
  }
  const statuses = {}
  for (const row of list) {
    const key = hasStatus ? String(row?.status || '—') : '—'
    statuses[key] = (statuses[key] || 0) + 1
  }
  return {
    total: list.length,
    active,
    statusAvailable: hasStatus,
    newInPeriod: list.filter(row => inPeriod(row?.created_at)).length,
    byStatus: Object.entries(statuses).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    mrr: null,
    mrrNote: 'MRR nu se calculeaza: nu e clar din cod daca sumele din vip_subscriptions sunt in centi sau in EUR.',
  }
}

const FAILED_STATUSES = /fail|error|bounce|reject|invalid/i

// rows = [{ status, created_at }] din notification_email_attempts.
export function notificationAttemptSummary(rows = []) {
  const list = Array.isArray(rows) ? rows : []
  const hasStatus = list.some(row => row && Object.prototype.hasOwnProperty.call(row, 'status'))
  const failed = hasStatus ? list.filter(row => FAILED_STATUSES.test(String(row?.status || ''))).length : null
  const last = list.reduce((max, row) => {
    const t = time(row?.created_at)
    return t !== null && (max === null || t > max) ? t : max
  }, null)
  return {
    attempts: list.length,
    failed,
    failureRate: hasStatus && list.length ? failed / list.length * 100 : null,
    lastAttemptAt: last === null ? null : new Date(last).toISOString(),
  }
}
