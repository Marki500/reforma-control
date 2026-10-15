import { supabase } from './supabaseClient'
import { removeStoredFile } from './storageCleanup'
import { getCurrentProjectId } from './workspaceService'

export async function createMaterial(material) {
  const { data, error } = await supabase
    .from('materials')
    .insert([material])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMaterial(id, updates) {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteMaterial(material) {
  await removeStoredFile('material-images', material.main_image_url)
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', material.id)

  if (error) throw error
}

export async function uploadImage(file, userId) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  const { error } = await supabase.storage
    .from('material-images')
    .upload(fileName, file)

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('material-images')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('material_categories')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function createCategory(name) {
  const projectId = await getCurrentProjectId()
  const { data, error } = await supabase
    .from('material_categories')
    .insert([{ name, project_id: projectId }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCategory(id, name) {
  const { data, error } = await supabase
    .from('material_categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const { error } = await supabase
    .from('material_categories')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function createRoom(name) {
  const projectId = await getCurrentProjectId()
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ name, project_id: projectId }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateRoom(id, name) {
  const { data, error } = await supabase
    .from('rooms')
    .update({ name })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteRoom(id) {
  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getCategoryBudgets() {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('project_id', projectId)

  if (error) throw error
  return data || []
}

export async function toggleCountInTotal(id, value) {
  const { data, error } = await supabase
    .from('materials')
    .update({ count_in_total: value })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getDashboardGridConfig() {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('dashboard_grid_config')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw error
  return data || { num_columns: 3, num_rows: 2 }
}

export async function upsertDashboardGridConfig(numColumns, numRows) {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('dashboard_grid_config')
    .upsert(
      { project_id: projectId, num_columns: numColumns, num_rows: numRows },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getDashboardGridCells() {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('dashboard_grid_cells')
    .select('*, material_categories(name)')
    .eq('project_id', projectId)
    .order('row_index')
    .order('col_index')

  if (error) throw error
  return data || []
}

export async function saveDashboardGridCells(cells) {
  const projectId = await getCurrentProjectId()
  const payload = cells.map((c) => ({
    project_id: projectId,
    category_id: c.category_id || null,
    budget_amount: c.budget_amount || 0,
    row_index: c.row_index,
    col_index: c.col_index,
  }))

  const { data, error } = await supabase
    .from('dashboard_grid_cells')
    .upsert(payload, { onConflict: 'project_id,row_index,col_index' })
    .select()

  if (error) throw error
  return data
}

export async function deleteDashboardGridCells() {
  const projectId = await getCurrentProjectId()

  const { error } = await supabase
    .from('dashboard_grid_cells')
    .delete()
    .eq('project_id', projectId)

  if (error) throw error
}

export async function upsertCategoryBudget(categoryId, budgetAmount) {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('category_budgets')
    .upsert(
      { project_id: projectId, category_id: categoryId, budget_amount: budgetAmount },
      { onConflict: 'project_id,category_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
