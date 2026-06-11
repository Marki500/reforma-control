import { supabase } from './supabaseClient'

export async function getFloorPlans() {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('id, name, image_url, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getFloorPlan(id) {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createFloorPlan({ name, image_url }) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('floor_plans')
    .insert({
      user_id: userData.user.id,
      name,
      image_url,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateFloorPlan(id, updates) {
  const { data, error } = await supabase
    .from('floor_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFloorPlan(id) {
  const { error } = await supabase
    .from('floor_plans')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload-file', {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Error al subir archivo')
  }
  return response.json()
}
