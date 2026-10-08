import { supabase } from './supabaseClient'

export async function authenticatedRequest(endpoint, body, headers = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Inicia sesión de nuevo para subir archivos.')
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${data.session.access_token}` },
      body,
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(result?.error || `La operación no se pudo completar (HTTP ${response.status}).`)
  }
  if (!result) throw new Error('El servidor devolvió una respuesta no válida.')
  return result
}

export async function authenticatedUpload(endpoint, body, headers = {}) {
  const result = await authenticatedRequest(endpoint, body, headers)
  if (!result.url) throw new Error('El servidor no devolvió la dirección del archivo.')
  return result
}
