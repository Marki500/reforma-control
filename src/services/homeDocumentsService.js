import { supabase } from './supabaseClient'
import { authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { removeStoredFile } from './storageCleanup'

export async function getHomeDocuments() {
  const { data, error } = await supabase.from('home_documents').select('*').order('expiry_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all((data || []).map(async document => {
    const normalized = normalizeStorageRecord(document)
    const { data: signed } = await supabase.storage.from('home-documents').createSignedUrl(document.file_url, 3600)
    return { ...normalized, access_url: signed?.signedUrl || '' }
  }))
}

export async function uploadHomeDocument(file) {
  const body = new FormData(); body.append('file', file)
  return authenticatedUpload('/api/upload-document', body)
}

export async function createHomeDocument(form, upload) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Inicia sesión de nuevo.')
  const { data, error } = await supabase.from('home_documents').insert({
    user_id: authData.user.id, title: form.title.trim(), document_type: form.document_type,
    file_url: upload.url, file_size: upload.size || 0, document_date: form.document_date || null,
    expiry_date: form.expiry_date || null, notes: form.notes.trim(),
  }).select().single()
  if (error) { await removeStoredFile('home-documents', upload.url).catch(() => {}); throw error }
  const { data: signed } = await supabase.storage.from('home-documents').createSignedUrl(data.file_url, 3600)
  return { ...normalizeStorageRecord(data), access_url: signed?.signedUrl || '' }
}

export async function deleteHomeDocument(document) {
  await removeStoredFile('home-documents', document.file_url)
  const { error } = await supabase.from('home_documents').delete().eq('id', document.id)
  if (error) throw error
}
