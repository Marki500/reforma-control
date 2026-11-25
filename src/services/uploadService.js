import { supabase } from './supabaseClient'

async function authenticatedFetch(endpoint, { method = 'POST', body, headers = {} } = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Inicia sesión de nuevo para subir archivos.')
  let response
  const requestId = headers['x-request-id'] || headers['X-Request-ID'] || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    response = await fetch(endpoint, {
      method,
      headers: { ...headers, Authorization: `Bearer ${data.session.access_token}`, 'x-request-id': requestId },
      body,
    })
  } catch {
    throw new Error(`No se pudo conectar con el servidor. Diagnóstico: ${requestId}`)
  }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const diagnosticId = result?.request_id || response.headers.get('x-request-id') || requestId
    const proxyMessage = !result && response.status === 502
      ? 'El servidor o el proxy devolvió un error de conexión (HTTP 502).'
      : !result && response.status === 504 ? 'El servidor o el proxy tardó demasiado en responder (HTTP 504).' : null
    const reason = result?.code ? ` · ${result.code}` : ''
    const error = new Error(`${result?.error || proxyMessage || `La operación no se pudo completar (HTTP ${response.status}).`}${reason} · Diagnóstico: ${diagnosticId}`)
    error.status = response.status
    error.code = result?.code || null
    error.stage = result?.stage || null
    error.requestId = diagnosticId
    throw error
  }
  if (!result) throw new Error('El servidor devolvió una respuesta no válida.')
  return result
}

export async function authenticatedRequest(endpoint, body, headers = {}) {
  return authenticatedFetch(endpoint, { method: 'POST', body, headers })
}

export async function authenticatedGet(endpoint, headers = {}) {
  return authenticatedFetch(endpoint, { method: 'GET', headers })
}

export async function authenticatedUpload(endpoint, body, headers = {}) {
  const result = await authenticatedRequest(endpoint, body, headers)
  if (!result.url) throw new Error('El servidor no devolvió la dirección del archivo.')
  return result
}
