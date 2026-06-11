import { supabase } from './supabaseClient'

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

export async function deleteMaterial(id) {
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', id)

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
  const { data: user } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('material_categories')
    .insert([{ name, user_id: user?.user?.id }])
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
  const { data: user } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ name, user_id: user?.user?.id }])
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
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('category_budgets')
    .select('*')
    .eq('user_id', user.user.id)

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

export async function upsertCategoryBudget(categoryId, budgetAmount) {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('category_budgets')
    .upsert(
      { user_id: user.user.id, category_id: categoryId, budget_amount: budgetAmount },
      { onConflict: 'user_id,category_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
