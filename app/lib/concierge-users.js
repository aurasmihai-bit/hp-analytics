import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { sbFetch } from './supabase'

const USER_SELECT = 'id,username,display_name,email,role,active,last_login_at,created_at,updated_at'
const ROLES = new Set(['admin', 'asistent'])

function encodeValue(value) {
  return encodeURIComponent(String(value))
}

function cleanString(value, max = 500) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function cleanUsername(value) {
  return cleanString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
}

function cleanRole(value) {
  const role = cleanString(value, 40) || 'asistent'
  if (role === 'agent') return 'asistent'
  return ROLES.has(role) ? role : 'asistent'
}

export function hashPassword(password) {
  const clean = cleanString(password, 240)
  if (clean.length < 4) throw new Error('Parola trebuie sa aiba cel putin 4 caractere')
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(clean, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  const clean = cleanString(password, 240)
  const [scheme, salt, hash] = String(storedHash || '').split(':')
  if (scheme !== 'scrypt' || !salt || !hash || !clean) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(clean, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function isMissingConciergeUsersTable(error) {
  const message = String(error?.message || error)
  return message.includes('hp_concierge_users') && (
    message.includes('PGRST') ||
    message.includes('42P01') ||
    message.toLowerCase().includes('could not find') ||
    message.toLowerCase().includes('does not exist')
  )
}

export async function listConciergeUsers() {
  return sbFetch(`/hp_concierge_users?select=${USER_SELECT}&order=active.desc,display_name.asc,username.asc`, { prefer: '' })
}

export async function getConciergeUserByUsername(username) {
  const clean = cleanUsername(username)
  if (!clean) return null
  const rows = await sbFetch(
    `/hp_concierge_users?username=eq.${encodeValue(clean)}&select=${USER_SELECT},password_hash&limit=1`,
    { prefer: '' }
  )
  return rows?.[0] || null
}

export async function createConciergeUser(input) {
  const username = cleanUsername(input?.username)
  if (!username) throw new Error('Username invalid')
  const displayName = cleanString(input?.displayName || input?.display_name || username, 160) || username
  const passwordHash = hashPassword(input?.password)
  const row = {
    username,
    display_name: displayName,
    email: cleanString(input?.email, 220) || null,
    role: cleanRole(input?.role),
    active: input?.active !== false,
    password_hash: passwordHash,
  }
  const saved = await sbFetch('/hp_concierge_users', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(row),
  })
  return saved?.[0] || null
}

export async function updateConciergeUser(input) {
  const id = cleanString(input?.id, 80)
  if (!id) throw new Error('Missing user id')
  const row = {
    display_name: cleanString(input?.displayName || input?.display_name, 160) || null,
    email: cleanString(input?.email, 220) || null,
    role: cleanRole(input?.role),
    active: input?.active !== false,
    updated_at: new Date().toISOString(),
  }
  if (cleanString(input?.password, 240)) row.password_hash = hashPassword(input.password)
  const saved = await sbFetch(`/hp_concierge_users?id=eq.${encodeValue(id)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify(row),
  })
  return saved?.[0] || null
}

export async function deleteConciergeUser(id) {
  const cleanId = cleanString(id, 80)
  if (!cleanId) throw new Error('Missing user id')
  await sbFetch(`/hp_concierge_users?id=eq.${encodeValue(cleanId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  })
  return true
}

export async function markConciergeUserLogin(id) {
  const cleanId = cleanString(id, 80)
  if (!cleanId) return
  await sbFetch(`/hp_concierge_users?id=eq.${encodeValue(cleanId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  })
}
