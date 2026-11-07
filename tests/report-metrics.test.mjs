import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDaysIso,
  bucharestDate,
  bucharestDayStartUtc,
  bucharestDayEndUtc,
  completedDaysRange,
  weekBounds,
  previousWeekStart,
  tabDayCompleteness,
  selectTabDayRefreshDates,
  gscTotals,
  buildPreviousMap,
  keyEventsPer100,
  isNewFormPath,
  activeFormViews,
  isInternalReferrer,
  activeUsersLabel,
  fetchAllPages,
} from '../app/lib/report-metrics.js'

test('ziua calendaristica e in ora Romaniei', () => {
  // 23:30 UTC pe 6 nov = 01:30 pe 7 nov la Bucuresti (iarna, UTC+2)
  assert.equal(bucharestDate('2026-11-06T23:30:00Z'), '2026-11-07')
  // vara (UTC+3): 21:30 UTC = 00:30 ziua urmatoare
  assert.equal(bucharestDate('2026-07-01T21:30:00Z'), '2026-07-02')
  assert.equal(bucharestDate('nu e data'), null)
})

test('limitele zilei in UTC tin cont de ora de vara', () => {
  assert.equal(bucharestDayStartUtc('2026-11-07'), '2026-11-06T22:00:00.000Z')
  assert.equal(bucharestDayStartUtc('2026-07-01'), '2026-06-30T21:00:00.000Z')
  assert.equal(bucharestDayEndUtc('2026-11-07'), '2026-11-07T21:59:59.999Z')
  // ziua schimbarii orei (25 oct 2026, 25 de ore)
  assert.equal(bucharestDayStartUtc('2026-10-25'), '2026-10-24T21:00:00.000Z')
  assert.equal(bucharestDayEndUtc('2026-10-25'), '2026-10-25T21:59:59.999Z')
})

test('perioadele au aceeasi lungime si nu includ ziua de azi', () => {
  const now = new Date('2026-11-07T10:00:00Z')
  const range = completedDaysRange(30, now)
  assert.deepEqual(range, { currFrom: '2026-10-08', currTo: '2026-11-06', prevFrom: '2026-09-08', prevTo: '2026-10-07' })
  const len = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5 + 1
  assert.equal(len(range.currFrom, range.currTo), 30)
  assert.equal(len(range.prevFrom, range.prevTo), 30)
  assert.equal(addDaysIso(range.prevTo, 1), range.currFrom)
  // la 23:30 UTC e deja ziua urmatoare in Romania
  assert.equal(completedDaysRange(7, new Date('2026-11-07T23:30:00Z')).currTo, '2026-11-07')
  assert.deepEqual(completedDaysRange(1, now), { currFrom: '2026-11-06', currTo: '2026-11-06', prevFrom: '2026-11-05', prevTo: '2026-11-05' })
})

test('saptamana luni–duminica si saptamana anterioara', () => {
  // luni 9 nov 2026, 07:00 UTC (cron-ul raportului saptamanal)
  assert.deepEqual(weekBounds(1, new Date('2026-11-09T07:00:00Z')), { start: '2026-11-02', end: '2026-11-08' })
  // duminica seara tarziu UTC = deja luni in Romania
  assert.deepEqual(weekBounds(0, new Date('2026-11-08T22:30:00Z')), { start: '2026-11-09', end: '2026-11-15' })
  assert.equal(previousWeekStart('2026-11-02'), '2026-10-26')
})

test('o zi e completa doar daca a fost salvata dupa ce s-au asezat datele', () => {
  assert.deepEqual(tabDayCompleteness('2026-11-06', '2026-11-07T05:00:00Z'), { ga4Complete: false, gscComplete: false })
  assert.deepEqual(tabDayCompleteness('2026-11-03', '2026-11-06T05:00:00Z'), { ga4Complete: true, gscComplete: false })
  assert.deepEqual(tabDayCompleteness('2026-11-02', '2026-11-06T05:00:00Z'), { ga4Complete: true, gscComplete: true })
  // ziua de azi salvata partial nu e completa
  assert.deepEqual(tabDayCompleteness('2026-11-07', '2026-11-07T20:00:00Z'), { ga4Complete: false, gscComplete: false })
})

