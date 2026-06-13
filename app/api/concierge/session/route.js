import { NextResponse } from 'next/server'
import { isConciergeAuthorized, isDashboardSessionAuthorized, readCrmSession } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!isConciergeAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const crmUser = readCrmSession(request)
  const dashboardAccess = isDashboardSessionAuthorized(request) || crmUser?.role === 'admin'

  return NextResponse.json({
    ok: true,
    user: crmUser ? {
      id: crmUser.sub,
      username: crmUser.username,
      displayName: crmUser.name,
      role: crmUser.role,
    } : null,
    canAccessAll: dashboardAccess,
    canManageUsers: dashboardAccess,
  })
}
