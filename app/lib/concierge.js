import { getOptionalEnv, requireEnv } from './env'
import { sbFetch } from './supabase'

const SERVICE_LINE_RE = /^-\s*(\d+)\s*x\s*(.+?)\s*\(([\d.,\s]+)\s*€\)\s*=\s*([\d.,\s]+)\s*€/i
const DEFAULT_PLATFORM_SUPABASE_URL = 'https://bwfexvoapabfvkmmnxkg.supabase.co'

export const CONCIERGE_STAGES = new Set([
  'nou',
  'contactare',
  'consultanta',
  'oferta_finala',
  'plata_trimis',
  'platit',
  'livrare',
  'inchis',
  'pierdut',
])

export const PAYMENT_STATUSES = new Set([
  'not_created',
  'pending',
  'paid',
  'expired',
  'cancelled',
  'failed',
])

function encodeValue(value) {
  return encodeURIComponent(String(value))
}

function getPlatformServiceConfig() {
  const url = getOptionalEnv('PLATFORM_SUPABASE_URL') || DEFAULT_PLATFORM_SUPABASE_URL
  const key = getOptionalEnv('PLATFORM_SUPABASE_SERVICE_KEY')
  if (!key) {
    throw new Error('Missing required environment variable: PLATFORM_SUPABASE_SERVICE_KEY. Este necesara pentru citirea cererilor /concierge din Supabase HomePitch.')
  }
  return { url: url.replace(/\/$/, ''), key }
}

export function isMissingPlatformServiceKey(error) {
  return String(error?.message || error).includes('PLATFORM_SUPABASE_SERVICE_KEY')
}

export function isInvalidPlatformServiceKey(error) {
  const message = String(error?.message || error).toLowerCase()
  return (
    message.includes('platform supabase 401') ||
    message.includes('platform supabase 403') ||
    message.includes('invalid api key')
  )
}

export function isPlatformServiceUnavailable(error) {
  return isMissingPlatformServiceKey(error) || isInvalidPlatformServiceKey(error)
}

async function platformFetch(path, opts = {}) {
  const { url, key } = getPlatformServiceConfig()
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': opts.prefer !== undefined ? opts.prefer : 'return=representation',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Platform Supabase ${res.status}: ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function numericTextToNumber(value) {
  const clean = String(value || '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function parseConciergeMessage(message) {
  const lines = String(message || '').split(/\r?\n/)
  const services = []
  let estimatedTotal = 0
  let inCustomerMessage = false
  const customerLines = []

  for (const line of lines) {
    const serviceMatch = line.match(SERVICE_LINE_RE)
    if (serviceMatch) {
      const quantity = Number(serviceMatch[1])
      const title = serviceMatch[2].trim()
      const unitPriceEur = numericTextToNumber(serviceMatch[3])
      const subtotalEur = numericTextToNumber(serviceMatch[4])
      services.push({
        id: slug(title),
        title,
        quantity,
        unit_price_eur: unitPriceEur,
        subtotal_eur: subtotalEur,
      })
      continue
    }

    if (/total estimat|estimated total/i.test(line)) {
      estimatedTotal = numericTextToNumber(line)
      continue
    }

    if (/mesaj client|customer message/i.test(line)) {
      inCustomerMessage = true
      const inlineMessage = line.split(/mesaj client:?|customer message:?/i).slice(1).join('').trim()
      if (inlineMessage) customerLines.push(inlineMessage)
      continue
    }

    if (inCustomerMessage) {
      if (/disclaimer acceptat|disclaimer accepted/i.test(line)) {
        inCustomerMessage = false
        continue
      }
      customerLines.push(line)
    }
  }

  if (!estimatedTotal && services.length) {
    estimatedTotal = services.reduce((sum, service) => sum + Number(service.subtotal_eur || 0), 0)
  }

  return {
    services,
    estimatedTotal,
    customerMessage: customerLines.join('\n').trim(),
  }
}

function isMissingTable(error, tableName) {
  const message = String(error?.message || error)
  return message.includes(tableName) && (
    message.includes('PGRST') ||
    message.includes('42P01') ||
    message.toLowerCase().includes('could not find') ||
    message.toLowerCase().includes('does not exist')
  )
}

export function isMissingConciergeCrmTable(error) {
  return isMissingTable(error, 'hp_concierge_crm')
}

export function isMissingConciergeEmailLogTable(error) {
  return isMissingTable(error, 'hp_concierge_email_log')
}

export function isMissingConciergeImportedRequestsTable(error) {
  return isMissingTable(error, 'hp_concierge_imported_requests')
}

export async function getConciergeRequests(limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 500))
  return platformFetch(
    `/concierge_requests?select=id,user_id,full_name,email,phone,message,status,admin_notes,created_at,updated_at&order=created_at.desc&limit=${safeLimit}`,
    { prefer: '' }
  )
}

