import test from 'node:test'
import assert from 'node:assert/strict'
import {
  lastActionAt,
  daysSince,
  requestOfferCaseTiming,
  markResolvedInHomePitch,
  conciergePipelineValue,
  countCreatedSince,
  firstContactAt,
  firstContactStats,
} from '../app/lib/crm-metrics.js'

const NOW = Date.parse('2026-11-07T12:00:00Z')

test('inactivitatea se numara de la ultima actiune, nu de la primire', () => {
  const row = {
    source_received_at: '2026-10-01T10:00:00Z',
    log: [
      { event: 'crm_case_updated', created_at: '2026-11-01T10:00:00Z' },
      { event: 'homepitch_offer_synced', created_at: '2026-11-06T10:00:00Z' }, // automat, nu conteaza
    ],
    comments: [{ type: 'comment', created_at: '2026-11-03T09:00:00Z' }],
    last_reminder_at: '2026-11-02T08:00:00Z',
  }
  const timing = requestOfferCaseTiming(row, NOW)
  assert.equal(timing.lastActionAt, '2026-11-03T09:00:00.000Z')
  assert.equal(timing.inactiveDays, 4)
  assert.equal(timing.ageDays, 37)
})

test('fara actiuni, inactivitatea porneste de la primire', () => {
  assert.equal(lastActionAt({ receivedAt: '2026-11-01T12:00:00Z' }), '2026-11-01T12:00:00.000Z')
  assert.equal(daysSince('2026-11-01T12:00:00Z', NOW), 6)
  assert.equal(daysSince('', NOW), 0)
})

test('cazurile care nu mai vin live sunt marcate rezolvate doar cand lista live e completa', () => {
  const stored = [{ id: 'a', stage: 'nou' }]
  assert.equal(markResolvedInHomePitch(stored, { liveLoaded: true, liveCount: 10, liveLimit: 500 })[0].resolvedInHomePitch, true)
  // exportul a picat sau a venit plin (posibil trunchiat): nu stim, nu marcam
  assert.equal(markResolvedInHomePitch(stored, { liveLoaded: false, liveCount: 0, liveLimit: 500 })[0].resolvedInHomePitch, undefined)
  assert.equal(markResolvedInHomePitch(stored, { liveLoaded: true, liveCount: 500, liveLimit: 500 })[0].resolvedInHomePitch, undefined)
})

test('pipeline-ul nu include cererile refuzate', () => {
  const rows = [
    { stage: 'nou', estimatedTotalEur: 100 },
    { stage: 'oferta_trimisa', finalTotalEur: 250, estimatedTotalEur: 200 },
    { stage: 'refuz', finalTotalEur: 1000 },
  ]
  assert.equal(conciergePipelineValue(rows), 350)
})

test('ultimele 7 zile se raporteaza la azi', () => {
  const rows = [
    { createdAt: '2026-11-06T10:00:00Z' },
    { createdAt: '2026-11-01T10:00:00Z' },
    { createdAt: '2026-10-20T10:00:00Z' },
    { createdAt: '' },
  ]
  assert.equal(countCreatedSince(rows, 7, NOW), 2)
  // fata de ultima cerere ar fi fost tot 2, dar fara cereri recente rezultatul trebuie sa fie 0
  assert.equal(countCreatedSince([{ createdAt: '2026-09-01T10:00:00Z' }], 7, NOW), 0)
})

test('primul contact: primul comentariu sau prima schimbare de etapa in afara de nou', () => {
  const createdAt = '2026-11-01T10:00:00Z'
  assert.equal(firstContactAt({
    createdAt,
    comments: [
      { type: 'meta', created_at: '2026-11-01T10:05:00Z' },
      { type: 'activity', meta: { event: 'stage_changed', stage: 'nou' }, created_at: '2026-11-01T11:00:00Z' },
      { type: 'activity', meta: { event: 'stage_changed', stage: 'contactat' }, created_at: '2026-11-01T14:00:00Z' },
      { type: 'comment', created_at: '2026-11-02T09:00:00Z' },
    ],
  }), '2026-11-01T14:00:00.000Z')
  assert.equal(firstContactAt({ createdAt, log: [{ event: 'crm_case_updated', meta: { stage: 'nou' }, created_at: '2026-11-02T00:00:00Z' }] }), null)
  assert.equal(firstContactAt({ createdAt, log: [{ event: 'crm_case_updated', meta: { stage: 'contactat' }, created_at: '2026-11-02T10:00:00Z' }] }), '2026-11-02T10:00:00.000Z')
  assert.equal(firstContactAt({ createdAt, comments: [{ type: 'activity', meta: { event: 'payment_email_sent' }, created_at: '2026-11-03T10:00:00Z' }] }), '2026-11-03T10:00:00.000Z')
})

test('mediana orelor pana la primul contact', () => {
  const stats = firstContactStats([
    { createdAt: '2026-11-01T10:00:00Z', firstContactAt: '2026-11-01T12:00:00Z' },
    { createdAt: '2026-11-01T10:00:00Z', firstContactAt: '2026-11-02T10:00:00Z' },
    { createdAt: '2026-11-01T10:00:00Z', firstContactAt: '2026-11-04T10:00:00Z' },
    { createdAt: '2026-11-01T10:00:00Z', firstContactAt: '' },
  ])
  assert.equal(stats.medianHours, 24)
  assert.equal(stats.contacted, 3)
  assert.equal(stats.uncontacted, 1)
  assert.equal(stats.within24h, 2)
  assert.equal(firstContactStats([]).medianHours, null)
})
