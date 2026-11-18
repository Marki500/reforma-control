import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

test('proxy errors retain HTTP status and request ID and do not call every 502 a timeout', async t => {
  const { outputFiles } = await build({ entryPoints: ['src/services/uploadService.js'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'session-fixture', setup(b) {
      b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: 'session', namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } };` }))
    } }],
  })
  const { authenticatedRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  let status = 502
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Proxy error</html>', { status, headers: { 'Content-Type': 'text/html', 'x-request-id': 'proxy-request-id' } }))
  await assert.rejects(authenticatedRequest('/api/material-images', '{}'), error => {
    assert.equal(error.status, 502)
    assert.equal(error.requestId, 'proxy-request-id')
    assert.match(error.message, /HTTP 502/)
    assert.doesNotMatch(error.message, /demasiado/)
    return true
  })
  status = 504
  await assert.rejects(authenticatedRequest('/api/material-images', '{}'), error => error.status === 504 && /demasiado/.test(error.message))
})
