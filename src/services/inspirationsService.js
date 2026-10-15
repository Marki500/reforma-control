import { authenticatedRequest, authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { supabase } from './supabaseClient'
import { removeStoredFile } from './storageCleanup'
import { getCurrentProjectId } from './workspaceService'

export async function getInspirations() {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('inspirations')
    .select('*, rooms(name)')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function createInspiration(inspiration) {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('inspirations')
    .insert([{ ...inspiration, project_id: projectId }])
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

export async function deleteInspiration(inspiration) {
  await removeStoredFile('images', inspiration.image_url)
  const { error } = await supabase
    .from('inspirations')
    .delete()
    .eq('id', inspiration.id)

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
