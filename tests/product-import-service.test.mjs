import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function importerFixture(t, { start, polls }) {
  const calls = []
  globalThis.__productImportFixture = {
    async start(...args) { calls.push({ method: 'POST', args }); return start },
    async poll(...args) {
      calls.push({ method: 'GET', args })
      const result = polls.shift()
      if (result instanceof Error) throw result
      assert.ok(result, 'the client must stop polling once the job is complete')
      return result
    },
  }
  t.after(() => { delete globalThis.__productImportFixture })
  const { outputFiles } = await build({ entryPoints: ['src/services/productImportService.js'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'upload-fixture', setup(b) {
      b.onResolve({ filter: /uploadService\.js$/ }, () => ({ path: 'upload', namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const authenticatedRequest = (...args) => globalThis.__productImportFixture.start(...args); export const authenticatedGet = (...args) => globalThis.__productImportFixture.poll(...args);` }))
    } }],
  })
  const { importProduct } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  // Resolve only the client's polling delay; no real scraper/network is used.
  t.mock.method(globalThis, 'setTimeout', callback => { queueMicrotask(callback); return 0 })
  return { importProduct, calls }
}

const job = { status: 'processing', job_id: 'job-fixture', poll_token: 'private-poll-token', request_id: 'original-request-id' }

test('client starts one asynchronous import and only polls that job until completion', async t => {
  const product = { name: 'Pack WC Oxy', price: 145 }
  const { importProduct, calls } = await importerFixture(t, { start: job, polls: [{ status: 'processing' }, { status: 'complete', product }] })
  assert.deepEqual(await importProduct('https://shop.example/product'), product)
  assert.deepEqual(JSON.parse(calls[0].args[1]), { url: 'https://shop.example/product', async: true })
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET', 'GET'])
  assert.equal(calls[1].args[0], '/api/import-product/job-fixture')
  assert.deepEqual(calls[1].args[1], { 'x-product-import-token': 'private-poll-token' })
})

test('client retries transient polling failures without starting another paid request', async t => {
  const product = { name: 'Product', price: 20 }
  const error = Object.assign(new Error('proxy unavailable'), { status: 502 })
  const { importProduct, calls } = await importerFixture(t, { start: job, polls: [error, { status: 'processing' }, { status: 'complete', product }] })
  assert.deepEqual(await importProduct('https://shop.example/product'), product)
  assert.equal(calls.filter(call => call.method === 'POST').length, 1)
})

test('client preserves terminal provider errors and never retries the scrape', async t => {
  const failure = Object.assign(new Error('Connection failed'), { status: 502, code: 'PRODUCT_SCRAPER_NETWORK', requestId: 'original-request-id' })
  const { importProduct, calls } = await importerFixture(t, { start: job, polls: [failure] })
  await assert.rejects(importProduct('https://shop.example/product'), error => error === failure)
  assert.equal(calls.length, 2)
})

test('client remains compatible with a synchronous backend during deployment', async t => {
  const product = { name: 'Product', price: 20 }
  const { importProduct, calls } = await importerFixture(t, { start: product, polls: [] })
  assert.deepEqual(await importProduct('https://shop.example/product'), product)
  assert.equal(calls.length, 1)
})

test('browser diagnostics separate the original import ID from a failed poll ID', async t => {
  const reports = []
  const failure = Object.assign(new Error('Proxy error'), { status: 502, requestId: 'proxy-poll-request-id', apiJson: false })
  const { importProduct } = await importerFixture(t, { start: job, polls: [failure, failure, failure, failure] })
  await assert.rejects(importProduct('https://shop.example/product?token=private-url-token', { onDiagnostic: value => reports.push(value) }), error => error === failure)
  const last = reports.at(-1)
  assert.equal(last.phase, 'error')
  assert.equal(last.client_version, 5)
  assert.equal(last.request_id, job.request_id)
  assert.equal(last.poll_request_id, 'proxy-poll-request-id')
  assert.equal(last.api_json, false)
  assert.equal(last.http_status, 502)
  assert.doesNotMatch(JSON.stringify(reports), /private-url-token|private-poll-token/)
})

test('browser diagnostics retain server trace details on a terminal import failure', async t => {
  const reports = []
  const failure = Object.assign(new Error('Incomplete page'), { status: 422, code: 'PRODUCT_PAGE_INCOMPLETE', requestId: job.request_id, apiJson: true,
    diagnostic: { request_id: job.request_id, importer_version: 5, events: [{ transport: 'zenrows', phase: 'result', upstreamStatus: 200, contentType: 'text/plain', bytes: 170087, body: 'private-body' }] },
  })
  const { importProduct } = await importerFixture(t, { start: job, polls: [failure] })
  await assert.rejects(importProduct('https://shop.example/product', { onDiagnostic: value => reports.push(value) }))
  const last = reports.at(-1)
  assert.equal(last.importer_version, 5)
  assert.equal(last.api_json, true)
  assert.equal(last.events[0].contentType, 'text/plain')
  assert.equal(last.events[0].upstreamStatus, 200)
  assert.doesNotMatch(JSON.stringify(reports), /private-body/)
})

test('a failed job arrives over HTTP 200 and remains an actionable error in the web', async t => {
  const reports = []
  const { importProduct, calls } = await importerFixture(t, { start: job, polls: [{ status: 'error', error: 'No se pudo conectar con ZenRows.', code: 'PRODUCT_SCRAPER_NETWORK', http_status: 502, request_id: job.request_id,
    diagnostic: { importer_version: 5, request_id: job.request_id, events: [{ phase: 'request', transport: 'zenrows', networkCode: 'ECONNRESET' }] },
  }] })
  await assert.rejects(importProduct('https://shop.example/product', { onDiagnostic: value => reports.push(value) }), error => {
    assert.equal(error.code, 'PRODUCT_SCRAPER_NETWORK')
    assert.equal(error.status, 502)
    assert.equal(error.responseStatus, 200)
    assert.match(error.message, /original-request-id/)
    return true
  })
  assert.equal(calls.length, 2)
  assert.equal(reports.at(-1).http_status, 200)
  assert.equal(reports.at(-1).api_json, true)
  assert.equal(reports.at(-1).events[0].networkCode, 'ECONNRESET')
})
