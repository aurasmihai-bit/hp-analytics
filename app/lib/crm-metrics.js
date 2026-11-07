// Logica pura pentru CRM-uri (Cereri/Oferte, Concierge/Notariat): inactivitate de la ultima
// actiune, cazuri rezolvate in HomePitch, pipeline, ultimele N zile, timp pana la primul contact.
// Fara importuri, ca sa mearga in client, pe server si in node --test (tests/crm-metrics.test.mjs).

const DAY_MS = 864e5

function time(value) {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

function nowMs(now) {
  if (now === undefined || now === null) return Date.now()
  return now instanceof Date ? now.getTime() : Number(now)
}

// Evenimentele automate (sync HomePitch) nu sunt actiuni ale echipei.
const NON_ACTION_EVENTS = new Set(['homepitch_offer_synced', 'homepitch_offer_sync_failed'])

// Ultima actiune pe un caz: ultimul log (fara sync-uri automate), ultimul comentariu sau ultimul
// reminder. Fara nicio actiune, se intoarce data primirii.
export function lastActionAt({ log = [], comments = [], lastReminderAt = '', receivedAt = '' } = {}) {
  let latest = null
  const consider = value => {
    const t = time(value)
    if (t !== null && (latest === null || t > latest)) latest = t
  }
  for (const entry of Array.isArray(log) ? log : []) {
    if (NON_ACTION_EVENTS.has(entry?.event)) continue
    consider(entry?.created_at || entry?.at)
  }
  for (const entry of Array.isArray(comments) ? comments : []) {
    if (entry?.type === 'meta') continue
    consider(entry?.created_at)
  }
  consider(lastReminderAt)
  if (latest === null) consider(receivedAt)
  return latest === null ? null : new Date(latest).toISOString()
}

export function daysSince(value, now) {
  const t = time(value)
  if (t === null) return 0
  return Math.max(0, Math.floor((nowMs(now) - t) / DAY_MS))
}

// Pentru un caz Cereri/Oferte: zile de la ultima actiune si varsta cazului (de la primire).
export function requestOfferCaseTiming(row = {}, now) {
  const receivedAt = row.source_received_at || row.source_created_at || row.created_at || ''
  const last = lastActionAt({
    log: row.log,
    comments: row.comments,
    lastReminderAt: row.last_reminder_at,
    receivedAt,
  })
  return {
    lastActionAt: last || '',
    inactiveDays: daysSince(last, now),
    ageDays: daysSince(receivedAt, now),
  }
}

// Cazurile salvate in CRM care nu mai vin din exportul live au fost rezolvate in HomePitch
// (cumparatorul a raspuns, oferta a fost trimisa etc.). Le marcam doar cand lista live a venit
// complet (fara eroare si sub limita ceruta), altfel nu stim sigur.
export function markResolvedInHomePitch(storedOnly = [], { liveLoaded = false, liveCount = 0, liveLimit = Infinity } = {}) {
  const liveComplete = liveLoaded && liveCount < liveLimit
  return storedOnly.map(row => (liveComplete ? { ...row, resolvedInHomePitch: true } : row))
}

// ── Concierge ────────────────────────────────────────────────────────

export const CONCIERGE_LOST_STAGES = new Set(['refuz'])

// Pipeline = valoarea cererilor care nu sunt pierdute (refuz).
export function conciergePipelineValue(rows = [], valueOf = row => Number(row?.finalTotalEur || row?.estimatedTotalEur || 0)) {
  return (rows || [])
    .filter(row => !CONCIERGE_LOST_STAGES.has(row?.stage))
    .reduce((sum, row) => sum + Number(valueOf(row) || 0), 0)
}

// Cereri create in ultimele `days` zile fata de acum (nu fata de ultima cerere).
export function countCreatedSince(rows = [], days = 7, now, field = 'createdAt') {
  const from = nowMs(now) - days * DAY_MS
  return (rows || []).filter(row => {
    const t = time(row?.[field])
    return t !== null && t >= from
  }).length
}

// ── Timp pana la primul contact ──────────────────────────────────────

// Activitati care inseamna contact direct cu clientul (emailul cu linkul de plata).
const CONTACT_EVENTS = new Set(['payment_email_sent'])

// Primul moment in care echipa a facut ceva pe caz: primul comentariu, prima schimbare de etapa
// in afara de „nou” sau primul email trimis. Fara asa ceva → null (necontactat).
export function firstContactAt({ comments = [], log = [], emails = [], createdAt = '' } = {}) {
  const created = time(createdAt)
  let first = null
  const consider = value => {
    const t = time(value)
    if (t === null || (created !== null && t < created)) return
    if (first === null || t < first) first = t
  }
  for (const entry of Array.isArray(comments) ? comments : []) {
    if (!entry || entry.type === 'meta') continue
    if (!entry.type || entry.type === 'comment') { consider(entry.created_at); continue }
    const stage = entry.meta?.stage
    if (entry.meta?.event === 'stage_changed' && stage && stage !== 'nou') consider(entry.created_at)
    if (CONTACT_EVENTS.has(entry.meta?.event)) consider(entry.created_at)
  }
  for (const entry of Array.isArray(log) ? log : []) {
    if (NON_ACTION_EVENTS.has(entry?.event)) continue
    const stage = entry?.meta?.stage
    if (stage && stage !== 'nou') consider(entry?.created_at)
  }
  for (const email of Array.isArray(emails) ? emails : []) consider(email?.created_at || email?.sent_at)
  return first === null ? null : new Date(first).toISOString()
}

function medianOf(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

// items = [{ createdAt, firstContactAt }] → mediana orelor pana la primul contact si cate
// cazuri nu au inca niciun contact.
export function firstContactStats(items = []) {
  const hours = []
  let uncontacted = 0
  for (const item of items || []) {
    const created = time(item?.createdAt)
    const contacted = time(item?.firstContactAt)
    if (created === null) continue
    if (contacted === null) { uncontacted += 1; continue }
    hours.push((contacted - created) / 36e5)
  }
  return {
    medianHours: medianOf(hours),
    contacted: hours.length,
    uncontacted,
    within24h: hours.filter(h => h <= 24).length,
  }
}
