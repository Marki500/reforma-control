import test from 'node:test'
import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import { createProductFetcher } from '../server/productFetch.js'
import { extractProductPrice } from '../server/productPrice.js'
import { load } from 'cheerio'

const url = 'https://www.leroymerlin.es/productos/pack-wc-oxy-con-tapa-amortiguada-3-6-l-92452542.html'
const product = '<h1>Pack WC Oxy con tapa amortiguada 3/6 L</h1><script type="application/ld+json">{"@type":"Product","name":"Pack WC Oxy","offers":{"price":145,"priceCurrency":"EUR"}}</script>'
const challenge = '<title>leroymerlin.es</title><p id="cmsg">Please enable JS and disable any ad blocker</p><script src="https://ct.captcha-delivery.com/c.js"></script>'

function network(t, handler) {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  return t.mock.method(globalThis, 'fetch', handler)
}
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html' } })

test('a readable direct product does not call the configured provider', async t => {
  const fetch = network(t, async target => { assert.equal(target.href, url); return html(product) })
  const result = await createProductFetcher({ apiKey: 'synthetic-key' })(url)
  assert.equal(extractProductPrice(load(result.body), 'leroymerlin.es'), 145)
  assert.equal(fetch.mock.callCount(), 1)
})

test('blocked Leroy HTML automatically retries once through the configured provider', async t => {
  const diagnostics = []
  const fetch = network(t, async (target, options) => {
    if (target.hostname !== 'api.zenrows.com') return html(challenge, 403)
    assert.equal(target.protocol, 'https:')
    assert.equal(target.searchParams.get('url'), url)
    assert.equal(target.searchParams.get('apikey'), 'synthetic-key')
    assert.equal(target.searchParams.get('mode'), 'auto')
    assert.equal(target.searchParams.get('proxy_country'), 'es')
    assert.equal(options.redirect, 'manual')
    assert.equal(options.headers.Authorization, undefined)
    assert.equal(options.headers.Cookie, undefined)
    return html(product)
  })
  const result = await createProductFetcher({ apiKey: 'synthetic-key' })(url, { onDiagnostic: value => diagnostics.push(value) })
  assert.equal(fetch.mock.callCount(), 2)
  assert.equal(result.finalUrl, url)
  assert.equal(result.transport, 'zenrows')
  assert.equal(extractProductPrice(load(result.body), 'leroymerlin.es'), 145)
  assert.doesNotMatch(JSON.stringify(diagnostics), /synthetic-key|apikey|captcha-delivery/)
})

test('no provider request occurs without a key, including a challenge delivered with HTTP 200', async t => {
  let status = 403
  const fetch = network(t, async () => html(challenge, status))
  const importer = createProductFetcher()
  await assert.rejects(importer(url), error => error.diagnostic.protection === 'DataDome')
  status = 200
  await assert.rejects(importer(url), error => error.code === 'STORE_ACCESS_DENIED')
  assert.equal(fetch.mock.callCount(), 2)
})

test('a JavaScript shell or a challenge with HTTP 200 triggers the browser provider', async t => {
  let directBody = '<div id="app"></div><script src="/bundle.js"></script>'
  network(t, async target => html(target.hostname === 'api.zenrows.com' ? product : directBody))
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  assert.equal((await importer(url)).transport, 'zenrows')
  directBody = challenge
  assert.equal((await importer(url)).transport, 'zenrows')
})

test('a provider challenge or an unrelated page is never imported as a product', async t => {
  let body = challenge
  network(t, async target => html(target.hostname === 'api.zenrows.com' ? body : challenge, target.hostname === 'api.zenrows.com' ? 200 : 403))
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  await assert.rejects(importer(url), error => error.code === 'STORE_ACCESS_DENIED' && error.diagnostic.transport === 'zenrows')
  body = '<title>Login</title><h1>Inicia sesión</h1>'
  await assert.rejects(importer(url), error => error.code === 'PRODUCT_PAGE_INCOMPLETE')
})

