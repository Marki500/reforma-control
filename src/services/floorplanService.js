import { authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { supabase } from './supabaseClient'
import { removeStoredFile } from './storageCleanup'
import { getCurrentProjectId } from './workspaceService'
import { validatePlan } from '../utils/floorPlan'

export async function getFloorPlans() {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function getFloorPlan(id) {
  const { data, error } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function createFloorPlan({ name, image_url }) {
  const { data, error } = await supabase
    .from('floor_plans')
    .insert({
      project_id: await getCurrentProjectId(),
      name,
      image_url,
    })
    .select()
    .single()
  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function updateFloorPlan(id, updates) {
  const { data, error } = await supabase
    .from('floor_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function deleteFloorPlan(plan) {
  if (plan.image_url) await removeStoredFile('images', plan.image_url)
  const { error } = await supabase
    .from('floor_plans')
    .delete()
    .eq('id', plan.id)
  if (error) throw error
}

export async function saveInteractiveFloorPlan({ id, name, plan_data, updated_at }) {
  if (!name.trim() || name.length > 120 || !validatePlan(plan_data)) throw new Error('Revisa el nombre y las medidas del plano antes de guardar.')
  const values = { name: name.trim(), plan_data, updated_at: new Date().toISOString() }
  const query = updated_at
    ? supabase.from('floor_plans').update(values).eq('id', id).eq('updated_at', updated_at)
    : supabase.from('floor_plans').insert({ ...values, id, project_id: await getCurrentProjectId() })
  const { data, error } = await query.select().maybeSingle()
  if (error) {
    if (error.code === 'PGRST204' || error.code === '42703') throw new Error('El guardado del editor 2D necesita actualizar la base de datos. Puedes exportar el plano mientras se activa.')
    if (error.code === '23505' && !updated_at) {
      const saved = await getFloorPlan(id)
      if (saved.name === values.name && JSON.stringify(saved.plan_data) === JSON.stringify(plan_data)) return saved
      throw new Error('Este plano ya existe con otros cambios. Cierra el editor y vuelve a abrirlo antes de guardar.')
    }
    throw error
  }
  if (!data) throw new Error('El plano ha cambiado o ya no tienes permiso para editarlo. Exporta tu versión antes de volver a abrirlo.')
  return data
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return authenticatedUpload('/api/upload-file', formData)
}
