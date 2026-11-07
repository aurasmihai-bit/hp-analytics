import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REQUEST_SELECT_FALLBACKS,
  REQUEST_ATTRIBUTION_COLUMNS,
  buildRequestSelect,
  requestAttribution,
  requestFormVariantKey,
  homepageVariantKey,
  countRequestVariants,
  computeBuyerRequestConversion,
  requestsPerGa4Signup,
  canonicalRequestFormEvent,
  isRequestFormEventName,
  requestFormEventTotals,
} from '../app/lib/request-attribution.js'

// Coloanele care exista azi in buyer_requests (fara atribuire first-touch).
const CURRENT_COLUMNS = [
  'id', 'user_id', 'created_at', 'updated_at', 'status', 'transaction_type', 'property_type',
  'request_form_variant', 'request_form_path', 'homepage_variant', 'status_change_source', 'notes',
]

test('select-ul se construieste doar din coloanele existente', () => {
  const built = buildRequestSelect(CURRENT_COLUMNS)
  const columns = built.select.split(',')
  for (const column of ['id', 'created_at', 'request_form_variant', 'request_form_path', 'homepage_variant']) {
    assert.ok(columns.includes(column), `lipseste ${column}`)
  }
  for (const missing of ['landing_path', 'referrer', 'utm_source', 'metadata', 'page_path']) {
    assert.ok(!columns.includes(missing), `nu trebuie cerut ${missing}`)
  }
  assert.ok(!columns.includes('user_id'), 'user_id nu se cere decat explicit')
  assert.equal(built.attributionAvailable, false)
  assert.deepEqual(built.attributionColumns, [])
})

test('select-ul preia automat coloanele de atribuire cand apar', () => {
  const built = buildRequestSelect([...CURRENT_COLUMNS, ...REQUEST_ATTRIBUTION_COLUMNS])
  const columns = built.select.split(',')
  for (const column of REQUEST_ATTRIBUTION_COLUMNS) assert.ok(columns.includes(column))
  assert.equal(built.attributionAvailable, true)
  assert.equal(new Set(columns).size, columns.length, 'fara duplicate')
})

test('fiecare fallback (in afara de ultimele) pastreaza variantele formularului', () => {
  const withVariant = REQUEST_SELECT_FALLBACKS.filter(select => select.split(',').includes('request_form_variant'))
  assert.ok(withVariant.length >= REQUEST_SELECT_FALLBACKS.length - 1)
  assert.ok(REQUEST_SELECT_FALLBACKS[1].split(',').includes('homepage_variant'))
  assert.ok(REQUEST_SELECT_FALLBACKS.every(select => !select.includes('metadata')))
  assert.ok(REQUEST_SELECT_FALLBACKS.slice(1).every(select => !select.split(',').some(c => REQUEST_ATTRIBUTION_COLUMNS.includes(c))),
    'al doilea pas nu mai cere coloane de atribuire')
})

test('varianta formularului: V, VH, Istoric (gol)', () => {
  assert.equal(requestFormVariantKey({ request_form_variant: 'VH', request_form_path: '/new' }), 'VH')
  assert.equal(requestFormVariantKey({ request_form_variant: 'V', request_form_path: '/vreau' }), 'V')
  assert.equal(requestFormVariantKey({ request_form_variant: 'vh' }), 'VH')
  assert.equal(requestFormVariantKey({ request_form_variant: null, request_form_path: '/new?x=1' }), 'VH')
  assert.equal(requestFormVariantKey({ request_form_variant: '', request_form_path: '' }), 'Istoric')
  assert.equal(requestFormVariantKey({}), 'Istoric')

  const rows = [
    ...Array.from({ length: 12 }, () => ({ request_form_variant: 'VH', request_form_path: '/new', homepage_variant: 'simplu' })),
    ...Array.from({ length: 8 }, () => ({ request_form_variant: 'V', request_form_path: '/vreau', homepage_variant: 'control' })),
    { request_form_variant: null, homepage_variant: null },
  ]
  const counts = countRequestVariants(rows)
  assert.deepEqual(counts.form, { V: 8, VH: 12, Istoric: 1 })
  assert.deepEqual(counts.homepage, { control: 8, simplu: 12, variant_c: 0, necunoscut: 1 })
  assert.equal(homepageVariantKey({ homepage_variant: 'variant_c' }), 'variant_c')
})

