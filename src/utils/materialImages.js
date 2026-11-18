// Only URLs produced by our optimizer count as optimized. An external .webp
// still needs copying into our own storage.
export function isOptimizedMaterialImage(value, baseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://api-reforma.noxumlab.com') {
  try {
    const url = new URL(value)
    const base = new URL(baseUrl)
    return url.origin === base.origin && /^\/storage\/v1\/object\/public\/material-images\/[0-9a-f-]{36}\/optimized\/[0-9a-f-]{36}\.webp$/.test(url.pathname)
  } catch { return false }
}
