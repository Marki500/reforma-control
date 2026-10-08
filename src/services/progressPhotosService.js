import { supabase } from './supabaseClient'
import { authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { storageObjectPath } from '../utils/progressPhotos'

export async function getProgressPhotos() {
  const { data, error } = await supabase.from('progress_photos').select('*, rooms(name)').order('taken_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function uploadProgressPhoto(file) {
  const body = new FormData()
  body.append('file', file)
  return authenticatedUpload('/api/upload-file', body)
}

export async function saveProgressPhoto(id, form, imageUrl) {
  const payload = {
    title: form.title.trim(), phase: form.phase, taken_date: form.taken_date,
    room_id: form.room_id || null, notes: form.notes.trim(), updated_at: new Date().toISOString(),
  }
  let query
  if (id) query = supabase.from('progress_photos').update(payload).eq('id', id)
  else {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data.user) throw new Error('Inicia sesión de nuevo.')
    query = supabase.from('progress_photos').insert({ ...payload, image_url: imageUrl, user_id: data.user.id })
  }
  const { data, error } = await query.select('*, rooms(name)').single()
  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function deleteProgressPhoto(photo) {
  const path = storageObjectPath(photo.image_url)
  if (path) {
    const { error: storageError } = await supabase.storage.from('images').remove([path])
    if (storageError) throw storageError
  }
  const { data, error } = await supabase.from('progress_photos').delete().eq('id', photo.id).select('id').single()
  if (error) throw error
  return data
}
