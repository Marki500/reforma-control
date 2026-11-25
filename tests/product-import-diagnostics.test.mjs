import test from 'node:test'
import assert from 'node:assert/strict'
import { safeImportDiagnostic, safeImportEvent } from '../src/utils/productImportDiagnostics.js'

test('the browser report preserves useful stages without bodies, URLs or credentials', () => {
  const result = safeImportDiagnostic({ client_version: 5, importer_version: 5, request_id: 'original-import-id', poll_request_id: 'failed-poll-id', http_status: 502, api_json: false,
    url: 'https://secret.example/?apikey=private-key', poll_token: 'private-token',
    events: [{ atMs: 5408, transport: 'zenrows', phase: 'response', upstreamStatus: 200, contentType: 'text/plain', bytes: 170087, body: 'private-body', cookie: 'private-cookie', apikey: 'private-key' },
      { phase: 'request', networkCode: 'ECONNRESET', code: 'PRODUCT_SCRAPER_NETWORK' }],
  })
  const text = JSON.stringify(result)
  for (const secret of ['secret.example', 'apikey', 'private-key', 'private-token', 'private-body', 'private-cookie']) assert.equal(text.includes(secret), false)
  assert.equal(result.events[0].contentType, 'text/plain')
  assert.equal(result.events[0].bytes, 170087)
  assert.equal(result.events[1].networkCode, 'ECONNRESET')
  assert.equal(result.request_id, 'original-import-id')
  assert.equal(result.poll_request_id, 'failed-poll-id')
  assert.equal(result.api_json, false)
})

test('diagnostics remain bounded and tolerate malformed values', () => {
  assert.deepEqual(safeImportDiagnostic(null), {})
  assert.deepEqual(safeImportEvent(null), {})
  const result = safeImportDiagnostic({ request_id: 'https://secret.example', events: [null, ...Array.from({ length: 50 }, (_, i) => ({ atMs: i, phase: 'response' }))] })
  assert.equal(result.events.length, 32)
  assert.equal(result.request_id, undefined)
  assert.deepEqual(safeImportEvent({ phase: 'private-token', transport: 'private-token', atMs: Infinity, networkCode: 'https://private.example', bytes: -1 }), {})
})
