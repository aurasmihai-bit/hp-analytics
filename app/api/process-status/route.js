import { NextResponse } from 'next/server'
import { sbFetch } from '../../lib/supabase'
import { fetchPlatformNotificationStatus } from '../../lib/platform'

export const maxDuration = 30

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET
  const sessionSecret = process.env.SESSION_SECRET
  const authHeader = request.headers.get('authorization')
  return (
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!sessionSecret && request.cookies.get('hp_session')?.value === sessionSecret)
  )
}

// Ultima valoare a unei coloane de timp dintr-un tabel hp-analytics; null daca nu se poate citi.
async function latest(table, column, select = column) {
  try {
    const rows = await sbFetch(`/${table}?select=${select}&order=${column}.desc.nullslast&limit=1`, { prefer: '' })
    return { available: true, row: rows?.[0] || null }
  } catch (error) {
    return { available: false, error: error.message || String(error) }
  }
}

// Status live doar din date care exista deja: urmele lasate de cron-urile hp-analytics in
// propriul Supabase si incercarile de email din HomePitch. cron.job_run_details nu e expus
// prin PostgREST, deci ramane „indisponibil” pana exista un RPC / export in HomePitch.
export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [tabCache, weekly, payments, notifications] = await Promise.all([
    latest('hp_tab_data_daily', 'synced_at', 'data_date,synced_at'),
    latest('hp_analytics_weekly_reports', 'created_at', 'week_start,created_at'),
    latest('hp_concierge_crm', 'payment_checked_at', 'payment_checked_at'),
    fetchPlatformNotificationStatus({ days: 7 }).catch(error => ({ available: false, error: error.message || String(error) })),
  ])

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    processes: [
      {
        name: '/api/sync (cache zilnic GA4 + GSC)',
        schedule: 'zilnic 06:00 UTC',
        available: tabCache.available,
        lastRunAt: tabCache.row?.synced_at || null,
        detail: tabCache.row ? `ultima zi salvata: ${tabCache.row.data_date}` : '',
        error: tabCache.error || '',
        expectedEveryHours: 24,
      },
      {
        name: '/api/weekly (raport saptamanal)',
        schedule: 'luni 07:00 UTC',
        available: weekly.available,
        lastRunAt: weekly.row?.created_at || null,
        detail: weekly.row ? `saptamana ${weekly.row.week_start}` : '',
        error: weekly.error || '',
        expectedEveryHours: 24 * 7,
      },
      {
        name: '/api/concierge/check-payments',
        schedule: 'zilnic 07:30 UTC',
        available: payments.available,
        lastRunAt: payments.row?.payment_checked_at || null,
        detail: 'ultima verificare de plata salvata in CRM (apare doar cand exista plati de verificat)',
        error: payments.error || '',
        expectedEveryHours: null,
      },
    ],
    notifications,
    cronJobs: {
      available: false,
      note: 'cron.job_run_details din HomePitch nu e accesibil prin API. Trebuie adaugat in HomePitch un RPC sau o resursa in hp-analytics-export (de ex. resource=cron_job_runs: jobname, status, start_time, end_time, return_message).',
    },
  })
}
