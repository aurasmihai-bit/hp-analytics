import { NextResponse } from 'next/server'
import { getActionBacklog, upsertActionBacklogItems } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['nou', 'in_lucru', 'masurare', 'inchis'])

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const sessionSecret = process.env.SESSION_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret)
  )
}

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cleanVerification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function cleanIsoDate(value) {
  if (typeof value !== 'string') return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function rowToClientState(row) {
  return {
    status: VALID_STATUSES.has(row.status) ? row.status : 'nou',
    owner: row.owner || '',
    ignored: !!row.ignored,
    verification: row.verification || null,
    updatedAt: row.updated_at,
  }
}

function rowsToState(rows) {
  return (rows || []).reduce((acc, row) => {
    acc[row.recommendation_id] = rowToClientState(row)
    return acc
  }, {})
}

function cleanItem(input) {
  const id = cleanString(input?.id || input?.recommendation_id, 220)
  if (!id) throw new Error('Missing recommendation id')

  const state = input.state && typeof input.state === 'object' ? input.state : input
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const status = VALID_STATUSES.has(state.status) ? state.status : 'nou'

  return {
    recommendation_id: id,
    status,
    owner: cleanString(state.owner, 180) || cleanString(metadata.owner, 180),
    ignored: !!state.ignored,
    verification: cleanVerification(state.verification),
    type: cleanString(metadata.type || input.type, 80),
    title: cleanString(metadata.title || input.title, 500),
    body: cleanString(metadata.body || input.body, 1000),
    fix: cleanString(metadata.fix || input.fix, 1000),
    metric: cleanString(metadata.metric || input.metric, 240),
    urgency: cleanString(metadata.urgency || input.urgency, 80),
    updated_at: cleanIsoDate(state.updatedAt),
  }
}

function isMissingBacklogTable(error) {
  const message = String(error?.message || error)
  return (
    message.includes('hp_action_backlog') &&
    (
      message.includes('PGRST') ||
      message.includes('42P01') ||
      message.toLowerCase().includes('could not find') ||
      message.toLowerCase().includes('does not exist')
    )
  )
}

function tableSetupResponse(error) {
  console.warn('Action backlog table missing:', error?.message || error)
  return NextResponse.json({
    error: 'Tabela hp_action_backlog nu exista in Supabase.',
    setupRequired: true,
    migration: 'supabase/hp_action_backlog.sql',
  }, { status: 503 })
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await getActionBacklog()
    return NextResponse.json({ ok: true, items: rowsToState(rows), rows })
  } catch (error) {
    if (isMissingBacklogTable(error)) return tableSetupResponse(error)
    console.error('Action backlog read failed:', error)
    return NextResponse.json({ error: 'Backlog read failed' }, { status: 500 })
  }
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

  let rows
  try {
    const rawItems = Array.isArray(body?.items) ? body.items : [body]
    rows = rawItems.map(cleanItem)
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Invalid backlog item' }, { status: 400 })
  }

  try {
    const saved = await upsertActionBacklogItems(rows)
    return NextResponse.json({ ok: true, items: rowsToState(saved), rows: saved })
  } catch (error) {
    if (isMissingBacklogTable(error)) return tableSetupResponse(error)
    console.error('Action backlog save failed:', error)
    return NextResponse.json({ error: 'Backlog save failed' }, { status: 500 })
  }
}
