import { supabase } from './supabaseClient'

export async function getBudgetPDFs() {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name)')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getBudgetPDFsByCategory(categoryId) {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name)')
    .eq('user_id', user.user.id)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createBudgetPDF(pdf) {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('budget_pdfs')
    .insert([{ ...pdf, user_id: user.user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBudgetPDF(id) {
  const { error } = await supabase
    .from('budget_pdfs')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function uploadPDF(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload-pdf', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Error al subir PDF')
  }

  return response.json()
}
