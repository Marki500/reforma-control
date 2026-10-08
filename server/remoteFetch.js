import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

export class RemoteFetchError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'RemoteFetchError'
    this.status = status
  }
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
  try { url = new URL(value) } catch { throw new RemoteFetchError('URL inválida.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new RemoteFetchError('Solo se permiten direcciones http o https.')
  if (url.username || url.password) throw new RemoteFetchError('La URL no puede incluir credenciales.')
  if (!url.hostname) throw new RemoteFetchError('URL inválida.')
  return url
}

async function resolvePublicAddress(hostname) {
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new RemoteFetchError('La dirección apunta a una red interna o reservada.')
    return { address: hostname, family: net.isIP(hostname) }
  }
  let addresses
  try { addresses = await dns.lookup(hostname, { all: true, verbatim: true }) } catch {
    throw new RemoteFetchError('No se pudo resolver el dominio.', 502)
  }
  if (!addresses.length) throw new RemoteFetchError('El dominio no tiene una dirección válida.', 502)
  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw new RemoteFetchError('El dominio apunta a una red interna o reservada.')
  }
  return addresses[0]
}

function requestOnce(url, address, { headers, timeoutMs, maxBytes }) {
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: 'GET',
      headers: { 'Accept-Encoding': 'identity', ...headers },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
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
    request.on('error', error => reject(error instanceof RemoteFetchError ? error : new RemoteFetchError('No se pudo descargar el contenido remoto.', 502)))
    request.end()
  })
}

export async function fetchRemote(value, options = {}) {
  const {
    headers = {}, timeoutMs = 10000, maxBytes = 2 * 1024 * 1024,
    maxRedirects = 4, allowedContentTypes = [],
  } = options
  let url = parseRemoteUrl(value)
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const address = await resolvePublicAddress(url.hostname)
    const result = await requestOnce(url, address, { headers, timeoutMs, maxBytes })
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
      throw new RemoteFetchError(message, 502)
    }
    const contentType = String(result.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (allowedContentTypes.length && !allowedContentTypes.some(type => contentType === type || contentType.startsWith(`${type}/`))) {
      throw new RemoteFetchError('El contenido remoto no tiene un formato permitido.', 415)
    }
    return { ...result, contentType, finalUrl: url.href }
  }
  throw new RemoteFetchError('No se pudo descargar el contenido remoto.', 502)
}
