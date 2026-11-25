import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'

const productUrl = 'https://www.leroymerlin.es/productos/pack-wc-oxy-con-tapa-amortiguada-3-6-l-92452542.html'

for (const configured of [false, true]) test(`import API: blocked store with provider ${configured ? 'configured' : 'disabled'}`, { timeout: 40000 }, async () => {
  // Local network fixtures: no external service, account or credits are used.
  const preload = `
    import dns from 'node:dns/promises'
    dns.lookup = async () => [{ address: '1.1.1.1', family: 4 }]
    globalThis.fetch = async (value, options = {}) => {
      const url = new URL(value)
      if (url.pathname === '/auth/v1/user') return Response.json({ id: 'user-fixture' })
      if (url.hostname === 'www.leroymerlin.es') return new Response('<p id="cmsg">Please enable JS</p><script src="https://ct.captcha-delivery.com/c.js"></script>', { status: 403, headers: { 'content-type': 'text/html' } })
      if (url.hostname === 'api.zenrows.com') {
        if (options.headers?.Authorization || options.headers?.Cookie) throw new Error('Application credentials forwarded to scraper')
        if (url.searchParams.get('apikey') !== 'synthetic-key') throw new Error('Unexpected provider key')
        const scenario = new URL(url.searchParams.get('url')).searchParams.get('fixture')
        if (scenario === 'network') throw Object.assign(new Error('synthetic-key must never reach the logs'), { cause: { code: 'ECONNRESET' } })
        if (scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 500))
        return new Response('<h1>Pack WC Oxy con tapa amortiguada 3/6 L</h1><script type="application/ld+json">{"@type":"Product","name":"Pack WC Oxy con tapa amortiguada 3/6 L","brand":{"name":"ARTECRISTAL"},"offers":{"price":145,"priceCurrency":"EUR"}}</script>', { headers: { 'content-type': 'text/plain' } })
      }
      throw new Error('Unexpected URL in network fixture')
    }
  `
  const reservation = http.createServer()
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, ['--import', `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`, 'server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), SUPABASE_URL: 'https://session.example', SUPABASE_ANON_KEY: 'synthetic-anon', ZENROWS_API_KEY: configured ? 'synthetic-key' : '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.on('data', chunk => { logs += chunk })
  child.stderr.on('data', chunk => { logs += chunk })
  try {
    const base = `http://127.0.0.1:${port}`
    let health
    for (let i = 0; i < 300; i++) {
      try { health = await (await fetch(`${base}/api/health`)).json() } catch {}
      if (health || child.exitCode !== null) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(health, logs)
    assert.equal(health.features.product_import, 5)
    assert.equal(health.product_import.diagnostics, 2)
    assert.equal(health.product_import.async, 1)
    assert.equal(health.product_import.fallback_configured, configured)
    assert.equal((await fetch(`${base}/api/import-product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: productUrl }) })).status, 401)
    const response = await fetch(`${base}/api/import-product`, {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json', 'x-request-id': 'import-fixture-id' },
      body: JSON.stringify({ url: productUrl }),
    })
    const data = await response.json()
    assert.equal(response.status, configured ? 200 : 422, JSON.stringify(data))
    if (configured) {
      assert.equal(data.name, 'Pack WC Oxy con tapa amortiguada 3/6 L')
      assert.equal(data.price, 145)
      assert.equal(data.brand, 'ARTECRISTAL')
      assert.equal(data.productUrl, productUrl)
      assert.equal(data.storeName, 'leroymerlin.es')
    } else {
      assert.equal(data.code, 'STORE_ACCESS_DENIED')
      assert.equal(data.request_id, 'import-fixture-id')
      assert.equal(data.diagnostic.protection, 'DataDome')
      assert.equal(data.diagnostic.fallback_configured, false)
    }
    assert.doesNotMatch(JSON.stringify(data) + logs + JSON.stringify(health), /synthetic-key|synthetic-session|apikey=/)

    for (const scenario of configured ? ['slow', 'network'] : ['blocked']) {
      const headers = { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json', 'x-request-id': `async-${scenario}-request` }
      const start = await fetch(`${base}/api/import-product`, { method: 'POST', headers, body: JSON.stringify({ url: `${productUrl}?fixture=${scenario}`, async: true }) })
      assert.equal(start.status, 202)
      const job = await start.json()
      assert.equal(job.diagnostic.importer_version, 5)
      const endpoint = `${base}/api/import-product/${job.job_id}`
      assert.equal((await fetch(endpoint)).status, 404, 'a job requires its private polling token')
      assert.equal((await fetch(endpoint, { headers: { 'x-product-import-token': 'wrong-token' } })).status, 404)
      if (scenario === 'slow') {
        const pending = await fetch(endpoint, { headers: { 'x-product-import-token': job.poll_token } })
        assert.equal(pending.status, 202, 'the API returns while the scraper is still waiting')
        const duplicate = await fetch(`${base}/api/import-product`, { method: 'POST', headers, body: JSON.stringify({ url: productUrl, async: true }) })
        assert.equal(duplicate.status, 429, 'a repeated click must not start another paid import')
      }
      let result, status
      for (let i = 0; i < 100; i++) {
        const poll = await fetch(endpoint, { headers: { 'x-product-import-token': job.poll_token } })
        assert.equal(poll.headers.get('cache-control'), 'no-store')
        status = poll.status; result = await poll.json()
        if (status !== 202) break
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.equal(result.request_id, `async-${scenario}-request`)
      assert.equal(result.diagnostic.request_id, result.request_id)
      assert.ok(result.diagnostic.events.length > 0)
      if (scenario === 'slow') {
        assert.equal(status, 200)
        assert.equal(result.product.price, 145)
        assert.ok(result.diagnostic.events.some(event => event.transport === 'zenrows' && event.upstreamStatus === 200 && event.contentType === 'text/plain'))
        assert.ok(result.diagnostic.events.some(event => event.hasProduct && event.hasPrice))
      } else if (scenario === 'network') {
        assert.equal(status, 200, 'a known job failure must not trigger proxy gateway-error pages')
        assert.equal(result.status, 'error')
        assert.equal(result.http_status, 502)
        assert.equal(result.code, 'PRODUCT_SCRAPER_NETWORK')
        assert.equal(result.diagnostic.network_code, 'ECONNRESET')
        assert.equal(result.diagnostic.phase, 'request')
      } else {
        assert.equal(status, 200)
        assert.equal(result.status, 'error')
        assert.equal(result.http_status, 422)
        assert.equal(result.code, 'STORE_ACCESS_DENIED')
      }
      assert.doesNotMatch(JSON.stringify(result) + logs, /synthetic-key|synthetic-session|apikey=/)
    }
  } finally {
    child.kill()
    if (child.exitCode === null) await once(child, 'exit')
  }
})
