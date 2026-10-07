// Rewrite only legacy Storage links; product links and other hosts stay intact.
export function normalizeStorageUrl(value, baseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://api-reforma.noxumlab.com') {
  if (!value) return value
  try {
    const url = new URL(value)
    if (url.hostname !== 'api-reforma.bycram.dev' || !url.pathname.startsWith('/storage/v1/')) return value
    const base = new URL(baseUrl)
    return `${base.origin}${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

export function normalizeStorageRecord(record) {
  if (!record) return record
  const result = { ...record }
  for (const field of ['file_url', 'image_url', 'main_image_url']) {
    if (field in result) result[field] = normalizeStorageUrl(result[field])
  }
  return result
}
