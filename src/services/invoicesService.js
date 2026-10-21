import { supabase } from './supabaseClient'
import { getCurrentProjectId } from './workspaceService'
import { analyzeBudgetPDF } from './budgetPDFService'
import { invoiceExtensions, invoiceMimeTypes } from '../utils/invoices'
import { retryProjectFileCleanup } from '../utils/projectDeletion'

export async function getInvoices() {
  const { data, error } = await supabase.from('invoices').select('*, expenses(id, amount, paid_amount, due_date, category), suppliers(name)').order('issued_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function analyzeInvoice(file, options = {}) { return analyzeBudgetPDF(file, { ...options, kind: 'invoice' }) }

export async function uploadInvoice(file, invoiceId, onPrepared = () => {}) {
  if (!invoiceMimeTypes.includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Selecciona un PDF, JPG, PNG o WebP de hasta 20 MB.')
  const projectId = await getCurrentProjectId()
  const path = `${projectId}/${invoiceId}.${invoiceExtensions[file.type]}`
  onPrepared({ file_path: path, file_type: file.type, file_size: file.size })
  const { error } = await supabase.storage.from('invoices').upload(path, file, { contentType: file.type, upsert: false })
  // Deterministic names allow a retry after a lost upload/registration response.
  if (error && String(error.statusCode) !== '409') throw error
  return { file_path: path, file_type: file.type, file_size: file.size }
}

export async function registerInvoice(form, upload, id, analysis) {
  const { data, error } = await supabase.rpc('register_invoice', {
    p_invoice: {
      ...form, ...upload, id,
      line_items: analysis?.line_items || [], ai_extracted: Boolean(analysis), ai_model: analysis?.model || '',
    },
    p_expense_id: form.expense_id || null,
  })
  if (error?.code === '23505') throw new Error('Ya existe esta factura para el mismo proveedor, o el gasto elegido ya tiene una factura. Revisa los registros antes de continuar.')
  if (error) throw error
  return data
}

export async function getInvoiceFile(invoice) {
  const { data, error } = await supabase.storage.from('invoices').createSignedUrl(invoice.file_path, 300)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('No se pudo abrir la factura.')
  return data.signedUrl
}

export async function deleteInvoice(id) {
  const { error } = await supabase.rpc('delete_invoice', { p_invoice_id: id })
  if (error) throw error
  return retryProjectFileCleanup(supabase)
}

export async function discardInvoiceUpload(id, upload) {
  if (!upload) return
  const { error } = await supabase.rpc('discard_invoice_upload', { p_invoice_id: id, p_path: upload.file_path })
  if (error) throw error
  return retryProjectFileCleanup(supabase)
}
