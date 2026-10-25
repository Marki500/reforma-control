import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import { test } from 'node:test'
import { canonicalizeRemoteUrl, createPinnedLookup, fetchRemote, isPublicIp, parseRemoteUrl } from '../server/remoteFetch.js'

test('native product transport preserves manual redirects and destroys its dispatcher', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  let dispatcher
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://shop.example/product')
    assert.equal(options.redirect, 'manual')
    assert.ok(options.signal instanceof AbortSignal)
    dispatcher = options.dispatcher
    return new Response('<h1>Product</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
  })
  const result = await fetchRemote('https://shop.example/product', { useNativeFetch: true, allowedContentTypes: ['text/html'] })
  assert.equal(result.body.toString(), '<h1>Product</h1>')
  assert.equal(result.contentType, 'text/html')
  assert.ok(dispatcher)
  assert.equal(dispatcher.destroyed, true)
})

test('native product transport rejects private redirect destinations before requesting them', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }))
  await assert.rejects(fetchRemote('https://shop.example/product', { useNativeFetch: true }), /red interna/)
  assert.equal(fetch.mock.callCount(), 1)
})

test('native product transport limits decoded bytes and rejects disallowed content types', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  t.mock.method(globalThis, 'fetch', async () => new Response('123456', { headers: { 'content-type': 'application/json' } }))
  await assert.rejects(fetchRemote('https://shop.example/product', { useNativeFetch: true, maxBytes: 5 }), error => error.status === 413)
  await assert.rejects(fetchRemote('https://shop.example/product', { useNativeFetch: true, allowedContentTypes: ['text/html'] }), error => error.status === 415)
})

test('native transport maps timeout and blocked responses to application errors', async t => {
  t.mock.method(dns, 'lookup', async () => [{ address: '1.1.1.1', family: 4 }])
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timeout', 'TimeoutError') })
  await assert.rejects(fetchRemote('https://shop.example/product', { useNativeFetch: true }), error => error.status === 504)
  fetch.mock.mockImplementation(async () => new Response('blocked', { status: 403 }))
  await assert.rejects(fetchRemote('https://shop.example/product', { useNativeFetch: true }), /bloquea/)
})

test('URL validation and pinned DNS lookup remain in effect', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '::1', 'fd00::1']) assert.equal(isPublicIp(ip), false)
  assert.throws(() => parseRemoteUrl('https://user:password@example.com'))
  assert.throws(() => parseRemoteUrl('file:///secret'))
  assert.equal(canonicalizeRemoteUrl('https://shop.example/product?utm_source=ad&color=red'), 'https://shop.example/product?color=red')
  const addresses = [{ address: '1.1.1.1', family: 4 }]
  const lookup = createPinnedLookup(addresses)
  lookup('shop.example', { all: true }, (error, result) => { assert.ifError(error); assert.deepEqual(result, addresses) })
  lookup('shop.example', {}, (error, ip, family) => { assert.ifError(error); assert.equal(ip, '1.1.1.1'); assert.equal(family, 4) })
  await assert.rejects(fetchRemote('http://127.0.0.1/secret', { useNativeFetch: true }), /red interna/)
})
