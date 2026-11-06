// Logica pura (fara env / fetch) pentru cererile HomePitch din buyer_requests:
// - ce coloane cerem din tabel (select construit din coloanele care exista),
// - atribuirea first-touch (landing_path, referrer, utm_*),
// - varianta formularului (V /vreau, VH /new, Istoric) si varianta homepage,
// - rata cumparatori inregistrati -> cel putin o cerere (useri distincti),
// - numele evenimentelor de formular din GA4 (Title Case si snake_case).
// Testata in tests/request-attribution.test.mjs.

// Coloanele de baza din buyer_requests folosite de sectiunea de cereri.
export const REQUEST_BASE_COLUMNS = [
  'id',
  'created_at',
  'status',
  'transaction_type',
  'property_type',
  'request_form_variant',
  'request_form_path',
  'homepage_variant',
]

// Coloanele first-touch pe care HomePitch le adauga pe buyer_requests.
export const REQUEST_ATTRIBUTION_COLUMNS = [
  'landing_path',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
]

// Lantul de fallback cand nu putem afla coloanele existente (proba fara randuri).
// Fiecare pas pastreaza request_form_variant / request_form_path / homepage_variant;
// abia ultimii pasi renunta la ele, pentru tabele foarte vechi.
export const REQUEST_SELECT_FALLBACKS = [
  [...REQUEST_BASE_COLUMNS, ...REQUEST_ATTRIBUTION_COLUMNS],
  [...REQUEST_BASE_COLUMNS],
  ['id', 'created_at', 'status', 'transaction_type', 'property_type', 'request_form_variant', 'request_form_path'],
  ['id', 'created_at', 'request_form_variant', 'request_form_path'],
  ['id', 'created_at'],
].map(columns => columns.join(','))

// Construieste select-ul din coloanele care exista efectiv in tabel.
// `available` = lista/Set de coloane din proba (select=*&limit=1).
// `extra` = coloane suplimentare cerute doar daca exista (ex. user_id).
export function buildRequestSelect(available, extra = []) {
  const set = available instanceof Set ? available : new Set(available || [])
  const wanted = [...REQUEST_BASE_COLUMNS, ...REQUEST_ATTRIBUTION_COLUMNS, ...extra]
  const columns = wanted.filter((column, index) => set.has(column) && wanted.indexOf(column) === index)
  if (!columns.includes('id') && set.has('id')) columns.unshift('id')
  return {
    select: columns.join(','),
    columns,
    attributionColumns: REQUEST_ATTRIBUTION_COLUMNS.filter(column => set.has(column)),
    attributionAvailable: REQUEST_ATTRIBUTION_COLUMNS.some(column => set.has(column)),
  }
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function normalizePathLike(value) {
  const raw = text(value)
  if (!raw) return ''
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : null
    return url ? (url.pathname || '/') : raw.split('?')[0].split('#')[0]
  } catch {
    return raw.split('?')[0].split('#')[0]
  }
}

export function pickRequestLandingPath(row = {}) {
  return text(row.landing_path)
}

export function pickRequestReferrer(row = {}) {
  return text(row.referrer)
}

export function pickRequestSource(row = {}) {
  const source = text(row.utm_source)
  const medium = text(row.utm_medium)
  const campaign = text(row.utm_campaign)
  const content = text(row.utm_content)
  const term = text(row.utm_term)
  const gclid = text(row.gclid)
  const fbclid = text(row.fbclid)
  // Fara utm_*: click id-urile si referrer-ul spun macar canalul.
  let sourceMedium = [source, medium].filter(Boolean).join(' / ')
  if (!sourceMedium && gclid) sourceMedium = 'google / cpc (gclid)'
  if (!sourceMedium && fbclid) sourceMedium = 'facebook / paid (fbclid)'
  return {
    source_medium: sourceMedium,
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
    utm_content: content,
    utm_term: term,
    has_click_id: Boolean(gclid || fbclid),
  }
}

// Atribuirea unei cereri. Cand tabelul nu are inca coloanele first-touch,
// cererea este "fara atribuire" (nu "(direct)": nu stim de unde a venit).
export function requestAttribution(row = {}, attributionAvailable = false) {
  const UNATTRIBUTED = 'fara atribuire'
  if (!attributionAvailable) {
    return { attributed: false, landing_path: UNATTRIBUTED, referrer_full: UNATTRIBUTED, source_medium: UNATTRIBUTED, utm_source: '', utm_medium: '', utm_campaign: '' }
  }
  const landing = normalizePathLike(pickRequestLandingPath(row))
  const referrer = pickRequestReferrer(row)
  const source = pickRequestSource(row)
  const attributed = Boolean(landing || referrer || source.source_medium)
  if (!attributed) {
    return { attributed: false, landing_path: UNATTRIBUTED, referrer_full: UNATTRIBUTED, source_medium: UNATTRIBUTED, utm_source: '', utm_medium: '', utm_campaign: '' }
  }
  return {
    attributed: true,
    landing_path: landing || '(unknown)',
    referrer_full: referrer || '(direct)',
    source_medium: source.source_medium || (referrer ? `${referrerHost(referrer)} / referral` : '(direct) / (none)'),
    utm_source: source.utm_source,
    utm_medium: source.utm_medium,
    utm_campaign: source.utm_campaign,
  }
}