export async function getImportedConciergeRequests(limit = 100) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 100), 500))
  return sbFetch(
    `/hp_concierge_imported_requests?select=id,full_name,email,phone,message,status,admin_notes,source_label,created_at,updated_at&order=created_at.desc&limit=${safeLimit}`,
    { prefer: '' }
  )
}

export async function getImportedConciergeRequestById(requestId) {
  const rows = await sbFetch(
    `/hp_concierge_imported_requests?id=eq.${encodeValue(requestId)}&select=id,full_name,email,phone,message,status,admin_notes,source_label,created_at,updated_at&limit=1`,
    { prefer: '' }
  )
  return rows?.[0] || null
}

export async function getConciergeRequestById(requestId) {
  let platformError = null

  try {
    const rows = await platformFetch(
      `/concierge_requests?id=eq.${encodeValue(requestId)}&select=id,user_id,full_name,email,phone,message,status,admin_notes,created_at,updated_at&limit=1`,
      { prefer: '' }
    )
    if (rows?.[0]) return rows[0]
  } catch (error) {
    if (!isPlatformServiceUnavailable(error)) throw error
    platformError = error
  }

  try {
    const imported = await getImportedConciergeRequestById(requestId)
    return imported ? { ...imported, user_id: null } : null
  } catch (error) {
    if (platformError && isMissingConciergeImportedRequestsTable(error)) throw platformError
    throw error
  }
}

export async function updateConciergeRequest(requestId, updates) {
  return platformFetch(`/concierge_requests?id=eq.${encodeValue(requestId)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify({
      ...updates,
      updated_at: new Date().toISOString(),
    }),
  })
}

export async function getConciergeCrmCases(requestIds) {
  if (!requestIds?.length) return []
  const list = requestIds.map(id => encodeValue(id)).join(',')
  return sbFetch(
    `/hp_concierge_crm?request_id=in.(${list})&select=*&order=updated_at.desc`,
    { prefer: '' }
  )
}

export async function getConciergeEmailLogs(requestIds) {
  if (!requestIds?.length) return []
  const list = requestIds.map(id => encodeValue(id)).join(',')
  return platformFetch(
    `/hp_concierge_email_log?request_id=in.(${list})&select=*&order=created_at.desc`,
    { prefer: '' }
  )
}

function cleanString(value, max = 1000) {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  return clean ? clean.slice(0, max) : null
}

function cleanServices(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).map(service => {
    const quantity = Math.max(0, Math.min(Number(service?.quantity || 0), 99))
    const unit = Math.max(0, Number(service?.unit_price_eur || service?.unitPriceEur || 0))
    const subtotal = Math.max(0, Number(service?.subtotal_eur || service?.subtotalEur || quantity * unit))
    return {
      id: cleanString(service?.id, 120) || slug(service?.title),
      title: cleanString(service?.title, 240) || 'Serviciu concierge',
      quantity,
      unit_price_eur: Number(unit.toFixed(2)),
      subtotal_eur: Number(subtotal.toFixed(2)),
    }
  }).filter(service => service.title && service.quantity > 0)
}

function cleanComments(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).map(comment => ({
    id: cleanString(comment?.id, 80) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: cleanString(comment?.text, 2000) || '',
    author: cleanString(comment?.author, 120) || 'Dashboard',
    created_at: cleanString(comment?.created_at, 40) || new Date().toISOString(),
  })).filter(comment => comment.text)
}

export function cleanCrmInput(input) {
  const requestId = cleanString(input?.requestId || input?.request_id, 80)
  if (!requestId) throw new Error('Missing requestId')

  const stage = cleanString(input?.stage, 80) || 'nou'
  const paymentStatus = cleanString(input?.paymentStatus || input?.payment_status, 80) || 'not_created'
  const finalTotal = Number(input?.finalTotalEur ?? input?.final_total_eur)

  return {
    request_id: requestId,
    stage: CONCIERGE_STAGES.has(stage) ? stage : 'nou',
    contact_status: cleanString(input?.contactStatus || input?.contact_status, 120) || null,
    owner: cleanString(input?.owner, 180),
    comments: cleanComments(input?.comments),
    services: cleanServices(input?.services),
    final_total_eur: Number.isFinite(finalTotal) ? Number(finalTotal.toFixed(2)) : null,
    final_notes: cleanString(input?.finalNotes || input?.final_notes, 3000),
    stripe_payment_url: cleanString(input?.stripePaymentUrl || input?.stripe_payment_url, 1200),
    stripe_session_id: cleanString(input?.stripeSessionId || input?.stripe_session_id, 240),
    payment_status: PAYMENT_STATUSES.has(paymentStatus) ? paymentStatus : 'not_created',
    after_payment_status: cleanString(input?.afterPaymentStatus || input?.after_payment_status, 200),
    updated_at: new Date().toISOString(),
  }
}

export async function upsertConciergeCrmCase(input) {
  const row = cleanCrmInput(input)
  return sbFetch('/hp_concierge_crm?on_conflict=request_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(row),
  })
}

export async function getPendingConciergePayments() {
  return sbFetch(
    '/hp_concierge_crm?payment_status=in.(pending,not_created)&stripe_session_id=not.is.null&select=*&order=updated_at.asc&limit=100',
    { prefer: '' }
  )
}

export async function updateConciergeCrmCase(requestId, updates) {
  return sbFetch(`/hp_concierge_crm?request_id=eq.${encodeValue(requestId)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify({
      ...updates,
      updated_at: new Date().toISOString(),
    }),
  })
}

