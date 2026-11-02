import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { pdfFixture } from './pdfFixtures.mjs'

for (const provider of ['openrouter', 'gemini']) test(`${provider}: empty text extraction retries visually once; empty visual extraction fails without a draft`, { timeout: 60000 }, async () => {
  const requests = [], reservations = []
  let failAll = false
  const uploads = []
  const mock = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    if (req.url.startsWith('/storage/v1/object/budget-pdfs/')) { uploads.push({ url: req.url, type: req.headers['content-type'], body: Buffer.concat(chunks) }); return res.end('{}') }
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
    failAll = false
    for (const [type, extension] of [['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp']]) {
      const bytes = Buffer.from('image-fixture-for-mocked-provider')
      const uploadBody = new FormData()
      uploadBody.append('file', new Blob([bytes], { type }), `quote${extension}`)
      const uploaded = await fetch(`${base}/api/upload-pdf`, { method: 'POST', headers: { Authorization: 'Bearer upload-image-test' }, body: uploadBody })
      assert.equal(uploaded.status, 200, await uploaded.clone().text())
      const saved = await uploaded.json()
      assert.ok(saved.url.endsWith(extension))
      assert.equal(uploads.at(-1).type, type)
      assert.deepEqual(uploads.at(-1).body, bytes)

      const analysisBody = new FormData()
      analysisBody.append('file', new Blob([bytes], { type }), `quote${extension}`)
      const started = await fetch(`${base}/api/analyze-budget`, { method: 'POST', headers: { Authorization: `Bearer image-test-${type}` }, body: analysisBody })
      assert.equal(started.status, 202, await started.clone().text())
      const job = await started.json()
      let result, status
      for (let i = 0; i < 150; i++) {
        const poll = await fetch(`${base}/api/analyze-budget/${job.job_id}`, { headers: { 'x-analysis-token': job.poll_token } })
        status = poll.status; result = await poll.json()
        if (status !== 202) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      assert.equal(status, 200, JSON.stringify(result))
      assert.equal(result.draft.total_amount, 121)
      assert.equal(result.reading_mode, 'vision')
      const request = requests.at(-1)
      if (provider === 'gemini') {
        const image = request.contents[0].parts.find(part => part.inline_data)
        assert.equal(image.inline_data.mime_type, type)
        assert.equal(image.inline_data.data, bytes.toString('base64'))
      } else {
        const image = request.messages[0].content.find(part => part.type === 'image_url')
        assert.equal(image.image_url.url, `data:${type};base64,${bytes.toString('base64')}`)
      }
    }
    const unsupported = new FormData()
    unsupported.append('file', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'quote.svg')
    const rejected = await fetch(`${base}/api/upload-pdf`, { method: 'POST', headers: { Authorization: 'Bearer upload-image-test' }, body: unsupported })
    assert.equal(rejected.status, 400)
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped }
    mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve))
  }
})
