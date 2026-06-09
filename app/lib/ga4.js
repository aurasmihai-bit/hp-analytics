import { getGoogleAccessToken } from './google-auth'

const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

function numberValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function gaDate(value) {
  const raw = String(value || '')
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
  return raw
}

async function runReport(accessToken, propertyId, { startDate, endDate, dimensions, metrics, limit = 10000 }) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map(name => ({ name })),
      metrics: metrics.map(name => ({ name })),
      limit: String(limit),
    }),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`GA4 report ${res.status}: ${body?.error?.message || text}`)
  return body.rows || []
}

async function runReportBatch(accessToken, propertyId, configs, concurrency = 4) {
  const results = new Array(configs.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < configs.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await runReport(accessToken, propertyId, configs[currentIndex])
    }
  }

  const workerCount = Math.min(concurrency, configs.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export async function fetchWeeklyGa4Data({ propertyId, start, end }) {
  const accessToken = await getGoogleAccessToken(GA4_SCOPE)
  const [trafficRows, pageRows, trackingRows] = await Promise.all([
    runReport(accessToken, propertyId, {
      startDate: start,
      endDate: end,
      dimensions: ['sessionDefaultChannelGroup'],
      metrics: ['sessions', 'newUsers', 'engagementRate', 'averageSessionDuration', 'conversions'],
    }),
    runReport(accessToken, propertyId, {
      startDate: start,
      endDate: end,
      dimensions: ['pagePath'],
      metrics: ['screenPageViews', 'activeUsers', 'engagementRate', 'averageSessionDuration', 'bounceRate', 'conversions'],
    }),
    runReport(accessToken, propertyId, {
      startDate: start,
      endDate: end,
      dimensions: ['date'],
      metrics: [
        'keyEvents:bravo_cerere_noua',
        'keyEvents:bun_venit_cumparator',
        'keyEvents:bun_venit_agent',
        'keyEvents:bun_venit_proprietar',
      ],
    }),
  ])

  return {
    traffic: trafficRows.map(row => ({
      session_default_channel_group: row.dimensionValues?.[0]?.value || '(not set)',
      sessions: numberValue(row.metricValues?.[0]?.value),
      newusers: numberValue(row.metricValues?.[1]?.value),
      engagement_rate: numberValue(row.metricValues?.[2]?.value),
      average_session_duration: numberValue(row.metricValues?.[3]?.value),
      conversions: numberValue(row.metricValues?.[4]?.value),
    })),
    pages: pageRows
      .map(row => ({
        page_path: row.dimensionValues?.[0]?.value || '/',
        screen_page_views: numberValue(row.metricValues?.[0]?.value),
        active_users: numberValue(row.metricValues?.[1]?.value),
        engagement_rate: numberValue(row.metricValues?.[2]?.value),
        average_session_duration: numberValue(row.metricValues?.[3]?.value),
        bounce_rate: numberValue(row.metricValues?.[4]?.value),
        conversions: numberValue(row.metricValues?.[5]?.value),
      }))
      .filter(row => !row.page_path.includes('/admin')),
    tracking: trackingRows.map(row => ({
      date: gaDate(row.dimensionValues?.[0]?.value),
      conversions_bravo_cerere_noua: numberValue(row.metricValues?.[0]?.value),
      conversions_bun_venit_cumparator: numberValue(row.metricValues?.[1]?.value),
      conversions_bun_venit_agent: numberValue(row.metricValues?.[2]?.value),
      conversions_bun_venit_proprietar: numberValue(row.metricValues?.[3]?.value),
    })),
    gsc: {
      clicks: 0,
      impressions: 0,
      position: null,
    },
  }
}

function dim(row, index) {
  return row.dimensionValues?.[index]?.value || ''
}

function metric(row, index) {
  return numberValue(row.metricValues?.[index]?.value)
}

function isExitIntentEventName(value) {
  const name = String(value || '').toLowerCase()
  return /(exit|intent|abandon|leave|beforeunload|page_close|close_page|dropoff|drop_off)/.test(name)
}

function mapTrafficRows(rows) {
  return rows.map(row => ({
    session_default_channel_group: dim(row, 0) || '(not set)',
    sessions: metric(row, 0),
    newusers: metric(row, 1),
    engaged_sessions: metric(row, 2),
    engagement_rate: metric(row, 3),
    average_session_duration: metric(row, 4),
    conversions: metric(row, 5),
  }))
}

function mapPageRows(rows) {
  return rows.map(row => ({
    page_path: dim(row, 0) || '/',
    screen_page_views: metric(row, 0),
    active_users: metric(row, 1),
    bounce_rate: metric(row, 2),
    engagement_rate: metric(row, 3),
    average_session_duration: metric(row, 4),
    user_engagement_duration: metric(row, 5),
    conversions: metric(row, 6),
  })).filter(row => !row.page_path.includes('/admin'))
}

function mapConversionRows(rows) {
  return rows.map(row => ({
    session_default_channel_group: dim(row, 0) || '(not set)',
    sessions: metric(row, 0),
    conversions_signup: metric(row, 1),
    conversions_offer_accepted: metric(row, 2),
    conversions_bravo_cerere_noua: metric(row, 3),
    conversions_bun_venit_agent: metric(row, 4),
    conversions_bun_venit_cumparator: metric(row, 5),
    conversions_bun_venit_proprietar: metric(row, 6),
  }))
}

function mapDailyRows(rows) {
  return rows.map(row => ({
    date: gaDate(dim(row, 0)),
    sessions: metric(row, 0),
    newusers: metric(row, 1),
    conversions: metric(row, 2),
    engagement_rate: metric(row, 3),
    average_session_duration: metric(row, 4),
  }))
}

function mapDailyChannelRows(rows) {
  return rows.map(row => ({
    date: gaDate(dim(row, 0)),
    session_default_channel_group: dim(row, 1) || '(not set)',
    sessions: metric(row, 0),
    conversions: metric(row, 1),
  }))
}

function mapPageDailyRows(rows, pathPart) {
  return rows.map(row => ({
    date: gaDate(dim(row, 0)),
    page_path: dim(row, 1) || '/',
    screen_page_views: metric(row, 0),
    conversions: metric(row, 1),
  })).filter(row => row.page_path.includes(pathPart))
}

function mapPageChannelRows(rows, pathPart) {
  return rows.map(row => ({
    session_default_channel_group: dim(row, 0) || '(not set)',
    page_path: dim(row, 1) || '/',
    screen_page_views: metric(row, 0),
    active_users: metric(row, 1),
    conversions: metric(row, 2),
  })).filter(row => row.page_path.includes(pathPart))
}

function mapTrackingRows(rows) {
  return rows.map(row => ({
    date: gaDate(dim(row, 0)),
    conversions_bravo_cerere_noua: metric(row, 0),
    conversions_bun_venit_cumparator: metric(row, 1),
    conversions_bun_venit_agent: metric(row, 2),
    conversions_bun_venit_proprietar: metric(row, 3),
  }))
}

function mapExitIntentRows(rows) {
  return rows
    .map(row => ({
      date: gaDate(dim(row, 0)),
      event_name: dim(row, 1) || '(not set)',
      page_path: dim(row, 2) || '/',
      new_vs_returning: dim(row, 3) || '(not set)',
      session_default_channel_group: dim(row, 4) || '(not set)',
      device_category: dim(row, 5) || '(not set)',
      event_count: metric(row, 0),
      active_users: metric(row, 1),
    }))
    .filter(row => isExitIntentEventName(row.event_name))
    .filter(row => !row.page_path.includes('/admin'))
}

async function fetchExitIntentRows(accessToken, propertyId, startDate, endDate) {
  try {
    const rows = await runReport(accessToken, propertyId, {
      startDate,
      endDate,
      dimensions: ['date', 'eventName', 'pagePath', 'newVsReturning', 'sessionDefaultChannelGroup', 'deviceCategory'],
      metrics: ['eventCount', 'activeUsers'],
      limit: 10000,
    })
    return mapExitIntentRows(rows)
  } catch (error) {
    console.warn('GA4 exit intent report failed:', error.message)
    return []
  }
}

export async function fetchReportGa4Data({ propertyId, currFrom, currTo, prevFrom, prevTo }) {
  const accessToken = await getGoogleAccessToken(GA4_SCOPE)
  const trafficMetrics = ['sessions', 'newUsers', 'engagedSessions', 'engagementRate', 'averageSessionDuration', 'conversions']
  const pageMetrics = ['screenPageViews', 'activeUsers', 'bounceRate', 'engagementRate', 'averageSessionDuration', 'userEngagementDuration', 'conversions']
  const conversionMetrics = [
    'sessions',
    'keyEvents:signup',
    'keyEvents:Offer_accepted',
    'keyEvents:bravo_cerere_noua',
    'keyEvents:bun_venit_agent',
    'keyEvents:bun_venit_cumparator',
    'keyEvents:bun_venit_proprietar',
  ]
  const trackingMetrics = [
    'keyEvents:bravo_cerere_noua',
    'keyEvents:bun_venit_cumparator',
    'keyEvents:bun_venit_agent',
    'keyEvents:bun_venit_proprietar',
  ]

  const [
    trafficCurrent,
    trafficPrevious,
    pagesCurrent,
    pagesPrevious,
    conversions,
    dailyCurrent,
    dailyByChannel,
    pageDailyCerereNoua,
    pageDailyCereriNou,
    pageDailyVreau,
    pageChannelCerereNoua,
    pageChannelCereriNou,
    pageChannelVreau,
    tracking,
  ] = await runReportBatch(accessToken, propertyId, [
    { startDate: currFrom, endDate: currTo, dimensions: ['sessionDefaultChannelGroup'], metrics: trafficMetrics },
    { startDate: prevFrom, endDate: prevTo, dimensions: ['sessionDefaultChannelGroup'], metrics: trafficMetrics },
    { startDate: currFrom, endDate: currTo, dimensions: ['pagePath'], metrics: pageMetrics },
    { startDate: prevFrom, endDate: prevTo, dimensions: ['pagePath'], metrics: pageMetrics },
    { startDate: currFrom, endDate: currTo, dimensions: ['sessionDefaultChannelGroup'], metrics: conversionMetrics },
    { startDate: currFrom, endDate: currTo, dimensions: ['date'], metrics: ['sessions', 'newUsers', 'conversions', 'engagementRate', 'averageSessionDuration'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['date', 'sessionDefaultChannelGroup'], metrics: ['sessions', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: currFrom, endDate: currTo, dimensions: ['date'], metrics: trackingMetrics },
  ])
  const exitIntentRows = await fetchExitIntentRows(accessToken, propertyId, currFrom, currTo)

  return {
    traffic: {
      current: mapTrafficRows(trafficCurrent),
      previous: mapTrafficRows(trafficPrevious),
    },
    pages: {
      current: mapPageRows(pagesCurrent),
      previous: mapPageRows(pagesPrevious),
    },
    conversions: mapConversionRows(conversions),
    daily: {
      current: mapDailyRows(dailyCurrent).sort((a,b) => a.date.localeCompare(b.date)),
      byChannel: mapDailyChannelRows(dailyByChannel),
    },
    gsc: {
      current: [],
      previous: [],
      queries: [],
      pages: [],
    },
    cererePages: {
      daily: {
        cerereNoua: mapPageDailyRows(pageDailyCerereNoua, 'cerere-noua').sort((a,b) => a.date.localeCompare(b.date)),
        cereriNou: mapPageDailyRows(pageDailyCereriNou, '/cereri/nou').sort((a,b) => a.date.localeCompare(b.date)),
        vreau: mapPageDailyRows(pageDailyVreau, '/vreau').sort((a,b) => a.date.localeCompare(b.date)),
      },
      byChannel: {
        cerereNoua: mapPageChannelRows(pageChannelCerereNoua, 'cerere-noua'),
        cereriNou: mapPageChannelRows(pageChannelCereriNou, '/cereri/nou'),
        vreau: mapPageChannelRows(pageChannelVreau, '/vreau'),
      },
    },
    cerereTracking: mapTrackingRows(tracking).sort((a,b) => a.date.localeCompare(b.date)),
    exitAnalysis: {
      schemaVersion: 1,
      exitIntent: {
        rows: exitIntentRows,
      },
    },
  }
}

function emptyDailyPayload(date) {
  return {
    date,
    traffic: [],
    pages: [],
    conversions: [],
    daily: { current: [], byChannel: [] },
    cererePages: {
      daily: { cerereNoua: [], cereriNou: [], vreau: [] },
      byChannel: { cerereNoua: [], cereriNou: [], vreau: [] },
    },
    cerereTracking: [],
    exitAnalysis: {
      schemaVersion: 1,
      exitIntent: { rows: [] },
    },
  }
}

function ensureDailyPayload(days, date) {
  const cleanDate = gaDate(date)
  if (!days[cleanDate]) days[cleanDate] = emptyDailyPayload(cleanDate)
  return days[cleanDate]
}

export async function fetchReportGa4DailyData({ propertyId, start, end }) {
  const accessToken = await getGoogleAccessToken(GA4_SCOPE)
  const trafficMetrics = ['sessions', 'newUsers', 'engagedSessions', 'engagementRate', 'averageSessionDuration', 'conversions']
  const pageMetrics = ['screenPageViews', 'activeUsers', 'bounceRate', 'engagementRate', 'averageSessionDuration', 'userEngagementDuration', 'conversions']
  const conversionMetrics = [
    'sessions',
    'keyEvents:signup',
    'keyEvents:Offer_accepted',
    'keyEvents:bravo_cerere_noua',
    'keyEvents:bun_venit_agent',
    'keyEvents:bun_venit_cumparator',
    'keyEvents:bun_venit_proprietar',
  ]
  const trackingMetrics = [
    'keyEvents:bravo_cerere_noua',
    'keyEvents:bun_venit_cumparator',
    'keyEvents:bun_venit_agent',
    'keyEvents:bun_venit_proprietar',
  ]

  const [
    traffic,
    pages,
    conversions,
    daily,
    dailyByChannel,
    pageDailyCerereNoua,
    pageDailyCereriNou,
    pageDailyVreau,
    pageChannelCerereNoua,
    pageChannelCereriNou,
    pageChannelVreau,
    tracking,
  ] = await runReportBatch(accessToken, propertyId, [
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup'], metrics: trafficMetrics },
    { startDate: start, endDate: end, dimensions: ['date', 'pagePath'], metrics: pageMetrics },
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup'], metrics: conversionMetrics },
    { startDate: start, endDate: end, dimensions: ['date'], metrics: ['sessions', 'newUsers', 'conversions', 'engagementRate', 'averageSessionDuration'] },
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup'], metrics: ['sessions', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'pagePath'], metrics: ['screenPageViews', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date', 'sessionDefaultChannelGroup', 'pagePath'], metrics: ['screenPageViews', 'activeUsers', 'conversions'] },
    { startDate: start, endDate: end, dimensions: ['date'], metrics: trackingMetrics },
  ])
  const exitIntentRows = await fetchExitIntentRows(accessToken, propertyId, start, end)

  const days = {}

  traffic.forEach(row => {
    const day = ensureDailyPayload(days, dim(row, 0))
    day.traffic.push({
      session_default_channel_group: dim(row, 1) || '(not set)',
      sessions: metric(row, 0),
      newusers: metric(row, 1),
      engaged_sessions: metric(row, 2),
      engagement_rate: metric(row, 3),
      average_session_duration: metric(row, 4),
      conversions: metric(row, 5),
    })
  })

  pages.forEach(row => {
    const pagePath = dim(row, 1) || '/'
    if (pagePath.includes('/admin')) return
    const day = ensureDailyPayload(days, dim(row, 0))
    day.pages.push({
      page_path: pagePath,
      screen_page_views: metric(row, 0),
      active_users: metric(row, 1),
      bounce_rate: metric(row, 2),
      engagement_rate: metric(row, 3),
      average_session_duration: metric(row, 4),
      user_engagement_duration: metric(row, 5),
      conversions: metric(row, 6),
    })
  })

  conversions.forEach(row => {
    const day = ensureDailyPayload(days, dim(row, 0))
    day.conversions.push({
      session_default_channel_group: dim(row, 1) || '(not set)',
      sessions: metric(row, 0),
      conversions_signup: metric(row, 1),
      conversions_offer_accepted: metric(row, 2),
      conversions_bravo_cerere_noua: metric(row, 3),
      conversions_bun_venit_agent: metric(row, 4),
      conversions_bun_venit_cumparator: metric(row, 5),
      conversions_bun_venit_proprietar: metric(row, 6),
    })
  })

  daily.forEach(row => {
    const date = gaDate(dim(row, 0))
    const day = ensureDailyPayload(days, date)
    day.daily.current.push({
      date,
      sessions: metric(row, 0),
      newusers: metric(row, 1),
      conversions: metric(row, 2),
      engagement_rate: metric(row, 3),
      average_session_duration: metric(row, 4),
    })
  })

  dailyByChannel.forEach(row => {
    const date = gaDate(dim(row, 0))
    const day = ensureDailyPayload(days, date)
    day.daily.byChannel.push({
      date,
      session_default_channel_group: dim(row, 1) || '(not set)',
      sessions: metric(row, 0),
      conversions: metric(row, 1),
    })
  })

  function addPageDaily(rows, key, pathPart) {
    rows.forEach(row => {
      const pagePath = dim(row, 1) || '/'
      if (!pagePath.includes(pathPart)) return
      const date = gaDate(dim(row, 0))
      const day = ensureDailyPayload(days, date)
      day.cererePages.daily[key].push({
        date,
        page_path: pagePath,
        screen_page_views: metric(row, 0),
        conversions: metric(row, 1),
      })
    })
  }

  function addPageChannel(rows, key, pathPart) {
    rows.forEach(row => {
      const pagePath = dim(row, 2) || '/'
      if (!pagePath.includes(pathPart)) return
      const date = gaDate(dim(row, 0))
      const day = ensureDailyPayload(days, date)
      day.cererePages.byChannel[key].push({
        date,
        session_default_channel_group: dim(row, 1) || '(not set)',
        page_path: pagePath,
        screen_page_views: metric(row, 0),
        active_users: metric(row, 1),
        conversions: metric(row, 2),
      })
    })
  }

  addPageDaily(pageDailyCerereNoua, 'cerereNoua', 'cerere-noua')
  addPageDaily(pageDailyCereriNou, 'cereriNou', '/cereri/nou')
  addPageDaily(pageDailyVreau, 'vreau', '/vreau')
  addPageChannel(pageChannelCerereNoua, 'cerereNoua', 'cerere-noua')
  addPageChannel(pageChannelCereriNou, 'cereriNou', '/cereri/nou')
  addPageChannel(pageChannelVreau, 'vreau', '/vreau')

  tracking.forEach(row => {
    const date = gaDate(dim(row, 0))
    const day = ensureDailyPayload(days, date)
    day.cerereTracking.push({
      date,
      conversions_bravo_cerere_noua: metric(row, 0),
      conversions_bun_venit_cumparator: metric(row, 1),
      conversions_bun_venit_agent: metric(row, 2),
      conversions_bun_venit_proprietar: metric(row, 3),
    })
  })

  exitIntentRows.forEach(row => {
    const day = ensureDailyPayload(days, row.date)
    day.exitAnalysis.exitIntent.rows.push(row)
  })

  return days
}