test('atribuire: fara coloane -> "fara atribuire", cu coloane -> landing/referrer/utm', () => {
  const none = requestAttribution({ id: 1 }, false)
  assert.equal(none.attributed, false)
  assert.equal(none.source_medium, 'fara atribuire')

  const empty = requestAttribution({ landing_path: null, referrer: '' }, true)
  assert.equal(empty.attributed, false)

  const utm = requestAttribution({
    landing_path: 'https://homepitch.ro/vreau?utm_source=fb',
    referrer: 'https://l.facebook.com/',
    utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'lansare',
  }, true)
  assert.equal(utm.attributed, true)
  assert.equal(utm.landing_path, '/vreau')
  assert.equal(utm.source_medium, 'facebook / paid_social')
  assert.equal(utm.utm_campaign, 'lansare')

  const ref = requestAttribution({ landing_path: '/new', referrer: 'https://www.google.com/' }, true)
  assert.equal(ref.source_medium, 'google.com / referral')

  const gclid = requestAttribution({ landing_path: '/new', gclid: 'abc' }, true)
  assert.equal(gclid.source_medium, 'google / cpc (gclid)')

  const direct = requestAttribution({ landing_path: '/' }, true)
  assert.equal(direct.referrer_full, '(direct)')
  assert.equal(direct.source_medium, '(direct) / (none)')
})

test('rata cumparator -> cerere foloseste useri distincti si nu depaseste 100%', () => {
  const buyers = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }, { user_id: 'd' }, { user_id: 'a' }]
  // 20 de cereri: multe de la acelasi user si de la useri inregistrati inainte de perioada
  const requests = [
    ...Array.from({ length: 10 }, () => ({ user_id: 'a' })),
    ...Array.from({ length: 5 }, () => ({ user_id: 'b' })),
    ...Array.from({ length: 5 }, () => ({ user_id: 'vechi' })),
  ]
  const result = computeBuyerRequestConversion(buyers, requests)
  assert.equal(result.buyersRegistered, 4)
  assert.equal(result.buyersWithRequest, 2)
  assert.equal(result.requestersTotal, 3)
  assert.equal(result.rate, 50)

  const all = computeBuyerRequestConversion([{ user_id: 'x' }], [{ user_id: 'x' }, { user_id: 'x' }])
  assert.equal(all.rate, 100)

  assert.equal(computeBuyerRequestConversion([], requests).rate, null)
  assert.equal(computeBuyerRequestConversion([{ user_id: null }], []).buyersRegistered, 0)
})

test('fallback GA4: cereri / inregistrare ca raport, nu procent', () => {
  assert.equal(requestsPerGa4Signup(20, 11).toFixed(1), '1.8')
  assert.equal(requestsPerGa4Signup(5, 0), null)
  assert.equal(requestsPerGa4Signup(0, 4), 0)
})

test('evenimentele formularului: Title Case si snake_case', () => {
  assert.equal(canonicalRequestFormEvent('form_step_completed'), 'form_step_completed')
  assert.equal(canonicalRequestFormEvent('Form Step Completed'), 'form_step_completed')
  assert.equal(canonicalRequestFormEvent('FORM_ABANDONED'), 'form_abandoned')
  assert.equal(canonicalRequestFormEvent('Request Created'), 'request_created')
  assert.equal(canonicalRequestFormEvent('page_view'), null)
  assert.ok(isRequestFormEventName('form_validation_error'))
  assert.ok(isRequestFormEventName('[Amplitude] Form Started'))
  assert.ok(!isRequestFormEventName('bravo_cerere_noua'))

  const totals = requestFormEventTotals([
    { event_name: 'Form Step Completed', event_count: 3 },
    { event_name: 'form_step_completed', event_count: 7 },
    { event_name: 'request_created', event_count: 2 },
    { event_name: 'form_abandoned', event_count: '4' },
    { event_name: 'page_view', event_count: 100 },
  ])
  assert.equal(totals.form_step_completed, 10)
  assert.equal(totals.request_created, 2)
  assert.equal(totals.form_abandoned, 4)
  assert.equal(totals.form_validation_error, 0)
})

// ── buyer_request_attribution (tabel privat, embed PostgREST 1:1) ──────────
import {
  ATTRIBUTION_EMBED_TABLE,
  attributionEmbedSelect,
  withAttributionEmbed,
  flattenRequestAttribution,
  fetchWithAttributionEmbed,
} from '../app/lib/request-attribution.js'

test('embed-ul cere cele 9 coloane din buyer_request_attribution', () => {
  assert.equal(ATTRIBUTION_EMBED_TABLE, 'buyer_request_attribution')
  assert.equal(attributionEmbedSelect(), 'buyer_request_attribution(landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,gclid,fbclid)')
  assert.equal(withAttributionEmbed('id,created_at'), `id,created_at,${attributionEmbedSelect()}`)
})

