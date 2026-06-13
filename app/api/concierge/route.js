import { NextResponse } from 'next/server'
import {
  cleanCrmInput,
  getConciergeCrmCases,
  getConciergeEmailLogs,
  getConciergeRequests,
  isMissingConciergeCrmTable,
  isMissingConciergeEmailLogTable,
  parseConciergeMessage,
  updateConciergeRequest,
  upsertConciergeCrmCase,
} from '../../lib/concierge'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const sessionSecret = process.env.SESSION_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret)
  )
}

function latestByRequestId(rows) {
  return (rows || []).reduce((acc, row) => {
    if (!acc[row.request_id]) acc[row.request_id] = row
    return acc
  }, {})
}

function mapRequestToRow(request, crm, emailLog) {
  const parsed = parseConciergeMessage(request.message)
  const services = Array.isArray(crm?.services) && crm.services.length ? crm.services : parsed.services
  const finalTotal = Number(crm?.final_total_eur ?? 0) || parsed.estimatedTotal || services.reduce((sum, service) => sum + Number(service.subtotal_eur || 0), 0)

  return {
    id: request.id,
    requestId: request.id,
    createdAt: request.created_at,
    updatedAt: crm?.updated_at || request.updated_at,
    customer: {
      name: request.full_name,
      email: request.email,
      phone: request.phone || '',
    },
    originalStatus: request.status,
    originalAdminNotes: request.admin_notes || '',
    stage: crm?.stage || request.status || 'nou',
    contactStatus: crm?.contact_status || 'necontactat',
    owner: crm?.owner || '',
    comments: Array.isArray(crm?.comments) ? crm.comments : [],
    services,
    estimatedTotalEur: parsed.estimatedTotal,
    finalTotalEur: finalTotal,
    finalNotes: crm?.final_notes || '',
    stripePaymentUrl: crm?.stripe_payment_url || '',
    stripeSessionId: crm?.stripe_session_id || '',
    paymentStatus: crm?.payment_status || 'not_created',
    paymentCheckedAt: crm?.payment_checked_at || null,
    reminderSentAt: crm?.reminder_sent_at || null,
    reminderCount: crm?.reminder_count || 0,
    afterPaymentStatus: crm?.after_payment_status || '',
    customerMessage: parsed.customerMessage,
    rawMessage: request.message,
    email: emailLog ? {
      status: emailLog.status,
      recipient: emailLog.recipient,
      type: emailLog.email_type,
      createdAt: emailLog.created_at,
      error: emailLog.error || '',
    } : {
      status: 'unknown',
      recipient: '',
      type: 'admin_notification',
      createdAt: null,
      error: 'Nu exista audit email in DB pentru aceasta cerere.',
    },
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 100)

  try {
    const requests = await getConciergeRequests(limit)
    const requestIds = requests.map(row => row.id)

    let crmRows = []
    let emailLogs = []
    const setupRequired = { crm: false, emailLog: false }

    try {
      crmRows = await getConciergeCrmCases(requestIds)
    } catch (error) {
      if (!isMissingConciergeCrmTable(error)) throw error
      setupRequired.crm = true
    }

    try {
      emailLogs = await getConciergeEmailLogs(requestIds)
    } catch (error) {
      if (!isMissingConciergeEmailLogTable(error)) throw error
      setupRequired.emailLog = true
    }

    const crmByRequest = (crmRows || []).reduce((acc, row) => {
      acc[row.request_id] = row
      return acc
    }, {})
    const emailByRequest = latestByRequestId(emailLogs)

    const rows = requests.map(row => mapRequestToRow(row, crmByRequest[row.id], emailByRequest[row.id]))

    return NextResponse.json({
      ok: true,
      rows,
      setupRequired,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Concierge CRM read failed:', error)
    return NextResponse.json({ error: error.message || 'Concierge CRM read failed' }, { status: 500 })
  }
}

export async function PATCH(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let cleaned
  try {
    cleaned = cleanCrmInput(body)
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Invalid CRM payload' }, { status: 400 })
  }

  try {
    const saved = await upsertConciergeCrmCase(cleaned)
    await updateConciergeRequest(cleaned.request_id, {
      status: cleaned.stage,
      admin_notes: cleaned.final_notes || null,
    }).catch(error => {
      console.warn('Concierge base request update failed:', error.message || error)
    })

    return NextResponse.json({ ok: true, row: saved?.[0] || null })
  } catch (error) {
    if (isMissingConciergeCrmTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_concierge_crm nu exista in Supabase.',
        setupRequired: true,
        migration: 'supabase/hp_concierge_crm.sql',
      }, { status: 503 })
    }
    console.error('Concierge CRM save failed:', error)
    return NextResponse.json({ error: error.message || 'Concierge CRM save failed' }, { status: 500 })
  }
}
