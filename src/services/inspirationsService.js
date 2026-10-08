import { authenticatedRequest, authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { supabase } from './supabaseClient'

export async function getInspirations() {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('inspirations')
    .select('*, rooms(name)')
    .eq('user_id', user.user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function createInspiration(inspiration) {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('inspirations')
    .insert([{ ...inspiration, user_id: user.user.id }])
    .select()
    .single()

  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function updateInspiration(id, updates) {
  const { data, error } = await supabase
    .from('inspirations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function deleteInspiration(id) {
  const { error } = await supabase
    .from('inspirations')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function reorderInspirations(ids) {
  const updates = ids.map((id, index) => ({
    id,
    sort_order: index,
  }))

  const { error } = await supabase
    .from('inspirations')
    .upsert(updates)

  if (error) throw error
}

export async function extractFromUrl(url) {
  return authenticatedRequest('/api/extract-inspiration', JSON.stringify({ url }), { 'Content-Type': 'application/json' })
}

export async function uploadImageFromUrl(url) {
  return authenticatedUpload('/api/upload-image', JSON.stringify({ url }), { 'Content-Type': 'application/json' })
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return authenticatedUpload('/api/upload-file', formData)
}
