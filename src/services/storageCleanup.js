import { supabase } from './supabaseClient'

export function storagePathForBucket(url, bucket) {
  if (!url) return null
  if (!String(url).includes('://')) return String(url).replace(/^\/+/, '')
  try {
    const parsed = new URL(url)
    const marker = `/storage/v1/object/public/${bucket}/`
    const index = parsed.pathname.indexOf(marker)
    return index === -1 ? null : decodeURIComponent(parsed.pathname.slice(index + marker.length))
  } catch { return null }
}

export async function removeStoredFile(bucket, url) {
  const path = storagePathForBucket(url, bucket)
  if (!path) return false
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
  return true
}
