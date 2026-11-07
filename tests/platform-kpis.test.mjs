import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requestsPer1000Sessions,
  draftFunnel,
  firstOfferStats,
  vipSubscriptionSummary,
  notificationAttemptSummary,
} from '../app/lib/platform-kpis.js'

test('cereri la 1.000 de sesiuni', () => {
  assert.equal(requestsPer1000Sessions(21, 7000), 3)
  assert.equal(requestsPer1000Sessions(5, 0), null)
})

test('drafturi → cereri', () => {
  assert.deepEqual(draftFunnel(40, 10), { drafts: 40, requests: 10, requestsPerDraft: 0.25 })
  assert.equal(draftFunnel(0, 3).requestsPerDraft, null)
})

test('timp pana la prima oferta si % cereri cu oferta in 48 h', () => {
  const now = Date.parse('2026-11-07T12:00:00Z')
  const requests = [
    { id: 'a', created_at: '2026-11-01T00:00:00Z' }, // oferta dupa 10 h
    { id: 'b', created_at: '2026-11-01T00:00:00Z' }, // oferta dupa 72 h
    { id: 'c', created_at: '2026-11-02T00:00:00Z' }, // fara oferta
    { id: 'd', created_at: '2026-11-07T00:00:00Z' }, // prea noua pentru 48 h, oferta dupa 2 h
  ]
  const offers = [
    { request_id: 'a', created_at: '2026-11-01T20:00:00Z' },
    { request_id: 'a', created_at: '2026-11-01T10:00:00Z' }, // prima oferta
    { request_id: 'b', created_at: '2026-11-04T00:00:00Z' },
    { request_id: 'd', created_at: '2026-11-07T02:00:00Z' },
    { request_id: 'x', created_at: '2026-11-03T00:00:00Z' },
  ]
  const stats = firstOfferStats(requests, offers, { now })
  assert.equal(stats.withOffer, 3)
  assert.equal(stats.withoutOffer, 1)
  assert.equal(stats.medianHoursToFirstOffer, 10)
  assert.equal(stats.eligibleFor48h, 3)
  assert.equal(stats.within48h, 1)
  assert.ok(Math.abs(stats.within48hRate - 100 / 3) < 1e-9)
})

test('abonati VIP activi, fara MRR', () => {
  const rows = [
    { status: 'active', created_at: '2026-10-20T10:00:00Z' },
    { status: 'trialing', created_at: '2026-09-01T10:00:00Z' },
    { status: 'canceled', created_at: '2026-10-25T10:00:00Z' },
  ]
  const summary = vipSubscriptionSummary(rows, { start: '2026-10-08', end: '2026-11-06' })
  assert.equal(summary.active, 2)
  assert.equal(summary.total, 3)
  assert.equal(summary.newInPeriod, 2)
  assert.equal(summary.mrr, null)
  // fara coloana status nu ghicim care sunt active
  assert.equal(vipSubscriptionSummary([{ created_at: '2026-10-20' }]).active, null)
})

test('incercari de notificare esuate', () => {
  const summary = notificationAttemptSummary([
    { status: 'sent', created_at: '2026-11-06T10:00:00Z' },
    { status: 'failed', created_at: '2026-11-06T11:00:00Z' },
    { status: 'bounced', created_at: '2026-11-05T11:00:00Z' },
    { status: 'sent', created_at: '2026-11-04T11:00:00Z' },
  ])
  assert.equal(summary.attempts, 4)
  assert.equal(summary.failed, 2)
  assert.equal(summary.failureRate, 50)
  assert.equal(summary.lastAttemptAt, '2026-11-06T11:00:00.000Z')
  assert.equal(notificationAttemptSummary([{ created_at: '2026-11-06T10:00:00Z' }]).failed, null)
})

test('vip: activ din is_active + expires_at (coloanele reale)', () => {
  const now = new Date('2026-11-07T08:00:00Z')
  const s = vipSubscriptionSummary([
    { is_active: true, expires_at: '2026-12-01T00:00:00Z', created_at: '2026-11-01T10:00:00Z' },
    { is_active: true, expires_at: '2026-11-01T00:00:00Z', created_at: '2026-10-01T10:00:00Z' },
    { is_active: false, expires_at: null, created_at: '2026-09-01T10:00:00Z' },
    { is_active: true, expires_at: null, created_at: '2026-08-01T10:00:00Z' },
  ], { start: '2026-10-08', end: '2026-11-06', now })
  assert.equal(s.active, 2)
  assert.equal(s.newInPeriod, 1)
  assert.equal(s.statusAvailable, true)
})

test('notificari: outcome / error_code / attempted_at', () => {
  const s = notificationAttemptSummary([
    { outcome: 'sent', error_code: null, attempted_at: '2026-11-06T10:00:00Z' },
    { outcome: 'failed', error_code: null, attempted_at: '2026-11-06T11:00:00Z' },
    { outcome: 'sent', error_code: 'rate_limited', attempted_at: '2026-11-06T12:00:00Z' },
  ])
  assert.equal(s.attempts, 3)
  assert.equal(s.failed, 2)
  assert.equal(s.lastAttemptAt, '2026-11-06T12:00:00.000Z')
})
