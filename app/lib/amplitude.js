import { getOptionalEnv } from './env'

const DEFAULT_AMPLITUDE_EVENTS = [
  '[Amplitude] Page Viewed',
  '[Amplitude] Element Clicked',
  '[Amplitude] Form Started',
  '[Amplitude] Form Submitted',
  '[Amplitude] Session Started',
  '[Amplitude] Session Ended',
  '[Amplitude] Session Replay Started',
  'Session Replay Started',
  'session_replay_started',
  'Form Step Completed',
  'Form Validation Error',
  'Form Abandoned',
  'Request Created',
  'llm_referral',
  'LLM Referral',
  'AI Agent Discovery',
  'agent_discovery',
  'api_catalog_view',
  'mcp_server_card_view',
]

const AMPLITUDE_BROWSER_SETTINGS = {
  sdk: '@amplitude/unified',
  analyticsAutocapture: true,
  sessionReplayEnabled: true,
  sessionReplaySampleRate: 1,
  initializedClientSide: true,
}

function amplitudeConfig() {
  const apiKey = getOptionalEnv('AMPLITUDE_API_KEY')
  const secretKey = getOptionalEnv('AMPLITUDE_SECRET_KEY')
  const replaySearchEndpoint = getOptionalEnv('AMPLITUDE_REPLAY_SEARCH_ENDPOINT') || 'https://amplitude.com/api/2/session-replay/search'
  if (!apiKey || !secretKey) return null
  return {
    apiKey,
    secretKey,
    replaySearchEndpoint,
    events: (getOptionalEnv('AMPLITUDE_EVENTS') || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  }
}

function amplitudeDate(date) {
  return String(date || '').replace(/-/g, '')
}

function authHeader(config) {
  return `Basic ${Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64')}`
}

function flattenSeries(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => Array.isArray(item) ? flattenSeries(item) : [Number(item || 0)])
}

function parseSegmentationResponse(payload, eventName) {
  const data = payload?.data || payload || {}
  const series = flattenSeries(data.series || data.values || data.counts || [])
  const total = series.reduce((sum, value) => sum + Number(value || 0), 0)
  const labels = data.xValues || data.x_values || data.dates || []
  const timeline = series.map((value, index) => ({
    date: labels[index] || '',
    event_name: eventName,
    events: Number(value || 0),
  }))
  return {
    event_name: eventName,
    events: total,
    timeline,
  }
}

function lastSeenDate(row) {
  return (row.timeline || [])
    .filter(item => Number(item.events || 0) > 0 && item.date)
    .map(item => item.date)
    .sort()
    .pop() || ''
}

function eventListing(events, matcher = null) {
  return events
    .filter(row => !matcher || matcher.test(row.event_name || ''))
    .map(row => ({
      event_name: row.event_name,
      events: Number(row.events || 0),
      last_seen: lastSeenDate(row),
      error: row.error || '',
    }))
    .sort((a, b) => Number(b.events || 0) - Number(a.events || 0) || String(a.event_name || '').localeCompare(String(b.event_name || '')))
}

async function fetchEvent(config, eventName, start, end) {
  const params = new URLSearchParams()
  params.set('e', JSON.stringify({ event_type: eventName }))
  params.set('start', amplitudeDate(start))
  params.set('end', amplitudeDate(end))
  params.set('i', '1')
  params.set('m', 'totals')
  const endpoints = [
    'https://amplitude.com/api/2/events/segmentation',
    'https://amplitude.com/api/2/segmentation',
  ]
  let lastError = null
  for (const endpoint of endpoints) {
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: authHeader(config) },
      cache: 'no-store',
    })
    const text = await res.text()
    let payload = null
    try { payload = text ? JSON.parse(text) : null } catch {}
    if (res.ok) return parseSegmentationResponse(payload, eventName)
    lastError = new Error(`Amplitude ${res.status}: ${payload?.error || payload?.message || text || res.statusText}`)
    if (res.status !== 404) break
  }
  throw lastError || new Error('Amplitude request failed')
}

function parseReplaySearchResponse(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return {
    replays: rows.map(row => ({
      amplitude_id: row.amplitude_id || '',
      session_replay_id: row.session_replay_id || '',
      session_start_time: row.session_start_time || null,
      session_end_time: row.session_end_time || null,
      duration: Number(row.duration || 0),
      url: row.url || '',
      groupBys: row.groupBys || {},
    })),
    replayMetadata: payload?.metadata || {},
    replaySearchIssue: '',
  }
}

