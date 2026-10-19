import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'

test('invoice PDF and image analyses use invoice extraction, private polling and the shared quota', { timeout: 60000 }, async () => {
  const requests = [], reservations = []
  const mock = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    if (req.url === '/auth/v1/user') {
      if (!req.headers.authorization?.startsWith('Bearer invoice-test-')) { res.writeHead(401); return res.end('{}') }
      return res.end(JSON.stringify({ id: req.headers.authorization.slice(7) }))
    }
    if (req.url === '/rest/v1/rpc/reserve_ai_usage') {
      reservations.push(req.headers.authorization)
      return res.end(JSON.stringify([{ allowed: true, user_used: 1, user_limit: 10, global_used: reservations.length, global_limit: 40 }]))
    }
    if (req.url === '/chat/completions') {
      requests.push(JSON.parse(Buffer.concat(chunks).toString()))
      return res.end(JSON.stringify({ model: 'free-vision-test', choices: [{ message: { content: JSON.stringify({ is_invoice: true, document_title: 'Factura ventanas', supplier_name: 'Proveedor prueba', supplier_tax_id: 'B12345678', invoice_number: 'F-2026-01', issued_date: '2026-10-19', due_date: '2026-11-01', currency: 'EUR', subtotal: 100, tax_amount: 21, tax_rate: 21, total_amount: 121, line_items: [], warnings: [] }) } }] }))
    }
    res.writeHead(404); res.end('{}')
  })
  mock.listen(0, '127.0.0.1'); await once(mock, 'listening')
  const mockUrl = `http://127.0.0.1:${mock.address().port}`
  const reservation = http.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening')
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), SUPABASE_URL: mockUrl, SUPABASE_ANON_KEY: 'test-anon', AI_PROVIDER: 'groq', AI_FREE_ONLY: 'true', GROQ_API_KEY: 'test-groq', GROQ_MODEL: 'qwen/qwen3.8-27b', GROQ_API_BASE_URL: mockUrl, OPENROUTER_API_KEY: 'test-free', OPENROUTER_API_BASE_URL: mockUrl, OPENROUTER_MODEL: 'openrouter/free', OPENROUTER_PDF_ENGINE: 'pdf-text' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''; child.stdout.on('data', chunk => { log += chunk }); child.stderr.on('data', chunk => { log += chunk }); child.on('error', error => { log += error.message })
  const base = `http://127.0.0.1:${port}`
  try {
    let ready = false
    for (let attempt = 0; attempt < 200; attempt++) {
      try { ready = (await fetch(`${base}/api/health`)).ok } catch {}
      if (ready || child.exitCode !== null) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, log)
    assert.equal((await (await fetch(`${base}/api/health`)).json()).features.ai_invoice_async, 1)
    assert.equal((await fetch(`${base}/api/analyze-invoice`, { method: 'POST' })).status, 401)
    const invalid = new FormData(); invalid.append('file', new Blob(['gif'], { type: 'image/gif' }), 'invalid.gif')
    assert.equal((await fetch(`${base}/api/analyze-invoice`, { method: 'POST', headers: { Authorization: 'Bearer invoice-test-invalid' }, body: invalid })).status, 400)
    assert.equal(reservations.length, 0)
    for (const [index, mime] of ['application/pdf', 'image/png'].entries()) {
      const body = new FormData(); body.append('file', new Blob(['fake-test-document'], { type: mime }), mime === 'image/png' ? 'invoice.png' : 'invoice.pdf')
      const response = await fetch(`${base}/api/analyze-invoice`, { method: 'POST', headers: { Authorization: `Bearer invoice-test-${index}` }, body })
      assert.equal(response.status, 202, await response.clone().text())
      const job = await response.json()
      assert.equal((await fetch(`${base}/api/analyze-invoice/${job.job_id}`)).status, 404)
      assert.equal((await fetch(`${base}/api/analyze-budget/${job.job_id}`, { headers: { 'x-analysis-token': job.poll_token } })).status, 404)
      let result
      for (let attempt = 0; attempt < 100; attempt++) {
        const poll = await fetch(`${base}/api/analyze-invoice/${job.job_id}`, { headers: { 'x-analysis-token': job.poll_token } })
        result = await poll.json()
        if (poll.status !== 202) { assert.equal(poll.status, 200, JSON.stringify(result)); break }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      assert.equal(result.status, 'complete')
      assert.equal(result.draft.is_invoice, true)
      assert.equal(result.draft.invoice_number, 'F-2026-01')
      assert.equal(result.draft.total_amount, 121)
      assert.equal('paid_amount' in result.draft, false)
    }
    assert.equal(reservations.length, 2, 'Groq fallback must not reserve another quota usage')
    assert.equal(requests.length, 2)
    assert.match(requests[0].messages[0].content[0].text, /is_invoice/)
    assert.match(requests[0].messages[0].content[1].file.file_data, /^data:application\/pdf;base64,/)
    assert.equal(requests[0].plugins[0].pdf.engine, 'pdf-text')
    assert.match(requests[1].messages[0].content[1].image_url.url, /^data:image\/png;base64,/)
    assert.equal('plugins' in requests[1], false, 'images must not be sent to the PDF parser')
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped }
    mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve))
  }
})