test('real product pages with anti-bot scripts are accepted', async t => {
  const fetch = network(t, async () => html(product + challenge))
  assert.ok(await createProductFetcher({ apiKey: 'synthetic-key' })(url))
  assert.equal(fetch.mock.callCount(), 1)
})

test('private destinations, credentials, 404s and non-HTML files cannot trigger the provider', async t => {
  let response = () => html('Not found', 404)
  const fetch = network(t, async () => response())
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  await assert.rejects(importer('http://127.0.0.1/secret'), /red interna/)
  await assert.rejects(importer('https://user:secret@example.com/'), /credenciales/)
  assert.equal(fetch.mock.callCount(), 0)
  await assert.rejects(importer(url), /404/)
  response = () => new Response('{}', { headers: { 'content-type': 'application/json' } })
  await assert.rejects(importer(url), error => error.status === 415)
  assert.equal(fetch.mock.callCount(), 2)
})

test('a private redirect is rejected without passing the URL to the provider', async t => {
  const fetch = network(t, async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }))
  await assert.rejects(createProductFetcher({ apiKey: 'synthetic-key' })(url), /red interna/)
  assert.equal(fetch.mock.callCount(), 1)
})

test('rate-limited and temporarily unavailable stores use the same bounded fallback', async t => {
  let status = 429
  const fetch = network(t, async target => target.hostname === 'api.zenrows.com' ? html(product) : html('Unavailable', status))
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  assert.equal((await importer(url)).transport, 'zenrows')
  status = 503
  assert.equal((await importer(url)).transport, 'zenrows')
  assert.equal(fetch.mock.callCount(), 4)
})

test('provider errors are bounded and credentials never enter the public error', async t => {
  let providerStatus = 401
  const fetch = network(t, async target => target.hostname === 'api.zenrows.com'
    ? new Response('synthetic-key private provider body', { status: providerStatus }) : html(challenge, 403))
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  for (const [status, code] of [[401, 'PRODUCT_SCRAPER_AUTH_FAILED'], [403, 'PRODUCT_SCRAPER_AUTH_FAILED'], [402, 'PRODUCT_SCRAPER_LIMIT'], [429, 'PRODUCT_SCRAPER_LIMIT'], [500, 'PRODUCT_SCRAPER_FAILED']]) {
    providerStatus = status
    await assert.rejects(importer(url), error => {
      assert.equal(error.code, code)
      assert.doesNotMatch(error.message + JSON.stringify(error.diagnostic), /synthetic-key|apikey|private provider body/)
      return true
    })
  }
  assert.equal(fetch.mock.callCount(), 10, 'one direct request plus at most one provider call per import')
})

test('provider redirects cannot forward the API key to another host', async t => {
  const fetch = network(t, async target => target.hostname === 'api.zenrows.com'
    ? new Response(null, { status: 302, headers: { location: 'https://unrelated.example/' } }) : html(challenge, 403))
  await assert.rejects(createProductFetcher({ apiKey: 'synthetic-key' })(url), error => error.code === 'PRODUCT_SCRAPER_FAILED')
  assert.equal(fetch.mock.callCount(), 2)
})

test('only two provider requests may run simultaneously and the slots are released', async t => {
  const pending = []
  network(t, async target => {
    if (target.hostname !== 'api.zenrows.com') return html(challenge, 403)
    return new Promise(resolve => pending.push(() => resolve(html(product))))
  })
  const importer = createProductFetcher({ apiKey: 'synthetic-key' })
  const first = importer(url), second = importer(url)
  while (pending.length < 2) await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(importer(url), error => error.code === 'PRODUCT_IMPORT_BUSY')
  pending.splice(0).forEach(resolve => resolve())
  await Promise.all([first, second])
  const next = importer(url)
  while (!pending.length) await new Promise(resolve => setImmediate(resolve))
  pending.shift()()
  assert.equal((await next).transport, 'zenrows')
})
