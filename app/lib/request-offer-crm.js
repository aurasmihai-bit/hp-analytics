import { getOptionalEnv } from './env'
import { sbFetch } from './supabase'

const DEFAULT_PLATFORM_SUPABASE_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co'
const DEFAULT_HP_ANALYTICS_EXPORT_URL = `${DEFAULT_PLATFORM_SUPABASE_URL}/functions/v1/hp-analytics-export`
const DEFAULT_HP_REQUEST_OFFER_SYNC_URL = `${DEFAULT_PLATFORM_SUPABASE_URL}/functions/v1/hp-request-offer-crm-sync`
const HOMEPITCH_BASE_URL = 'https://homepitch.ro'

export const REQUEST_OFFER_STAGES = new Set([
  'nou',
  'contactat',
  'nu_raspunde',
  'refuz',
  'pending_actiune',
  'inchis_manual',
])

export const REQUEST_OFFER_CLOSED_STAGES = new Set(['refuz', 'inchis_manual'])

function encodeValue(value) {
  return encodeURIComponent(String(value))
}

function cleanString(value, max = 1000) {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  return clean ? clean.slice(0, max) : null
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function cleanJsonArray(value, max = 200) {
  return Array.isArray(value) ? value.slice(0, max).map(item => JSON.parse(JSON.stringify(item))) : []
}

function cleanJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value))
    : {}
}

function normalizeHomePitchUrl(value, expectedPathPrefix) {
  const clean = cleanString(value, 1200)
  if (!clean) return ''
  try {
    const url = new URL(clean, HOMEPITCH_BASE_URL)
    if (expectedPathPrefix && url.pathname.startsWith(expectedPathPrefix)) {
      return `${HOMEPITCH_BASE_URL}${url.pathname}${url.search}${url.hash}`
    }
    return url.toString()
  } catch {
    return clean
  }
}

function normalizeStage(value) {
  const clean = cleanString(value, 80) || 'nou'
  return REQUEST_OFFER_STAGES.has(clean) ? clean : 'nou'
}

function stageFromHomePitchStatus(sourceType, status) {
  if (sourceType !== 'offer_no_response') return 'nou'
  if (status === 'respinsa') return 'refuz'
  if (status === 'acceptata') return 'inchis_manual'
  return 'nou'
}

export function appendRequestOfferActivity(log, { event, text, meta = {}, author = 'Sistem' }) {
  return cleanJsonArray([
    ...(Array.isArray(log) ? log : []),
    {
      id: `a-${event || 'event'}-${Date.now()}`,
      event: event || 'updated',
      text: text || 'Actualizare CRM',
      author,
      created_at: new Date().toISOString(),
      meta,
    },
  ])
}

export function isMissingRequestOfferCrmTable(error) {
  const message = String(error?.message || error)
  return message.includes('hp_request_offer_crm_cases') && (
    message.includes('PGRST') ||
    message.includes('42P01') ||
    message.toLowerCase().includes('could not find') ||
    message.toLowerCase().includes('does not exist')
  )
}

function isMissingExport(error) {
  const message = String(error?.message || error).toLowerCase()
  return (
    message.includes('hp_analytics_token') ||
    message.includes('unknown resource') ||
    message.includes('not configured') ||
    message.includes('unauthorized') ||
    message.includes('invalid api key')
  )
}

export async function fetchHomePitchExport(resource, params = {}) {
  const token = getOptionalEnv('HP_ANALYTICS_TOKEN')
  if (!token) throw new Error('Lipseste HP_ANALYTICS_TOKEN in Vercel pentru exportul HomePitch.')

  const exportUrl = getOptionalEnv('HP_ANALYTICS_EXPORT_URL') || DEFAULT_HP_ANALYTICS_EXPORT_URL
  const url = new URL(exportUrl)
  url.searchParams.set('resource', resource)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) {
    throw new Error(json?.error || text || `HomePitch export ${res.status}`)
  }
  return json?.data || json?.rows || []
}

export async function syncRequestOfferStageToHomePitch(input) {
  const cleaned = cleanRequestOfferCase(input)
  if (cleaned.source_type !== 'offer_no_response') {
    return { skipped: true, reason: 'Sync disponibil doar pentru oferte.' }
  }
  if (cleaned.stage !== 'refuz') {
    return { skipped: true, reason: 'Etapa nu modifica statusul ofertei in HomePitch.' }
  }

  const token = getOptionalEnv('HP_ANALYTICS_TOKEN')
  if (!token) throw new Error('Lipseste HP_ANALYTICS_TOKEN pentru sincronizarea cu HomePitch.')

  const syncUrl = getOptionalEnv('HP_REQUEST_OFFER_SYNC_URL') || DEFAULT_HP_REQUEST_OFFER_SYNC_URL
  const res = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_type: cleaned.source_type,
      source_id: cleaned.source_id,
      offer_id: cleaned.offer_id,
      request_id: cleaned.request_id,
      property_id: cleaned.property_id,
      stage: cleaned.stage,
    }),
    cache: 'no-store',
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(json?.error || text || `HomePitch sync ${res.status}`)
  return json || { ok: true }
}

