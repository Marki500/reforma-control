import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { Agent } from 'undici'

export class RemoteFetchError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'RemoteFetchError'
    this.status = status
  }
}

export function normalizeRemoteUrl(value) {
  let url = String(value || '').trim()
  url = url.replace(/^['"<]+|['">]+$/g, '').replaceAll('\\', '')
  if (/^www\./i.test(url)) url = `https://${url}`
  return url
}

const trackingParameterNames = new Set([
  'awc', 'aw_affid', 'dclid', 'fbclid', 'gad_source', 'gclid',
  'sv1', 'sv_campaign_id', 'utm_id',
])

export function canonicalizeRemoteUrl(value) {
  const url = parseRemoteUrl(value)
  for (const name of [...url.searchParams.keys()]) {
    if (name.toLowerCase().startsWith('utm_') || trackingParameterNames.has(name.toLowerCase())) {
      url.searchParams.delete(name)
    }
  }
  return url.href
}

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => (value * 256) + Number(part), 0) >>> 0
}

function inIpv4Range(address, base, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask)
}

export function isPublicIp(address) {
  const version = net.isIP(address)
  if (version === 4) {
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
      ['224.0.0.0', 4],
    ]
    return !blocked.some(([base, prefix]) => inIpv4Range(address, base, prefix))
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    if (normalized === '::' || normalized === '::1') return false
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return false
    if (normalized.startsWith('ff') || normalized.startsWith('2001:db8:')) return false
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPublicIp(mapped[1]) : true
  }
  return false
}

export function parseRemoteUrl(value) {
  let url
  try { url = new URL(normalizeRemoteUrl(value)) } catch { throw new RemoteFetchError('URL inválida.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new RemoteFetchError('Solo se permiten direcciones http o https.')
  if (url.username || url.password) throw new RemoteFetchError('La URL no puede incluir credenciales.')
  if (!url.hostname) throw new RemoteFetchError('URL inválida.')
  return url
}

async function resolvePublicAddresses(hostname) {
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new RemoteFetchError('La dirección apunta a una red interna o reservada.')
    return [{ address: hostname, family: net.isIP(hostname) }]
  }
  let addresses
  try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }) } catch {
    throw new RemoteFetchError('No se pudo resolver el dominio.', 502)
  }
  if (!addresses.length) throw new RemoteFetchError('El dominio no tiene una dirección válida.', 502)
  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw new RemoteFetchError('El dominio apunta a una red interna o reservada.')
  }
  return addresses
}

export function createPinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  }
}

function requestOnce(url, addresses, { headers, timeoutMs, maxBytes }) {
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: 'GET',
      headers: { 'Accept-Encoding': 'identity', ...headers },
      servername: url.hostname,
      lookup: createPinnedLookup(addresses),
    }, response => {
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > maxBytes) {
          request.destroy(new RemoteFetchError('El contenido remoto supera el tamaño permitido.', 413))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }))
    })
    request.setTimeout(timeoutMs, () => request.destroy(new RemoteFetchError('La página tardó demasiado en responder.', 504)))
    request.on('error', error => reject(error instanceof RemoteFetchError ? error : new RemoteFetchError(
      error?.code === 'ECONNRESET'
        ? 'La tienda cerró la conexión antes de responder. Inténtalo de nuevo.'
        : 'No se pudo conectar con la tienda.',
      502,
    )))
    request.end()
  })
}

async function requestWithFetch(url, addresses, { headers, timeoutMs, maxBytes }) {
  // Keep the validated DNS addresses fixed even when using the native fetch client.
  // Redirects remain manual so fetchRemote validates every new destination.
  const dispatcher = new Agent({ connect: { lookup: createPinnedLookup(addresses) } })
  try {
    const response = await fetch(url, {
      headers, dispatcher, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
    })
    const chunks = []
    let size = 0
    for await (const chunk of response.body || []) {
      size += chunk.length
      if (size > maxBytes) throw new RemoteFetchError('El contenido remoto supera el tamaño permitido.', 413)
      chunks.push(Buffer.from(chunk))
    }
    return { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.concat(chunks) }
  } catch (error) {
    if (error instanceof RemoteFetchError) throw error
    throw new RemoteFetchError(
      ['TimeoutError', 'AbortError'].includes(error?.name)
        ? 'La página tardó demasiado en responder.'
        : 'No se pudo conectar con la tienda.',
      ['TimeoutError', 'AbortError'].includes(error?.name) ? 504 : 502,
    )
  } finally {
    await dispatcher.destroy()
  }
}

export async function fetchRemote(value, options = {}) {
  const {
    headers = {}, timeoutMs = 10000, maxBytes = 2 * 1024 * 1024,
    maxRedirects = 4, allowedContentTypes = [], useNativeFetch = false,
  } = options
  let url = parseRemoteUrl(value)
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const addresses = await resolvePublicAddresses(url.hostname)
    const request = useNativeFetch ? requestWithFetch : requestOnce
    const result = await request(url, addresses, { headers, timeoutMs, maxBytes })
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      if (redirects === maxRedirects) throw new RemoteFetchError('La URL tiene demasiadas redirecciones.', 502)
      const location = result.headers.location
      if (!location) throw new RemoteFetchError('La redirección no contiene un destino.', 502)
      url = parseRemoteUrl(new URL(location, url).href)
      continue
    }
    if (result.status < 200 || result.status >= 300) {
      const message = result.status === 403
        ? 'La tienda bloquea la extracción automática. Introduce los datos manualmente.'
        : `La página respondió con HTTP ${result.status}.`
      throw new RemoteFetchError(message, result.status >= 500 ? 502 : 422)
    }
    const contentType = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (allowedContentTypes.length && !allowedContentTypes.some(type => contentType === type || contentType.startsWith(`${type}/`))) {
      throw new RemoteFetchError('El contenido remoto no tiene un formato permitido.', 415)
    }
    return { ...result, contentType, finalUrl: url.href }
  }
  throw new RemoteFetchError('No se pudo descargar el contenido remoto.', 502)
}