async function fetchReplaySearch(config, start, end) {
  const body = {
    start: amplitudeDate(start),
    end: amplitudeDate(end),
    replayFilters: [
      { prop: 'duration', op: 'greater or equal', values: ['1'] },
    ],
    groupBys: {
      eventPosition: 'last',
      properties: [
        { type: 'event', value: 'page_url' },
        { type: 'event', value: 'page_location' },
        { type: 'event', value: 'page_path' },
        { type: 'user', value: 'email' },
      ],
    },
    limit: 20,
  }
  const res = await fetch(config.replaySearchEndpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) {
    throw new Error(`Amplitude Replay Search ${res.status}: ${payload?.error || payload?.message || text || res.statusText}`)
  }
  return parseReplaySearchResponse(payload)
}

function buildAmplitudeRecommendations(events, issue = '') {
  if (issue) {
    return [{
      type: 'neutral',
      title: 'Conecteaza Amplitude pentru tabul dedicat',
      body: issue,
    }]
  }
  const llmEvents = events.filter(row => /(llm|agent|api_catalog|mcp)/i.test(row.event_name))
  const formEvents = events.filter(row => /(form|request)/i.test(row.event_name))
  const recommendations = []
  if (!llmEvents.some(row => Number(row.events || 0) > 0)) {
    recommendations.push({
      type: 'neutral',
      title: 'Nu exista inca evenimente LLM/agent discovery in Amplitude',
      body: 'Adauga sau mapeaza evenimente pentru llm_referral, agent_discovery, api_catalog_view si mcp_server_card_view ca sa vezi impactul LLM-urilor.',
    })
  }
  if (!formEvents.some(row => Number(row.events || 0) > 0)) {
    recommendations.push({
      type: 'neutral',
      title: 'Evenimentele de formular nu apar in Amplitude API',
      body: 'Verifica event names din Amplitude si seteaza AMPLITUDE_EVENTS cu lista exacta, separata prin virgula.',
    })
  }
  return recommendations
}

export async function fetchAmplitudeAnalytics({ start, end }) {
  const config = amplitudeConfig()
  const configuredEvents = config?.events?.length ? config.events : DEFAULT_AMPLITUDE_EVENTS
  if (!config) {
    return {
      schemaVersion: 1,
      settings: AMPLITUDE_BROWSER_SETTINGS,
      setupIssue: 'Lipsesc AMPLITUDE_API_KEY si/sau AMPLITUDE_SECRET_KEY in env. Optional seteaza AMPLITUDE_EVENTS cu event names exacte, separate prin virgula.',
      events: configuredEvents.map(eventName => ({ event_name: eventName, events: 0, timeline: [] })),
      llmEvents: [],
      formEvents: [],
      sessionReplayEvents: [],
      liveEvents: [],
      replays: [],
      replayMetadata: {},
      replaySearchIssue: 'Replay Search API nu poate rula fara AMPLITUDE_API_KEY si AMPLITUDE_SECRET_KEY.',
      timeline: [],
      recommendations: buildAmplitudeRecommendations([], 'Lipsesc AMPLITUDE_API_KEY si/sau AMPLITUDE_SECRET_KEY in env.'),
    }
  }

  const [eventResults, replaySearchResult] = await Promise.all([
    Promise.allSettled(configuredEvents.map(eventName => fetchEvent(config, eventName, start, end))),
    fetchReplaySearch(config, start, end).catch(error => ({
      replays: [],
      replayMetadata: {},
      replaySearchIssue: error.message || 'Replay Search API indisponibil.',
    })),
  ])
  const settled = eventResults
  const events = settled.map((result, index) => (
    result.status === 'fulfilled'
      ? result.value
      : { event_name: configuredEvents[index], events: 0, error: result.reason?.message || String(result.reason), timeline: [] }
  ))
  const timelineMap = new Map()
  events.flatMap(row => row.timeline || []).forEach(row => {
    if (!row.date) return
    if (!timelineMap.has(row.date)) timelineMap.set(row.date, { date: row.date })
    timelineMap.get(row.date)[row.event_name] = Number(row.events || 0)
  })
  const llmEvents = events.filter(row => /(llm|agent|api_catalog|mcp)/i.test(row.event_name))
  const formEvents = events.filter(row => /(form|request)/i.test(row.event_name))
  const sessionReplayEvents = eventListing(events, /(session.?replay|replay)/i)
  const liveEvents = eventListing(events).slice(0, 20)
  return {
    schemaVersion: 1,
    settings: AMPLITUDE_BROWSER_SETTINGS,
    events,
    llmEvents,
    formEvents,
    sessionReplayEvents,
    liveEvents,
    replays: replaySearchResult.replays || [],
    replayMetadata: replaySearchResult.replayMetadata || {},
    replaySearchIssue: replaySearchResult.replaySearchIssue || '',
    timeline: Array.from(timelineMap.values()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    recommendations: buildAmplitudeRecommendations(events),
  }
}
