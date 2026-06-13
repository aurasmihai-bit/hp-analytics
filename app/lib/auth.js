import { createHmac, timingSafeEqual } from 'crypto'
import { requireEnv } from './env'

export const DASHBOARD_SESSION_COOKIE = 'hp_session'
export const CRM_SESSION_COOKIE = 'hp_crm_session'

const CRM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(input) {
  const padded = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded + '='.repeat((4 - padded.length % 4) % 4), 'base64').toString('utf8')
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function isDashboardSessionAuthorized(request) {
  const sessionSecret = process.env.SESSION_SECRET
  return !!sessionSecret && request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value === sessionSecret
}

export function createCrmSessionValue(user) {
  const secret = requireEnv('SESSION_SECRET')
  const payload = {
    sub: user.id,
    username: user.username,
    name: user.display_name || user.username,
    role: user.role || 'asistent',
    exp: Date.now() + CRM_SESSION_MAX_AGE_SECONDS * 1000,
  }
  const body = base64Url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

export function readCrmSession(request) {
  const token = request.cookies.get(CRM_SESSION_COOKIE)?.value
  const secret = process.env.SESSION_SECRET
  if (!token || !secret) return null

  const [body, signature] = token.split('.')
  if (!body || !signature || !safeEqual(signature, sign(body, secret))) return null

  try {
    const payload = JSON.parse(fromBase64Url(body))
    if (!payload?.sub || !payload?.username || Number(payload.exp || 0) < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function isConciergeAuthorized(request) {
  return isDashboardSessionAuthorized(request) || !!readCrmSession(request)
}

export function isConciergeAdminAuthorized(request) {
  if (isDashboardSessionAuthorized(request)) return true
  return readCrmSession(request)?.role === 'admin'
}

export function setCrmSessionCookie(response, user) {
  response.cookies.set(CRM_SESSION_COOKIE, createCrmSessionValue(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CRM_SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}

export function setDashboardSessionCookie(response) {
  response.cookies.set(DASHBOARD_SESSION_COOKIE, requireEnv('SESSION_SECRET'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CRM_SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}

export function clearSessionCookies(response) {
  for (const name of [DASHBOARD_SESSION_COOKIE, CRM_SESSION_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
  }
}
