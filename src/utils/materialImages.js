// Only URLs produced by our optimizer count as optimized. An external .webp
// still needs copying into our own storage.
export function isOptimizedMaterialImage(value, baseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://api-reforma.noxumlab.com') {
  try {
    const url = new URL(value)
    const base = new URL(baseUrl)
    return url.origin === base.origin && /^\/storage\/v1\/object\/public\/material-images\/[0-9a-f-]{36}\/optimized\/[0-9a-f-]{36}\.webp$/.test(url.pathname)
  } catch { return false }
}

// ADEO supplies the images for Obramat and Leroy Merlin. Its original
// images can be 8192 x 8192; ask the existing CDN for a bounded version
// before downloading, without raising the decoder's pixel/memory limit.
export function boundedMaterialImageUrl(value) {
  try {
    const url = new URL(value)
    if (url.hostname !== 'media.adeo.com' || !/^\/media\/[^/]+\/media\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)) return value
    for (const dimension of ['width', 'height']) {
      const existing = Number(url.searchParams.get(dimension))
      url.searchParams.set(dimension, String(existing > 0 ? Math.max(1, Math.min(1200, Math.floor(existing))) : 1200))
    }
    url.searchParams.set('fit', 'bounds')
    url.searchParams.set('format', 'webp')
    url.searchParams.set('quality', '80')
    return url.href
  } catch { return value }
}