test('flatten: obiectul embed ajunge pe rand, null ramane fara atribuire', () => {
  const flat = flattenRequestAttribution({
    id: 'r1', request_form_variant: 'VH',
    buyer_request_attribution: { landing_path: '/new?utm_source=x', referrer: 'https://www.google.com/', utm_source: 'google', utm_medium: 'cpc', utm_campaign: null, utm_content: null, utm_term: null, gclid: 'g1', fbclid: null },
  })
  assert.equal(flat.buyer_request_attribution, undefined)
  assert.equal(flat.landing_path, '/new?utm_source=x')
  assert.equal(flat.utm_source, 'google')
  assert.equal(flat.request_form_variant, 'VH')
  const attributed = requestAttribution(flat, true)
  assert.equal(attributed.attributed, true)
  assert.equal(attributed.landing_path, '/new')
  assert.equal(attributed.source_medium, 'google / cpc')

  const none = flattenRequestAttribution({ id: 'r2', buyer_request_attribution: null })
  assert.equal(none.buyer_request_attribution, undefined)
  assert.equal(none.landing_path, undefined)
  assert.equal(requestAttribution(none, true).source_medium, 'fara atribuire')

  // forma lista (daca PostgREST nu detecteaza 1:1) si randuri fara embed
  assert.equal(flattenRequestAttribution({ buyer_request_attribution: [{ referrer: 'https://a.ro/' }] }).referrer, 'https://a.ro/')
  assert.equal(flattenRequestAttribution({ buyer_request_attribution: [] }).referrer, undefined)
  const plain = { id: 'r3', landing_path: '/vreau' }
  assert.deepEqual(flattenRequestAttribution(plain), plain)
  // coloanele inline existente nu sunt suprascrise
  assert.equal(flattenRequestAttribution({ landing_path: '/inline', buyer_request_attribution: { landing_path: '/embed' } }).landing_path, '/inline')
})

test('fallback: embed indisponibil -> acelasi select fara embed, fara eroare', async () => {
  const calls = []
  const run = async select => {
    calls.push(select)
    if (select.includes(ATTRIBUTION_EMBED_TABLE)) throw new Error("Platform Supabase 400: PGRST200 Could not find a relationship between 'buyer_requests' and 'buyer_request_attribution'")
    return [{ id: 'r1', request_form_variant: 'V' }]
  }
  const result = await fetchWithAttributionEmbed(['id,created_at,request_form_variant'], run, { isRetryable: () => true })
  assert.equal(result.embedUsed, false)
  assert.equal(result.embedAvailable, false)
  assert.equal(result.select, 'id,created_at,request_form_variant')
  assert.equal(result.rows.length, 1)
  assert.deepEqual(calls, [withAttributionEmbed('id,created_at,request_form_variant'), 'id,created_at,request_form_variant'])

  // cache negativ: embed-ul nu mai este incercat
  calls.length = 0
  await fetchWithAttributionEmbed(['id,created_at'], run, { embedAvailable: false })
  assert.deepEqual(calls, ['id,created_at'])

  // cheie anon fara drepturi (42501) -> tot fallback
  const denied = await fetchWithAttributionEmbed(['id'], async select => {
    if (select.includes(ATTRIBUTION_EMBED_TABLE)) throw new Error('Platform Supabase 401: 42501 permission denied for table buyer_request_attribution')
    return []
  })
  assert.equal(denied.embedUsed, false)
  assert.equal(denied.embedAvailable, false)
})

test('embed disponibil: randurile sunt aplatizate; coloana lipsa -> urmatorul select', async () => {
  const calls = []
  const run = async select => {
    calls.push(select)
    if (select.startsWith('id,created_at,landing_path')) throw new Error('Platform Supabase 400: 42703 column buyer_requests.landing_path does not exist')
    return [
      { id: 'a', buyer_request_attribution: { landing_path: '/new', referrer: '', utm_source: 'newsletter', utm_medium: 'email' } },
      { id: 'b', buyer_request_attribution: null },
    ]
  }
  const result = await fetchWithAttributionEmbed(['id,created_at,landing_path', 'id,created_at'], run, { isRetryable: e => /42703/.test(e.message) })
  assert.equal(result.embedUsed, true)
  assert.equal(result.embedAvailable, true)
  assert.equal(result.select, 'id,created_at')
  assert.equal(result.rows[0].utm_source, 'newsletter')
  assert.equal(result.rows[0].buyer_request_attribution, undefined)
  const counts = result.rows.map(row => requestAttribution(row, result.embedUsed).attributed)
  assert.deepEqual(counts, [true, false])
})

test('fallback: erorile care nu tin de coloane sunt aruncate', async () => {
  await assert.rejects(
    fetchWithAttributionEmbed(['id'], async () => { throw new Error('Platform Supabase 500: boom') }),
    /500/
  )
})
