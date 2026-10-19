import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { pdfFixture } from './pdfFixtures.mjs'

for (const provider of ['openrouter', 'gemini']) test(`${provider}: empty text extraction retries visually once; empty visual extraction fails without a draft`, { timeout: 60000 }, async () => {
  const requests = [], reservations = []
  let failAll = false
  const mock = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    if (req.url === '/auth/v1/user') return res.end(JSON.stringify({ id: req.headers.authorization }))
    if (req.url === '/rest/v1/rpc/reserve_ai_usage') {
      reservations.push(req.headers.authorization)
      return res.end(JSON.stringify([{ allowed: true, user_used: 1, user_limit: 10, global_used: reservations.length, global_limit: 40 }]))
    }
    if (req.url === '/chat/completions' || req.url.endsWith(':generateContent')) {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body)
      const vision = provider === 'gemini' ? body.contents[0].parts.some(part => part.inline_data) : body.messages[0].content.some(part => part.type === 'image_url')
      const draft = { is_budget: true, supplier_name: 'Proveedor ejemplo', total_amount: vision && !failAll ? 121 : null, line_items: [], warnings: ['Prueba sintetica'] }
      return res.end(JSON.stringify(provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] } : { choices: [{ message: { content: JSON.stringify(draft) } }] }))
    }
    res.writeHead(404); res.end('{}')
  })
  mock.listen(0, '127.0.0.1'); await once(mock, 'listening')
  const mockUrl = `http://127.0.0.1:${mock.address().port}`
  const socket = http.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening')
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), SUPABASE_URL: mockUrl, SUPABASE_ANON_KEY: 'test-anon', AI_PROVIDER: provider, AI_FREE_ONLY: provider === 'gemini' ? 'false' : 'true', GEMINI_API_KEY: 'test-gemini', GEMINI_API_BASE_URL: mockUrl, OPENROUTER_API_KEY: 'test-free', OPENROUTER_API_BASE_URL: mockUrl, OPENROUTER_MODEL: 'openrouter/free' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''; child.stdout.on('data', chunk => { log += chunk }); child.stderr.on('data', chunk => { log += chunk })
  const base = `http://127.0.0.1:${port}`
  try {
    let ready = false
    for (let i = 0; i < 150; i++) {
      try { ready = (await fetch(`${base}/api/health`)).ok } catch {}
      if (ready || child.exitCode !== null) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, log)
    for (const fail of [false, true]) {
      failAll = fail
      const body = new FormData(); body.append('file', new Blob([pdfFixture()], { type: 'application/pdf' }), 'quote.pdf')
      const start = await fetch(`${base}/api/analyze-budget`, { method: 'POST', headers: { Authorization: `Bearer vision-test-${fail}` }, body })
      assert.equal(start.status, 202, await start.clone().text())
      const job = await start.json()
      let result, status
      for (let i = 0; i < 150; i++) {
        const poll = await fetch(`${base}/api/analyze-budget/${job.job_id}`, { headers: { 'x-analysis-token': job.poll_token } })
        status = poll.status; result = await poll.json()
        if (status !== 202) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      if (fail) {
        assert.equal(status, 422, JSON.stringify(result))
        assert.equal(result.code, 'AI_EXTRACTION_INCOMPLETE')
        assert.equal(result.draft, undefined)
      } else {
        assert.equal(status, 200, JSON.stringify(result))
        assert.equal(result.reading_mode, 'vision')
        assert.equal(result.draft.total_amount, 121)
      }
    }
    assert.equal(reservations.length, 2, 'one internal quota reservation per analysis, including retry')
    assert.equal(requests.length, 4, 'at most one visual retry per text extraction')
    for (const [i, request] of requests.entries()) {
      const images = provider === 'gemini' ? request.contents[0].parts.filter(part => part.inline_data) : request.messages[0].content.filter(part => part.type === 'image_url')
      assert.equal(images.length, i % 2)
      if (provider === 'gemini' && images.length) {
        assert.equal(images[0].inline_data.mime_type, 'image/png')
        assert.match(images[0].inline_data.data, /^iVBOR/)
      }
      assert.equal('plugins' in request, false)
      assert.doesNotMatch(JSON.stringify(request), /AUTOR_METADATA/)
    }
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped }
    mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve))
  }
})