export async function createStripeConciergeSession({ request, services, amountEur, finalNotes }) {
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY')
  const amountCents = Math.round(Number(amountEur || 0) * 100)
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    throw new Error('Suma finala trebuie sa fie de cel putin 1 EUR')
  }

  const appUrl = getOptionalEnv('HOMEPITCH_APP_URL') || 'https://homepitch.ro'
  const successUrl = getOptionalEnv('CONCIERGE_PAYMENT_SUCCESS_URL') || `${appUrl}/concierge?payment=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = getOptionalEnv('CONCIERGE_PAYMENT_CANCEL_URL') || `${appUrl}/concierge?payment=cancelled`
  const serviceSummary = (services || [])
    .map(service => `${service.quantity} x ${service.title}`)
    .join(', ')
    .slice(0, 480)

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('customer_email', request.email)
  params.set('client_reference_id', request.id)
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', 'eur')
  params.set('line_items[0][price_data][unit_amount]', String(amountCents))
  params.set('line_items[0][price_data][product_data][name]', 'Servicii HomePitch Concierge')
  params.set('line_items[0][price_data][product_data][description]', serviceSummary || 'Pachet servicii concierge')
  params.set('metadata[source]', 'hp_analytics_concierge_crm')
  params.set('metadata[concierge_request_id]', request.id)
  params.set('metadata[customer_email]', request.email)
  params.set('metadata[customer_phone]', request.phone || '')
  params.set('metadata[services]', serviceSummary)
  if (finalNotes) params.set('metadata[final_notes]', String(finalNotes).slice(0, 480))

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) {
    throw new Error(json?.error?.message || text || `Stripe ${res.status}`)
  }
  return json
}

export async function retrieveStripeSession(sessionId) {
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY')
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(json?.error?.message || text || `Stripe ${res.status}`)
  return json
}

export async function sendConciergePaymentReminder({ request, crm }) {
  const brevoApiKey = requireEnv('BREVO_API_KEY')
  const paymentUrl = crm?.stripe_payment_url
  if (!paymentUrl) throw new Error('Lipseste linkul de plata')

  const amount = Number(crm.final_total_eur || 0)
  const fromEmail = getOptionalEnv('CONCIERGE_FROM_EMAIL') || 'contact@homepitch.ro'
  const senderName = getOptionalEnv('CONCIERGE_FROM_NAME') || 'HomePitch'

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: fromEmail },
      to: [{ email: request.email, name: request.full_name }],
      subject: 'Link plata servicii HomePitch Concierge',
      htmlContent: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.55;max-width:640px;margin:0 auto;">
          <h2 style="margin:0 0 14px;color:#0f1e35;">Plata servicii HomePitch Concierge</h2>
          <p>Buna, ${escapeHtml(request.full_name)},</p>
          <p>Am pregatit linkul de plata pentru serviciile discutate. Suma finala este <strong>${amount.toLocaleString('ro-RO')} EUR</strong>.</p>
          <p style="margin:22px 0;">
            <a href="${paymentUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Plateste serviciile</a>
          </p>
          <p style="color:#6b7280;font-size:13px;">Daca ai intrebari, raspunde direct la acest email.</p>
        </div>
      `,
    }),
  })

  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) throw new Error(json?.message || text || `Brevo ${res.status}`)
  return json || { ok: true }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
