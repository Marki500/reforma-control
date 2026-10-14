import { supabase } from './supabaseClient'

export async function authenticatedRequest(endpoint, body, headers = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Inicia sesión de nuevo para subir archivos.')
  let response
  const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${data.session.access_token}`, 'x-request-id': requestId },
      body,
    })
  } catch {
    throw new Error(`No se pudo conectar con el servidor. Diagnóstico: ${requestId}`)
  }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const diagnosticId = result?.request_id || response.headers.get('x-request-id') || requestId
    if (!result && [502, 504].includes(response.status)) {
      throw new Error(`El servidor o el proxy tardó demasiado en responder. Diagnóstico: ${diagnosticId}`)
    }
    const reason = result?.code ? ` · ${result.code}` : ''
    throw new Error(`${result?.error || `La operación no se pudo completar (HTTP ${response.status}).`}${reason} · Diagnóstico: ${diagnosticId}`)
  }
  if (!result) throw new Error('El servidor devolvió una respuesta no válida.')
  return result
}

export async function authenticatedUpload(endpoint, body, headers = {}) {
  const result = await authenticatedRequest(endpoint, body, headers)
  if (!result.url) throw new Error('El servidor no devolvió la dirección del archivo.')
  return result
}
