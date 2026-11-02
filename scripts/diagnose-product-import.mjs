import { fetchRemote } from '../server/remoteFetch.js'

const urls = process.argv.slice(2)
if (!urls.length) urls.push('https://www.obramat.es/productos/aerotermo-acs-250l-nuos-fit-s2-ariston-25112023.html')
const oldHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.google.com/',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1', 'Cache-Control': 'no-cache', Pragma: 'no-cache', DNT: '1',
}
const currentHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache', 'Upgrade-Insecure-Requests': '1',
}

// Run only with public product URLs. The legacy client is for diagnosis, not API use:
// it does not have the application's DNS pinning or redirect protections.
for (const url of urls) {
  if (new URL(url).protocol !== 'https:') throw new Error('Use a public HTTPS product URL.')
  console.log(JSON.stringify({ url, node: process.version }))
  for (const [label, legacy, headers] of [
    ['fixed-pinned-fetch', false, currentHeaders],
    ['current', false, currentHeaders],
    ['legacy', true, oldHeaders],
    ['legacy-client-current-headers', true, currentHeaders],
    ['current-client-old-headers', false, { ...oldHeaders, 'Accept-Encoding': 'identity' }],
  ]) {
    const start = Date.now()
    try {
      let body, status, contentType
      if (legacy) {
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
        status = response.status
        contentType = response.headers.get('content-type')
        body = await response.text()
      } else {
        const response = await fetchRemote(url, { headers, timeoutMs: 15000, maxBytes: 5 * 1024 * 1024, useNativeFetch: label === 'fixed-pinned-fetch', onDiagnostic: diagnostic => console.log(JSON.stringify({ label, diagnostic })) })
        status = response.status
        contentType = response.contentType
        body = response.body.toString('utf8')
      }
      console.log(JSON.stringify({ label, status, contentType, bytes: Buffer.byteLength(body),
        hasProduct: /<h1[^>]*>[\s\S]*?AEROTERMO/i.test(body) || /"@type"\s*:\s*"Product"/.test(body),
        title: body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 160),
        elapsedMs: Date.now() - start }))
    } catch (error) {
      console.log(JSON.stringify({ label, error: error.message, diagnostic: error.diagnostic, cause: error.cause?.code, elapsedMs: Date.now() - start }))
    }
  }
}
