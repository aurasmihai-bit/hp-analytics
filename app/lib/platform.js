import { getOptionalEnv } from './env'

const DEFAULT_PLATFORM_SUPABASE_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co'
const DEFAULT_REQUESTS_TABLE = 'buyer_requests'
const REPORT_TIME_ZONE = 'Europe/Bucharest'

function getPlatformConfig() {
  const url = getOptionalEnv('PLATFORM_SUPABASE_URL') || DEFAULT_PLATFORM_SUPABASE_URL
  const key = getOptionalEnv('PLATFORM_SUPABASE_ANON_KEY')
  if (!url || !key) return null
  return {
    url: url.replace(/\/$/, ''),
    key,
    requestsTable: getOptionalEnv('PLATFORM_REQUESTS_TABLE') || DEFAULT_REQUESTS_TABLE,
  }
}

function addDaysIso(date, days) {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function getOffsetForDate(date, timeZone = REPORT_TIME_ZONE) {
  const d = new Date(`${date}T00:00:00.000Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(d)
  const raw = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT+2'
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+02:00'
  const sign = match[1]
  const hours = match[2].padStart(2, '0')
  const minutes = (match[3] || '00').padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

function localDateStart(date) {
  return `${date}T00:00:00${getOffsetForDate(date)}`
}

function parseCount(contentRange) {
  const raw = String(contentRange || '')
  const count = Number(raw.split('/').pop())
  return Number.isFinite(count) ? count : 0
}

function localDateFromTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

function classifyField(path) {
  const key = String(path || '').toLowerCase()
  if (/(email|mail|phone|telefon|tel|nume|name|prenume|contact|client|user|token|password|auth|message|mesaj|note|coment|description|descriere|address|adresa)/.test(key)) return 'sensitive'
  if (/(transaction|tranzact|deal|operation)/.test(key)) return 'transaction'
  if (/(request.*type|type|tip|category|categorie)/.test(key)) return 'request_type'
  if (/(property|propriet|estate|imobil|apartment|apartament|house|casa|rooms|camere|bedrooms)/.test(key)) return 'property'
  if (/(district|cartier|neighborhood|zona|zone|oras|city|judet|county|sector|location|locatie)/.test(key)) return 'location'
  if (/(budget|buget|price|pret|min_|max_|amount|suma|valoare|currency|valuta)/.test(key)) return 'budget'
  if (/(advance|avans|down_payment|downpayment)/.test(key)) return 'down_payment'
  if (/(financ|credit|mortgage|ipotec|cash|loan|payment|plata|pre_approval|preapproval|aprobare)/.test(key)) return 'financing'
  if (/(status|stage|state)/.test(key)) return 'status'
  if (/(created|updated|date|time)/.test(key)) return 'date'
  if (/(^id$|_id$|uuid)/.test(key)) return 'identifier'
  return 'other'
}

function valueType(value) {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function visitValue(value, path, visit, depth = 0) {
  visit(path, value)
  if (!value || typeof value !== 'object' || depth >= 4) return
  if (Array.isArray(value)) {
    value.slice(0, 10).forEach(item => visitValue(item, `${path}[]`, visit, depth + 1))
    return
  }
  Object.entries(value).forEach(([key, child]) => {
    visitValue(child, path ? `${path}.${key}` : key, visit, depth + 1)
  })
}

function inspectRows(rows) {
  const fields = new Map()
  rows.forEach(row => {
    visitValue(row, '', (path, value) => {
      if (!path) return
      if (!fields.has(path)) {
        fields.set(path, {
          path,
          topLevel: path.split('.')[0].replace(/\[\]$/, ''),
          types: new Set(),
          nonNull: 0,
          primitiveDistinct: new Set(),
          category: classifyField(path),
        })
      }
      const info = fields.get(path)
      const type = valueType(value)
      info.types.add(type)
      if (type !== 'null') info.nonNull += 1
      if (['string', 'number', 'boolean'].includes(type) && info.primitiveDistinct.size < 250) {
        info.primitiveDistinct.add(String(value))
      }
    })
  })

  return Array.from(fields.values())
    .map(info => ({
      path: info.path,
      topLevel: info.topLevel,
      types: Array.from(info.types).sort(),
      nonNull: info.nonNull,
      distinctCount: info.primitiveDistinct.size,
      category: info.category,
      sensitive: ['sensitive', 'identifier'].includes(info.category),
      extractableForAnalytics: !['sensitive', 'identifier', 'other'].includes(info.category) && info.nonNull > 0,
    }))
    .sort((a, b) => {
      if (a.extractableForAnalytics !== b.extractableForAnalytics) return a.extractableForAnalytics ? -1 : 1
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.path.localeCompare(b.path)
    })
}

function cleanText(value, fallback = '—') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function safeZones(value, cartier) {
  const zones = Array.isArray(value) ? value : []
  const clean = zones
    .filter(zone => typeof zone === 'string')
    .map(zone => zone.trim())
    .filter(Boolean)
  if (!clean.length && typeof cartier === 'string' && cartier.trim()) return [cartier.trim()]
  return clean
}

function sanitizeRequestRow(row) {
  const budgetMax = numberOrNull(row.budget_max)
  const downPayment = numberOrNull(row.down_payment)
  const offersCount = numberOrNull(row.offers_count) || 0
  const rawBuyerScoreRelation = row.buyer_scores_public ?? row.buyer_scores
  const buyerScoreRelation = Array.isArray(rawBuyerScoreRelation) ? rawBuyerScoreRelation[0] : rawBuyerScoreRelation
  const buyerScore = numberOrNull(row.buyer_score ?? row.total_score ?? buyerScoreRelation?.total_score)
  return {
    created_at: row.created_at || null,
    date: row.created_at ? localDateFromTimestamp(row.created_at) : null,
    status: cleanText(row.status),
    transaction_type: cleanText(row.transaction_type),
    property_type: cleanText(row.property_type),
    location_city: cleanText(row.location_city),
    cartier: cleanText(row.cartier, ''),
    location_zones: safeZones(row.location_zones, row.cartier),
    budget_min: numberOrNull(row.budget_min),
    budget_max: budgetMax,
    currency: cleanText(row.currency, ''),
    rent_budget_min: numberOrNull(row.rent_budget_min),
    rent_budget_max: numberOrNull(row.rent_budget_max),
    rent_currency: cleanText(row.rent_currency, ''),
    financing: cleanText(row.financing),
    pre_approval: cleanText(row.pre_approval, ''),
    down_payment: downPayment,
    down_payment_currency: cleanText(row.down_payment_currency, ''),
    down_payment_ratio: budgetMax && downPayment ? downPayment / budgetMax * 100 : null,
    buyer_score: buyerScore,
    buyer_score_bucket: buyerScoreBucket(buyerScore),
    buyer_score_level: cleanText(buyerScoreRelation?.level, ''),
    offers_count: offersCount,
    has_offers: offersCount > 0,
    rooms_min: numberOrNull(row.rooms_min),
    rooms_max: numberOrNull(row.rooms_max),
    bathrooms: numberOrNull(row.bathrooms),
  }
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const value = row[field] || '—'
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function countZones(rows) {
  return rows.reduce((acc, row) => {
    const zones = row.location_zones?.length ? row.location_zones : ['—']
    zones.forEach(zone => {
      acc[zone] = (acc[zone] || 0) + 1
    })
    return acc
  }, {})
}

function objectToRows(object, labelField = 'label') {
  return Object.entries(object)
    .map(([label, count]) => ({ [labelField]: label, count }))
    .sort((a, b) => b.count - a.count || String(a[labelField]).localeCompare(String(b[labelField])))
}

function budgetBucket(value) {
  const n = numberOrNull(value)
  if (n === null) return 'Necunoscut'
  if (n < 75000) return '<75k'
  if (n < 100000) return '75k-100k'
  if (n < 150000) return '100k-150k'
  if (n < 200000) return '150k-200k'
  if (n < 300000) return '200k-300k'
  return '300k+'
}

function buyerScoreBucket(value) {
  const n = numberOrNull(value)
  if (n === null) return 'Fara scor'
  if (n >= 80) return '80-100'
  if (n >= 60) return '60-79'
  if (n >= 40) return '40-59'
  if (n >= 20) return '20-39'
  return '0-19'
}

function offersBucket(value) {
  const count = Number(value || 0)
  if (!count) return '0 oferte'
  return `${count} ${count === 1 ? 'oferta' : 'oferte'}`
}

function median(values) {
  const clean = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b)
  if (!clean.length) return null
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

function analyticsSummary(rows) {
  const budgetMaxValues = rows.map(row => row.budget_max).filter(value => Number.isFinite(value))
  const rentBudgetMaxValues = rows.map(row => row.rent_budget_max).filter(value => Number.isFinite(value))
  const downPaymentValues = rows.map(row => row.down_payment).filter(value => Number.isFinite(value))
  const downPaymentRatioValues = rows.map(row => row.down_payment_ratio).filter(value => Number.isFinite(value))
  const downPaymentRows = rows.filter(row => Number.isFinite(row.down_payment))
  const buyerScoreValues = rows.map(row => row.buyer_score).filter(value => Number.isFinite(value))
  const withOffers = rows.filter(row => Number(row.offers_count || 0) > 0)
  const totalOffers = rows.reduce((sum, row) => sum + Number(row.offers_count || 0), 0)
  const daily = objectToRows(countBy(rows, 'date'), 'date').sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const budgetBuckets = rows.reduce((acc, row) => {
    const bucket = budgetBucket(row.budget_max)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})
  const rentBudgetBuckets = rows.reduce((acc, row) => {
    const bucket = budgetBucket(row.rent_budget_max)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})
  const offerBuckets = rows.reduce((acc, row) => {
    const bucket = offersBucket(row.offers_count)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})
  const buyerScoreBuckets = rows.reduce((acc, row) => {
    const bucket = buyerScoreBucket(row.buyer_score)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})

  return {
    total: rows.length,
    medianBudgetMax: median(budgetMaxValues),
    avgBudgetMax: budgetMaxValues.length ? budgetMaxValues.reduce((s, v) => s + v, 0) / budgetMaxValues.length : null,
    medianRentBudgetMax: median(rentBudgetMaxValues),
    avgRentBudgetMax: rentBudgetMaxValues.length ? rentBudgetMaxValues.reduce((s, v) => s + v, 0) / rentBudgetMaxValues.length : null,
    medianDownPayment: median(downPaymentValues),
    medianDownPaymentRatio: median(downPaymentRatioValues),
    medianBuyerScore: median(buyerScoreValues),
    avgBuyerScore: buyerScoreValues.length ? buyerScoreValues.reduce((s, v) => s + v, 0) / buyerScoreValues.length : null,
    buyerScoreCoverage: rows.length ? buyerScoreValues.length / rows.length * 100 : 0,
    downPaymentCoverage: rows.length ? downPaymentRows.length / rows.length * 100 : 0,
    creditShare: rows.length ? rows.filter(row => /credit|ipotec|loan/i.test(row.financing || '')).length / rows.length * 100 : 0,
    withOffers: withOffers.length,
    offerRate: rows.length ? withOffers.length / rows.length * 100 : 0,
    totalOffers,
    avgOffersPerRequest: rows.length ? totalOffers / rows.length : 0,
    daily,
    byTransaction: objectToRows(countBy(rows, 'transaction_type')),
    byProperty: objectToRows(countBy(rows, 'property_type')),
    byCity: objectToRows(countBy(rows, 'location_city')),
    byFinancing: objectToRows(countBy(rows, 'financing')),
    byPreApproval: objectToRows(countBy(rows, 'pre_approval')),
    byCurrency: objectToRows(countBy(rows, 'currency')),
    byRentCurrency: objectToRows(countBy(rows, 'rent_currency')),
    byStatus: objectToRows(countBy(rows, 'status')),
    byOffers: objectToRows(offerBuckets),
    byBuyerScore: objectToRows(buyerScoreBuckets),
    byZone: objectToRows(countZones(rows), 'zone'),
    byBudget: objectToRows(budgetBuckets),
    byRentBudget: objectToRows(rentBudgetBuckets),
  }
}

export async function fetchPlatformRequestStats({ start, end }) {
  const config = getPlatformConfig()
  if (!config) return null

  const exclusiveEnd = addDaysIso(end, 1)
  const params = new URLSearchParams()
  params.set('select', 'id,created_at,status')
  params.append('created_at', `gte.${localDateStart(start)}`)
  params.append('created_at', `lt.${localDateStart(exclusiveEnd)}`)
  params.set('limit', '1')

  const res = await fetch(`${config.url}/rest/v1/${config.requestsTable}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: 'count=exact',
    },
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Platform Supabase ${res.status}: ${text || res.statusText}`)

  return {
    count: parseCount(res.headers.get('content-range')),
    source: config.requestsTable,
    start,
    end,
  }
}

export async function fetchPlatformRequestDailyStats({ start, end }) {
  const config = getPlatformConfig()
  if (!config) return {}

  const exclusiveEnd = addDaysIso(end, 1)
  const params = new URLSearchParams()
  params.set('select', 'created_at')
  params.append('created_at', `gte.${localDateStart(start)}`)
  params.append('created_at', `lt.${localDateStart(exclusiveEnd)}`)
  params.set('order', 'created_at.asc')
  params.set('limit', '10000')

  const res = await fetch(`${config.url}/rest/v1/${config.requestsTable}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let rows = []
  try { rows = text ? JSON.parse(text) : [] } catch {}
  if (!res.ok) throw new Error(`Platform Supabase ${res.status}: ${text || res.statusText}`)

  const days = {}
  rows.forEach(row => {
    const date = localDateFromTimestamp(row.created_at)
    if (!date) return
    days[date] = {
      count: (days[date]?.count || 0) + 1,
      source: config.requestsTable,
      start: date,
      end: date,
    }
  })
  return days
}

export async function inspectPlatformRequestFields({ limit = 200 } = {}) {
  const config = getPlatformConfig()
  if (!config) throw new Error('Platform Supabase is not configured')

  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500))
  const params = new URLSearchParams()
  params.set('select', '*')
  params.set('order', 'created_at.desc')
  params.set('limit', String(safeLimit))

  const res = await fetch(`${config.url}/rest/v1/${config.requestsTable}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: 'count=exact',
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let rows = []
  try { rows = text ? JSON.parse(text) : [] } catch {}
  if (!res.ok) throw new Error(`Platform Supabase ${res.status}: ${text || res.statusText}`)
  if (!Array.isArray(rows)) rows = []

  const fields = inspectRows(rows)
  const analyticsFields = fields.filter(field => field.extractableForAnalytics)
  return {
    table: config.requestsTable,
    sampleRows: rows.length,
    totalAccessibleRows: parseCount(res.headers.get('content-range')),
    fields,
    analyticsFields,
    categories: analyticsFields.reduce((acc, field) => {
      acc[field.category] = (acc[field.category] || 0) + 1
      return acc
    }, {}),
    privacy: {
      rawValuesReturned: false,
      note: 'This inspection returns field names, types and counts only; user-level values are not returned.',
    },
  }
}

export async function fetchPlatformRequestAnalytics({ start, end, limit = 1000 } = {}) {
  const config = getPlatformConfig()
  if (!config) throw new Error('Platform Supabase is not configured')

  const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000))
  const params = new URLSearchParams()
  params.set('select', [
    'created_at',
    'updated_at',
    'status',
    'transaction_type',
    'property_type',
    'location_city',
    'location_zones',
    'cartier',
    'budget_min',
    'budget_max',
    'currency',
    'rent_budget_min',
    'rent_budget_max',
    'rent_currency',
    'financing',
    'pre_approval',
    'down_payment',
    'down_payment_currency',
    'buyer_scores_public(total_score,level)',
    'offers_count',
    'rooms_min',
    'rooms_max',
    'bathrooms',
  ].join(','))
  if (start) params.append('created_at', `gte.${localDateStart(start)}`)
  if (end) params.append('created_at', `lt.${localDateStart(addDaysIso(end, 1))}`)
  params.set('order', 'created_at.desc')
  params.set('limit', String(safeLimit))

  const res = await fetch(`${config.url}/rest/v1/${config.requestsTable}?${params}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: 'count=exact',
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let rows = []
  try { rows = text ? JSON.parse(text) : [] } catch {}
  if (!res.ok) throw new Error(`Platform Supabase ${res.status}: ${text || res.statusText}`)
  if (!Array.isArray(rows)) rows = []

  const sanitizedRows = rows.map(sanitizeRequestRow)
  return {
    table: config.requestsTable,
    totalAccessibleRows: parseCount(res.headers.get('content-range')),
    returnedRows: sanitizedRows.length,
    rows: sanitizedRows,
    summary: analyticsSummary(sanitizedRows),
    privacy: {
      rawPersonalDataReturned: false,
      excludedFields: ['id', 'user_id', 'notes', 'meta_description'],
    },
  }
}
