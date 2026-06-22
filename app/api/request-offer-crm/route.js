import { NextResponse } from 'next/server'
import { isConciergeAuthorized } from '../../lib/auth'
import {
  appendRequestOfferActivity,
  cleanRequestOfferCase,
  getRequestOfferCrmCases,
  isMissingRequestOfferCrmTable,
  syncRequestOfferStageToHomePitch,
  upsertRequestOfferCrmCase,
} from '../../lib/request-offer-crm'

export const dynamic = 'force-dynamic'

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return (cronSecret && authHeader === `Bearer ${cronSecret}`) || isConciergeAuthorized(request)
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || 500)

  try {
    const payload = await getRequestOfferCrmCases({ limit })
    return NextResponse.json({ ok: true, ...payload })
  } catch (error) {
    console.error('Request offer CRM read failed:', error)
    return NextResponse.json({ error: error.message || 'Request offer CRM read failed' }, { status: 500 })
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

  try {
    const cleaned = cleanRequestOfferCase(body)
    let syncResult = null
    let syncError = ''
    try {
      syncResult = await syncRequestOfferStageToHomePitch(cleaned)
    } catch (error) {
      syncError = error.message || String(error)
    }

    let nextLog = appendRequestOfferActivity(cleaned.log, {
      event: 'crm_case_updated',
      text: `Caz actualizat in etapa ${cleaned.stage}.`,
      meta: { stage: cleaned.stage, sourceType: cleaned.source_type, sourceId: cleaned.source_id },
      author: 'Dashboard',
    })
    if (syncResult && !syncResult.skipped) {
      nextLog = appendRequestOfferActivity(nextLog, {
        event: 'homepitch_offer_synced',
        text: 'Statusul ofertei a fost sincronizat in HomePitch.',
        meta: syncResult,
        author: 'Sistem',
      })
    } else if (syncError) {
      nextLog = appendRequestOfferActivity(nextLog, {
        event: 'homepitch_offer_sync_failed',
        text: `Sincronizarea cu HomePitch a esuat: ${syncError}`,
        meta: { stage: cleaned.stage, sourceType: cleaned.source_type, sourceId: cleaned.source_id },
        author: 'Sistem',
      })
    }
    const saved = await upsertRequestOfferCrmCase({ ...cleaned, log: nextLog })
    return NextResponse.json({ ok: true, row: saved, homePitchSync: syncResult, homePitchSyncError: syncError || undefined })
  } catch (error) {
    if (isMissingRequestOfferCrmTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_request_offer_crm_cases nu exista in Supabase analytics.',
        setupRequired: true,
        migration: 'supabase/hp_request_offer_crm.sql',
      }, { status: 503 })
    }
    console.error('Request offer CRM save failed:', error)
    return NextResponse.json({ error: error.message || 'Request offer CRM save failed' }, { status: 500 })
  }
}
