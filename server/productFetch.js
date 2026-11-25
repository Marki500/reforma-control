import { load } from 'cheerio'
import { canonicalizeRemoteUrl, fetchRemote, remoteResponseDiagnostic, RemoteFetchError } from './remoteFetch.js'
import { extractProductPrice, structuredProducts } from './productPrice.js'

const maxBytes = 5 * 1024 * 1024
const contentTypes = ['text/html', 'application/xhtml+xml']

function inspectPage(response, url) {
  const $ = load(response.body.toString('utf8'))
  let structured = false
  $('script[type="application/ld+json"]').each((_, el) => {
    try { structured ||= structuredProducts(JSON.parse($(el).text())).length > 0 } catch {}
  })
  const price = extractProductPrice($, new URL(url).hostname.replace(/^www\./, ''))
  const heading = $('h1').first().text().trim()
  const hasProduct = structured || Boolean(heading && price !== null)
  const upstream = remoteResponseDiagnostic(response)
  // Real product pages can also include anti-bot scripts. Don't reject those.
  const blocked = !hasProduct && Boolean(upstream.protection ||
    /just a moment|access denied|verify you are human|checking your browser|captcha|enable (?:javascript|js)/i.test($('title').text() + ' ' + heading + ' ' + $('#cmsg').text()))
  return { hasProduct, price, blocked, upstream }
}

function importError(message, code, status, diagnostic) {
  const error = new RemoteFetchError(message, status)
  error.code = code
  error.diagnostic = diagnostic
  return error
}

export function createProductFetcher({ apiKey = '', remote = fetchRemote } = {}) {
  const key = apiKey.trim()
  let active = 0

  return async function fetchProduct(value, { onDiagnostic } = {}) {
    const url = canonicalizeRemoteUrl(value)
    let direct, directPage, failure
    try {
      direct = await remote(url, {
        useNativeFetch: true, maxBytes, timeoutMs: 15000,
        allowedContentTypes: contentTypes, onDiagnostic,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache', 'Upgrade-Insecure-Requests': '1',
        },
      })
      directPage = inspectPage(direct, url)
      if (directPage.hasProduct && directPage.price !== null) return direct
      failure = importError(
        directPage.blocked ? 'La tienda bloquea la importación automática.' : 'No se ha podido leer la ficha del producto.',
        directPage.blocked ? 'STORE_ACCESS_DENIED' : 'PRODUCT_PAGE_INCOMPLETE', 422,
        { ...directPage.upstream, transport: 'native-fetch-pinned' },
      )
    } catch (error) {
      // Invalid URLs, private networks, 404s and unsupported files never use a paid fallback.
      const status = error?.diagnostic?.upstreamStatus
      if (![403, 429].includes(status) && !(status >= 500) && error?.diagnostic?.phase !== 'request') throw error
      failure = error
    }

    if (!key) {
      if (directPage?.hasProduct && !directPage.blocked) return direct
      throw failure
    }
    if (active >= 2) {
      throw importError('Hay otras importaciones en curso. Vuelve a intentarlo en unos segundos.', 'PRODUCT_IMPORT_BUSY', 429)
    }
    active++
    try {
      const endpoint = new URL('https://api.zenrows.com/v1/')
      endpoint.search = new URLSearchParams({ url, apikey: key, mode: 'auto', proxy_country: 'es' }).toString()
      onDiagnostic?.({ transport: 'zenrows', phase: 'fallback', upstreamStatus: failure.diagnostic?.upstreamStatus || null })
      // Fixed HTTPS endpoint, no redirects, no user cookies or application credentials.
      const result = await remote(endpoint.href, {
        useNativeFetch: true, maxBytes, timeoutMs: 185000, maxRedirects: 0,
        // ZenRows can return raw HTML with a text/plain content type. The
        // product/challenge checks below still validate the actual content.
        allowedContentTypes: [...contentTypes, 'text/plain'],
        onDiagnostic: upstream => onDiagnostic?.({
          transport: 'zenrows', phase: 'response', upstreamStatus: upstream.upstreamStatus,
          contentType: upstream.contentType, bytes: upstream.bytes, elapsedMs: upstream.elapsedMs,
        }),
      })
      const page = inspectPage(result, url)
      const diagnostic = { transport: 'zenrows', upstreamStatus: result.status, protection: page.upstream.protection, contentType: result.contentType, bytes: result.body.length }
      onDiagnostic?.({ ...diagnostic, phase: 'result', hasProduct: page.hasProduct, hasPrice: page.price !== null })
      if (page.blocked || !page.hasProduct) {
        throw importError(
          page.blocked ? 'La tienda sigue bloqueando el acceso tras el segundo intento automático.' : 'La tienda no ha devuelto una ficha de producto legible.',
          page.blocked ? 'STORE_ACCESS_DENIED' : 'PRODUCT_PAGE_INCOMPLETE', 422, diagnostic,
        )
      }
      return { ...result, finalUrl: url, transport: 'zenrows' }
    } catch (error) {
      if (error?.code && error instanceof RemoteFetchError) throw error
      const status = error?.diagnostic?.upstreamStatus
      const networkCode = /^(?:[A-Z][A-Z0-9_]{1,79}|TimeoutError|AbortError|TypeError)$/.test(error?.diagnostic?.networkCode || '') ? error.diagnostic.networkCode : null
      const timedOut = error?.status === 504
      const code = timedOut ? 'PRODUCT_SCRAPER_TIMEOUT'
        : ['dns', 'request'].includes(error?.diagnostic?.phase) ? 'PRODUCT_SCRAPER_NETWORK'
        : error?.status === 415 ? 'PRODUCT_SCRAPER_INVALID_RESPONSE'
        : [401, 403].includes(status) ? 'PRODUCT_SCRAPER_AUTH_FAILED'
        : [402, 429].includes(status) ? 'PRODUCT_SCRAPER_LIMIT' : 'PRODUCT_SCRAPER_FAILED'
      const message = timedOut ? 'El servicio de importación ha agotado el tiempo de espera. Inténtalo más tarde.'
        : code === 'PRODUCT_SCRAPER_NETWORK' ? 'El servidor no pudo conectarse con el servicio de importación. Revisa la conexión del servidor con ZenRows.'
        : code === 'PRODUCT_SCRAPER_INVALID_RESPONSE' ? 'El servicio de importación devolvió un formato inesperado.'
        : code === 'PRODUCT_SCRAPER_AUTH_FAILED' ? 'El servicio de importación no pudo autenticarse. Contacta con quien administra la aplicación.'
        : code === 'PRODUCT_SCRAPER_LIMIT' ? 'El servicio de importación ha alcanzado su límite. Inténtalo más tarde.'
          : 'El segundo intento automático no ha podido recuperar la ficha. Inténtalo más tarde.'
      // Never propagate provider URLs, error bodies or credentials to logs or the client.
      throw importError(message, code, timedOut ? 504 : 502, {
        transport: 'zenrows', upstreamStatus: status || null,
        phase: ['dns', 'request', 'content-type'].includes(error?.diagnostic?.phase) ? error.diagnostic.phase : 'response',
        networkCode, failureStatus: error instanceof RemoteFetchError ? error.status : null,
      })
    } finally {
      active--
    }
  }
}
