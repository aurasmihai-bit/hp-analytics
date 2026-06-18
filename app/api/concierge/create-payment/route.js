import { NextResponse } from 'next/server'
import { isConciergeAuthorized } from '../../../lib/auth'
import {
  appendCrmActivity,
  getConciergeCrmCases,
  createStripeConciergeSession,
  getConciergeRequestById,
  isMissingConciergeCrmTable,
  upsertConciergeCrmCase,
} from '../../../lib/concierge'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!isConciergeAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const requestId = body?.requestId
  const amountEur = Number(body?.amountEur)
  const services = Array.isArray(body?.services) ? body.services : []
  const finalNotes = typeof body?.finalNotes === 'string' ? body.finalNotes : ''

  if (!requestId) return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return NextResponse.json({ error: 'Suma finala este invalida' }, { status: 400 })
  }

  try {
    const conciergeRequest = await getConciergeRequestById(requestId)
    if (!conciergeRequest) return NextResponse.json({ error: 'Cererea concierge nu exista' }, { status: 404 })

    const session = await createStripeConciergeSession({
      request: conciergeRequest,
      services,
      amountEur,
      finalNotes,
    })

    const existingCrm = (await getConciergeCrmCases([requestId]))?.[0]
    const comments = appendCrmActivity(existingCrm?.comments, {
      event: 'stripe_link_created',
      text: `Link Stripe creat pentru ${amountEur.toLocaleString('ro-RO')} EUR.`,
      meta: { sessionId: session.id, paymentUrl: session.url },
    })

    await upsertConciergeCrmCase({
      requestId,
      stage: session.payment_status === 'paid' ? 'oferta_platita' : 'plata_pending',
      comments,
      services,
      finalTotalEur: amountEur,
      finalNotes,
      stripePaymentUrl: session.url,
      stripeSessionId: session.id,
      paymentStatus: session.payment_status === 'paid' ? 'paid' : 'pending',
    })

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    })
  } catch (error) {
    if (isMissingConciergeCrmTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_concierge_crm nu exista in Supabase.',
        setupRequired: true,
        migration: 'supabase/hp_concierge_crm.sql',
      }, { status: 503 })
    }
    const message = error.message || 'Nu am putut crea linkul Stripe'
    if (message.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json({
        error: 'Lipseste cheia Stripe in Vercel. Seteaza variabila STRIPE_SECRET_KEY in proiectul hp-analytics si redeploy aplicatia.',
      }, { status: 503 })
    }
    const status = 500
    return NextResponse.json({ error: message }, { status })
  }
}
