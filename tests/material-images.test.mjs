import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import dns from 'node:dns/promises'
import express from 'express'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { optimizeMaterialImage, downloadMaterialImage, materialImageLimit, boundedMaterialImageUrl } from '../server/materialImages.js'
import { registerMaterialImageRoutes } from '../server/materialImageRoutes.js'
import { isOptimizedMaterialImage } from '../src/utils/materialImages.js'

const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const materialId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const storage = 'https://storage.example'
const httpFetch = globalThis.fetch
const imageUrl = 'https://shop.example/product.png'
const ownUrl = `${storage}/storage/v1/object/public/material-images/${projectId}/optimized/${materialId}.webp`

test('images become small WebP files with bounded dimensions, correct orientation and no EXIF', async () => {
  const original = await sharp(randomBytes(1800 * 1400 * 3), { raw: { width: 1800, height: 1400, channels: 3 } }).png().toBuffer()
  const result = await optimizeMaterialImage(original)
  const meta = await sharp(result.data).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.width, 1200)
  assert.ok(meta.height <= 1200)
  assert.ok(result.size < original.length / 3)
  const rotated = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: 'red' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const adjusted = await optimizeMaterialImage(rotated)
  const adjustedMeta = await sharp(adjusted.data).metadata()
  assert.equal(adjustedMeta.width, 750)
  assert.equal(adjustedMeta.height, 1200)
  assert.equal(adjustedMeta.exif, undefined)
  const transparent = await sharp({ create: { width: 120, height: 80, channels: 4, background: '#00000000' } }).png().toBuffer()
  const smallMeta = await sharp((await optimizeMaterialImage(transparent)).data).metadata()
  assert.equal(smallMeta.width, 120)
  assert.equal(smallMeta.height, 80)
  assert.equal(smallMeta.hasAlpha, true)
  console.log(`Image proof: ${original.length} bytes -> ${result.size} bytes`)
})

test('invalid, oversized and vector files cannot be stored as product photos', async () => {
  await assert.rejects(optimizeMaterialImage(Buffer.alloc(materialImageLimit + 1)), error => error.status === 413)
  await assert.rejects(optimizeMaterialImage(Buffer.from('<html>Blocked</html>')), error => error.status === 415)
  await assert.rejects(optimizeMaterialImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')), error => error.status === 415)
})

test('remote images keep DNS pinning, type/byte limits and reject private redirects', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  let options, mode = 'redirect'
  t.mock.method(globalThis, 'fetch', async (_url, config) => {
    options = config
    if (mode === 'html') return new Response('Not an image', { headers: { 'content-type': 'text/html' } })
    if (mode === 'large') return new Response(Buffer.alloc(materialImageLimit + 1), { headers: { 'content-type': 'image/png' } })
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })
  })
  await assert.rejects(downloadMaterialImage(imageUrl), /red interna/)
  assert.equal(options.redirect, 'manual')
  assert.equal(options.headers.Authorization, undefined)
  assert.ok(options.dispatcher)
  mode = 'html'
  await assert.rejects(downloadMaterialImage(imageUrl), error => error.status === 415)
  mode = 'large'
  await assert.rejects(downloadMaterialImage(imageUrl), error => error.status === 413)
})

test('only optimizer URLs in our storage are treated as ready', () => {
  assert.equal(isOptimizedMaterialImage(ownUrl, storage), true)
  for (const url of [imageUrl, ownUrl.replace('storage.example', 'shop.example'), ownUrl.replace('/optimized/', '/'), 'invalid', null]) {
    assert.equal(isOptimizedMaterialImage(url, storage), false)
  }
})

