import { NextResponse } from 'next/server'
import { isConciergeAdminAuthorized, isConciergeAuthorized } from '../../../lib/auth'
import {
  createConciergeUser,
  deleteConciergeUser,
  isMissingConciergeUsersTable,
  listConciergeUsers,
  updateConciergeUser,
} from '../../../lib/concierge-users'

export const dynamic = 'force-dynamic'

function setupResponse() {
  return NextResponse.json({
    error: 'Tabela hp_concierge_users nu exista in Supabase.',
    setupRequired: true,
    migration: 'supabase/hp_concierge_users.sql',
  }, { status: 503 })
}

function forbidden() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(request) {
  if (!isConciergeAuthorized(request)) return forbidden()
  try {
    const users = await listConciergeUsers()
    return NextResponse.json({ ok: true, users: users || [] })
  } catch (error) {
    if (isMissingConciergeUsersTable(error)) return setupResponse()
    console.error('Concierge users read failed:', error)
    return NextResponse.json({ error: error.message || 'Users read failed' }, { status: 500 })
  }
}

export async function POST(request) {
  if (!isConciergeAdminAuthorized(request)) return forbidden()
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const user = await createConciergeUser(body)
    return NextResponse.json({ ok: true, user })
  } catch (error) {
    if (isMissingConciergeUsersTable(error)) return setupResponse()
    const message = error.message || 'User create failed'
    const status = message.includes('duplicate') || message.includes('23505') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request) {
  if (!isConciergeAdminAuthorized(request)) return forbidden()
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const user = await updateConciergeUser(body)
    return NextResponse.json({ ok: true, user })
  } catch (error) {
    if (isMissingConciergeUsersTable(error)) return setupResponse()
    return NextResponse.json({ error: error.message || 'User update failed' }, { status: 500 })
  }
}

export async function DELETE(request) {
  if (!isConciergeAdminAuthorized(request)) return forbidden()
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await deleteConciergeUser(body?.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isMissingConciergeUsersTable(error)) return setupResponse()
    return NextResponse.json({ error: error.message || 'User delete failed' }, { status: 500 })
  }
}
