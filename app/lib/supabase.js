import { requireEnv } from './env'

function getSupabaseConfig() {
  return {
    url: requireEnv('SUPABASE_URL'),
    key: requireEnv('SUPABASE_SERVICE_KEY'),
  }
}

export async function sbFetch(path, opts = {}) {
  const { url, key } = getSupabaseConfig()
  const res = await fetch(`${url}/rest/v1${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
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
  return sbFetch('/hp_analytics_snapshots?on_conflict=snapshot_date,period_days', {
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

export async function upsertWeeklyReport(weekStart, weekEnd, payload) {
  const body = {
    week_start:  weekStart,
    week_end:    weekEnd,
    created_at:  new Date().toISOString(),
    ...payload,
  }
  try {
    return await sbFetch('/hp_analytics_weekly_reports?on_conflict=week_start', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify(body),
    })
  } catch (error) {
    const message = String(error?.message || error)
    if (message.includes('legacy_form_views') && (message.includes('PGRST204') || message.toLowerCase().includes('schema cache'))) {
      const { legacy_form_views, ...fallbackBody } = body
      return sbFetch('/hp_analytics_weekly_reports?on_conflict=week_start', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: JSON.stringify(fallbackBody),
      })
    }
    throw error
  }
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

export async function getActionBacklog() {
  return sbFetch(
    '/hp_action_backlog?select=recommendation_id,status,owner,ignored,verification,type,title,body,fix,metric,urgency,created_at,updated_at&order=updated_at.desc',
    { prefer: '' }
  )
}

export async function upsertActionBacklogItems(items) {
  if (!items.length) return []
  return sbFetch('/hp_action_backlog?on_conflict=recommendation_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(items),
  })
}

export async function getTabDailyRows(startDate, endDate) {
  return sbFetch(
    `/hp_tab_data_daily?data_date=gte.${startDate}&data_date=lte.${endDate}&order=data_date.asc`,
    { prefer: '' }
  )
}

export async function upsertTabDailyRows(rows) {
  if (!rows.length) return []
  return sbFetch('/hp_tab_data_daily?on_conflict=data_date', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify(rows),
  })
}
