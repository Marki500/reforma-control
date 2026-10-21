import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

for (const mode of ['navigate', 'cors']) {
  for (const cacheFails of [false, true]) {
    test(`service worker serves ${mode} responses while cache is delayed${cacheFails ? ' and fails' : ''}`, async () => {
      const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
      const handlers = {}
      const pending = []
      const warnings = []
      let result
      let releaseCache
      let storedBody
      const cacheReady = new Promise(resolve => { releaseCache = resolve })
      runInNewContext(worker, {
        URL,
        self: {
          location: { origin: 'https://nivel.test' },
          addEventListener: (type, handler) => { handlers[type] = handler },
        },
        fetch: async () => new Response('network body'),
        caches: {
          match: async () => undefined,
          open: async () => {
            await cacheReady
            if (cacheFails) throw new Error('Cache unavailable')
            return { put: async (key, response) => { storedBody = await response.text() } }
          },
        },
        console: { warn: (...args) => warnings.push(args) },
      })
      handlers.fetch({
        request: { method: 'GET', url: 'https://nivel.test/assets/app.js', mode },
        respondWith: promise => { result = promise },
        waitUntil: promise => pending.push(promise),
      })
      // Consume the browser's response before caches.open resolves, reproducing the race.
      assert.equal(await (await result).text(), 'network body')
      assert.equal(pending.length, 1)
      releaseCache()
      await Promise.all(pending)
      assert.equal(storedBody, cacheFails ? undefined : 'network body')
      assert.equal(warnings.length, cacheFails ? 1 : 0)
    })
  }
}

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
