import assert from 'node:assert/strict'
import { test } from 'node:test'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { normalizeStorageUrl } from '../src/utils/storageUrl.js'

test('legacy links keep object paths; external links are not rewritten', () => {
  const old = 'https://api-reforma.bycram.dev/storage/v1/object/public/budget-pdfs/a.pdf?download=1#page=2'
  assert.equal(normalizeStorageUrl(old), 'https://api-reforma.noxumlab.com/storage/v1/object/public/budget-pdfs/a.pdf?download=1#page=2')
  assert.equal(normalizeStorageUrl(old, 'https://custom.example'), 'https://custom.example/storage/v1/object/public/budget-pdfs/a.pdf?download=1#page=2')
  for (const url of ['https://shop.example/image.jpg', 'https://api-reforma.bycram.dev/product', 'invalid', null]) {
    assert.equal(normalizeStorageUrl(url), url)
  }
})

test('uploads require a valid user and forward that user to Storage', async () => {
  const uploads = []
  const mock = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/auth/v1/user') {
      const valid = req.headers.authorization === 'Bearer test-user-token'
      res.writeHead(valid ? 200 : 401)
      res.end(JSON.stringify(valid ? { id: 'test-user' } : { error: 'Invalid token' }))
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    uploads.push({ url: req.url, headers: req.headers, size: Buffer.concat(chunks).length })
    res.end('{}')
  })
  mock.listen(0, '127.0.0.1')
  await once(mock, 'listening')
  const mockUrl = `http://127.0.0.1:${mock.address().port}`
  const reservation = http.createServer()
  reservation.listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), SUPABASE_URL: mockUrl, SUPABASE_ANON_KEY: 'test-anon-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', chunk => { log += chunk })
  child.stderr.on('data', chunk => { log += chunk })
  const base = `http://127.0.0.1:${port}`
  try {
    let ready = false
    for (let i = 0; i < 60; i++) {
      try { ready = (await fetch(`${base}/api/health`)).ok } catch {}
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, log)
    for (const endpoint of ['upload-file', 'upload-pdf', 'upload-image']) {
      const anonymous = await fetch(`${base}/api/${endpoint}`, { method: 'POST' })
      assert.equal(anonymous.status, 401)
      const invalid = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: { Authorization: 'Bearer invalid' } })
      assert.equal(invalid.status, 401)
    }
    assert.equal(uploads.length, 0)
    for (const [endpoint, type, filename, bucket] of [
      ['upload-file', 'image/png', 'test.png', 'images'],
      ['upload-pdf', 'application/pdf', 'test.pdf', 'budget-pdfs'],
    ]) {
      const body = new FormData()
      body.append('file', new Blob(['test-only-content'], { type }), filename)
      const response = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: { Authorization: 'Bearer test-user-token' }, body })
      assert.equal(response.status, 200, await response.clone().text())
      assert.ok((await response.json()).url.startsWith(`${mockUrl}/storage/v1/object/public/${bucket}/`))
    }
    assert.equal(uploads.length, 2)
    for (const upload of uploads) {
      assert.equal(upload.headers.authorization, 'Bearer test-user-token')
      assert.equal(upload.headers.apikey, 'test-anon-key')
      assert.equal(upload.size, 17)
    }
  } finally {
    const stopped = once(child, 'exit')
    child.kill()
    await stopped
    mock.closeAllConnections()
    await new Promise(resolve => mock.close(resolve))
  }
})
