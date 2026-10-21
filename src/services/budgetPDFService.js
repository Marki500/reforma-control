import { authenticatedGet, authenticatedRequest, authenticatedUpload } from './uploadService'
import { normalizeStorageRecord } from '../utils/storageUrl'
import { supabase } from './supabaseClient'
import { removeStoredFile } from './storageCleanup'
import { getCurrentProjectId } from './workspaceService'

export async function getBudgetPDFs() {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name), suppliers(id, name, trade)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function getBudgetPDFsByCategory(categoryId) {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('budget_pdfs')
    .select('*, material_categories(name), suppliers(id, name, trade)')
    .eq('project_id', projectId)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeStorageRecord)
}

export async function createBudgetPDF(pdf) {
  const projectId = await getCurrentProjectId()

  const { data, error } = await supabase
    .from('budget_pdfs')
    .insert([{ ...pdf, project_id: projectId }])
    .select()
    .single()

  if (error) throw error
  return normalizeStorageRecord(data)
}

export async function createBudgetWithSupplier(stage) {
  const { data, error } = await supabase.rpc('create_budget_with_supplier', { p_budget: stage.budget, p_supplier: stage.supplier, p_project: stage.projectId })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Falta aplicar la migración 00031 para crear proveedores desde presupuestos.')
    throw error
  }
  if (!data?.id || !data?.supplier_id) throw new Error('No se pudo confirmar el guardado. Reintenta con el mismo borrador.')
  return data
}

// A lost response may hide a committed transaction: check before removing its PDF.
export async function discardPendingBudget(stage) {
  const { data, error } = await supabase.rpc('resolve_budget_supplier_upload', { p_id: stage.budget.id, p_project: stage.projectId })
  if (error) throw error
  if (data?.saved === true) return { saved: true }
  if (data?.saved !== false) throw new Error('No se pudo comprobar el guardado. No se ha eliminado el archivo.')
  await removeStoredFile('budget-pdfs', stage.budget.file_url)
  return { saved: false }
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

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function analysisError(message, { transient = false } = {}) {
  const error = new Error(message)
  error.transient = transient
  return error
}

async function pollBudgetAnalysis(job) {
  let response
  try {
    response = await fetch(`/api/${job.documentKind === 'invoice' ? 'analyze-invoice' : 'analyze-budget'}/${encodeURIComponent(job.job_id)}`, {
      cache: 'no-store',
      headers: {
        'x-request-id': job.request_id,
        'x-analysis-token': job.poll_token,
      },
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw analysisError(`No se pudo conectar temporalmente con el servidor. Diagnóstico: ${job.request_id}`, { transient: true })
  }

  const result = await response.json().catch(() => null)
  const diagnosticId = result?.request_id || response.headers.get('x-request-id') || job.request_id
  if (!response.ok) {
    // An error with a code comes from our API and must be shown immediately. An
    // unstructured 502/503/504 normally comes from the reverse proxy and is safe to retry.
    if (!result?.code && [502, 503, 504].includes(response.status)) {
      throw analysisError(`El servidor o el proxy no respondió temporalmente. Diagnóstico: ${diagnosticId}`, { transient: true })
    }
    const reason = result?.code ? ` · ${result.code}` : ''
    throw analysisError(`${result?.error || `La operación no se pudo completar (HTTP ${response.status}).`}${reason} · Diagnóstico: ${diagnosticId}`)
  }
  if (!result) throw analysisError(`El servidor devolvió una respuesta no válida. Diagnóstico: ${diagnosticId}`, { transient: true })
  return result
}

export async function analyzeBudgetPDF(file, { kind = 'budget' } = {}) {
  let health
  try {
    const response = await fetch('/api/health', { cache: 'no-store' })
    health = await response.json()
  } catch {
    throw new Error('Fase: comprobación del servidor · No se pudo consultar la versión desplegada.')
  }
  if (kind === 'invoice' && health?.features?.ai_invoice_async !== 1) throw new Error('El servidor todavía no tiene habilitado el análisis de facturas. Puedes rellenar los datos manualmente.')
  if (health?.features?.ai_budget_async !== 6) {
    throw new Error(`Fase: comprobación del servidor · Coolify está sirviendo una versión anterior (${health?.release || 'sin versión'}). Haz un redeploy sin caché.`)
  }
  const formData = new FormData()
  formData.append('file', file)
  let job
  try {
    job = await authenticatedRequest(kind === 'invoice' ? '/api/analyze-invoice' : '/api/analyze-budget', formData)
  } catch (error) {
    throw new Error(`Fase: envío del documento · ${error.message}`)
  }
  job.documentKind = kind
  if (!job.job_id || !job.poll_token) throw new Error(`El servidor no inició el análisis. Diagnóstico: ${job.request_id || 'sin identificador'}`)
  const analysisDeadline = Date.now() + 5 * 60 * 1000
  let transientFailureStartedAt = null
  while (Date.now() < analysisDeadline) {
    await wait(2000)
    try {
      const result = await pollBudgetAnalysis(job)
      if (result.status === 'complete') return result
      transientFailureStartedAt = null
    } catch (error) {
      if (error.transient) {
        transientFailureStartedAt ||= Date.now()
        if (Date.now() - transientFailureStartedAt < 60 * 1000) continue
      }
      if (error.transient) {
        throw new Error(`Fase: consulta del resultado · El servidor lleva más de un minuto sin responder. El análisis puede seguir ejecutándose. ${error.message}`)
      }
      if (error.message) {
        throw new Error(`Fase: procesamiento del documento · ${error.message}`)
      }
      if (Date.now() < analysisDeadline) {
        continue
      }
      throw error
    }
  }
  throw new Error(`El análisis sigue tardando más de lo esperado. Diagnóstico: ${job.request_id}`)
}

export async function getAIUsage() {
  return authenticatedGet('/api/ai-usage')
}