test('authenticated upload, URL copy and existing conversion use the same optimizer and preserve failed sources', async t => {
  const png = await sharp({ create: { width: 1800, height: 1600, channels: 3, background: 'blue' } }).png().toBuffer()
  const realFetch = httpFetch
  const diagnosticLogs = []
  t.mock.method(console, 'warn', (...args) => diagnosticLogs.push(args))
  const uploads = [], patches = [], queries = []
  let remoteCalls = 0, blockImage = false, patchConflict = false, patchFailure = false
  let material = { id: materialId, main_image_url: imageUrl, title: 'Tile' }
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const value = String(url)
    if (value === imageUrl) {
      remoteCalls++
      assert.equal(options.headers.Authorization, undefined)
      return blockImage ? new Response('Blocked', { status: 403 }) : new Response(png, { headers: { 'content-type': 'image/png' } })
    }
    assert.equal(options.headers.Authorization, 'Bearer user-token')
    assert.equal(options.headers.apikey, 'anon-key')
    if (value.startsWith(`${storage}/storage/v1/object/material-images/`)) {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Content-Type'], 'image/webp')
      assert.match(options.headers['Cache-Control'], /31536000/)
      assert.match(value, new RegExp(`/${projectId}/optimized/[0-9a-f-]+\\.webp$`))
      uploads.push(options.body)
      assert.equal((await sharp(options.body).metadata()).width, 1200)
      return Response.json({})
    }
    const query = new URL(value)
    assert.equal(query.searchParams.get('project_id'), `eq.${projectId}`)
    assert.equal(query.searchParams.get('id'), `eq.${materialId}`)
    if (options.method === 'PATCH') {
      const change = JSON.parse(options.body)
      patches.push(change)
      assert.deepEqual(Object.keys(change), ['main_image_url'])
      assert.equal(query.searchParams.get('main_image_url'), `eq.${material.main_image_url}`)
      if (patchFailure) return Response.json({}, { status: 503 })
      if (patchConflict) return Response.json([])
      material = { ...material, ...change }
      return Response.json([material])
    }
    queries.push(query)
    return Response.json(material ? [material] : [])
  })
  const app = express()
  app.use(express.json())
  const requireSession = (req, res, next) => {
    if (req.get('Authorization') !== 'Bearer user-token') return res.sendStatus(401)
    req.authUser = { id: 'user' }; req.uploadAuthorization = 'Bearer user-token'; next()
  }
  registerMaterialImageRoutes(app, { requireSession, getRequestProjectId: async () => projectId, supabaseUrl: storage, supabaseKey: 'anon-key' })
  app.use((error, _req, res, _next) => res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'Bad upload' }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (route, body, authenticated = true) => realFetch(`${base}${route}`, { method: 'POST', headers: { ...(authenticated ? { Authorization: 'Bearer user-token' } : {}), ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}) }, body })
  const route = `/api/materials/${materialId}/optimize-image`
  try {
    assert.equal((await post('/api/material-images', '{}', false)).status, 401)
    assert.equal((await post(route, '{}', false)).status, 401)
    const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'tile.png')
    const fileResponse = await post('/api/material-images', form)
    assert.equal(fileResponse.status, 200, await fileResponse.clone().text())
    const file = await fileResponse.json()
    assert.equal(file.width, 1200)
    assert.equal(typeof file.timings_ms.compression, 'number')
    assert.match(fileResponse.headers.get('server-timing'), /compression;dur=/)
    assert.equal(isOptimizedMaterialImage(file.url, storage), true)
    const copied = await post('/api/material-images', JSON.stringify({ url: imageUrl }))
    assert.equal(copied.status, 200)
    assert.equal(uploads.length, 2)
    assert.deepEqual(uploads[0], uploads[1], 'file and URL follow identical processing')
    const reused = await post('/api/material-images', JSON.stringify({ url: file.url }))
    assert.equal((await reused.json()).reused, true)
    assert.equal(uploads.length, 2)
    const converted = await post(route, '{}')
    assert.equal(converted.status, 200)
    const saved = await converted.json()
    assert.equal(saved.material.main_image_url, saved.url)
    assert.equal(uploads.length, 3)
    const calls = remoteCalls
    assert.equal((await (await post(route, '{}')).json()).skipped, true)
    assert.equal(remoteCalls, calls)
    material.main_image_url = imageUrl
    blockImage = true
    const blocked = await post(route, '{}')
    assert.equal(blocked.status, 422)
    const blockedDiagnostic = await blocked.json()
    assert.equal(blockedDiagnostic.stage, 'download')
    assert.equal(blockedDiagnostic.upstream_status, 403)
    assert.equal(typeof blockedDiagnostic.timings_ms.download, 'number')
    assert.equal(JSON.stringify(diagnosticLogs).includes('user-token'), false)
    assert.equal(material.main_image_url, imageUrl)
    assert.equal(patches.length, 1)
    blockImage = false; patchConflict = true
    assert.equal((await post(route, '{}')).status, 409)
    assert.equal(material.main_image_url, imageUrl)
    patchConflict = false; patchFailure = true
    assert.equal((await post(route, '{}')).status, 502)
    assert.equal(material.main_image_url, imageUrl)
    const invalid = new FormData(); invalid.append('file', new Blob(['<html/>'], { type: 'image/png' }), 'fake.png')
    assert.equal((await post('/api/material-images', invalid)).status, 415)
    assert.equal((await post('/api/materials/not-an-id/optimize-image', '{}')).status, 400)
    material = null
    assert.equal((await post(route, '{}')).status, 404)
  } finally { await new Promise(resolve => server.close(resolve)) }
})


test('ADEO originals are downloaded at bounded resolution without changing other providers', () => {
  const original = 'https://media.adeo.com/media/3459612/media.jpg'
  const bounded = new URL(boundedMaterialImageUrl(original))
  assert.equal(bounded.hostname, 'media.adeo.com')
  assert.equal(bounded.pathname, '/media/3459612/media.jpg')
  assert.equal(bounded.searchParams.get('width'), '1200')
  assert.equal(bounded.searchParams.get('height'), '1200')
  assert.equal(bounded.searchParams.get('format'), 'webp')
  const oversized = new URL(boundedMaterialImageUrl(original + '?width=8192&height=8192&quality=100'))
  assert.equal(oversized.searchParams.get('width'), '1200')
  const small = new URL(boundedMaterialImageUrl(original + '?width=125&height=125'))
  assert.equal(small.searchParams.get('width'), '125')
  for (const url of ['https://shop.example/media.jpg?width=8192', 'https://media.adeo.com.evil.example/media/1/media.jpg']) assert.equal(boundedMaterialImageUrl(url), url)
})

test('download applies the ADEO bound before fetching the image', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.searchParams.get('width'), '1200')
    assert.equal(url.searchParams.get('height'), '1200')
    return new Response('image bytes', { headers: { 'content-type': 'image/webp' } })
  })
  assert.equal((await downloadMaterialImage('https://media.adeo.com/media/3459612/media.jpg')).toString(), 'image bytes')
})

test('oversized pixel headers are rejected clearly without decoding huge image data', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer()
  png.writeUInt32BE(8192, 16); png.writeUInt32BE(8192, 20)
  let crc = 0xffffffff
  for (const byte of png.subarray(12, 29)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  png.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29)
  await assert.rejects(optimizeMaterialImage(png), error => error.status === 413 && /40 millones/.test(error.message))
})
