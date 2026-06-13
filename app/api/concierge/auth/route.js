import { NextResponse } from 'next/server'
import { setCrmSessionCookie, setDashboardSessionCookie } from '../../../lib/auth'
import {
  getConciergeUserByUsername,
  isMissingConciergeUsersTable,
  markConciergeUserLogin,
  verifyPassword,
} from '../../../lib/concierge-users'

export const dynamic = 'force-dynamic'

function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    role: user.role,
    active: user.active,
  }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const user = await getConciergeUserByUsername(body?.username)
    if (!user?.active || !verifyPassword(body?.password, user.password_hash)) {
      return NextResponse.json({ error: 'Credentiale CRM invalide' }, { status: 401 })
    }

    await markConciergeUserLogin(user.id).catch(error => {
      console.warn('Could not mark CRM login:', error.message || error)
    })

    const response = NextResponse.json({ ok: true, user: publicUser(user) })
    setCrmSessionCookie(response, user)
    if (user.role === 'admin') setDashboardSessionCookie(response)
    return response
  } catch (error) {
    if (isMissingConciergeUsersTable(error)) {
      return NextResponse.json({
        error: 'Tabela hp_concierge_users nu exista in Supabase.',
        setupRequired: true,
        migration: 'supabase/hp_concierge_users.sql',
      }, { status: 503 })
    }
    console.error('CRM login failed:', error)
    return NextResponse.json({ error: error.message || 'CRM login failed' }, { status: 500 })
  }
}
