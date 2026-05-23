const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rstihjcnuazzyksdwczp.supabase.co'
// Service role key hardcodat — RLS dezactivat pe hp_analytics_*
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzdGloamNudWF6enlrc2R3Y3pwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2MjY1MiwiZXhwIjoyMDkxMjM4NjUyfQ.2bc82kbs1015eRjhMmQSGlU3SPqTpWxsmZjm5hiGJKU'

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': opts.prefer !== undefined ? opts.prefer : 'return=representation',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${res.status}: ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function upsertSnapshot(snapshotDate, periodDays, payload) {
  return sbFetch('/hp_analytics_snapshots', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify({
      snapshot_date:    snapshotDate,
      period_days:      periodDays,
      synced_at:        new Date().toISOString(),
      traffic:          payload.traffic,
      pages:            payload.pages,
      conversions:      payload.conversions,
      daily:            payload.daily,
      gsc:              payload.gsc,
      cerere_pages:     payload.cererePages,
      cerere_tracking:  payload.cerereTracking,
      recommendations:  payload.recommendations,
    }),
  })
}

export async function getLatestSnapshot(periodDays) {
  const rows = await sbFetch(
    `/hp_analytics_snapshots?period_days=eq.${periodDays}&order=snapshot_date.desc&limit=1`,
    { prefer: '' }
  )
  return rows?.[0] || null
}

export function isFresh(snapshot, maxAgeHours = 6) {
  if (!snapshot) return false
  const age = Date.now() - new Date(snapshot.synced_at).getTime()
  return age < maxAgeHours * 60 * 60 * 1000
}

export async function logSync(params) {
  return sbFetch('/hp_analytics_sync_log', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(params),
  })
}

export async function getHistory(limit = 60) {
  return sbFetch(
    `/hp_analytics_snapshots?period_days=eq.30&order=snapshot_date.desc&limit=${limit}`,
    { prefer: '' }
  )
}

// ── Weekly Reports ────────────────────────────────────────────────
export async function upsertWeeklyReport(weekStart, weekEnd, payload) {
  return sbFetch('/hp_analytics_weekly_reports', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify({
      week_start:  weekStart,
      week_end:    weekEnd,
      created_at:  new Date().toISOString(),
      ...payload,
    }),
  })
}

export async function getWeeklyReports(limit = 12) {
  return sbFetch(
    `/hp_analytics_weekly_reports?order=week_start.desc&limit=${limit}`,
    { prefer: '' }
  )
}

export async function getWeeklyReport(weekStart) {
  const rows = await sbFetch(
    `/hp_analytics_weekly_reports?week_start=eq.${weekStart}&limit=1`,
    { prefer: '' }
  )
  return rows?.[0] || null
}
