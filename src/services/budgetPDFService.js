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
  let health
  try {
    const response = await fetch('/api/health', { cache: 'no-store' })
    health = await response.json()
  } catch {
    throw new Error('Fase: comprobación del servidor · No se pudo consultar la versión desplegada.')
  }
  if (health?.features?.ai_budget_async !== 3) {
    throw new Error(`Fase: comprobación del servidor · Coolify está sirviendo una versión anterior (${health?.release || 'sin versión'}). Haz un redeploy sin caché.`)
  }
  const formData = new FormData()
  formData.append('file', file)
  let job
  try {
    job = await authenticatedRequest('/api/analyze-budget', formData)
  } catch (error) {
    throw new Error(`Fase: envío del PDF · ${error.message}`)
  }
  if (!job.job_id || !job.poll_token) throw new Error(`El servidor no inició el análisis. Diagnóstico: ${job.request_id || 'sin identificador'}`)
  let transientFailures = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1500))
    try {
      const result = await authenticatedGet(`/api/analyze-budget/${encodeURIComponent(job.job_id)}`, { 'x-request-id': job.request_id, 'x-analysis-token': job.poll_token })
      if (result.status === 'complete') return result
      transientFailures = 0
    } catch (error) {
      if (/proxy tardó|No se pudo conectar con el servidor/i.test(error.message) && transientFailures < 4) {
        transientFailures += 1
        continue
      }
      throw new Error(`Fase: procesamiento del PDF · ${error.message}`)
    }
  }
  throw new Error(`El análisis sigue tardando más de lo esperado. Diagnóstico: ${job.request_id}`)
}