test('se recitesc ultimele zile incomplete, cu limita de varsta si buget', () => {
  const now = new Date('2026-11-07T12:00:00Z')
  const rows = [
    { data_date: '2026-11-06', synced_at: '2026-11-07T01:00:00Z' }, // recenta, veche de 11 h
    { data_date: '2026-11-05', synced_at: '2026-11-07T10:00:00Z' }, // recenta, abia salvata
    { data_date: '2026-11-03', synced_at: '2026-11-04T06:00:00Z' }, // GSC incomplet
    { data_date: '2026-11-01', synced_at: '2026-11-06T06:00:00Z' }, // completa
    { data_date: '2026-10-01', synced_at: '2026-10-01T06:00:00Z' }, // salvata partial in ziua ei
    { data_date: '2026-09-01', synced_at: '2026-10-01T06:00:00Z', sources: { gsc: 'error' } },
    { data_date: '2026-08-01', synced_at: '2026-10-01T06:00:00Z', sources: { gsc: 'none', ga4Complete: true, gscComplete: true } },
  ]
  assert.deepEqual(selectTabDayRefreshDates(rows, { now }), ['2026-09-01', '2026-10-01', '2026-11-03', '2026-11-06'])
  // refresh=1 (sync): si zilele abia salvate
  assert.deepEqual(selectTabDayRefreshDates(rows, { now, force: true }), ['2026-09-01', '2026-10-01', '2026-11-03', '2026-11-05', '2026-11-06'])
  // bugetul limiteaza doar zilele vechi, nu fereastra recenta
  assert.deepEqual(selectTabDayRefreshDates(rows, { now, maxDays: 0 }), ['2026-11-03', '2026-11-06'])
})

test('CTR GSC = clickuri / impresii si pozitia e ponderata cu impresiile', () => {
  const rows = [
    { organic_google_search_clicks: 1, organic_google_search_impressions: 10, organic_google_search_click_through_rate: 0.1, organic_google_search_average_position: 2 },
    { organic_google_search_clicks: 9, organic_google_search_impressions: 990, organic_google_search_click_through_rate: 0.009, organic_google_search_average_position: 20 },
  ]
  const totals = gscTotals(rows)
  assert.equal(totals.clicks, 10)
  assert.equal(totals.impressions, 1000)
  assert.equal(totals.ctr, 0.01) // media simpla ar fi dat 5,45%
  assert.ok(Math.abs(totals.position - 19.82) < 1e-9) // media simpla ar fi dat 11
  assert.deepEqual(gscTotals([]), { clicks: 0, impressions: 0, ctr: null, position: null })
})

test('delta pe pagini compara direct cu perioada anterioara', () => {
  const prev = [{ page_path: '/a', screen_page_views: 80 }, { page_path: '/b', screen_page_views: 10 }]
  const map = buildPreviousMap(prev)
  assert.equal(map['/a'].screen_page_views, 80) // nu 80 − valoarea curenta
  assert.equal(map['/b'].screen_page_views, 10)
  // randurile duplicate se aduna
  assert.equal(buildPreviousMap([...prev, { page_path: '/a', screen_page_views: 5 }])['/a'].screen_page_views, 85)
})

test('evenimente-cheie la 100 views', () => {
  assert.equal(keyEventsPer100(3, 60), 5)
  assert.equal(keyEventsPer100(5, 0), 0)
})

test('formularele active includ /vreau si /new, fara /newsletter', () => {
  assert.equal(isNewFormPath('/new'), true)
  assert.equal(isNewFormPath('/new/'), true)
  assert.equal(isNewFormPath('/new?step=2'), true)
  assert.equal(isNewFormPath('/newsletter'), false)
  const pages = [
    { page_path: '/vreau', screen_page_views: 8 },
    { page_path: '/new', screen_page_views: 13 },
    { page_path: '/newsletter', screen_page_views: 100 },
    { page_path: '/cereri', screen_page_views: 50 },
  ]
  assert.equal(activeFormViews(pages), 21)
})

test('referrer-ele interne homepitch.ro sunt recunoscute', () => {
  assert.equal(isInternalReferrer('https://homepitch.ro/cereri'), true)
  assert.equal(isInternalReferrer('https://www.homepitch.ro/'), true)
  assert.equal(isInternalReferrer('www.homepitch.ro/vreau'), true)
  assert.equal(isInternalReferrer('https://google.com/'), false)
  assert.equal(isInternalReferrer('https://homepitch.ro.evil.com/'), false)
  assert.equal(isInternalReferrer('(direct)'), false)
  assert.equal(isInternalReferrer(''), false)
})

test('eticheta userilor spune cand e suma zilnica', () => {
  assert.match(activeUsersLabel('daily_sum'), /sumă zilnică/)
  assert.equal(activeUsersLabel('period'), 'Useri activi')
})

test('paginarea citeste toate paginile', async () => {
  const all = Array.from({ length: 2500 }, (_, i) => ({ id: i }))
  const calls = []
  const result = await fetchAllPages(({ offset, limit }) => { calls.push(offset); return all.slice(offset, offset + limit) })
  assert.equal(result.rows.length, 2500)
  assert.equal(result.truncated, false)
  assert.deepEqual(calls, [0, 1000, 2000])
})

test('paginarea se opreste daca serverul ignora offset-ul', async () => {
  const page = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
  const result = await fetchAllPages(() => page)
  assert.equal(result.rows.length, 1000)
  assert.equal(result.truncated, true)
})

test('paginarea marcheaza trunchierea la maxRows', async () => {
  const result = await fetchAllPages(({ offset, limit }) => Array.from({ length: limit }, (_, i) => ({ id: offset + i })), { maxRows: 2000 })
  assert.equal(result.rows.length, 2000)
  assert.equal(result.truncated, true)
})
