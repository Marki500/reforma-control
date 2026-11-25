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
