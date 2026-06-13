import { NextResponse } from 'next/server'
import {
  appendCrmActivity,
  getConciergeCrmCases,
  getConciergeRequestById,
  isMissingConciergeCrmTable,
  sendConciergePaymentReminder,
  updateConciergeCrmCase,
} from '../../../lib/concierge'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const sessionSecret = process.env.SESSION_SECRET
  return !!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const requestId = body?.requestId
  const subject = typeof body?.subject === 'string' ? body.subject : ''
  const message = typeof body?.message === 'string' ? body.message : ''
  if (!requestId) return NextResponse.json({ error: 'Missing requestId' }, { status: 400 })

  try {
    const conciergeRequest = await getConciergeRequestById(requestId)
    if (!conciergeRequest) return NextResponse.json({ error: 'Cererea concierge nu exista' }, { status: 404 })

    const crm = (await getConciergeCrmCases([requestId]))?.[0]
    if (!crm?.stripe_payment_url) {
      return NextResponse.json({ error: 'Nu exista link de plata pentru aceasta cerere' }, { status: 400 })
    }

    const providerResponse = await sendConciergePaymentReminder({ request: conciergeRequest, crm, subject, message })
    const comments = appendCrmActivity(crm.comments, {
      event: 'payment_email_sent',
      text: 'Emailul cu linkul de plata a fost trimis clientului.',
      meta: { subject: subject || 'Link plata servicii HomePitch Concierge' },
    })
    await updateConciergeCrmCase(requestId, {
      comments,
      reminder_sent_at: new Date().toISOString(),
      reminder_count: Number(crm.reminder_count || 0) + 1,
    })

    return NextResponse.json({ ok: true, providerResponse })
  } catch (error) {
    if (isMissingConciergeCrmTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_concierge_crm nu exista in Supabase.',
        setupRequired: true,
        migration: 'supabase/hp_concierge_crm.sql',
      }, { status: 503 })
    }
    const message = error.message || 'Nu am putut trimite reminderul'
    const status = message.includes('BREVO_API_KEY') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
