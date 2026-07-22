import { getOptionalEnv } from './env'

const DEFAULT_AMPLITUDE_EVENTS = [
  '[Amplitude] Page Viewed',
  '[Amplitude] Form Started',
  '[Amplitude] Form Submitted',
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

function amplitudeConfig() {
  const apiKey = getOptionalEnv('AMPLITUDE_API_KEY')
  const secretKey = getOptionalEnv('AMPLITUDE_SECRET_KEY')
  if (!apiKey || !secretKey) return null
  return {
    apiKey,
    secretKey,
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
      setupIssue: 'Lipsesc AMPLITUDE_API_KEY si/sau AMPLITUDE_SECRET_KEY in env. Optional seteaza AMPLITUDE_EVENTS cu event names exacte, separate prin virgula.',
      events: configuredEvents.map(eventName => ({ event_name: eventName, events: 0, timeline: [] })),
      llmEvents: [],
      formEvents: [],
      timeline: [],
      recommendations: buildAmplitudeRecommendations([], 'Lipsesc AMPLITUDE_API_KEY si/sau AMPLITUDE_SECRET_KEY in env.'),
    }
  }

  const settled = await Promise.allSettled(configuredEvents.map(eventName => fetchEvent(config, eventName, start, end)))
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
  return {
    schemaVersion: 1,
    events,
    llmEvents,
    formEvents,
    timeline: Array.from(timelineMap.values()).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    recommendations: buildAmplitudeRecommendations(events),
  }
}