export function cleanRequestOfferCase(input) {
  const sourceType = cleanString(input?.sourceType || input?.source_type, 80)
  const sourceId = cleanString(input?.sourceId || input?.source_id, 180)
  if (!['offer_no_response', 'recommendation_no_offer'].includes(sourceType)) {
    throw new Error('sourceType invalid')
  }
  if (!sourceId) throw new Error('sourceId lipseste')

  return {
    source_type: sourceType,
    source_id: sourceId,
    offer_id: cleanString(input?.offerId || input?.offer_id, 180),
    recommendation_id: cleanString(input?.recommendationId || input?.recommendation_id, 180),
    request_id: cleanString(input?.requestId || input?.request_id, 180),
    property_id: cleanString(input?.propertyId || input?.property_id, 180),
    request_url: cleanString(input?.requestUrl || input?.request_url, 1200),
    property_url: cleanString(input?.propertyUrl || input?.property_url, 1200),
    request_title: cleanString(input?.requestTitle || input?.request_title, 400),
    request_description: cleanString(input?.requestDescription || input?.request_description, 6000),
    property_title: cleanString(input?.propertyTitle || input?.property_title, 400),
    transaction_type: cleanString(input?.transactionType || input?.transaction_type, 120),
    request_author_name: cleanString(input?.requestAuthorName || input?.request_author_name, 240),
    request_author_email: cleanString(input?.requestAuthorEmail || input?.request_author_email, 260),
    request_author_phone: cleanString(input?.requestAuthorPhone || input?.request_author_phone, 80),
    request_author_user_type: cleanString(input?.requestAuthorUserType || input?.request_author_user_type, 120),
    counterparty_name: cleanString(input?.counterpartyName || input?.counterparty_name, 240),
    counterparty_email: cleanString(input?.counterpartyEmail || input?.counterparty_email, 260),
    counterparty_phone: cleanString(input?.counterpartyPhone || input?.counterparty_phone, 80),
    counterparty_user_type: cleanString(input?.counterpartyUserType || input?.counterparty_user_type, 120),
    price: cleanNumber(input?.price),
    currency: cleanString(input?.currency, 20),
    city: cleanString(input?.city, 160),
    neighborhood: cleanString(input?.neighborhood, 300),
    financing: cleanString(input?.financing, 80),
    down_payment: cleanNumber(input?.downPayment ?? input?.down_payment),
    down_payment_currency: cleanString(input?.downPaymentCurrency || input?.down_payment_currency, 20),
    pre_approval: cleanString(input?.preApproval || input?.pre_approval, 80),
    deadline: cleanString(input?.deadline, 80),
    buyer_score: cleanNumber(input?.buyerScore || input?.buyer_score),
    ai_score: cleanNumber(input?.aiScore || input?.ai_score),
    source_created_at: cleanString(input?.sourceCreatedAt || input?.source_created_at, 80),
    source_received_at: cleanString(input?.sourceReceivedAt || input?.source_received_at, 80),
    source_status: cleanString(input?.sourceStatus || input?.source_status, 120),
    reminder_count: Math.max(0, Math.min(Number(input?.reminderCount ?? input?.reminder_count ?? 0) || 0, 999)),
    reminder_channels: cleanJsonArray(input?.reminderChannels || input?.reminder_channels, 20),
    last_reminder_at: cleanString(input?.lastReminderAt || input?.last_reminder_at, 80),
    stage: normalizeStage(input?.stage),
    comments: cleanJsonArray(input?.comments, 200),
    log: cleanJsonArray(input?.log, 300),
    metadata: cleanJsonObject(input?.metadata),
  }
}

function toClientCase(row, source = 'crm') {
  const receivedAt = row.source_received_at || row.source_created_at || row.created_at
  const receivedTime = receivedAt ? new Date(receivedAt).getTime() : 0
  const inactiveDays = Number.isFinite(receivedTime) && receivedTime > 0
    ? Math.max(0, Math.floor((Date.now() - receivedTime) / 86400000))
    : 0

  return {
    id: row.id || `${row.source_type}:${row.source_id}`,
    source: row._source || source,
    sourceType: row.source_type,
    sourceId: row.source_id,
    offerId: row.offer_id || '',
    recommendationId: row.recommendation_id || '',
    requestId: row.request_id || '',
    propertyId: row.property_id || '',
    requestUrl: normalizeHomePitchUrl(row.request_url, '/cereri'),
    propertyUrl: normalizeHomePitchUrl(row.property_url, '/proprietati'),
    requestTitle: row.request_title || 'Cerere fara titlu',
    requestDescription: row.request_description || row.metadata?.request_description || '',
    propertyTitle: row.property_title || '',
    transactionType: row.transaction_type || '',
    requestAuthorName: row.request_author_name || '',
    requestAuthorEmail: row.request_author_email || '',
    requestAuthorPhone: row.request_author_phone || '',
    requestAuthorUserType: row.request_author_user_type || '',
    counterpartyName: row.counterparty_name || '',
    counterpartyEmail: row.counterparty_email || '',
    counterpartyPhone: row.counterparty_phone || '',
    counterpartyUserType: row.counterparty_user_type || '',
    price: row.price,
    currency: row.currency || 'EUR',
    city: row.city || '',
    neighborhood: row.neighborhood || '',
    financing: row.financing || row.metadata?.financing || '',
    downPayment: row.down_payment ?? row.metadata?.down_payment ?? null,
    downPaymentCurrency: row.down_payment_currency || row.metadata?.down_payment_currency || row.currency || 'EUR',
    preApproval: row.pre_approval || row.metadata?.pre_approval || '',
    deadline: row.deadline || row.metadata?.deadline || '',
    buyerScore: row.buyer_score,
    aiScore: row.ai_score,
    sourceCreatedAt: row.source_created_at || '',
    sourceReceivedAt: receivedAt || '',
    inactiveDays,
    sourceStatus: row.source_status || '',
    reminderCount: Number(row.reminder_count || 0),
    reminderChannels: Array.isArray(row.reminder_channels) ? row.reminder_channels : [],
    lastReminderAt: row.last_reminder_at || '',
    stage: normalizeStage(row.stage),
    comments: Array.isArray(row.comments) ? row.comments : [],
    log: Array.isArray(row.log) ? row.log : [],
    metadata: row.metadata || {},
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  }
}