function referrerHost(value) {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return value }
}

// V = /vreau, VH = /new, Istoric = fara varianta (cereri vechi).
export function requestFormVariantKey(row = {}) {
  const variant = text(row.request_form_variant).toUpperCase()
  if (variant === 'VH' || variant === 'V') return variant
  const path = normalizePathLike(row.request_form_path).toLowerCase()
  if (path === '/new' || path.startsWith('/new/')) return 'VH'
  if (path === '/vreau' || path.startsWith('/vreau/')) return 'V'
  return 'Istoric'
}

export const HOMEPAGE_VARIANT_KEYS = ['control', 'simplu', 'variant_c']

export function homepageVariantKey(row = {}) {
  const variant = text(row.homepage_variant).toLowerCase()
  return HOMEPAGE_VARIANT_KEYS.includes(variant) ? variant : 'necunoscut'
}

export function countRequestVariants(rows = []) {
  const form = { V: 0, VH: 0, Istoric: 0 }
  const homepage = { control: 0, simplu: 0, variant_c: 0, necunoscut: 0 }
  for (const row of rows) {
    form[requestFormVariantKey(row)] += 1
    homepage[homepageVariantKey(row)] += 1
  }
  return { form, homepage }
}

// Rata reala: din cumparatorii inregistrati in perioada (profiles.user_type = buyer),
// cati useri distincti au creat cel putin o cerere in perioada.
// `buyers` = [{ user_id }], `requests` = [{ user_id }]. Rezultatul este mereu 0..100%.
export function computeBuyerRequestConversion(buyers = [], requests = []) {
  const buyerIds = new Set(buyers.map(row => text(row?.user_id)).filter(Boolean))
  const requesterIds = new Set(requests.map(row => text(row?.user_id)).filter(Boolean))
  let buyersWithRequest = 0
  for (const id of buyerIds) if (requesterIds.has(id)) buyersWithRequest += 1
  return {
    buyersRegistered: buyerIds.size,
    buyersWithRequest,
    requestersTotal: requesterIds.size,
    rate: buyerIds.size ? buyersWithRequest / buyerIds.size * 100 : null,
  }
}

// Fallback cand datele de platforma lipsesc: cereri / inregistrare GA4,
// ca raport (ex. 1.8), niciodata ca procent peste 100.
export function requestsPerGa4Signup(requests, signups) {
  const r = Number(requests || 0)
  const s = Number(signups || 0)
  if (!(s > 0)) return null
  return r / s
}

// Evenimentele de formular: HomePitch trimite in GA4 snake_case
// (form_step_completed ...), istoric au existat si numele Title Case.
export const REQUEST_FORM_EVENT_ALIASES = {
  form_started: ['[Amplitude] Form Started', 'form_started'],
  form_submitted: ['[Amplitude] Form Submitted', 'form_submitted'],
  form_step_completed: ['Form Step Completed', 'form_step_completed'],
  form_validation_error: ['Form Validation Error', 'form_validation_error'],
  form_abandoned: ['Form Abandoned', 'form_abandoned'],
  request_created: ['Request Created', 'request_created'],
}

const EVENT_ALIAS_LOOKUP = Object.entries(REQUEST_FORM_EVENT_ALIASES).reduce((acc, [key, names]) => {
  names.forEach(name => { acc[name.toLowerCase()] = key })
  return acc
}, {})

export function canonicalRequestFormEvent(name) {
  return EVENT_ALIAS_LOOKUP[text(name).toLowerCase()] || null
}

export function isRequestFormEventName(name) {
  return canonicalRequestFormEvent(name) !== null
}

// events = [{ event_name, event_count }] -> { form_step_completed: n, ... } (alias-urile adunate)
export function requestFormEventTotals(events = []) {
  const totals = Object.keys(REQUEST_FORM_EVENT_ALIASES).reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
  for (const row of events) {
    const key = canonicalRequestFormEvent(row?.event_name)
    if (key) totals[key] += Number(row?.event_count || 0)
  }
  return totals
}
