import test from 'node:test'
import assert from 'node:assert/strict'
import { measureRead, materialsDiagnosticReport, sampleFrames } from '../src/utils/materialsDiagnostics.js'

test('read measurements preserve values and failures without adding requests', async () => {
  const timings = {}; let clock = 0, calls = 0
  assert.equal(await measureRead('materials', async () => { calls++; clock = 120; return 42 }, timings, () => clock), 42)
  assert.equal(calls, 1)
  assert.equal(timings.materials, 120)
  const failure = new Error('failed')
  await assert.rejects(measureRead('rooms', async () => { clock += 55; throw failure }, timings, () => clock), error => error === failure)
  assert.equal(timings.rooms, 55)
})

test('the copied report excludes full URLs, queries and tokens while preserving timings and failed products', () => {
  const report = materialsDiagnosticReport({ load: { materials_ms: 1400 }, materialCount: 120, pageCount: 5,
    images: [{ name: 'Tile', host: 'shop.example', failed: true, ms: 5000 }, { name: 'Tap', host: 'storage.example', failed: false, ms: 1200 }],
    failures: [{ material: 'Tile', reason: 'Shop blocked', status: 422, stage: 'download', request_id: 'request-example' }],
    resources: [
      { name: 'https://api.example/rest/v1/materials?apikey=secret-key&title=private-query', duration: 1400, startTime: 100, encodedBodySize: 0 },
      { name: 'https://api.example/auth/v1/user?access_token=secret-token', duration: 500 },
      { name: 'https://cdn.example/photo?token=secret-image', initiatorType: 'img', duration: 2000 },
    ],
  })
  const output = JSON.stringify(report)
  for (const secret of ['https://', 'apikey', 'secret-key', 'private-query', 'access_token', 'secret-token', 'secret-image']) assert.equal(output.includes(secret), false, secret)
  assert.equal(report.load.materials_ms, 1400)
  assert.equal(report.image_errors[0].name, 'Tile')
  assert.equal(report.slow_images[0].name, 'Tap')
  assert.equal(report.optimization_failures[0].stage, 'download')
  assert.equal(report.requests[0].bytes, null)
  assert.equal(report.requests[0].resource, 'datos:materials')
})

test('the optional frame probe reports actual frame gaps and cleans up', async () => {
  const originalRequest = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame
  let time = 0, frames = 0, cancelled = 0
  globalThis.requestAnimationFrame = callback => {
    frames++; time += frames === 3 ? 90 : 16
    const timestamp = time
    queueMicrotask(() => callback(timestamp))
    return frames
  }
  globalThis.cancelAnimationFrame = () => { cancelled++ }
  try {
    const result = await sampleFrames(100)
    assert.equal(result.supported, true)
    assert.equal(result.max_gap_ms, 90)
    assert.equal(result.gaps_over_50ms, 1)
    assert.ok(cancelled > 0)
  } finally {
    if (originalRequest) globalThis.requestAnimationFrame = originalRequest; else delete globalThis.requestAnimationFrame
    if (originalCancel) globalThis.cancelAnimationFrame = originalCancel; else delete globalThis.cancelAnimationFrame
  }
})