function fromExportCase(row) {
  const clean = cleanRequestOfferCase({
    ...row,
    sourceType: row.source_type || row.sourceType,
    sourceId: row.source_id || row.sourceId || row.id,
    stage: row.stage || stageFromHomePitchStatus(row.source_type || row.sourceType, row.source_status || row.sourceStatus),
  })
  return toClientCase({ ...clean, _source: 'homepitch-export' }, 'homepitch-export')
}

function mergeCases(liveCases, storedCases) {
  const storedByKey = new Map(storedCases.map(row => [`${row.sourceType}:${row.sourceId}`, row]))
  const merged = liveCases.map(live => {
    const stored = storedByKey.get(`${live.sourceType}:${live.sourceId}`)
    if (!stored) return live
    storedByKey.delete(`${live.sourceType}:${live.sourceId}`)
    const liveMeta = live.metadata || {}
    const storedMeta = stored.metadata || {}
    return {
      ...live,
      id: stored.id || live.id,
      stage: stored.stage || live.stage,
      comments: stored.comments || [],
      log: stored.log || [],
      metadata: {
        ...liveMeta,
        ...storedMeta,
        request_details: {
          ...(storedMeta.request_details || {}),
          ...(liveMeta.request_details || {}),
        },
        property_details: {
          ...(storedMeta.property_details || {}),
          ...(liveMeta.property_details || {}),
        },
      },
      updatedAt: stored.updatedAt || live.updatedAt,
      source: 'merged',
    }
  })

  return [...merged, ...storedByKey.values()]
    .sort((a, b) => String(b.sourceReceivedAt || b.updatedAt || '').localeCompare(String(a.sourceReceivedAt || a.updatedAt || '')))
}

export async function getStoredRequestOfferCases(limit = 500) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 500), 1000))
  const rows = await sbFetch(
    `/hp_request_offer_crm_cases?select=*&order=source_received_at.desc.nullslast,updated_at.desc&limit=${safeLimit}`,
    { prefer: '' }
  )
  return (rows || []).map(row => toClientCase(row, 'crm'))
}

export async function getRequestOfferCrmCases({ limit = 500 } = {}) {
  const setupRequired = {
    crm: false,
    homePitchExport: false,
  }
  let storedCases = []
  let liveCases = []
  let sourceIssue = ''

  try {
    storedCases = await getStoredRequestOfferCases(limit)
  } catch (error) {
    if (!isMissingRequestOfferCrmTable(error)) throw error
    setupRequired.crm = true
  }

  try {
    const rows = await fetchHomePitchExport('request_offer_cases', { limit })
    liveCases = (rows || []).map(fromExportCase)
  } catch (error) {
    if (!isMissingExport(error)) throw error
    setupRequired.homePitchExport = true
    sourceIssue = error.message || String(error)
  }

  return {
    rows: mergeCases(liveCases, storedCases),
    setupRequired,
    sourceIssue,
    checkedAt: new Date().toISOString(),
  }
}

export async function upsertRequestOfferCrmCase(input) {
  const row = {
    ...cleanRequestOfferCase(input),
    updated_at: new Date().toISOString(),
  }

  const rows = await sbFetch('/hp_request_offer_crm_cases?on_conflict=source_type,source_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(row),
  })
  return rows?.[0] ? toClientCase(rows[0], 'crm') : null
}

export async function getRequestOfferCrmCaseBySource(sourceType, sourceId) {
  const rows = await sbFetch(
    `/hp_request_offer_crm_cases?source_type=eq.${encodeValue(sourceType)}&source_id=eq.${encodeValue(sourceId)}&select=*&limit=1`,
    { prefer: '' }
  )
  return rows?.[0] ? toClientCase(rows[0], 'crm') : null
}
