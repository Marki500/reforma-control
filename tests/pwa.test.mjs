import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('PWA manifest exposes installable NIVEL icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.name, 'NIVEL · Control de obra')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'))
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'))
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'))
})

test('generated launcher icons have the declared PNG dimensions', async () => {
  for (const [name, expected] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
    const png = await readFile(new URL(`../public/icons/${name}`, import.meta.url))
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(png.readUInt32BE(16), expected, name)
    assert.equal(png.readUInt32BE(20), expected, name)
  }
})

test('service worker excludes API requests from its cache', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/)
})
