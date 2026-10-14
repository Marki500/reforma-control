import { authenticatedGet, authenticatedRequest, authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { supabase } from './supabaseClient'
import { removeStoredFile } from './storageCleanup'

export async function getBudgetPDFs() {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name), suppliers(id, name, trade)')
    .eq('user_id', user.user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function getBudgetPDFsByCategory(categoryId) {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name), suppliers(id, name, trade)')
    .eq('user_id', user.user.id)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
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
  return normalizeStorageRecord(data)
}

export async function deleteBudgetPDF(pdf) {
  await removeStoredFile('budget-pdfs', pdf.file_url)
  const { error } = await supabase
    .from('budget_pdfs')
    .delete()
    .eq('id', pdf.id)

  if (error) throw error
}

export async function acceptBudgetPDF(id) {
  const { data, error } = await supabase.rpc('accept_budget_pdf', { p_budget_id: id })
  if (error) throw error
  return data
}

export async function updateBudgetPDF(id, changes) {
  const { data, error } = await supabase
    .from('budget_pdfs')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, material_categories(name), suppliers(id, name, trade)')
    .single()

  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function uploadPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  return authenticatedUpload('/api/upload-pdf', formData)
}

export async function analyzeBudgetPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  const job = await authenticatedRequest('/api/analyze-budget', formData)
  if (!job.job_id) throw new Error(`El servidor no inició el análisis. Diagnóstico: ${job.request_id || 'sin identificador'}`)
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    const result = await authenticatedGet(`/api/analyze-budget/${encodeURIComponent(job.job_id)}`)
    if (result.status === 'complete') return result
  }
  throw new Error(`El análisis sigue tardando más de lo esperado. Diagnóstico: ${job.request_id}`)
}
