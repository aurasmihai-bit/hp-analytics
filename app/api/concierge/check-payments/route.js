import { NextResponse } from 'next/server'
import { isConciergeAuthorized } from '../../../lib/auth'
import {
  appendCrmActivity,
  getPendingConciergePayments,
  isMissingConciergeCrmTable,
  retrieveStripeSession,
  updateConciergeCrmCase,
} from '../../../lib/concierge'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    isConciergeAuthorized(request)
  )
}

function crmStatusFromStripe(session) {
  if (session?.payment_status === 'paid') return 'paid'
  if (session?.status === 'expired') return 'expired'
  if (session?.status === 'complete') return session.payment_status === 'paid' ? 'paid' : 'pending'
  return 'pending'
}

async function checkPayments() {
  const rows = await getPendingConciergePayments()
  const results = []

  for (const row of rows) {
    try {
      const session = await retrieveStripeSession(row.stripe_session_id)
      const paymentStatus = crmStatusFromStripe(session)
      const stage = paymentStatus === 'paid' ? 'oferta_platita' : row.stage
      const updates = {
        payment_status: paymentStatus,
        payment_checked_at: new Date().toISOString(),
        stage,
        after_payment_status: paymentStatus === 'paid' ? (row.after_payment_status || 'de_contactat_dupa_plata') : row.after_payment_status,
      }
      if (paymentStatus !== row.payment_status || stage !== row.stage) {
        updates.comments = appendCrmActivity(row.comments, {
          event: paymentStatus === 'paid' ? 'payment_confirmed' : 'payment_status_updated',
          text: paymentStatus === 'paid' ? 'Plata a fost confirmata in Stripe.' : `Status plata actualizat: ${paymentStatus}.`,
          meta: { sessionId: row.stripe_session_id, paymentStatus },
        })
      }
      await updateConciergeCrmCase(row.request_id, updates)
      results.push({ requestId: row.request_id, sessionId: row.stripe_session_id, status: paymentStatus })
    } catch (error) {
      results.push({ requestId: row.request_id, sessionId: row.stripe_session_id, status: 'error', error: error.message || String(error) })
    }
  }

  return results
}

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const results = await checkPayments()
    const failed = results.filter(row => row.status === 'error')
    return NextResponse.json({
      ok: failed.length === 0,
      checkedAt: new Date().toISOString(),
      count: results.length,
      results,
    }, { status: failed.length ? 207 : 200 })
  } catch (error) {
    if (isMissingConciergeCrmTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_concierge_crm nu exista in Supabase.',
        setupRequired: true,
        migration: 'supabase/hp_concierge_crm.sql',
      }, { status: 503 })
    }
    const message = error.message || 'Payment check failed'
    const status = message.includes('STRIPE_SECRET_KEY') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request) {
  return GET(request)
}
